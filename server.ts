import express from "express";
import path from "path";
import https from "https";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { initializeApp, getApps, getApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

dotenv.config();

// Load projectId from firebase-applet-config.json for Firebase ID token verification (requires no IAM)
let firebaseProjectId = "console-anailda";
try {
  const cfgPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(cfgPath)) {
    const parsed = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
    if (parsed?.projectId) {
      firebaseProjectId = String(parsed.projectId);
    }
  }
} catch {
  // Keep default projectId
}

const adminApp = getApps().length
  ? getApp()
  : initializeApp({ projectId: firebaseProjectId });
const adminAuth = getAuth(adminApp);

interface OrderLookupInput {
  orderId: string;
  orderCode?: string;
  externalReference?: string;
  mercadoPagoOrderId?: string;
  mercadoPagoPaymentId?: string;
  mercadoPagoTransactionId?: string;
  paymentStatus?: string;
  status?: string;
}

interface ResolvedMercadoPagoResult {
  orderId: string;
  orderCode: string;
  found: boolean;
  sourceType: "order" | "payment" | "none";
  sourceMethod: "orders_api" | "payments_api" | "payments_search" | "not_found" | "error";
  providerRefId: string | null;
  mercadoPagoOrderId: string | null;
  mercadoPagoPaymentId: string | null;
  mercadoPagoTransactionId: string | null;
  mercadoPagoTransactionStatus: string | null;
  mercadoPagoTransactionStatusDetail: string | null;
  mpStatus: string | null;
  mpStatusDetail: string | null;
  newStatus: string | null;
  paymentStatus: string | null;
  paidAtIso: string | null;
  error?: string;
}

function mpApiGet(apiPath: string, accessToken: string): Promise<{ statusCode: number; data: any }> {
  return new Promise((resolve, reject) => {
    const options: https.RequestOptions = {
      hostname: "api.mercadopago.com",
      path: apiPath,
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      timeout: 15000,
    };

    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        const statusCode = res.statusCode || 500;
        try {
          resolve({ statusCode, data: body ? JSON.parse(body) : null });
        } catch {
          resolve({ statusCode, data: null });
        }
      });
    });

    req.on("timeout", () => {
      req.destroy(new Error("Tempo esgotado ao consultar o Mercado Pago."));
    });
    req.on("error", (err) => reject(err));
    req.end();
  });
}

function resolveFromPaymentInfo(paymentInfo: any, fallbackPaymentId?: string) {
  const mpStatus = String(paymentInfo?.status || "pending").toLowerCase();
  const mpStatusDetail = paymentInfo?.status_detail ? String(paymentInfo.status_detail) : null;
  const paymentId = String(paymentInfo?.id || fallbackPaymentId || "");

  let newStatus = "pending";
  let paymentStatus = "pending";
  let paidAtIso: string | null = null;

  if (mpStatus === "approved") {
    newStatus = "approved";
    paymentStatus = "paid";
    paidAtIso = paymentInfo?.date_approved ? new Date(paymentInfo.date_approved).toISOString() : null;
  } else if (["pending", "in_process", "authorized", "in_mediation"].includes(mpStatus)) {
    newStatus = "pending";
    paymentStatus = "pending";
  } else if (mpStatus === "refunded") {
    newStatus = "refunded";
    paymentStatus = "refunded";
  } else if (mpStatus === "cancelled" || mpStatus === "canceled") {
    newStatus = "cancelled";
    paymentStatus = "cancelled";
  } else if (["rejected", "charged_back"].includes(mpStatus)) {
    newStatus = "failed";
    paymentStatus = "failed";
  }

  return {
    sourceType: "payment" as const,
    providerRefId: paymentId || null,
    mercadoPagoOrderId: paymentInfo?.order?.id ? String(paymentInfo.order.id) : null,
    mercadoPagoPaymentId: paymentId || null,
    mercadoPagoTransactionId: null,
    mercadoPagoTransactionStatus: null,
    mercadoPagoTransactionStatusDetail: null,
    mpStatus,
    mpStatusDetail,
    newStatus,
    paymentStatus,
    paidAtIso,
  };
}

