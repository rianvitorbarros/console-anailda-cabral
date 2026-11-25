"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMercadoPagoPix = exports.mercadoPagoWebhook = void 0;
const functions = require("firebase-functions");
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const https = require("https");
const crypto = require("crypto");
const mercadoPagoSync_1 = require("./mercadoPagoSync");
if ((0, app_1.getApps)().length === 0) {
    (0, app_1.initializeApp)();
}
const db = (0, firestore_1.getFirestore)();
exports.mercadoPagoWebhook = functions.https.onRequest(async (req, res) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
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
        const projectId = req.query.projectId || 'anailda-book';
        if (projectId !== 'anailda-book') {
            res.status(400).json({ success: false, message: 'Invalid projectId' });
            return;
        }
        const body = (req.body && typeof req.body === 'object') ? req.body : {};
        const queryType = typeof ((_a = req.query) === null || _a === void 0 ? void 0 : _a.type) === 'string' ? req.query.type : '';
        const queryTopic = typeof ((_b = req.query) === null || _b === void 0 ? void 0 : _b.topic) === 'string' ? req.query.topic : '';
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
            dataId: ((_c = body.data) === null || _c === void 0 ? void 0 : _c.id) || ((_d = req.query) === null || _d === void 0 ? void 0 : _d['data.id']) || null,
            resourceId: body.resource || ((_e = req.query) === null || _e === void 0 ? void 0 : _e.id) || body.id || null,
            userId: body.user_id || null,
            liveMode: (_f = body.live_mode) !== null && _f !== void 0 ? _f : null,
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
        const rawWebhookId = ((_g = body.data) === null || _g === void 0 ? void 0 : _g.id) ||
            ((_h = req.query) === null || _h === void 0 ? void 0 : _h['data.id']) ||
            ((_j = req.query) === null || _j === void 0 ? void 0 : _j.id) ||
            resourceIdFromUrl ||
            body.id;
        const webhookId = rawWebhookId ? String(rawWebhookId).trim() : '';
        if (!webhookId) {
            console.error('[MP_WEBHOOK] No ID found in webhook payload');
            res.status(200).json({ success: true, message: 'ignored no id' });
            return;
        }
        const accessToken = await (0, mercadoPagoSync_1.getMercadoPagoAccessToken)(db, projectId);
        if (!accessToken) {
            console.error(`[MP_WEBHOOK] Mercado Pago access token not found for project: ${projectId}`);
            res.status(500).json({ success: false, message: 'Internal Server Error' });
            return;
        }
        let resolution = null;
        let externalReference = '';
        let mpOrderIdForLookup = null;
        if (isMerchantOrder) {
            const moRes = await (0, mercadoPagoSync_1.mpApiGet)(`/merchant_orders/${encodeURIComponent(webhookId)}`, accessToken);
            if (moRes.statusCode !== 200 || !moRes.data) {
                console.error(`[MP_WEBHOOK] Failed to get merchant_order info for id: ${webhookId}`);
                res.status(500).json({ success: false, message: 'Failed to fetch merchant_order info' });
                return;
            }
            const moData = moRes.data;
            externalReference = moData.external_reference ? String(moData.external_reference) : '';
            mpOrderIdForLookup = String(moData.id || webhookId);
            const moPayments = Array.isArray(moData.payments) ? moData.payments : [];
            const approvedPayment = moPayments.find((p) => String((p === null || p === void 0 ? void 0 : p.status) || '').toLowerCase() === 'approved');
            const selectedPayment = approvedPayment || moPayments[0];
            if (selectedPayment === null || selectedPayment === void 0 ? void 0 : selectedPayment.id) {
                const fullPayment = await (0, mercadoPagoSync_1.fetchMercadoPagoPayment)(String(selectedPayment.id), accessToken);
                if (fullPayment) {
                    resolution = (0, mercadoPagoSync_1.resolveFromPaymentInfo)(fullPayment, String(selectedPayment.id));
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
        }
        else if (isOrder) {
            const orderInfo = await (0, mercadoPagoSync_1.fetchMercadoPagoOrder)(webhookId, accessToken);
            if (!orderInfo) {
                console.error(`[MP_WEBHOOK] Failed to get order info for id: ${webhookId}`);
                res.status(500).json({ success: false, message: 'Failed to fetch order info' });
                return;
            }
            resolution = (0, mercadoPagoSync_1.resolveFromOrderInfo)(orderInfo, webhookId);
            externalReference = resolution.externalReference || '';
            mpOrderIdForLookup = webhookId;
            console.log('[MP_WEBHOOK] order consultada', {
                mercadoPagoOrderId: webhookId,
                status: resolution.mpStatus,
                statusDetail: resolution.mpStatusDetail,
                externalReference: externalReference || null,
                transactionAmount: resolution.transactionAmount,
            });
        }
        else {
            const paymentInfo = await (0, mercadoPagoSync_1.fetchMercadoPagoPayment)(webhookId, accessToken);
            if (!paymentInfo) {
                console.error(`[MP_WEBHOOK] Failed to get payment info for id: ${webhookId}`);
                res.status(500).json({ success: false, message: 'Failed to fetch payment info' });
                return;
            }
            resolution = (0, mercadoPagoSync_1.resolveFromPaymentInfo)(paymentInfo, webhookId);
            externalReference = resolution.externalReference || '';
            mpOrderIdForLookup = resolution.mercadoPagoOrderId || null;
            console.log('[MP_WEBHOOK] payment consultado', {
                paymentId: webhookId,
                status: paymentInfo.status,
                statusDetail: paymentInfo.status_detail,
                externalReference: paymentInfo.external_reference,
                orderId: (_k = paymentInfo.order) === null || _k === void 0 ? void 0 : _k.id,
                merchantOrderId: (_l = paymentInfo.order) === null || _l === void 0 ? void 0 : _l.id,
                transactionAmount: paymentInfo.transaction_amount,
                paymentMethodId: paymentInfo.payment_method_id,
                paymentTypeId: paymentInfo.payment_type_id,
                dateApproved: paymentInfo.date_approved,
            });
        }
        let orderRef = null;
        let orderSnap = null;
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
        if (!(orderSnap === null || orderSnap === void 0 ? void 0 : orderSnap.exists)) {
            const collectionRef = db.collection(`projects/${projectId}/orders`);
            const lookupSteps = [];
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
        if (!orderRef || !(orderSnap === null || orderSnap === void 0 ? void 0 : orderSnap.exists)) {
            console.error('[MP_WEBHOOK] pedido não encontrado para payment', {
                paymentId: webhookId,
                externalReference: externalReference || null,
                mercadoPagoOrderId: mpOrderIdForLookup,
                status: resolution.mpStatus,
                statusDetail: resolution.mpStatusDetail,
            });
            await db.collection(`projects/${projectId}/webhookErrors`).add({
                timestamp: firestore_1.FieldValue.serverTimestamp(),
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
        const orderData = (orderSnap.data() || {});
        const orderId = orderSnap.id;
        const applied = await (0, mercadoPagoSync_1.applyPaymentResolutionToOrder)(db, projectId, orderRef, orderData, resolution, {
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
    }
    catch (error) {
        console.error('[MP_WEBHOOK] Erro interno:', error);
        res.status(500).json({ success: false, message: 'Internal error' });
    }
});
exports.createMercadoPagoPix = functions.https.onRequest(async (req, res) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0;
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
        const orderData = orderSnap.data();
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
        const productData = productSnap.data();
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
        const secretData = secretsSnap.data();
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
        const email = (((_a = orderData.customer) === null || _a === void 0 ? void 0 : _a.email) || orderData.customerEmail || orderData.email || '').trim().toLowerCase();
        const payer = {
            email: email && email.includes('@') ? email : 'cliente@anailda.com.br'
        };
        const payloadObj = {
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
        const mpResponse = await new Promise((resolve, reject) => {
            const request = https.request(mpOptions, (response) => {
                let responseData = '';
                response.on('data', (chunk) => responseData += chunk);
                response.on('end', () => {
                    console.log(`[PIX_BACKEND] status HTTP Mercado Pago: ${response.statusCode}`);
                    try {
                        resolve({ statusCode: response.statusCode, headers: response.headers, data: JSON.parse(responseData) });
                    }
                    catch (e) {
                        reject(e);
                    }
                });
            });
            request.on('error', (e) => reject(e));
            request.write(mpPayload);
            request.end();
        });
        ;
        console.log(`[PIX_BACKEND] Mercado Pago retornou pagamento? ${!!((_b = mpResponse === null || mpResponse === void 0 ? void 0 : mpResponse.data) === null || _b === void 0 ? void 0 : _b.id)}`);
        if (mpResponse.statusCode !== 200 && mpResponse.statusCode !== 201) {
            const errorData = mpResponse.data || {};
            console.error('[PIX_BACKEND] MP error keys:', JSON.stringify({
                root: Object.keys(errorData || {}),
                errors: Array.isArray(errorData === null || errorData === void 0 ? void 0 : errorData.errors)
                    ? errorData.errors.map((e) => ({
                        keys: Object.keys(e || {}),
                        detailKeys: Array.isArray(e === null || e === void 0 ? void 0 : e.details)
                            ? e.details.map((d) => Object.keys(d || {}))
                            : []
                    }))
                    : []
            }));
            const sanitizeMercadoPagoError = (obj) => {
                if (Array.isArray(obj)) {
                    return obj.map(sanitizeMercadoPagoError);
                }
                else if (obj !== null && typeof obj === 'object') {
                    const redactedKeys = ['access_token', 'authorization', 'token', 'email', 'identification', 'document', 'cpf', 'phone', 'address', 'qr_code', 'qr_code_base64', 'ticket_url'];
                    const newObj = {};
                    for (const key of Object.keys(obj)) {
                        if (redactedKeys.includes(key.toLowerCase())) {
                            newObj[key] = '[REDACTED]';
                        }
                        else {
                            newObj[key] = sanitizeMercadoPagoError(obj[key]);
                        }
                    }
                    return newObj;
                }
                return obj;
            };
            const sanitizedErrorData = sanitizeMercadoPagoError(errorData);
            console.error('[PIX_BACKEND] Payload enviado sanitizado:', JSON.stringify({
                type: payloadObj.type,
                external_reference: payloadObj.external_reference,
                total_amount: payloadObj.total_amount,
                processing_mode: payloadObj.processing_mode,
                payment_method: (_e = (_d = (_c = payloadObj.transactions) === null || _c === void 0 ? void 0 : _c.payments) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.payment_method,
                hasPayerEmail: !!((_f = payloadObj.payer) === null || _f === void 0 ? void 0 : _f.email),
                idempotencyKeyLength: idempotencyKey === null || idempotencyKey === void 0 ? void 0 : idempotencyKey.length
            }));
            console.error('[PIX_BACKEND] Mercado Pago 402 sanitizado:', JSON.stringify(sanitizedErrorData));
            const httpStatus = mpResponse.statusCode;
            const requestId = (_g = mpResponse.headers) === null || _g === void 0 ? void 0 : _g['x-request-id'];
            const mercadoPagoOrderId = ((_h = sanitizedErrorData === null || sanitizedErrorData === void 0 ? void 0 : sanitizedErrorData.data) === null || _h === void 0 ? void 0 : _h.id) || null;
            const mercadoPagoUserId = ((_j = sanitizedErrorData === null || sanitizedErrorData === void 0 ? void 0 : sanitizedErrorData.data) === null || _j === void 0 ? void 0 : _j.user_id) || null;
            const mercadoPagoApplicationId = ((_l = (_k = sanitizedErrorData === null || sanitizedErrorData === void 0 ? void 0 : sanitizedErrorData.data) === null || _k === void 0 ? void 0 : _k.integration_data) === null || _l === void 0 ? void 0 : _l.application_id) || null;
            const transactionStatus = ((_p = (_o = (_m = sanitizedErrorData === null || sanitizedErrorData === void 0 ? void 0 : sanitizedErrorData.transactions) === null || _m === void 0 ? void 0 : _m.payments) === null || _o === void 0 ? void 0 : _o[0]) === null || _p === void 0 ? void 0 : _p.status) || null;
            const transactionStatusDetail = ((_s = (_r = (_q = sanitizedErrorData === null || sanitizedErrorData === void 0 ? void 0 : sanitizedErrorData.transactions) === null || _q === void 0 ? void 0 : _q.payments) === null || _r === void 0 ? void 0 : _r[0]) === null || _s === void 0 ? void 0 : _s.status_detail) || null;
            console.error('[PIX_BACKEND] Contexto do erro Mercado Pago:', JSON.stringify({
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
            }));
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
                    status: ((_t = sanitizedErrorData.data) === null || _t === void 0 ? void 0 : _t.status) || null,
                    statusDetail: ((_u = sanitizedErrorData.data) === null || _u === void 0 ? void 0 : _u.status_detail) || null
                }
            });
            return;
        }
        const mpData = mpResponse.data;
        const mercadoPagoOrderId = mpData.id;
        const transaction = (_w = (_v = mpData.transactions) === null || _v === void 0 ? void 0 : _v.payments) === null || _w === void 0 ? void 0 : _w[0];
        const transactionPaymentId = transaction === null || transaction === void 0 ? void 0 : transaction.id;
        const qrCode = (_x = transaction === null || transaction === void 0 ? void 0 : transaction.payment_method) === null || _x === void 0 ? void 0 : _x.qr_code;
        const qrCodeBase64 = (_y = transaction === null || transaction === void 0 ? void 0 : transaction.payment_method) === null || _y === void 0 ? void 0 : _y.qr_code_base64;
        const ticketUrl = (_z = transaction === null || transaction === void 0 ? void 0 : transaction.payment_method) === null || _z === void 0 ? void 0 : _z.ticket_url;
        if (!qrCode || !qrCodeBase64) {
            console.error('[PIX_BACKEND] Erro Mercado Pago (QR Code ausente):', {
                status: mpResponse.statusCode,
                code: 'QR_CODE_MISSING',
                missing: { qrCode: !qrCode, qrCodeBase64: !qrCodeBase64 },
                requestId: (_0 = mpResponse.headers) === null || _0 === void 0 ? void 0 : _0['x-request-id']
            });
            res.status(500).json({ success: false, message: 'Não foi possível gerar o Pix agora.', code: 'QR_CODE_MISSING' });
            return;
        }
        console.log(`[PIX_BACKEND] recebeu qrCode, qrCodeBase64 e ticketUrl? ${!!qrCode && !!qrCodeBase64 && !!ticketUrl}`);
        // Update order
        const publicStatusToken = orderData.publicStatusToken || crypto.randomBytes(32).toString('hex');
        const publicStatusPath = `/projects/${projectId}/publicCheckoutStatus/${publicStatusToken}`;
        const orderCode = orderData.orderCode || `AC-2026-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
        console.log(`[PIX_BACKEND] publicStatusPath retornado: ${publicStatusPath}`);
        const updateData = {
            paymentProvider: 'mercado_pago',
            paymentMethod: 'pix',
            paymentStatus: 'pending',
            status: 'pending',
            mercadoPagoPaymentId: transactionPaymentId ? String(transactionPaymentId) : null,
            mercadoPagoOrderId: String(mercadoPagoOrderId),
            mercadoPagoApi: "orders",
            mercadoPagoOrderStatus: mpData.status,
            mercadoPagoStatusDetail: mpData.status_detail,
            mercadoPagoTransactionStatus: (transaction === null || transaction === void 0 ? void 0 : transaction.status) || null,
            mercadoPagoTransactionStatusDetail: (transaction === null || transaction === void 0 ? void 0 : transaction.status_detail) || null,
            pixQrCode: qrCode || null,
            pixQrCodeBase64: qrCodeBase64 || null,
            pixTicketUrl: ticketUrl || null,
            pixGeneratedAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
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
            createdAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
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
            createdAt: firestore_1.FieldValue.serverTimestamp()
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
    }
    catch (error) {
        console.error('[PIX_BACKEND] Erro interno:', error);
        res.status(500).json({ success: false, message: 'Não foi possível gerar o Pix agora.', code: error.code || 'INTERNAL_ERROR' });
    }
});
__exportStar(require("./pushNotifications"), exports);
__exportStar(require("./users"), exports);
__exportStar(require("./shipping"), exports);
__exportStar(require("./analytics"), exports);
__exportStar(require("./mercadoPagoSync"), exports);
//# sourceMappingURL=index.js.map