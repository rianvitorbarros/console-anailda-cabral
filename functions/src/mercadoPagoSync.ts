import * as functions from 'firebase-functions';
import { getFirestore, FieldValue, DocumentReference, DocumentSnapshot } from 'firebase-admin/firestore';
import * as https from 'https';

export interface MercadoPagoResolution {
  sourceType: 'order' | 'payment';
  providerRefId: string;
  mercadoPagoOrderId?: string | null;
  mercadoPagoPaymentId?: string | null;
  mercadoPagoTransactionId?: string | null;
  mercadoPagoTransactionStatus?: string | null;
  mercadoPagoTransactionStatusDetail?: string | null;
  mpStatus: string;
  mpStatusDetail: string | null;
  newStatus: string;
  paymentStatus: string;
  paidAtDate?: Date | null;
  transactionAmount?: number | null;
  externalReference?: string | null;
}

export interface SyncOrderResultItem {
  orderId: string;
  orderCode: string;
  previousPaymentStatus: string;
  newPaymentStatus: string;
  mpStatus: string | null;
  mpStatusDetail: string | null;
  updated: boolean;
  becamePaid: boolean;
  sourceMethod: string;
  error?: string;
}

export async function getMercadoPagoAccessToken(
  db: FirebaseFirestore.Firestore,
  projectId: string
): Promise<string | null> {
  const candidatePaths = [
    `projects/${projectId}/integration_secrets/mercadopago`,
    `projects/${projectId}/integrations_secrets/mercadopago`,
    `projects/${projectId}/integration_secrets/mercado_pago`,
    `projects/${projectId}/integrations_secrets/mercado_pago`,
  ];

  for (const docPath of candidatePaths) {
    const snap = await db.doc(docPath).get();
    if (snap.exists) {
      const secretData = snap.data() as Record<string, any> | undefined;
      const token = secretData?.accessToken || secretData?.access_token || secretData?.token;
      if (typeof token === 'string' && token.trim().length > 0) {
        return token.trim();
      }
    }
  }
  return null;
}

export function mpApiGet(apiPath: string, accessToken: string): Promise<{ statusCode: number; data: any }> {
  return new Promise((resolve, reject) => {
    const options: https.RequestOptions = {
      hostname: 'api.mercadopago.com',
      path: apiPath,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
      timeout: 15000,
    };

    const request = https.request(options, (response) => {
      let responseData = '';
      response.on('data', (chunk) => {
        responseData += chunk;
      });
      response.on('end', () => {
        const statusCode = response.statusCode || 500;
        try {
          const parsed = responseData ? JSON.parse(responseData) : null;
          resolve({ statusCode, data: parsed });
        } catch {
          resolve({ statusCode, data: null });
        }
      });
    });

    request.on('timeout', () => {
      request.destroy(new Error('Mercado Pago API request timed out'));
    });

    request.on('error', (err) => reject(err));
    request.end();
  });
}

export async function fetchMercadoPagoPayment(paymentId: string, accessToken: string): Promise<any | null> {
  const safeId = encodeURIComponent(String(paymentId).trim());
  const res = await mpApiGet(`/v1/payments/${safeId}`, accessToken);
  if (res.statusCode === 200 && res.data) {
    return res.data;
  }
  if (res.statusCode !== 404) {
    console.error(`[MP_API] GET /v1/payments/${safeId} returned status ${res.statusCode}`);
  }
  return null;
}

export async function fetchMercadoPagoOrder(mpOrderId: string, accessToken: string): Promise<any | null> {
  const safeId = encodeURIComponent(String(mpOrderId).trim());
  const res = await mpApiGet(`/v1/orders/${safeId}`, accessToken);
  if (res.statusCode === 200 && res.data) {
    return res.data;
  }
  if (res.statusCode !== 404) {
    console.error(`[MP_API] GET /v1/orders/${safeId} returned status ${res.statusCode}`);
  }
  return null;
}