function resolveFromOrderInfo(orderInfo: any, fallbackOrderId?: string) {
  const mpStatus = String(orderInfo?.status || "pending").toLowerCase();
  const mpStatusDetail = orderInfo?.status_detail ? String(orderInfo.status_detail) : null;
  const mpOrderId = String(orderInfo?.id || fallbackOrderId || "");
  const paymentsList: any[] = Array.isArray(orderInfo?.transactions?.payments)
    ? orderInfo.transactions.payments
    : [];

  const paidTx = paymentsList.find(
    (tx) =>
      String(tx?.status || "").toLowerCase() === "processed" ||
      String(tx?.status || "").toLowerCase() === "approved"
  );
  const primaryTx = paidTx || paymentsList[0] || null;
  const txStatus = primaryTx?.status ? String(primaryTx.status).toLowerCase() : null;
  const txStatusDetail = primaryTx?.status_detail ? String(primaryTx.status_detail).toLowerCase() : null;

  let newStatus = "pending";
  let paymentStatus = "pending";
  let paidAtIso: string | null = null;

  const isOrderApproved =
    (mpStatus === "processed" &&
      (mpStatusDetail === "accredited" || txStatus === "processed" || txStatus === "approved")) ||
    txStatus === "approved" ||
    (txStatus === "processed" && txStatusDetail === "accredited");

  if (isOrderApproved) {
    newStatus = "approved";
    paymentStatus = "paid";
    const rawDate = primaryTx?.date_approved || orderInfo?.last_updated_date || null;
    paidAtIso = rawDate ? new Date(rawDate).toISOString() : null;
  } else if (["action_required", "processing", "created", "pending", "in_process"].includes(mpStatus)) {
    newStatus = "pending";
    paymentStatus = "pending";
  } else if (mpStatus === "refunded") {
    newStatus = "refunded";
    paymentStatus = "refunded";
  } else if (["canceled", "cancelled", "expired"].includes(mpStatus)) {
    newStatus = "cancelled";
    paymentStatus = "cancelled";
  } else if (["failed", "rejected", "charged_back"].includes(mpStatus)) {
    newStatus = "failed";
    paymentStatus = "failed";
  }

  return {
    sourceType: "order" as const,
    providerRefId: mpOrderId || null,
    mercadoPagoOrderId: mpOrderId || null,
    mercadoPagoPaymentId: primaryTx?.id ? String(primaryTx.id) : null,
    mercadoPagoTransactionId: primaryTx?.id ? String(primaryTx.id) : null,
    mercadoPagoTransactionStatus: txStatus,
    mercadoPagoTransactionStatusDetail: txStatusDetail,
    mpStatus,
    mpStatusDetail,
    newStatus,
    paymentStatus,
    paidAtIso,
  };
}

function pickBestPayment(payments: any[]): any | null {
  if (!payments || payments.length === 0) return null;
  const approved = payments.find((p) => String(p?.status || "").toLowerCase() === "approved");
  if (approved) return approved;
  const pending = payments.find((p) =>
    ["pending", "in_process", "authorized"].includes(String(p?.status || "").toLowerCase())
  );
  if (pending) return pending;
  return payments[0];
}

