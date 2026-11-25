import * as functions from 'firebase-functions';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

export const onOrderShippingUpdated = functions.firestore
  .document('projects/{projectId}/orders/{orderId}')
  .onUpdate(async (change, context) => {
    const beforeData = change.before.data();
    const afterData = change.after.data();

    const beforeShippingStatus = beforeData?.shipping?.status;
    const afterShippingStatus = afterData?.shipping?.status;

    // Check if shipping status changed
    if (afterShippingStatus && beforeShippingStatus !== afterShippingStatus) {
      const { projectId, orderId } = context.params;
      const customerEmail = afterData?.customerEmail || afterData?.customer?.email;
      const customerName = afterData?.customerName || afterData?.customer?.name || 'Cliente';
      const trackingCode = afterData?.shipping?.trackingCode;
      
      console.log(`[SHIPPING] Order ${orderId} shipping status changed from ${beforeShippingStatus} to ${afterShippingStatus}`);

      // Check dedupe flag
      const shippingPushFlags = afterData.shippingPushFlags || {};
      const flagKey = `${afterShippingStatus}Sent`;
      if (shippingPushFlags[flagKey]) {
         console.log(`[SHIPPING] Push for ${afterShippingStatus} already sent for order ${orderId}. Skipping.`);
      } else {
         const db = getFirestore();

         // 1. Send push to admin and publisher_operator
         try {
            const tokensSnapshot = await db.collection('pushTokens')
              .where('projectId', '==', projectId)
              .where('role', 'in', ['admin', 'publisher_operator'])
              .where('active', '==', true)
              .get();

            if (!tokensSnapshot.empty) {
               const tokens = Array.from(new Set(tokensSnapshot.docs.map(doc => doc.id)));
               let pushTitle = 'Atualização de envio';
               let pushBody = `O status de envio do pedido de ${customerName} mudou.`;

               switch(afterShippingStatus) {
                  case 'preparing':
                     pushTitle = 'Pedido em separação';
                     pushBody = `O pedido de ${customerName} entrou em separação.`;
                     break;
                  case 'shipped':
                     pushTitle = 'Pedido enviado';
                     pushBody = `O pedido de ${customerName} foi marcado como enviado.`;
                     break;
                  case 'out_for_delivery':
                     pushTitle = 'Saiu para entrega';
                     pushBody = `O pedido de ${customerName} saiu para entrega.`;
                     break;
                  case 'delivered':
                     pushTitle = 'Pedido entregue';
                     pushBody = `O pedido de ${customerName} foi marcado como entregue.`;
                     break;
                  case 'returned':
                     pushTitle = 'Pedido devolvido';
                     pushBody = `O pedido de ${customerName} foi marcado como devolvido.`;
                     break;
                  case 'issue':
                     pushTitle = 'Problema no envio';
                     pushBody = `O pedido de ${customerName} foi marcado com problema.`;
                     break;
               }

               const payload = {
                  data: {
                     type: 'shipping_status_updated',
                     title: pushTitle,
                     body: pushBody,
                     orderId: orderId,
                     projectId: projectId,
                     url: `/shipping`,
                     tag: `shipping-${afterShippingStatus}-${orderId}`
                  }
               };

               const response = await getMessaging().sendEachForMulticast({
                  tokens,
                  ...payload
               });
               
               console.log(`[SHIPPING] Push sent to ${tokens.length} tokens. Success: ${response.successCount}, Failures: ${response.failureCount}`);
            }

            // Mark as sent
            await change.after.ref.update({
               [`shippingPushFlags.${flagKey}`]: true,
               [`shippingPushFlags.${flagKey}At`]: FieldValue.serverTimestamp()
            });

         } catch(e) {
            console.error(`[SHIPPING] Error sending push:`, e);
         }
      }

      // 2. Create orderEvent for internal notifications
      const db = getFirestore();
      let eventName = '';
      if (afterShippingStatus === 'preparing') eventName = 'shipping_preparing';
      else if (afterShippingStatus === 'shipped') eventName = 'shipping_shipped';
      else if (afterShippingStatus === 'out_for_delivery') eventName = 'shipping_out_for_delivery';
      else if (afterShippingStatus === 'delivered') eventName = 'shipping_delivered';
      else if (afterShippingStatus === 'issue' || afterShippingStatus === 'returned') eventName = 'shipping_issue';

      if (eventName) {
        const eventId = `shipping_${afterShippingStatus}_${orderId}`;
        const eventRef = db.collection(`projects/${projectId}/orderEvents`).doc(eventId);
        const eventSnap = await eventRef.get();
        if (!eventSnap.exists) {
          await eventRef.set({
            orderId: orderId,
            eventName: eventName,
            status: afterShippingStatus,
            createdAt: FieldValue.serverTimestamp()
          });
          console.log(`[SHIPPING] Event created: ${eventId}`);
        }
      }

      // 3. Mock Email notification
      if (customerEmail) {
        let subject = '';
        let message = '';

        switch (afterShippingStatus) {
          case 'preparing':
            subject = 'Seu pedido está em separação!';
            message = `Olá, estamos preparando seu pedido ${orderId} para envio.`;
            break;
          case 'shipped':
            subject = 'Seu pedido foi enviado!';
            message = `Seu pedido ${orderId} foi enviado.`;
            if (trackingCode) {
              message += ` Código de rastreio: ${trackingCode}`;
            }
            break;
          case 'out_for_delivery':
            subject = 'Seu pedido saiu para entrega!';
            message = `Olá, seu pedido ${orderId} saiu para entrega e chegará em breve.`;
            break;
          case 'delivered':
            subject = 'Seu pedido foi entregue!';
            message = `Oba! Seu pedido ${orderId} foi entregue com sucesso.`;
            break;
          case 'returned':
            subject = 'Atualização sobre o seu pedido';
            message = `Seu pedido ${orderId} consta como devolvido. Entraremos em contato.`;
            break;
        }

        if (subject && message) {
          console.log(`[EMAIL_MOCK] E-mail de notificação de envio seria enviado para: ${customerEmail}`);
          console.log(`[EMAIL_MOCK] Assunto: ${subject}`);
          console.log(`[EMAIL_MOCK] Mensagem: ${message}`);
        }
      } else {
        console.log(`[SHIPPING] No customer email found for order ${orderId} to send notification.`);
      }
    }
  });

