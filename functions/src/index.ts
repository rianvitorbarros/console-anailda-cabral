import * as functions from 'firebase-functions';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as https from 'https';
import * as crypto from 'crypto';
import {
  getMercadoPagoAccessToken,
  fetchMercadoPagoPayment,
  fetchMercadoPagoOrder,
  mpApiGet,
  resolveFromPaymentInfo,
  resolveFromOrderInfo,
  applyPaymentResolutionToOrder,
  MercadoPagoResolution,
} from './mercadoPagoSync';

if (getApps().length === 0) {
  initializeApp();
}
const db = getFirestore();

export const mercadoPagoWebhook = functions.https.onRequest(async (req, res) => {
  // CORS configuration for public site
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-signature, x-request-id');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  // Healthcheck
  if (req.method === 'GET') {
    res.status(200).json({
      success: true,
      function: 'mercadoPagoWebhook',
      projectId: req.query.projectId || 'anailda-book',
      status: 'ready'
    });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, message: 'Method Not Allowed' });
    return;
  }

  try {
    const projectId = (req.query.projectId as string) || 'anailda-book';
    
    if (projectId !== 'anailda-book') {
      res.status(400).json({ success: false, message: 'Invalid projectId' });
      return;
    }

    const body = (req.body && typeof req.body === 'object') ? req.body : {};
    const queryType = typeof req.query?.type === 'string' ? req.query.type : '';
    const queryTopic = typeof req.query?.topic === 'string' ? req.query.topic : '';
    const type = String(body.type || queryType || '').toLowerCase();
    const topic = String(body.topic || queryTopic || '').toLowerCase();
    const action = String(body.action || '').toLowerCase();

    console.log('[MP_WEBHOOK] recebido', {
      method: req.method,
      queryKeys: Object.keys(req.query || {}),
      bodyKeys: Object.keys(body),
      action: action || null,
      type: type || null,
      topic: topic || null,
      dataId: body.data?.id || req.query?.['data.id'] || null,
      resourceId: body.resource || req.query?.id || body.id || null,
      userId: body.user_id || null,
      liveMode: body.live_mode ?? null,
    });

    const isPayment = type === 'payment' || topic === 'payment' || action.includes('payment');
    const isMerchantOrder = topic === 'merchant_order' || type === 'merchant_order';
    const isOrder = !isMerchantOrder && (type === 'order' || topic === 'order' || action.includes('order'));

    if (!isPayment && !isOrder && !isMerchantOrder) {
      console.log('[MP_WEBHOOK] ignored non-payment/order event');
      res.status(200).json({ success: true, message: 'ignored' });
      return;
    }

    const resourceIdFromUrl = typeof body.resource === 'string' ? body.resource.split('/').filter(Boolean).pop() : null;
    const rawWebhookId =
      body.data?.id ||
      req.query?.['data.id'] ||
      req.query?.id ||
      resourceIdFromUrl ||
      body.id;

    const webhookId = rawWebhookId ? String(rawWebhookId).trim() : '';

    if (!webhookId) {
      console.error('[MP_WEBHOOK] No ID found in webhook payload');
      res.status(200).json({ success: true, message: 'ignored no id' });
      return;
    }

    const accessToken = await getMercadoPagoAccessToken(db, projectId);
    if (!accessToken) {
      console.error(`[MP_WEBHOOK] Mercado Pago access token not found for project: ${projectId}`);
      res.status(500).json({ success: false, message: 'Internal Server Error' });
      return;
    }

    let resolution: MercadoPagoResolution | null = null;
    let externalReference = '';
    let mpOrderIdForLookup: string | null = null;

    if (isMerchantOrder) {
      const moRes = await mpApiGet(`/merchant_orders/${encodeURIComponent(webhookId)}`, accessToken);
      if (moRes.statusCode !== 200 || !moRes.data) {
        console.error(`[MP_WEBHOOK] Failed to get merchant_order info for id: ${webhookId}`);
        res.status(500).json({ success: false, message: 'Failed to fetch merchant_order info' });
        return;
      }
      const moData = moRes.data;
      externalReference = moData.external_reference ? String(moData.external_reference) : '';
      mpOrderIdForLookup = String(moData.id || webhookId);
      const moPayments: any[] = Array.isArray(moData.payments) ? moData.payments : [];
      const approvedPayment = moPayments.find((p) => String(p?.status || '').toLowerCase() === 'approved');
      const selectedPayment = approvedPayment || moPayments[0];

      if (selectedPayment?.id) {
        const fullPayment = await fetchMercadoPagoPayment(String(selectedPayment.id), accessToken);
        if (fullPayment) {
          resolution = resolveFromPaymentInfo(fullPayment, String(selectedPayment.id));
          if (!externalReference && fullPayment.external_reference) {
            externalReference = String(fullPayment.external_reference);
          }
        }
      }

      if (!resolution) {
        console.log('[MP_WEBHOOK] merchant_order sem pagamento resolvido ainda', { merchantOrderId: webhookId, externalReference });
        res.status(200).json({ success: true, message: 'merchant_order without payment yet' });
        return;
      }
    } else if (isOrder) {
      const orderInfo = await fetchMercadoPagoOrder(webhookId, accessToken);
      if (!orderInfo) {
        console.error(`[MP_WEBHOOK] Failed to get order info for id: ${webhookId}`);
        res.status(500).json({ success: false, message: 'Failed to fetch order info' });
        return;
      }
      resolution = resolveFromOrderInfo(orderInfo, webhookId);
      externalReference = resolution.externalReference || '';
      mpOrderIdForLookup = webhookId;
      console.log('[MP_WEBHOOK] order consultada', {
        mercadoPagoOrderId: webhookId,
        status: resolution.mpStatus,
        statusDetail: resolution.mpStatusDetail,
        externalReference: externalReference || null,
        transactionAmount: resolution.transactionAmount,
      });
    } else {
      const paymentInfo = await fetchMercadoPagoPayment(webhookId, accessToken);
      if (!paymentInfo) {
        console.error(`[MP_WEBHOOK] Failed to get payment info for id: ${webhookId}`);
        res.status(500).json({ success: false, message: 'Failed to fetch payment info' });
        return;
      }
      resolution = resolveFromPaymentInfo(paymentInfo, webhookId);
      externalReference = resolution.externalReference || '';
      mpOrderIdForLookup = resolution.mercadoPagoOrderId || null;

      console.log('[MP_WEBHOOK] payment consultado', {
        paymentId: webhookId,
        status: paymentInfo.status,
        statusDetail: paymentInfo.status_detail,
        externalReference: paymentInfo.external_reference,
        orderId: paymentInfo.order?.id,
        merchantOrderId: paymentInfo.order?.id,
        transactionAmount: paymentInfo.transaction_amount,
        paymentMethodId: paymentInfo.payment_method_id,
        paymentTypeId: paymentInfo.payment_type_id,
        dateApproved: paymentInfo.date_approved,
      });
    }

    let orderRef: FirebaseFirestore.DocumentReference | null = null;
    let orderSnap: FirebaseFirestore.DocumentSnapshot | null = null;

    // A) Direct lookup by external_reference = orderId
    if (externalReference && !externalReference.includes('/')) {
      const candidateRef = db.doc(`projects/${projectId}/orders/${externalReference}`);
      const candidateSnap = await candidateRef.get();
      if (candidateSnap.exists) {
        orderRef = candidateRef;
        orderSnap = candidateSnap;
      }
    }

    // B, C, D, E, F) Fallback queries
    if (!orderSnap?.exists) {
      const collectionRef = db.collection(`projects/${projectId}/orders`);
      const lookupSteps: Array<{ field: string; value: string }> = [];

      if (resolution.mercadoPagoPaymentId) {
        lookupSteps.push({ field: 'mercadoPagoPaymentId', value: resolution.mercadoPagoPaymentId });
        lookupSteps.push({ field: 'mercadoPagoTransactionId', value: resolution.mercadoPagoPaymentId });
      }
      if (webhookId && webhookId !== resolution.mercadoPagoPaymentId) {
        lookupSteps.push({ field: 'mercadoPagoPaymentId', value: webhookId });
        lookupSteps.push({ field: 'mercadoPagoTransactionId', value: webhookId });
      }
      if (mpOrderIdForLookup) {
        lookupSteps.push({ field: 'mercadoPagoOrderId', value: mpOrderIdForLookup });
      }
      if (externalReference) {
        lookupSteps.push({ field: 'externalReference', value: externalReference });
        lookupSteps.push({ field: 'orderCode', value: externalReference });
      }

      for (const step of lookupSteps) {
        const snap = await collectionRef.where(step.field, '==', step.value).limit(1).get();
        if (!snap.empty) {
          orderRef = snap.docs[0].ref;
          orderSnap = snap.docs[0];
          break;
        }
      }
    }

    if (!orderRef || !orderSnap?.exists) {
      console.error('[MP_WEBHOOK] pedido não encontrado para payment', {
        paymentId: webhookId,
        externalReference: externalReference || null,
        mercadoPagoOrderId: mpOrderIdForLookup,
        status: resolution.mpStatus,
        statusDetail: resolution.mpStatusDetail,
      });

      await db.collection(`projects/${projectId}/webhookErrors`).add({
        timestamp: FieldValue.serverTimestamp(),
        error: 'Order not found',
        webhookId,
        externalReference: externalReference || null,
        mercadoPagoOrderId: mpOrderIdForLookup,
        type: resolution.sourceType,
        status: resolution.mpStatus,
        statusDetail: resolution.mpStatusDetail,
      });

      res.status(200).json({ success: true, message: 'order not found' });
      return;
    }

    const orderData = (orderSnap.data() || {}) as Record<string, any>;
    const orderId = orderSnap.id;

    const applied = await applyPaymentResolutionToOrder(db, projectId, orderRef, orderData, resolution, {
      source: 'webhook',
      providerAction: action || 'webhook_received',
      webhookUserId: body.user_id ? String(body.user_id) : undefined,
    });

    console.log('[MP_WEBHOOK] pedido atualizado com sucesso', {
      orderId,
      orderCode: orderData.orderCode || orderData.code || null,
      paymentId: resolution.mercadoPagoPaymentId || webhookId,
      newStatus: applied.finalStatus,
      paymentStatus: applied.finalPaymentStatus,
      updated: applied.updated,
    });

    res.status(200).json({ success: true, message: 'Order processed' });
  } catch (error) {
    console.error('[MP_WEBHOOK] Erro interno:', error);
    res.status(500).json({ success: false, message: 'Internal error' });
  }
});

