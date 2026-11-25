import { collection, onSnapshot, query, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export interface OrderEvent {
  id: string;
  orderId: string;
  eventName: string;
  status?: string;
  paymentStatus?: string;
  provider?: string;
  mercadoPagoPaymentId?: string;
  createdAt: any;
  metadata?: any;
}

export function subscribeToEvents(projectId: string, callback: (events: OrderEvent[], type: 'added' | 'modified' | 'removed', isInitial: boolean) => void) {
  const eventsRef = collection(db, `projects/${projectId}/orderEvents`);
  const q = query(eventsRef, orderBy('createdAt', 'desc'), limit(50));

  let isInitial = true;

  return onSnapshot(q, (snapshot) => {
    if (isInitial) {
      isInitial = false;
      const initialEvents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OrderEvent));
      callback(initialEvents, 'added', true);
      return;
    }

    const addedEvents: OrderEvent[] = [];
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        const event = { id: change.doc.id, ...change.doc.data() } as OrderEvent;
        // Ensure event is not too old (e.g. from more than 5 minutes ago)
        const eventTime = event.createdAt?.toDate?.() || new Date(0);
        if (Date.now() - eventTime.getTime() < 5 * 60 * 1000) {
            addedEvents.push(event);
        }
      }
    });

    if (addedEvents.length > 0) {
      callback(addedEvents, 'added', false);
    }
  }, (error) => {
    console.error("[NOTIFICATIONS] erro no listener", error);
  });
}