export const updateOrderShipping = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
  }

  const { orderId, shippingData } = data;
  
  if (!orderId || !shippingData) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required fields.');
  }

  const db = getFirestore();
  const uid = context.auth.uid;
  const userDoc = await db.collection('users').doc(uid).get();
  
  if (!userDoc.exists) {
    throw new functions.https.HttpsError('permission-denied', 'User record not found.');
  }

  const userRole = userDoc.data()?.role;
  if (userRole !== 'admin' && userRole !== 'publisher_operator') {
    throw new functions.https.HttpsError('permission-denied', 'You do not have permission to update shipping.');
  }

  const orderRef = db.doc(`projects/anailda-book/orders/${orderId}`);
  const orderDoc = await orderRef.get();

  if (!orderDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Order not found.');
  }

  const orderData = orderDoc.data()!;
  if (orderData.paymentStatus !== 'paid' && orderData.paymentStatus !== 'approved') {
    throw new functions.https.HttpsError('failed-precondition', 'Este pedido ainda não teve pagamento confirmado.');
  }

  const currentShipping = orderData.shipping || {};
  const newShipping = {
    ...currentShipping,
    ...shippingData,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: uid
  };

  // Only allow updating shipping fields
  await orderRef.update({
    shipping: newShipping
  });

  // Create history event
  await orderRef.collection('shippingEvents').add({
    status: newShipping.status || 'not_started',
    label: getShippingStatusLabel(newShipping.status),
    notes: shippingData.notes || '',
    trackingCode: newShipping.trackingCode || '',
    trackingUrl: newShipping.trackingUrl || '',
    carrier: newShipping.carrier || '',
    createdAt: FieldValue.serverTimestamp(),
    createdBy: uid,
    createdByName: userDoc.data()?.name || 'Unknown'
  });

  return { success: true };
});

function getShippingStatusLabel(status: string) {
  switch(status) {
    case 'protocol_started': return 'Protocolo iniciado';
    case 'preparing': return 'Em separação';
    case 'shipped': return 'Enviado';
    case 'out_for_delivery': return 'Saiu para entrega';
    case 'delivered': return 'Entregue';
    case 'returned': return 'Devolvido';
    case 'issue': return 'Problema';
    default: return 'Aguardando envio';
  }
}
