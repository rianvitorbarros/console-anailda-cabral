import {
  collection,
  doc,
  onSnapshot,
  query,
  orderBy,
  limit,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '../firebase';

export const DEPLOY_MP_FUNCTIONS_CMD =
  'firebase deploy --only functions:mercadoPagoWebhook,functions:syncMercadoPagoOrders,functions:testMercadoPagoConnection --project console-anailda';

export interface Order {
  productSnapshot?: any;
  items?: any[];
  trackingCode?: string;
  id: string;
  projectId: string;
  productId: string;
  productTitle?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  amount: number;
  currency: string;
  status: string;
  paymentStatus: string;
  paymentMethod?: string;
  paymentProvider?: string;
  orderCode?: string;
  externalReference?: string;
  mercadoPagoOrderId?: string;
  mercadoPagoPaymentId?: string;
  mercadoPagoTransactionId?: string;
  mercadoPagoStatus?: string;
  mercadoPagoPaymentStatus?: string;
  mercadoPagoOrderStatus?: string;
  mercadoPagoStatusDetail?: string;
  lastPaymentSyncAt?: any;
  publicStatusToken?: string;
  publicStatusPath?: string;
  shippingAddress?: any;
  shipping?: {
    status?: 'unshipped' | 'not_started' | 'preparing' | 'shipped' | 'out_for_delivery' | 'delivered' | 'returned' | 'issue';
    trackingCode?: string;
    trackingUrl?: string;
    carrier?: string;
    method?: string;
    notes?: string;
    address?: any;
  };
  customer?: any;
  createdAt: any;
  updatedAt: any;
  paidAt?: any;
  approvedAt?: any;
  fulfillmentStatus?: string;
  customerNotificationStatus?: string;
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

export interface SyncMercadoPagoSummary {
  mode: 'single' | 'batch';
  checked: number;
  updatedToPaid: number;
  updatedOther: number;
  stillPending: number;
  notFound: number;
  errors: number;
  results: SyncOrderResultItem[];
}

export interface MercadoPagoConnectionResult {
  connected: boolean;
  userId: string;
  nickname: string;
  siteId: string;
  webhookUrl: string;
}

export class CallableSyncError extends Error {
  code: string;
  needsDeploy: boolean;
  needsEnvVar: boolean;

  constructor(message: string, code: string, needsDeploy = false, needsEnvVar = false) {
    super(message);
    this.name = 'CallableSyncError';
    this.code = code;
    this.needsDeploy = needsDeploy;
    this.needsEnvVar = needsEnvVar;
  }
}

function classifyCallableError(err: any, fallbackMessage: string): CallableSyncError {
  const code = String(err?.code || '');
  const rawMessage = String(err?.message || '');
  const lower = rawMessage.toLowerCase();

  const looksUndeployed =
    code === 'functions/not-found' ||
    code === 'functions/internal' ||
    lower.includes('cors') ||
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower === 'internal';

  if (looksUndeployed) {
    return new CallableSyncError(
      'A função de sincronização ainda não foi publicada no Firebase (projeto console-anailda).',
      code || 'functions/not-found',
      true,
      false
    );
  }

  return new CallableSyncError(rawMessage || fallbackMessage, code || 'unknown', false, false);
}

interface ServerCheckResult {
  orderId: string;
  orderCode: string;
  found: boolean;
  sourceType: 'order' | 'payment' | 'none';
  sourceMethod: 'orders_api' | 'payments_api' | 'payments_search' | 'not_found' | 'error';
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

async function applyResolvedPaymentInFirestore(
  projectId: string,
  order: Order,
  resolved: ServerCheckResult,
  triggeredByUid: string
): Promise<SyncOrderResultItem> {
  const orderId = order.id;
  const orderCode = String(order.orderCode || orderId.substring(0, 8));
  const previousPaymentStatus = String(order.paymentStatus || order.status || 'pending').toLowerCase();
  const orderRef = doc(db, `projects/${projectId}/orders/${orderId}`);

  if (resolved.error) {
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
      error: resolved.error,
    };
  }

  if (!resolved.found || !resolved.paymentStatus || !resolved.newStatus) {
    await updateDoc(orderRef, { lastPaymentSyncAt: serverTimestamp() }).catch(() => {});
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
  }

  const isCurrentlyPaid = previousPaymentStatus === 'paid' || previousPaymentStatus === 'approved';
  const isCurrentlyCancelled = String(order.status || '').toLowerCase() === 'cancelled';

  if (isCurrentlyPaid && resolved.paymentStatus === 'pending') {
    return {
      orderId,
      orderCode,
      previousPaymentStatus,
      newPaymentStatus: previousPaymentStatus,
      mpStatus: resolved.mpStatus,
      mpStatusDetail: resolved.mpStatusDetail,
      updated: false,
      becamePaid: false,
      sourceMethod: resolved.sourceMethod,
    };
  }

  if (isCurrentlyCancelled && resolved.paymentStatus === 'pending') {
    return {
      orderId,
      orderCode,
      previousPaymentStatus,
      newPaymentStatus: previousPaymentStatus,
      mpStatus: resolved.mpStatus,
      mpStatusDetail: resolved.mpStatusDetail,
      updated: false,
      becamePaid: false,
      sourceMethod: resolved.sourceMethod,
    };
  }

  const becamePaid = !isCurrentlyPaid && resolved.paymentStatus === 'paid';
  const statusChanged =
    previousPaymentStatus !== resolved.paymentStatus || order.status !== resolved.newStatus;

  const updateData: Record<string, any> = {
    status: resolved.newStatus,
    paymentStatus: resolved.paymentStatus,
    mercadoPagoStatus: resolved.mpStatus,
    mercadoPagoStatusDetail: resolved.mpStatusDetail,
    updatedAt: serverTimestamp(),
    lastPaymentSyncAt: serverTimestamp(),
  };

  if (resolved.sourceType === 'order') {
    if (resolved.mercadoPagoOrderId) updateData.mercadoPagoOrderId = resolved.mercadoPagoOrderId;
    updateData.mercadoPagoOrderStatus = resolved.mpStatus;
    if (resolved.mercadoPagoTransactionId) updateData.mercadoPagoTransactionId = resolved.mercadoPagoTransactionId;
    if (resolved.mercadoPagoTransactionStatus) updateData.mercadoPagoTransactionStatus = resolved.mercadoPagoTransactionStatus;
    if (resolved.mercadoPagoTransactionStatusDetail) updateData.mercadoPagoTransactionStatusDetail = resolved.mercadoPagoTransactionStatusDetail;
    if (resolved.mercadoPagoPaymentId && !order.mercadoPagoPaymentId) {
      updateData.mercadoPagoPaymentId = resolved.mercadoPagoPaymentId;
    }
  } else {
    if (resolved.mercadoPagoPaymentId) updateData.mercadoPagoPaymentId = resolved.mercadoPagoPaymentId;
    updateData.mercadoPagoPaymentStatus = resolved.mpStatus;
    if (resolved.mercadoPagoOrderId && !order.mercadoPagoOrderId) {
      updateData.mercadoPagoOrderId = resolved.mercadoPagoOrderId;
    }
  }

  const paidAtValue = resolved.paidAtIso
    ? Timestamp.fromDate(new Date(resolved.paidAtIso))
    : serverTimestamp();

  if (resolved.paymentStatus === 'paid') {
    if (!order.paidAt) updateData.paidAt = paidAtValue;
    if (!order.approvedAt) updateData.approvedAt = serverTimestamp();
    if (!order.fulfillmentStatus) updateData.fulfillmentStatus = 'pending_contact';
    if (!order.customerNotificationStatus) updateData.customerNotificationStatus = 'pending';
  }

  await updateDoc(orderRef, updateData);

  // Sync publicCheckoutStatus so the customer page reflects confirmation
  if (order.publicStatusToken || order.publicStatusPath) {
    const rawPath =
      order.publicStatusPath || `/projects/${projectId}/publicCheckoutStatus/${order.publicStatusToken}`;
    const normalizedPath = rawPath.startsWith('/') ? rawPath.substring(1) : rawPath;
    const publicStatusRef = doc(db, normalizedPath);
    const publicUpdate: Record<string, any> = {
      orderId,
      orderCode,
      paymentStatus: resolved.paymentStatus,
      status: resolved.newStatus,
      mercadoPagoStatus: resolved.mpStatus,
      mercadoPagoStatusDetail: resolved.mpStatusDetail,
      updatedAt: serverTimestamp(),
    };

    if (resolved.paymentStatus === 'paid') {
      publicUpdate.paidAt = order.paidAt || paidAtValue;
      publicUpdate.approvedAt = order.approvedAt || serverTimestamp();
      publicUpdate.fulfillmentStatus = order.fulfillmentStatus || 'pending_contact';
      publicUpdate.customerNotificationStatus = order.customerNotificationStatus || 'pending';
      publicUpdate.successMessage = 'Pagamento confirmado! Seu pedido foi registrado com sucesso.';
      publicUpdate.nextStepsMessage =
        'Você receberá um e-mail de confirmação em breve. Nossa equipe também poderá entrar em contato pelo WhatsApp para acompanhar a entrega.';
    }

    await updateDoc(publicStatusRef, publicUpdate).catch((err) => {
      console.warn('[MP_SYNC] Aviso ao atualizar publicCheckoutStatus:', err?.message || err);
    });
  }

  // Create idempotent audit event
  if (statusChanged || becamePaid) {
    const safeRef = (resolved.providerRefId || orderId).replace(/[^a-zA-Z0-9_-]/g, '_');
    const eventId = `mp_${resolved.newStatus}_${safeRef}`;
    const eventRef = doc(db, `projects/${projectId}/orderEvents/${eventId}`);
    try {
      const eventSnap = await getDoc(eventRef);
      if (!eventSnap.exists()) {
        await setDoc(eventRef, {
          projectId,
          orderId,
          eventName: resolved.paymentStatus === 'paid' ? 'payment_approved' : 'payment_status_updated',
          status: resolved.newStatus,
          paymentStatus: resolved.paymentStatus,
          provider: 'mercado_pago',
          providerEventType: resolved.sourceType,
          providerAction: 'panel_api_reconciliation',
          providerPaymentId: resolved.mercadoPagoPaymentId || resolved.providerRefId || null,
          providerOrderId: resolved.mercadoPagoOrderId || null,
          metadata: {
            mercadoPagoStatus: resolved.mpStatus,
            mercadoPagoStatusDetail: resolved.mpStatusDetail,
            syncSource: 'manual_sync',
            triggeredBy: triggeredByUid,
          },
          createdAt: serverTimestamp(),
        });
      }
    } catch (err: any) {
      console.warn('[MP_SYNC] Aviso ao gravar orderEvent:', err?.message || err);
    }
  }

  return {
    orderId,
    orderCode,
    previousPaymentStatus,
    newPaymentStatus: resolved.paymentStatus,
    mpStatus: resolved.mpStatus,
    mpStatusDetail: resolved.mpStatusDetail,
    updated: statusChanged || becamePaid,
    becamePaid,
    sourceMethod: resolved.sourceMethod,
  };
}

async function syncViaServerFallback(orderId?: string): Promise<SyncMercadoPagoSummary> {
  const projectId = 'anailda-book';
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new CallableSyncError('Você precisa estar autenticado para sincronizar pagamentos.', 'unauthenticated');
  }

  const idToken = await currentUser.getIdToken();

  let targetOrders: Order[] = [];
  if (orderId) {
    const single = await getOrder(projectId, orderId);
    if (!single) {
      throw new CallableSyncError('Pedido não encontrado.', 'not-found');
    }
    targetOrders = [single];
  } else {
    const ordersRef = collection(db, `projects/${projectId}/orders`);
    const q = query(ordersRef, orderBy('createdAt', 'desc'), limit(100));
    const snap = await getDocs(q);
    snap.forEach((docSnap) => {
      const orderData = { id: docSnap.id, ...docSnap.data() } as Order;
      const paySt = String(orderData.paymentStatus || orderData.status || 'pending').toLowerCase();
      if (!['paid', 'approved', 'refunded'].includes(paySt)) {
        targetOrders.push(orderData);
      }
    });
    targetOrders = targetOrders.slice(0, 40);
  }

  if (targetOrders.length === 0) {
    return {
      mode: orderId ? 'single' : 'batch',
      checked: 0,
      updatedToPaid: 0,
      updatedOther: 0,
      stillPending: 0,
      notFound: 0,
      errors: 0,
      results: [],
    };
  }

  const response = await fetch('/api/mercadopago/check-orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      orders: targetOrders.map((o) => ({
        orderId: o.id,
        orderCode: o.orderCode,
        externalReference: o.externalReference,
        mercadoPagoOrderId: o.mercadoPagoOrderId,
        mercadoPagoPaymentId: o.mercadoPagoPaymentId,
        mercadoPagoTransactionId: o.mercadoPagoTransactionId,
      })),
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (payload?.code === 'MISSING_MP_TOKEN') {
      throw new CallableSyncError(
        'Para sincronizar agora direto por este painel, preencha a variável MERCADO_PAGO_ACCESS_TOKEN no painel de variáveis do AI Studio (canto inferior esquerdo) com o seu Access Token de produção do Mercado Pago e clique em Apply.',
        'MISSING_MP_TOKEN',
        true,
        true
      );
    }
    throw new CallableSyncError(
      payload?.message || 'Erro ao consultar o Mercado Pago pelo servidor do painel.',
      payload?.code || `http-${response.status}`
    );
  }

  const serverResults: ServerCheckResult[] = Array.isArray(payload?.results) ? payload.results : [];
  const orderMap = new Map(targetOrders.map((o) => [o.id, o]));
  const appliedResults: SyncOrderResultItem[] = [];

  for (const resItem of serverResults) {
    const order = orderMap.get(resItem.orderId);
    if (!order) continue;
    const item = await applyResolvedPaymentInFirestore(projectId, order, resItem, currentUser.uid);
    appliedResults.push(item);
  }

  return {
    mode: orderId ? 'single' : 'batch',
    checked: appliedResults.length,
    updatedToPaid: appliedResults.filter((r) => r.becamePaid).length,
    updatedOther: appliedResults.filter((r) => r.updated && !r.becamePaid).length,
    stillPending: appliedResults.filter((r) => r.newPaymentStatus === 'pending' && !r.error).length,
    notFound: appliedResults.filter((r) => r.mpStatus === 'not_found').length,
    errors: appliedResults.filter((r) => Boolean(r.error)).length,
    results: appliedResults,
  };
}