export async function searchMercadoPagoPaymentsByExternalRef(
  externalReference: string,
  accessToken: string
): Promise<any[]> {
  const safeRef = encodeURIComponent(String(externalReference).trim());
  const res = await mpApiGet(
    `/v1/payments/search?external_reference=${safeRef}&sort=date_created&criteria=desc&limit=10`,
    accessToken
  );
  if (res.statusCode === 200 && Array.isArray(res.data?.results)) {
    return res.data.results;
  }
  if (res.statusCode !== 404) {
    console.error(`[MP_API] GET /v1/payments/search returned status ${res.statusCode}`);
  }
  return [];
}

export async function fetchMercadoPagoAccount(accessToken: string): Promise<{ statusCode: number; data: any }> {
  return mpApiGet('/users/me', accessToken);
}

export function resolveFromPaymentInfo(paymentInfo: any, fallbackPaymentId?: string): MercadoPagoResolution {
  const mpStatus = String(paymentInfo?.status || 'pending').toLowerCase();
  const mpStatusDetail = paymentInfo?.status_detail ? String(paymentInfo.status_detail) : null;
  const paymentId = String(paymentInfo?.id || fallbackPaymentId || '');

  let newStatus = 'pending';
  let paymentStatus = 'pending';
  let paidAtDate: Date | null = null;

  if (mpStatus === 'approved') {
    newStatus = 'approved';
    paymentStatus = 'paid';
    paidAtDate = paymentInfo?.date_approved ? new Date(paymentInfo.date_approved) : null;
  } else if (['pending', 'in_process', 'authorized', 'in_mediation'].includes(mpStatus)) {
    newStatus = 'pending';
    paymentStatus = 'pending';
  } else if (mpStatus === 'refunded') {
    newStatus = 'refunded';
    paymentStatus = 'refunded';
  } else if (mpStatus === 'cancelled' || mpStatus === 'canceled') {
    newStatus = 'cancelled';
    paymentStatus = 'cancelled';
  } else if (['rejected', 'charged_back'].includes(mpStatus)) {
    newStatus = 'failed';
    paymentStatus = 'failed';
  }

  return {
    sourceType: 'payment',
    providerRefId: paymentId,
    mercadoPagoPaymentId: paymentId || null,
    mercadoPagoOrderId: paymentInfo?.order?.id ? String(paymentInfo.order.id) : null,
    mpStatus,
    mpStatusDetail,
    newStatus,
    paymentStatus,
    paidAtDate,
    transactionAmount: typeof paymentInfo?.transaction_amount === 'number' ? paymentInfo.transaction_amount : null,
    externalReference: paymentInfo?.external_reference ? String(paymentInfo.external_reference) : null,
  };
}

export function resolveFromOrderInfo(orderInfo: any, fallbackOrderId?: string): MercadoPagoResolution {
  const mpStatus = String(orderInfo?.status || 'pending').toLowerCase();
  const mpStatusDetail = orderInfo?.status_detail ? String(orderInfo.status_detail) : null;
  const mpOrderId = String(orderInfo?.id || fallbackOrderId || '');
  const paymentsList: any[] = Array.isArray(orderInfo?.transactions?.payments)
    ? orderInfo.transactions.payments
    : [];

  const paidTx = paymentsList.find(
    (tx) =>
      String(tx?.status || '').toLowerCase() === 'processed' ||
      String(tx?.status || '').toLowerCase() === 'approved'
  );
  const primaryTx = paidTx || paymentsList[0] || null;
  const txStatus = primaryTx?.status ? String(primaryTx.status).toLowerCase() : null;
  const txStatusDetail = primaryTx?.status_detail ? String(primaryTx.status_detail).toLowerCase() : null;

  let newStatus = 'pending';
  let paymentStatus = 'pending';
  let paidAtDate: Date | null = null;

  const isOrderApproved =
    (mpStatus === 'processed' && (mpStatusDetail === 'accredited' || txStatus === 'processed' || txStatus === 'approved')) ||
    txStatus === 'approved' ||
    (txStatus === 'processed' && txStatusDetail === 'accredited');

  if (isOrderApproved) {
    newStatus = 'approved';
    paymentStatus = 'paid';
    const rawDate = primaryTx?.date_approved || orderInfo?.last_updated_date || null;
    paidAtDate = rawDate ? new Date(rawDate) : null;
  } else if (['action_required', 'processing', 'created', 'pending', 'in_process'].includes(mpStatus)) {
    newStatus = 'pending';
    paymentStatus = 'pending';
  } else if (mpStatus === 'refunded') {
    newStatus = 'refunded';
    paymentStatus = 'refunded';
  } else if (['canceled', 'cancelled', 'expired'].includes(mpStatus)) {
    newStatus = 'cancelled';
    paymentStatus = 'cancelled';
  } else if (['failed', 'rejected', 'charged_back'].includes(mpStatus)) {
    newStatus = 'failed';
    paymentStatus = 'failed';
  }

  return {
    sourceType: 'order',
    providerRefId: mpOrderId,
    mercadoPagoOrderId: mpOrderId || null,
    mercadoPagoPaymentId: primaryTx?.id ? String(primaryTx.id) : null,
    mercadoPagoTransactionId: primaryTx?.id ? String(primaryTx.id) : null,
    mercadoPagoTransactionStatus: txStatus,
    mercadoPagoTransactionStatusDetail: txStatusDetail,
    mpStatus,
    mpStatusDetail,
    newStatus,
    paymentStatus,
    paidAtDate,
    transactionAmount: orderInfo?.total_amount ? Number(orderInfo.total_amount) : null,
    externalReference: orderInfo?.external_reference ? String(orderInfo.external_reference) : null,
  };
}