async function checkSingleOrderWithMercadoPago(
  input: OrderLookupInput,
  accessToken: string
): Promise<ResolvedMercadoPagoResult> {
  const orderId = String(input.orderId || "").trim();
  const orderCode = String(input.orderCode || orderId.substring(0, 8)).trim();

  let best: ReturnType<typeof resolveFromPaymentInfo> | ReturnType<typeof resolveFromOrderInfo> | null = null;
  let sourceMethod: ResolvedMercadoPagoResult["sourceMethod"] = "not_found";

  try {
    // 1. Orders API by mercadoPagoOrderId
    if (input.mercadoPagoOrderId) {
      const mpOrderId = String(input.mercadoPagoOrderId).trim();
      const res = await mpApiGet(`/v1/orders/${encodeURIComponent(mpOrderId)}`, accessToken);
      if (res.statusCode === 200 && res.data) {
        const resolved = resolveFromOrderInfo(res.data, mpOrderId);
        best = resolved;
        sourceMethod = "orders_api";
        if (resolved.paymentStatus === "paid") {
          return { orderId, orderCode, found: true, sourceMethod, ...resolved };
        }
      }
    }

    // 2. Direct Payments API by numeric payment/transaction ID
    const numericIds = [input.mercadoPagoPaymentId, input.mercadoPagoTransactionId]
      .filter((id): id is string => typeof id === "string" || typeof id === "number")
      .map((id) => String(id).trim())
      .filter((id, idx, arr) => /^\d+$/.test(id) && arr.indexOf(id) === idx);

    for (const numId of numericIds) {
      const res = await mpApiGet(`/v1/payments/${encodeURIComponent(numId)}`, accessToken);
      if (res.statusCode === 200 && res.data) {
        const resolved = resolveFromPaymentInfo(res.data, numId);
        if (!best || resolved.paymentStatus === "paid") {
          best = resolved;
          sourceMethod = "payments_api";
        }
        if (resolved.paymentStatus === "paid") {
          return { orderId, orderCode, found: true, sourceMethod, ...resolved };
        }
      }
    }

    // 3. Universal Payments Search by external_reference (orderId, externalReference, orderCode)
    const refs = [orderId, input.externalReference, input.orderCode]
      .filter((r): r is string => typeof r === "string" && r.trim().length > 0)
      .map((r) => r.trim())
      .filter((r, idx, arr) => arr.indexOf(r) === idx);

    for (const ref of refs) {
      const res = await mpApiGet(
        `/v1/payments/search?external_reference=${encodeURIComponent(ref)}&sort=date_created&criteria=desc&limit=10`,
        accessToken
      );
      if (res.statusCode === 200 && Array.isArray(res.data?.results)) {
        const picked = pickBestPayment(res.data.results);
        if (picked) {
          const resolved = resolveFromPaymentInfo(picked);
          if (
            !best ||
            resolved.paymentStatus === "paid" ||
            (best.paymentStatus === "pending" && resolved.paymentStatus !== "pending")
          ) {
            best = resolved;
            sourceMethod = "payments_search";
          }
          if (resolved.paymentStatus === "paid") {
            break;
          }
        }
      }
    }

    if (best) {
      return { orderId, orderCode, found: true, sourceMethod, ...best };
    }

    return {
      orderId,
      orderCode,
      found: false,
      sourceType: "none",
      sourceMethod: "not_found",
      providerRefId: null,
      mercadoPagoOrderId: null,
      mercadoPagoPaymentId: null,
      mercadoPagoTransactionId: null,
      mercadoPagoTransactionStatus: null,
      mercadoPagoTransactionStatusDetail: null,
      mpStatus: "not_found",
      mpStatusDetail: null,
      newStatus: null,
      paymentStatus: null,
      paidAtIso: null,
    };
  } catch (err: any) {
    return {
      orderId,
      orderCode,
      found: false,
      sourceType: "none",
      sourceMethod: "error",
      providerRefId: null,
      mercadoPagoOrderId: null,
      mercadoPagoPaymentId: null,
      mercadoPagoTransactionId: null,
      mercadoPagoTransactionStatus: null,
      mercadoPagoTransactionStatusDetail: null,
      mpStatus: null,
      mpStatusDetail: null,
      newStatus: null,
      paymentStatus: null,
      paidAtIso: null,
      error: err?.message || "Erro ao consultar Mercado Pago",
    };
  }
}

async function requireFirebaseAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    res.status(401).json({ code: "UNAUTHENTICATED", message: "Sessão inválida. Faça login novamente." });
    return;
  }

  const idToken = authHeader.slice("Bearer ".length).trim();
  if (!idToken) {
    res.status(401).json({ code: "UNAUTHENTICATED", message: "Token de autenticação ausente." });
    return;
  }

  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    (req as any).firebaseUser = decoded;
    next();
  } catch {
    res.status(401).json({ code: "UNAUTHENTICATED", message: "Token de autenticação expirado ou inválido." });
  }
}