export async function syncMercadoPagoOrders(orderId?: string): Promise<SyncMercadoPagoSummary> {
  try {
    const callable = httpsCallable<{ projectId: string; orderId?: string }, SyncMercadoPagoSummary>(
      functions,
      'syncMercadoPagoOrders'
    );
    const payload = orderId ? { projectId: 'anailda-book', orderId } : { projectId: 'anailda-book' };
    const response = await callable(payload);
    return response.data;
  } catch (err: any) {
    const classified = classifyCallableError(err, 'Não foi possível sincronizar os pagamentos com o Mercado Pago.');
    if (classified.needsDeploy) {
      return syncViaServerFallback(orderId);
    }
    throw classified;
  }
}

export async function testMercadoPagoConnection(): Promise<MercadoPagoConnectionResult> {
  try {
    const callable = httpsCallable<{ projectId: string }, MercadoPagoConnectionResult>(
      functions,
      'testMercadoPagoConnection'
    );
    const response = await callable({ projectId: 'anailda-book' });
    return response.data;
  } catch (err: any) {
    const classified = classifyCallableError(err, 'Não foi possível validar a conexão com o Mercado Pago.');
    if (classified.needsDeploy) {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new CallableSyncError('Você precisa estar autenticado para testar a conexão.', 'unauthenticated');
      }
      const idToken = await currentUser.getIdToken();
      const response = await fetch('/api/mercadopago/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (payload?.code === 'MISSING_MP_TOKEN') {
          throw new CallableSyncError(
            'Para testar a conexão agora direto por este painel, preencha a variável MERCADO_PAGO_ACCESS_TOKEN no painel de variáveis do AI Studio e clique em Apply.',
            'MISSING_MP_TOKEN',
            true,
            true
          );
        }
        throw new CallableSyncError(
          payload?.message || 'Erro ao testar conexão com o Mercado Pago.',
          payload?.code || `http-${response.status}`
        );
      }
      return payload as MercadoPagoConnectionResult;
    }
    throw classified;
  }
}

