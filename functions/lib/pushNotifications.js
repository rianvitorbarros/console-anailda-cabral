"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onOrderUpdatedPush = exports.onOrderCreatedPush = void 0;
const functions = require("firebase-functions");
const firestore_1 = require("firebase-admin/firestore");
const messaging_1 = require("firebase-admin/messaging");
const db = (0, firestore_1.getFirestore)();
function formatCurrencyBRL(amount) {
    if (amount === undefined || amount === null)
        return 'valor não informado';
    const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(numericAmount))
        return 'valor não informado';
    return numericAmount.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}
function getOrderDetails(data, orderId) {
    var _a, _b;
    const orderCode = data.orderCode || orderId.substring(0, 8);
    const isCombo = ((_a = data.productSnapshot) === null || _a === void 0 ? void 0 : _a.productType) === 'combo' || data.productId === 'combo-a-mulher' || (data.productTitle && data.productTitle.toLowerCase().includes('combo'));
    let productTitle = data.productTitle || ((_b = data.productSnapshot) === null || _b === void 0 ? void 0 : _b.title) || 'Produto indefinido';
    let isMultiple = false;
    let itemsCount = 0;
    if (data.items && Array.isArray(data.items) && data.items.length > 0) {
        itemsCount = data.items.length;
        if (itemsCount === 1) {
            productTitle = data.items[0].title;
        }
        else {
            isMultiple = true;
            if (isCombo) {
                productTitle = data.productTitle || 'Combo completo A Mulher';
            }
            else {
                productTitle = `${itemsCount} itens`;
            }
        }
    }
    const amountStr = formatCurrencyBRL(data.amount);
    const customerName = data.customerName || 'Cliente';
    const trackingCode = data.trackingCode || data.trackingNumber || null;
    return { orderCode, productTitle, isCombo, isMultiple, itemsCount, amountStr, customerName, trackingCode };
}
async function sendPushNotification(projectId, payloadData) {
    console.log(`[PUSH_NOTIFICATION] preparando notificação`);
    console.log(`[PUSH_NOTIFICATION] tipo: ${payloadData.type}`);
    console.log(`[PUSH_NOTIFICATION] orderId: ${payloadData.orderId}`);
    console.log(`[PUSH_NOTIFICATION] orderCode: ${payloadData.orderCode}`);
    console.log(`[PUSH_NOTIFICATION] productTitle: ${payloadData.productTitle}`);
    console.log(`[PUSH_NOTIFICATION] amount formatado: ${payloadData.amountStr}`);
    console.log(`[PUSH_NOTIFICATION] customerName: ${payloadData.customerName}`);
    try {
        const tokensSnapshot = await db.collection('pushTokens')
            .where('projectId', '==', projectId)
            .where('role', 'in', ['admin', 'publisher_operator'])
            .where('active', '==', true)
            .get();
        if (tokensSnapshot.empty) {
            console.log(`[PUSH_NOTIFICATION] Nenhum token ativo encontrado.`);
            return;
        }
        const tokens = [];
        tokensSnapshot.forEach(doc => tokens.push(doc.id));
        console.log(`[PUSH_NOTIFICATION] tokens encontrados: ${tokens.length}`);
        // Ensure we don't send extra fields not expected by the data payload
        const dataPayload = {
            type: payloadData.type,
            title: payloadData.title,
            body: payloadData.body,
            orderId: payloadData.orderId,
            orderCode: payloadData.orderCode,
            projectId: projectId,
            url: `/orders/${payloadData.orderId}`,
            tag: payloadData.tag
        };
        const response = await (0, messaging_1.getMessaging)().sendEachForMulticast({
            tokens,
            data: dataPayload
        });
        console.log(`[PUSH_NOTIFICATION] notificação enviada com sucesso (Sucesso: ${response.successCount}, Falha: ${response.failureCount})`);
        if (response.failureCount > 0) {
            const failedTokens = [];
            response.responses.forEach((resp, idx) => {
                var _a;
                if (!resp.success) {
                    const errCode = (_a = resp.error) === null || _a === void 0 ? void 0 : _a.code;
                    if (errCode === 'messaging/invalid-registration-token' ||
                        errCode === 'messaging/registration-token-not-registered') {
                        failedTokens.push(tokens[idx]);
                    }
                }
            });
            if (failedTokens.length > 0) {
                const batch = db.batch();
                failedTokens.forEach(token => {
                    batch.update(db.collection('pushTokens').doc(token), {
                        active: false,
                        disabledAt: firestore_1.FieldValue.serverTimestamp(),
                        disabledReason: 'invalid-token'
                    });
                });
                await batch.commit();
                console.log(`[PUSH_NOTIFICATION] tokens inválidos removidos: ${failedTokens.length}`);
            }
        }
    }
    catch (err) {
        console.error(`[PUSH_NOTIFICATION] Erro ao enviar notificação:`, err);
    }
}
exports.onOrderCreatedPush = functions.firestore
    .document('projects/{projectId}/orders/{orderId}')
    .onCreate(async (snap, context) => {
    const { projectId, orderId } = context.params;
    if (projectId !== 'anailda-book')
        return;
    const data = snap.data();
    const pushNotifications = data.pushNotifications || {};
    if (pushNotifications.orderCreatedSent) {
        console.log(`[PUSH_NOTIFICATION] orderCreatedSent já enviado para ${orderId}. Ignorando.`);
        return;
    }
    const { orderCode, productTitle, amountStr, customerName } = getOrderDetails(data, orderId);
    const title = `🛒 Novo pedido — ${amountStr}`;
    const body = `Produto: ${productTitle} • Cliente: ${customerName} • Pedido: ${orderCode} • Pendente`;
    await sendPushNotification(projectId, {
        type: 'order_created',
        tag: `order-created-${orderId}`,
        title,
        body,
        orderId,
        orderCode,
        productTitle,
        amountStr,
        customerName
    });
    await snap.ref.update({
        'pushNotifications.orderCreatedSent': true,
        'pushNotifications.orderCreatedSentAt': firestore_1.FieldValue.serverTimestamp()
    });
});
exports.onOrderUpdatedPush = functions.firestore
    .document('projects/{projectId}/orders/{orderId}')
    .onUpdate(async (change, context) => {
    const { projectId, orderId } = context.params;
    if (projectId !== 'anailda-book')
        return;
    const beforeData = change.before.data();
    const afterData = change.after.data();
    const pushNotifications = afterData.pushNotifications || {};
    const { orderCode, productTitle, isCombo, amountStr, customerName, trackingCode } = getOrderDetails(afterData, orderId);
    // 1. Payment Confirmed
    const beforeStatus = beforeData.paymentStatus;
    const afterStatus = afterData.paymentStatus;
    if ((beforeStatus !== 'paid' && beforeStatus !== 'approved') &&
        (afterStatus === 'paid' || afterStatus === 'approved')) {
        if (!pushNotifications.salePaidSent) {
            const title = isCombo ? `💰 Combo vendido — ${amountStr}` : `💰 Venda confirmada — ${amountStr}`;
            const body = `Produto: ${productTitle} • Cliente: ${customerName} • Pedido: ${orderCode} • Pago`;
            await sendPushNotification(projectId, {
                type: 'order_paid',
                tag: `order-paid-${orderId}`,
                title,
                body,
                orderId,
                orderCode,
                productTitle,
                amountStr,
                customerName
            });
            await change.after.ref.update({
                'pushNotifications.salePaidSent': true,
                'pushNotifications.salePaidSentAt': firestore_1.FieldValue.serverTimestamp()
            });
        }
    }
    // 2. Order Shipped
    const beforeOrderSt = beforeData.status;
    const afterOrderSt = afterData.status;
    if (beforeOrderSt !== 'shipped' && afterOrderSt === 'shipped') {
        if (!pushNotifications.shippedSent) {
            let title = `📦 Pedido enviado — ${amountStr}`;
            let body = `Produto: ${productTitle} • Cliente: ${customerName} • Pedido: ${orderCode} • Enviado`;
            if (trackingCode) {
                title = `📦 Rastreio disponível — ${amountStr}`;
                body = `Código: ${trackingCode} • Produto: ${productTitle} • Cliente: ${customerName} • Pedido: ${orderCode}`;
            }
            await sendPushNotification(projectId, {
                type: 'order_shipped',
                tag: `order-shipped-${orderId}`,
                title,
                body,
                orderId,
                orderCode,
                productTitle,
                amountStr,
                customerName
            });
            await change.after.ref.update({
                'pushNotifications.shippedSent': true,
                'pushNotifications.shippedSentAt': firestore_1.FieldValue.serverTimestamp()
            });
        }
    }
});
//# sourceMappingURL=pushNotifications.js.map