export const createMercadoPagoPix = functions.https.onRequest(async (req, res) => {
  // CORS configuration for public site
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, message: 'Method Not Allowed' });
    return;
  }

  try {
    let { projectId, orderId } = req.body;
    projectId = projectId || 'anailda-book';
    
    console.log(`[PIX_BACKEND] endpoint chamado`);
    console.log(`[PIX_BACKEND] projectId recebido: ${projectId}`);
    console.log(`[PIX_BACKEND] orderId recebido: ${orderId}`);

    if (!orderId) {
      res.status(400).json({ success: false, message: 'Missing orderId', code: 'ORDER_NOT_FOUND' });
      return;
    }

    // Buscar pedido
    const orderPath = `projects/${projectId}/orders/${orderId}`;
    console.log(`[PIX_BACKEND] caminho do pedido buscado: ${orderPath}`);
    const orderRef = db.doc(orderPath);
    const orderSnap = await orderRef.get();
    
    console.log(`[PIX_BACKEND] pedido encontrado? ${orderSnap.exists}`);

    if (!orderSnap.exists) {
      res.status(404).json({ success: false, message: 'Pedido não encontrado', code: 'ORDER_NOT_FOUND' });
      return;
    }

    const orderData = orderSnap.data() as any;

    if (orderData.paymentStatus !== 'pending' && orderData.status !== 'created' && orderData.status !== 'pending') {
      res.status(400).json({ success: false, message: 'Pedido já não está pendente', code: 'ORDER_NOT_PENDING' });
      return;
    }

    if (orderData.mercadoPagoPaymentId && orderData.pixQrCodeBase64) {
      console.log(`[PIX_BACKEND] retornando Pix já existente`);
      res.status(200).json({
        success: true,
        orderId,
        orderCode: orderData.orderCode,
        paymentId: orderData.mercadoPagoPaymentId,
        qrCode: orderData.pixQrCode,
        qrCodeBase64: orderData.pixQrCodeBase64,
        ticketUrl: orderData.pixTicketUrl,
        status: orderData.paymentStatus,
        paymentStatus: orderData.paymentStatus,
        publicStatusToken: orderData.publicStatusToken,
        publicStatusPath: orderData.publicStatusPath
      });
      return;
    }

    // Buscar Produto
    const productRef = db.doc(`products/${orderData.productId || 'anailda-book-main'}`);
    const productSnap = await productRef.get();
    
    if (!productSnap.exists) {
      res.status(404).json({ success: false, message: 'Produto não encontrado', code: 'PRODUCT_NOT_FOUND' });
      return;
    }

    const productData = productSnap.data() as any;
    
    if (productData.projectId !== projectId) {
      res.status(400).json({ success: false, message: 'Produto não pertence ao projeto', code: 'INVALID_PROJECT' });
      return;
    }

    if (productData.status !== 'active') {
      res.status(400).json({ success: false, message: 'Produto inativo', code: 'PRODUCT_INACTIVE' });
      return;
    }

    const amount = orderData.amount || productData.promotionalPrice || productData.originalPrice;

    // Buscar credenciais do Mercado Pago
    const secretPath = `projects/${projectId}/integration_secrets/mercadopago`;
    console.log(`[PIX_BACKEND] caminho da credencial buscada: ${secretPath}`);
    const secretsSnap = await db.doc(secretPath).get();

    if (!secretsSnap.exists) {
      console.error(`[PIX_BACKEND] Documento de credencial não encontrado`);
      res.status(500).json({ success: false, message: 'Credenciais não configuradas no admin', code: 'MERCADO_PAGO_SECRET_DOC_NOT_FOUND' });
      return;
    }

    const secretData = secretsSnap.data() as any;
    const accessToken = secretData.accessToken || secretData.access_token || secretData.token;

    console.log(`[PIX_BACKEND] accessToken existe? ${!!accessToken}`);

    if (!accessToken || accessToken === '') {
      res.status(500).json({ success: false, message: 'Token privado do Mercado Pago não encontrado no backend.', code: 'MERCADO_PAGO_ACCESS_TOKEN_NOT_FOUND' });
      return;
    }

    console.log(`[PIX_BACKEND] chamando Mercado Pago`);

    // Chamar Mercado Pago API
    const idempotencyKey = `pix-${orderId}`;
    
    const formattedAmount = Number(amount).toFixed(2);
    const email = (orderData.customer?.email || orderData.customerEmail || orderData.email || '').trim().toLowerCase();

    const payer: any = {
      email: email && email.includes('@') ? email : 'cliente@anailda.com.br'
    };

    const payloadObj: any = {
      type: "online",
      external_reference: orderId,
      total_amount: formattedAmount,
      processing_mode: "automatic",
      payer,
      transactions: {
        payments: [
          {
            amount: formattedAmount,
            payment_method: {
              id: "pix",
              type: "bank_transfer"
            }
          }
        ]
      }
    };
    const mpPayload = JSON.stringify(payloadObj);

    const mpOptions = {
      hostname: 'api.mercadopago.com',
      path: '/v1/orders',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-Idempotency-Key': idempotencyKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Content-Length': Buffer.byteLength(mpPayload)
      }
    };

    const mpResponse: any = await new Promise((resolve, reject) => {
      const request = https.request(mpOptions, (response) => {
        let responseData = '';
        response.on('data', (chunk) => responseData += chunk);
        response.on('end', () => {
           console.log(`[PIX_BACKEND] status HTTP Mercado Pago: ${response.statusCode}`);
           try {
             resolve({ statusCode: response.statusCode, headers: response.headers, data: JSON.parse(responseData) });
           } catch (e) {
             reject(e);
           }
        });
      });
      request.on('error', (e) => reject(e));
      request.write(mpPayload);
      request.end();
    });;

    console.log(`[PIX_BACKEND] Mercado Pago retornou pagamento? ${!!mpResponse?.data?.id}`);

    if (mpResponse.statusCode !== 200 && mpResponse.statusCode !== 201) {
      const errorData = mpResponse.data || {};

      console.error(
        '[PIX_BACKEND] MP error keys:',
        JSON.stringify({
          root: Object.keys(errorData || {}),
          errors: Array.isArray(errorData?.errors)
            ? errorData.errors.map((e: any) => ({
                keys: Object.keys(e || {}),
                detailKeys: Array.isArray(e?.details)
                  ? e.details.map((d: any) => Object.keys(d || {}))
                  : []
              }))
            : []
        })
      );

      const sanitizeMercadoPagoError = (obj: any): any => {
        if (Array.isArray(obj)) {
          return obj.map(sanitizeMercadoPagoError);
        } else if (obj !== null && typeof obj === 'object') {
          const redactedKeys = ['access_token', 'authorization', 'token', 'email', 'identification', 'document', 'cpf', 'phone', 'address', 'qr_code', 'qr_code_base64', 'ticket_url'];
          const newObj: any = {};
          for (const key of Object.keys(obj)) {
            if (redactedKeys.includes(key.toLowerCase())) {
              newObj[key] = '[REDACTED]';
            } else {
              newObj[key] = sanitizeMercadoPagoError(obj[key]);
            }
          }
          return newObj;
        }
        return obj;
      };

      const sanitizedErrorData = sanitizeMercadoPagoError(errorData);

      console.error(
        '[PIX_BACKEND] Payload enviado sanitizado:',
        JSON.stringify({
          type: payloadObj.type,
          external_reference: payloadObj.external_reference,
          total_amount: payloadObj.total_amount,
          processing_mode: payloadObj.processing_mode,
          payment_method: payloadObj.transactions?.payments?.[0]?.payment_method,
          hasPayerEmail: !!payloadObj.payer?.email,
          idempotencyKeyLength: idempotencyKey?.length
        })
      );

      console.error(
        '[PIX_BACKEND] Mercado Pago 402 sanitizado:',
        JSON.stringify(sanitizedErrorData)
      );

      const httpStatus = mpResponse.statusCode;
      const requestId = mpResponse.headers?.['x-request-id'];
      const mercadoPagoOrderId = sanitizedErrorData?.data?.id || null;
      const mercadoPagoUserId = sanitizedErrorData?.data?.user_id || null;
      const mercadoPagoApplicationId = sanitizedErrorData?.data?.integration_data?.application_id || null;
      const transactionStatus = sanitizedErrorData?.transactions?.payments?.[0]?.status || null;
      const transactionStatusDetail = sanitizedErrorData?.transactions?.payments?.[0]?.status_detail || null;

      console.error(
        '[PIX_BACKEND] Contexto do erro Mercado Pago:',
        JSON.stringify({
          httpStatus,
          requestId,
          orderId,
          projectId,
          formattedAmount,
          mercadoPagoOrderId,
          mercadoPagoUserId,
          mercadoPagoApplicationId,
          transactionStatus,
          transactionStatusDetail
        })
      );

      res.status(400).json({
        success: false,
        code: "MERCADO_PAGO_TRANSACTION_FAILED",
        message: "Não foi possível gerar o Pix no Mercado Pago.",
        mercadoPagoDebug: {
          httpStatus,
          requestId,
          orderId,
          mercadoPagoOrderId,
          mercadoPagoUserId,
          mercadoPagoApplicationId,
          transactionStatus,
          transactionStatusDetail,
          errors: sanitizedErrorData.errors || null,
          status: sanitizedErrorData.data?.status || null,
          statusDetail: sanitizedErrorData.data?.status_detail || null
        }
      });
      return;
    }

    const mpData = mpResponse.data;
    const mercadoPagoOrderId = mpData.id;
    const transaction = mpData.transactions?.payments?.[0];
    const transactionPaymentId = transaction?.id;
    const qrCode = transaction?.payment_method?.qr_code;
    const qrCodeBase64 = transaction?.payment_method?.qr_code_base64;
    const ticketUrl = transaction?.payment_method?.ticket_url;

    if (!qrCode || !qrCodeBase64) {
      console.error('[PIX_BACKEND] Erro Mercado Pago (QR Code ausente):', {
        status: mpResponse.statusCode,
        code: 'QR_CODE_MISSING',
        missing: { qrCode: !qrCode, qrCodeBase64: !qrCodeBase64 },
        requestId: mpResponse.headers?.['x-request-id']
      });
      res.status(500).json({ success: false, message: 'Não foi possível gerar o Pix agora.', code: 'QR_CODE_MISSING' });
      return;
    }    console.log(`[PIX_BACKEND] recebeu qrCode, qrCodeBase64 e ticketUrl? ${!!qrCode && !!qrCodeBase64 && !!ticketUrl}`);

    // Update order
    const publicStatusToken = orderData.publicStatusToken || crypto.randomBytes(32).toString('hex');
    const publicStatusPath = `/projects/${projectId}/publicCheckoutStatus/${publicStatusToken}`;
    const orderCode = orderData.orderCode || `AC-2026-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

    console.log(`[PIX_BACKEND] publicStatusPath retornado: ${publicStatusPath}`);

    const updateData: any = {
      paymentProvider: 'mercado_pago',
      paymentMethod: 'pix',
      paymentStatus: 'pending',
      status: 'pending',
      mercadoPagoPaymentId: transactionPaymentId ? String(transactionPaymentId) : null,
      mercadoPagoOrderId: String(mercadoPagoOrderId),
      mercadoPagoApi: "orders",
      mercadoPagoOrderStatus: mpData.status,
      mercadoPagoStatusDetail: mpData.status_detail,
      mercadoPagoTransactionStatus: transaction?.status || null,
      mercadoPagoTransactionStatusDetail: transaction?.status_detail || null,
      pixQrCode: qrCode || null,
      pixQrCodeBase64: qrCodeBase64 || null,
      pixTicketUrl: ticketUrl || null,
      pixGeneratedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      publicStatusToken,
      publicStatusPath,
      orderCode
    };

    await orderRef.update(updateData);

    // Create/update publicCheckoutStatus
    const publicStatusRef = db.doc(`projects/${projectId}/publicCheckoutStatus/${publicStatusToken}`);
    
    // Set expiresAt to 24 hours from now
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await publicStatusRef.set({
      projectId,
      orderId,
      orderCode,
      paymentProvider: 'mercado_pago',
      paymentMethod: 'pix',
      paymentStatus: 'pending',
      status: 'pending',
      mercadoPagoPaymentId: transactionPaymentId ? String(transactionPaymentId) : null,
      mercadoPagoOrderId: String(mercadoPagoOrderId),
      amount: amount,
      currency: 'BRL',
      productTitle: productData.title || 'A Mulher — Anailda Cabral',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt: expiresAt,
      paidAt: null
    }, { merge: true });

    // Create event
    const eventRef = db.collection(`projects/${projectId}/orderEvents`).doc();
    await eventRef.set({
      orderId,
      eventName: 'pix_generated',
      status: 'pending',
      paymentStatus: 'pending',
      provider: 'mercado_pago',
      mercadoPagoPaymentId: String(mpData.id),
      createdAt: FieldValue.serverTimestamp()
    });

    console.log(`[PIX_BACKEND] pedido atualizado e resposta enviada com sucesso`);

    res.status(200).json({
      success: true,
      orderId,
      orderCode,
      paymentId: String(mercadoPagoOrderId),
      qrCode,
      qrCodeBase64,
      ticketUrl,
      status: 'pending',
      paymentStatus: 'pending',
      publicStatusToken,
      publicStatusPath
    });

  } catch (error: any) {
    console.error('[PIX_BACKEND] Erro interno:', error);
    res.status(500).json({ success: false, message: 'Não foi possível gerar o Pix agora.', code: error.code || 'INTERNAL_ERROR' });
  }
});
export * from './pushNotifications';
export * from './users';
export * from './shipping';
export * from './analytics';
export * from './mercadoPagoSync';