export function subscribeToOrders(projectId: string, callback: (orders: Order[]) => void) {
  const ordersRef = collection(db, `projects/${projectId}/orders`);
  const q = query(ordersRef, orderBy('createdAt', 'desc'), limit(100));

  return onSnapshot(q, (snapshot) => {
    const orders: Order[] = [];
    snapshot.forEach((docSnap) => {
      orders.push({ id: docSnap.id, ...docSnap.data() } as Order);
    });
    callback(orders);
  });
}

export function subscribeToOrder(
  projectId: string,
  orderId: string,
  callback: (order: Order | null) => void
) {
  const orderRef = doc(db, `projects/${projectId}/orders/${orderId}`);
  return onSnapshot(orderRef, (snap) => {
    if (snap.exists()) {
      callback({ id: snap.id, ...snap.data() } as Order);
    } else {
      callback(null);
    }
  });
}

export async function getOrder(projectId: string, orderId: string): Promise<Order | null> {
  const orderRef = doc(db, `projects/${projectId}/orders/${orderId}`);
  const orderSnap = await getDoc(orderRef);

  if (orderSnap.exists()) {
    return { id: orderSnap.id, ...orderSnap.data() } as Order;
  }
  return null;
}

export async function updateOrder(projectId: string, orderId: string, updates: Partial<Order>): Promise<void> {
  const orderRef = doc(db, `projects/${projectId}/orders/${orderId}`);
  await setDoc(orderRef, updates, { merge: true });
}

export async function getRecentOrders(projectId: string, count: number = 5): Promise<Order[]> {
  const ordersRef = collection(db, `projects/${projectId}/orders`);
  const q = query(ordersRef, orderBy('createdAt', 'desc'), limit(count));

  const snapshot = await getDocs(q);
  const orders: Order[] = [];
  snapshot.forEach((docSnap) => {
    orders.push({ id: docSnap.id, ...docSnap.data() } as Order);
  });
  return orders;
}