function getServerMpAccessToken(): string | null {
  const token = (process.env.MERCADO_PAGO_ACCESS_TOKEN || "").trim();
  return token.length > 0 ? token : null;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "256kb" }));

  // API Routes
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Authenticated server-side Mercado Pago payment reconciliation fallback
  app.post("/api/mercadopago/check-orders", requireFirebaseAuth, async (req, res) => {
    const accessToken = getServerMpAccessToken();
    if (!accessToken) {
      res.status(503).json({
        code: "MISSING_MP_TOKEN",
        message:
          "Configure a variável de ambiente MERCADO_PAGO_ACCESS_TOKEN no painel de variáveis do AI Studio para sincronizar pagamentos diretamente por aqui.",
      });
      return;
    }

    const rawOrders = req.body?.orders;
    if (!Array.isArray(rawOrders)) {
      res.status(400).json({ code: "INVALID_ARGUMENT", message: "Lista de pedidos inválida." });
      return;
    }

    const sanitizedOrders: OrderLookupInput[] = rawOrders
      .slice(0, 40)
      .filter((o: any) => o && typeof o.orderId === "string" && o.orderId.trim().length > 0)
      .map((o: any) => ({
        orderId: String(o.orderId).trim(),
        orderCode: typeof o.orderCode === "string" ? o.orderCode.trim() : undefined,
        externalReference: typeof o.externalReference === "string" ? o.externalReference.trim() : undefined,
        mercadoPagoOrderId: typeof o.mercadoPagoOrderId === "string" ? o.mercadoPagoOrderId.trim() : undefined,
        mercadoPagoPaymentId:
          typeof o.mercadoPagoPaymentId === "string" || typeof o.mercadoPagoPaymentId === "number"
            ? String(o.mercadoPagoPaymentId).trim()
            : undefined,
        mercadoPagoTransactionId:
          typeof o.mercadoPagoTransactionId === "string" || typeof o.mercadoPagoTransactionId === "number"
            ? String(o.mercadoPagoTransactionId).trim()
            : undefined,
      }));

    const results: ResolvedMercadoPagoResult[] = [];
    const concurrency = 4;

    for (let i = 0; i < sanitizedOrders.length; i += concurrency) {
      const chunk = sanitizedOrders.slice(i, i + concurrency);
      const chunkResults = await Promise.all(
        chunk.map((item) => checkSingleOrderWithMercadoPago(item, accessToken))
      );
      results.push(...chunkResults);
    }

    res.json({ results });
  });

  // Authenticated server-side Mercado Pago connection test fallback
  app.post("/api/mercadopago/test-connection", requireFirebaseAuth, async (_req, res) => {
    const accessToken = getServerMpAccessToken();
    if (!accessToken) {
      res.status(503).json({
        code: "MISSING_MP_TOKEN",
        message:
          "Configure a variável de ambiente MERCADO_PAGO_ACCESS_TOKEN no painel de variáveis do AI Studio para testar a conexão diretamente por aqui.",
      });
      return;
    }

    try {
      const mpRes = await mpApiGet("/users/me", accessToken);
      if (mpRes.statusCode !== 200 || !mpRes.data?.id) {
        res.status(400).json({
          code: "INVALID_MP_TOKEN",
          message: `O Mercado Pago rejeitou o Access Token configurado (HTTP ${mpRes.statusCode}). Verifique se o token de produção está correto.`,
        });
        return;
      }

      res.json({
        connected: true,
        userId: String(mpRes.data.id),
        nickname: String(mpRes.data.nickname || ""),
        siteId: String(mpRes.data.site_id || ""),
        webhookUrl: "https://us-central1-console-anailda.cloudfunctions.net/mercadoPagoWebhook",
      });
    } catch (err: any) {
      res.status(502).json({
        code: "MP_UNREACHABLE",
        message: err?.message || "Erro ao se comunicar com a API do Mercado Pago.",
      });
    }
  });

  // Deprecated endpoint. Frontend should call Cloud Functions.
  app.post("/api/checkout/create-pix", (_req, res) => {
    res.status(404).json({
      error: "Endpoint depreciado. Chame a Cloud Function /createMercadoPagoPix no Firebase.",
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