export async function applyPaymentResolutionToOrder(
  db: FirebaseFirestore.Firestore,
  projectId: string,
  orderRef: DocumentReference,
  orderData: Record<string, any>,
  resolution: MercadoPagoResolution,
  options: {
    source: 'webhook' | 'manual_sync';
    providerAction?: string;
    webhookUserId?: string;
    triggeredBy?: string;
  }
): Promise<{ updated: boolean; becamePaid: boolean; finalPaymentStatus: string; finalStatus: string }> {
  const orderId = orderRef.id;
  const currentPaymentStatus = String(orderData.paymentStatus || orderData.status || 'pending').toLowerCase();
  const isCurrentlyPaid = currentPaymentStatus === 'paid' || currentPaymentStatus === 'approved';
  const isCurrentlyCancelled = String(orderData.status || '').toLowerCase() === 'cancelled';

  // Never downgrade an already paid order back to pending
  if (isCurrentlyPaid && resolution.paymentStatus === 'pending') {
    return {
      updated: false,
      becamePaid: false,
      finalPaymentStatus: orderData.paymentStatus || 'paid',
      finalStatus: orderData.status || 'approved',
    };
  }

  // Never overwrite a cancelled order with pending
  if (isCurrentlyCancelled && resolution.paymentStatus === 'pending') {
    return {
      updated: false,
      becamePaid: false,
      finalPaymentStatus: orderData.paymentStatus || 'cancelled',
      finalStatus: orderData.status || 'cancelled',
    };
  }

  const becamePaid = !isCurrentlyPaid && resolution.paymentStatus === 'paid';
  const statusChanged = currentPaymentStatus !== resolution.paymentStatus || orderData.status !== resolution.newStatus;

  const updateData: Record<string, any> = {
    status: resolution.newStatus,
    paymentStatus: resolution.paymentStatus,
    mercadoPagoStatus: resolution.mpStatus,
    mercadoPagoStatusDetail: resolution.mpStatusDetail,
    updatedAt: FieldValue.serverTimestamp(),
    lastPaymentSyncAt: FieldValue.serverTimestamp(),
  };

  if (options.source === 'webhook') {
    updateData.rawWebhookLastReceivedAt = FieldValue.serverTimestamp();
  }

  if (resolution.sourceType === 'order') {
    if (resolution.mercadoPagoOrderId) {
      updateData.mercadoPagoOrderId = resolution.mercadoPagoOrderId;
    }
    updateData.mercadoPagoOrderStatus = resolution.mpStatus;
    if (resolution.mercadoPagoTransactionId) {
      updateData.mercadoPagoTransactionId = resolution.mercadoPagoTransactionId;
    }
    if (resolution.mercadoPagoTransactionStatus) {
      updateData.mercadoPagoTransactionStatus = resolution.mercadoPagoTransactionStatus;
    }
    if (resolution.mercadoPagoTransactionStatusDetail) {
      updateData.mercadoPagoTransactionStatusDetail = resolution.mercadoPagoTransactionStatusDetail;
    }
    if (resolution.mercadoPagoPaymentId && !orderData.mercadoPagoPaymentId) {
      updateData.mercadoPagoPaymentId = resolution.mercadoPagoPaymentId;
    }
  } else {
    if (resolution.mercadoPagoPaymentId) {
      updateData.mercadoPagoPaymentId = resolution.mercadoPagoPaymentId;
    }
    updateData.mercadoPagoPaymentStatus = resolution.mpStatus;
    if (resolution.mercadoPagoOrderId && !orderData.mercadoPagoOrderId) {
      updateData.mercadoPagoOrderId = resolution.mercadoPagoOrderId;
    }
  }

  if (resolution.paymentStatus === 'paid') {
    if (!orderData.paidAt) {
      updateData.paidAt = resolution.paidAtDate || FieldValue.serverTimestamp();
    }
    if (!orderData.approvedAt) {
      updateData.approvedAt = FieldValue.serverTimestamp();
    }
    if (!orderData.fulfillmentStatus) {
      updateData.fulfillmentStatus = 'pending_contact';
    }
    if (!orderData.customerNotificationStatus) {
      updateData.customerNotificationStatus = 'pending';
    }
  }

  await orderRef.update(updateData);

  // Sync publicCheckoutStatus so the customer page reflects payment confirmation
  if (orderData.publicStatusToken || orderData.publicStatusPath) {
    const rawPath =
      orderData.publicStatusPath || `/projects/${projectId}/publicCheckoutStatus/${orderData.publicStatusToken}`;
    const normalizedPath = rawPath.startsWith('/') ? rawPath.substring(1) : rawPath;
    const publicStatusRef = db.doc(normalizedPath);

    const publicStatusUpdate: Record<string, any> = {
      orderId,
      orderCode: orderData.orderCode || orderData.code || orderId.substring(0, 8),
      paymentStatus: resolution.paymentStatus,
      status: resolution.newStatus,
      mercadoPagoStatus: resolution.mpStatus,
      mercadoPagoStatusDetail: resolution.mpStatusDetail,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (resolution.paymentStatus === 'paid') {
      publicStatusUpdate.paidAt = updateData.paidAt || orderData.paidAt || FieldValue.serverTimestamp();
      publicStatusUpdate.approvedAt = updateData.approvedAt || orderData.approvedAt || FieldValue.serverTimestamp();
      publicStatusUpdate.fulfillmentStatus = orderData.fulfillmentStatus || 'pending_contact';
      publicStatusUpdate.customerNotificationStatus = orderData.customerNotificationStatus || 'pending';
      publicStatusUpdate.successMessage = 'Pagamento confirmado! Seu pedido foi registrado com sucesso.';
      publicStatusUpdate.nextStepsMessage =
        'Você receberá um e-mail de confirmação em breve. Nossa equipe também poderá entrar em contato pelo WhatsApp para acompanhar a entrega.';
    }

    await publicStatusRef.update(publicStatusUpdate).catch((err) => {
      console.error(`[MP_SYNC] Erro ao atualizar publicCheckoutStatus para ${orderId}:`, err?.message || err);
    });
  }

  // Create idempotent audit event when status changes or payment is approved
  if (statusChanged || becamePaid) {
    const safeRefId = (resolution.providerRefId || orderId).replace(/[^a-zA-Z0-9_-]/g, '_');
    const eventId = `mp_${resolution.newStatus}_${safeRefId}`;
    const eventRef = db.collection(`projects/${projectId}/orderEvents`).doc(eventId);
    const eventSnap = await eventRef.get();

    if (!eventSnap.exists) {
      const metadata: Record<string, any> = {
        mercadoPagoStatus: resolution.mpStatus,
        mercadoPagoStatusDetail: resolution.mpStatusDetail,
        syncSource: options.source,
      };
      if (options.webhookUserId) {
        metadata.webhookUserId = String(options.webhookUserId);
      }
      if (options.triggeredBy) {
        metadata.triggeredBy = String(options.triggeredBy);
      }

      await eventRef.set({
        projectId,
        orderId,
        eventName: resolution.paymentStatus === 'paid' ? 'payment_approved' : 'payment_status_updated',
        status: resolution.newStatus,
        paymentStatus: resolution.paymentStatus,
        provider: 'mercado_pago',
        providerEventType: resolution.sourceType,
        providerAction: options.providerAction || (options.source === 'manual_sync' ? 'api_reconciliation' : 'webhook_received'),
        providerPaymentId: resolution.mercadoPagoPaymentId || resolution.providerRefId || null,
        providerOrderId: resolution.mercadoPagoOrderId || null,
        metadata,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  }

  return {
    updated: statusChanged || becamePaid,
    becamePaid,
    finalPaymentStatus: resolution.paymentStatus,
    finalStatus: resolution.newStatus,
  };
}

function pickBestPaymentFromSearch(payments: any[]): any | null {
  if (!payments || payments.length === 0) return null;
  const approved = payments.find((p) => String(p?.status || '').toLowerCase() === 'approved');
  if (approved) return approved;
  const pending = payments.find((p) =>
    ['pending', 'in_process', 'authorized'].includes(String(p?.status || '').toLowerCase())
  );
  if (pending) return pending;
  return payments[0];
}

export async function reconcileSingleOrder(
  db: FirebaseFirestore.Firestore,
  projectId: string,
  orderSnap: DocumentSnapshot,
  accessToken: string,
  triggeredBy: string
): Promise<SyncOrderResultItem> {
  const orderId = orderSnap.id;
  const orderData = (orderSnap.data() || {}) as Record<string, any>;
  const orderCode = String(orderData.orderCode || orderData.code || orderId.substring(0, 8));
  const previousPaymentStatus = String(orderData.paymentStatus || orderData.status || 'pending');

  let bestResolution: MercadoPagoResolution | null = null;
  let sourceMethod = 'none';

  try {
    // 1. Check Orders API by mercadoPagoOrderId (used by Pix Orders API)
    if (orderData.mercadoPagoOrderId) {
      const mpOrder = await fetchMercadoPagoOrder(String(orderData.mercadoPagoOrderId), accessToken);
      if (mpOrder) {
        const res = resolveFromOrderInfo(mpOrder, String(orderData.mercadoPagoOrderId));
        bestResolution = res;
        sourceMethod = 'orders_api';
        if (res.paymentStatus === 'paid') {
          const applied = await applyPaymentResolutionToOrder(db, projectId, orderSnap.ref, orderData, res, {
            source: 'manual_sync',
            triggeredBy,
          });
          return {
            orderId,
            orderCode,
            previousPaymentStatus,
            newPaymentStatus: applied.finalPaymentStatus,
            mpStatus: res.mpStatus,
            mpStatusDetail: res.mpStatusDetail,
            updated: applied.updated,
            becamePaid: applied.becamePaid,
            sourceMethod,
          };
        }
      }
    }

    // 2. Check Payments API directly by numeric mercadoPagoPaymentId / mercadoPagoTransactionId
    const directPaymentIds = [orderData.mercadoPagoPaymentId, orderData.mercadoPagoTransactionId]
      .filter((id) => typeof id === 'string' || typeof id === 'number')
      .map((id) => String(id).trim())
      .filter((id, idx, arr) => /^\d+$/.test(id) && arr.indexOf(id) === idx);

    for (const numericPaymentId of directPaymentIds) {
      const mpPayment = await fetchMercadoPagoPayment(numericPaymentId, accessToken);
      if (mpPayment) {
        const res = resolveFromPaymentInfo(mpPayment, numericPaymentId);
        if (!bestResolution || res.paymentStatus === 'paid') {
          bestResolution = res;
          sourceMethod = 'payments_api';
        }
        if (res.paymentStatus === 'paid') {
          const applied = await applyPaymentResolutionToOrder(db, projectId, orderSnap.ref, orderData, res, {
            source: 'manual_sync',
            triggeredBy,
          });
          return {
            orderId,
            orderCode,
            previousPaymentStatus,
            newPaymentStatus: applied.finalPaymentStatus,
            mpStatus: res.mpStatus,
            mpStatusDetail: res.mpStatusDetail,
            updated: applied.updated,
            becamePaid: applied.becamePaid,
            sourceMethod,
          };
        }
      }
    }

    // 3. Universal fallback: search Payments API by external_reference (orderId, externalReference, orderCode)
    const externalRefs = [orderId, orderData.externalReference, orderData.orderCode]
      .filter((ref) => typeof ref === 'string' && ref.trim().length > 0)
      .map((ref) => String(ref).trim())
      .filter((ref, idx, arr) => arr.indexOf(ref) === idx);

    for (const ref of externalRefs) {
      const searchResults = await searchMercadoPagoPaymentsByExternalRef(ref, accessToken);
      const picked = pickBestPaymentFromSearch(searchResults);
      if (picked) {
        const res = resolveFromPaymentInfo(picked);
        if (!bestResolution || res.paymentStatus === 'paid' || (bestResolution.paymentStatus === 'pending' && res.paymentStatus !== 'pending')) {
          bestResolution = res;
          sourceMethod = 'payments_search';
        }
        if (res.paymentStatus === 'paid') {
          break;
        }
      }
    }

    if (bestResolution) {
      const applied = await applyPaymentResolutionToOrder(db, projectId, orderSnap.ref, orderData, bestResolution, {
        source: 'manual_sync',
        triggeredBy,
      });
      return {
        orderId,
        orderCode,
        previousPaymentStatus,
        newPaymentStatus: applied.finalPaymentStatus,
        mpStatus: bestResolution.mpStatus,
        mpStatusDetail: bestResolution.mpStatusDetail,
        updated: applied.updated,
        becamePaid: applied.becamePaid,
        sourceMethod,
      };
    }

    // Nothing found in Mercado Pago — stamp sync attempt
    await orderSnap.ref.update({
      lastPaymentSyncAt: FieldValue.serverTimestamp(),
    });

    return {
      orderId,
      orderCode,
      previousPaymentStatus,
      newPaymentStatus: previousPaymentStatus,
      mpStatus: 'not_found',
      mpStatusDetail: null,
      updated: false,
      becamePaid: false,
      sourceMethod: 'not_found',
    };
  } catch (err: any) {
    console.error(`[MP_SYNC] Erro ao reconciliar pedido ${orderId}:`, err?.message || err);
    return {
      orderId,
      orderCode,
      previousPaymentStatus,
      newPaymentStatus: previousPaymentStatus,
      mpStatus: null,
      mpStatusDetail: null,
      updated: false,
      becamePaid: false,
      sourceMethod: 'error',
      error: err?.message || 'Erro ao consultar Mercado Pago',
    };
  }
}

async function verifyCallerRole(
  db: FirebaseFirestore.Firestore,
  context: functions.https.CallableContext,
  allowedRoles: string[]
): Promise<{ uid: string; role: string }> {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Autenticação necessária para executar esta operação.');
  }

  const uid = context.auth.uid;
  const userDoc = await db.collection('users').doc(uid).get();
  if (!userDoc.exists) {
    throw new functions.https.HttpsError('permission-denied', 'Perfil de usuário não encontrado.');
  }

  const role = String(userDoc.data()?.role || 'viewer');
  if (!allowedRoles.includes(role)) {
    throw new functions.https.HttpsError('permission-denied', 'Você não tem permissão para sincronizar pagamentos.');
  }

  return { uid, role };
}

export const syncMercadoPagoOrders = functions.https.onCall(async (data, context) => {
  const db = getFirestore();
  const { uid } = await verifyCallerRole(db, context, ['admin', 'publisher_operator']);

  const projectId = typeof data?.projectId === 'string' && data.projectId.trim() ? data.projectId.trim() : 'anailda-book';
  if (projectId !== 'anailda-book') {
    throw new functions.https.HttpsError('invalid-argument', 'Projeto inválido.');
  }

  const accessToken = await getMercadoPagoAccessToken(db, projectId);
  if (!accessToken) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Access Token do Mercado Pago não configurado em Integrações > Mercado Pago.'
    );
  }

  const requestedOrderId = typeof data?.orderId === 'string' ? data.orderId.trim() : '';

  if (requestedOrderId) {
    const orderSnap = await db.doc(`projects/${projectId}/orders/${requestedOrderId}`).get();
    if (!orderSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Pedido não encontrado.');
    }

    const result = await reconcileSingleOrder(db, projectId, orderSnap, accessToken, uid);
    console.log('[MP_SYNC] sincronização individual concluída', {
      orderId: result.orderId,
      orderCode: result.orderCode,
      becamePaid: result.becamePaid,
      newPaymentStatus: result.newPaymentStatus,
      mpStatus: result.mpStatus,
      sourceMethod: result.sourceMethod,
    });

    return {
      mode: 'single',
      checked: 1,
      updatedToPaid: result.becamePaid ? 1 : 0,
      updatedOther: result.updated && !result.becamePaid ? 1 : 0,
      stillPending: result.newPaymentStatus === 'pending' ? 1 : 0,
      notFound: result.mpStatus === 'not_found' ? 1 : 0,
      errors: result.error ? 1 : 0,
      results: [result],
    };
  }

  // Batch mode: scan latest 100 orders and reconcile all non-paid / non-refunded orders (up to 40 per run)
  const snapshot = await db
    .collection(`projects/${projectId}/orders`)
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get();

  const pendingDocs = snapshot.docs
    .filter((docSnap) => {
      const d = docSnap.data();
      const paySt = String(d.paymentStatus || d.status || 'pending').toLowerCase();
      return !['paid', 'approved', 'refunded'].includes(paySt);
    })
    .slice(0, 40);

  const results: SyncOrderResultItem[] = [];
  const concurrency = 4;

  for (let i = 0; i < pendingDocs.length; i += concurrency) {
    const chunk = pendingDocs.slice(i, i + concurrency);
    const chunkResults = await Promise.all(
      chunk.map((docSnap) => reconcileSingleOrder(db, projectId, docSnap, accessToken, uid))
    );
    results.push(...chunkResults);
  }

  const summary = {
    mode: 'batch',
    checked: results.length,
    updatedToPaid: results.filter((r) => r.becamePaid).length,
    updatedOther: results.filter((r) => r.updated && !r.becamePaid).length,
    stillPending: results.filter((r) => r.newPaymentStatus === 'pending' && !r.error).length,
    notFound: results.filter((r) => r.mpStatus === 'not_found').length,
    errors: results.filter((r) => Boolean(r.error)).length,
    results,
  };

  console.log('[MP_SYNC] sincronização em lote concluída', {
    checked: summary.checked,
    updatedToPaid: summary.updatedToPaid,
    updatedOther: summary.updatedOther,
    stillPending: summary.stillPending,
    notFound: summary.notFound,
    errors: summary.errors,
  });

  return summary;
});

export const testMercadoPagoConnection = functions.https.onCall(async (data, context) => {
  const db = getFirestore();
  await verifyCallerRole(db, context, ['admin']);

  const projectId = typeof data?.projectId === 'string' && data.projectId.trim() ? data.projectId.trim() : 'anailda-book';
  if (projectId !== 'anailda-book') {
    throw new functions.https.HttpsError('invalid-argument', 'Projeto inválido.');
  }

  const accessToken = await getMercadoPagoAccessToken(db, projectId);
  if (!accessToken) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Access Token não encontrado no servidor. Salve o token antes de testar.'
    );
  }

  const res = await fetchMercadoPagoAccount(accessToken);
  if (res.statusCode !== 200 || !res.data?.id) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      `O Mercado Pago rejeitou o Access Token configurado (HTTP ${res.statusCode}). Verifique se o token está ativo.`
    );
  }

  return {
    connected: true,
    userId: String(res.data.id),
    nickname: String(res.data.nickname || ''),
    siteId: String(res.data.site_id || ''),
    webhookUrl: 'https://us-central1-console-anailda.cloudfunctions.net/mercadoPagoWebhook',
  };
});
