export type UserRole = "admin" | "publisher_operator" | "viewer";

export interface PanelUser {
  uid: string;
  name: string;
  email: string;
  username: string;
  role: UserRole;
  roleLabel: string;
  active: boolean;
  projectId: "anailda-book";
  createdAt?: any;
  updatedAt?: any;
  createdBy?: string;
  lastLoginAt?: any;
}

export interface User {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'inactive';
  publicSiteUrl: string;
  supportEmail?: string;
  supportWhatsapp?: string;
}

export interface ComboItem {
  id?: string;
  productId?: string;
  title?: string;
  quantity: number;
  priceMode?: 'dynamic' | 'manual';
  unitPrice?: number;
  
  // Legacy fields
  sourceType?: 'linkedProduct' | 'manual';
  linkedProductId?: string;
  name?: string;
  unitPriceMode?: 'dynamic' | 'fixed';
  fixedUnitPrice?: number;
  snapshotTitle?: string;
  snapshotPrice?: number;
}

export type ProductType = 'simple' | 'book' | 'devotional' | 'accessory' | 'combo';

export interface Product {
  id: string;
  projectId: string;
  productType?: ProductType;
  comboItems?: ComboItem[];
  title: string;
  subtitle?: string;
  slug?: string;
  author?: string;
  description?: string;
  originalPrice: number;
  promotionalPrice: number;
  offerLabel?: string;
  active: boolean;
  status?: string;
  stockQuantity?: number;
  soldQuantity?: number;
  reservedQuantity?: number;
  availableQuantity?: number;
  coverUrl?: string;
  defaultShipping: number;
  estimatedDelivery?: string;
  imageUrl?: string;
  galleryImages?: string[];
  badge?: string;
  stockEnabled?: boolean;
  paymentMethods?: string[];
  deliveryType?: string;
}

export type OfferType = "checkout_upsell" | "order_bump" | "manual";
export type OfferStatus = "active" | "inactive";

export interface Offer {
  id?: string;
  projectId: string;
  title: string;
  description?: string;
  offerType: OfferType;
  status: OfferStatus;
  triggerProductId: string;
  offeredProductId: string;
  priority: number;
  startsAt?: any;
  endsAt?: any;
  displayTitle: string;
  displayDescription?: string;
  primaryButtonText: string;
  secondaryButtonText?: string;
  badgeText?: string;
  createdAt?: any;
  updatedAt?: any;
  updatedBy?: string;
}

export type PaymentStatus = 'pending' | 'processing' | 'approved' | 'paid' | 'rejected' | 'cancelled' | 'refunded' | 'expired';
export type ShippingStatus = 'not_started' | 'protocol_started' | 'preparing' | 'shipped' | 'delivered' | 'returned' | 'issue';

export interface ShippingEvent {
  status: ShippingStatus;
  label: string;
  notes?: string;
  trackingCode?: string;
  trackingUrl?: string;
  carrier?: string;
  createdAt: any;
  createdBy: string;
  createdByName: string;
}

export interface OrderItem {
  productId: string;
  title: string;
  type: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  imageUrl?: string;
}

export interface Order {
  id: string;
  projectId: string;
  productId: string;
  productTitle?: string;
  productSnapshot?: any;
  code: string;
  orderCode?: string;
  publicStatusToken: string;
  status: PaymentStatus; // legacy/alias
  paymentStatus: PaymentStatus;
  items?: OrderItem[];
  trackingCode?: string;
  customerName?: string;
  customerEmail?: string;
  amount?: number;
  paymentMethod?: string;
  pushNotifications?: {
    salePaidSent?: boolean;
    salePaidSentAt?: any;
  };
  customer: {
    name: string;
    email: string;
    phone: string;
    cpf: string;
  };
  shippingAddress: {
    zipCode: string;
    street: string;
    number: string;
    complement?: string;
    district: string;
    city: string;
    state: string;
  };
  product: {
    id: string;
    title: string;
    quantity: number;
    unitPrice: number;
    productType?: 'single' | 'combo';
    originalPrice?: number;
    comboItems?: ComboItem[];
  };
  amounts: {
    originalSubtotal: number;
    discount: number;
    subtotal: number;
    shipping: number;
    total: number;
  };
  payment: {
    provider: 'mercado_pago';
    method: 'pix' | 'credit_card' | 'debit_card';
    status: PaymentStatus;
    paymentId?: string;
    pixQrCode?: string;
    pixCopyPaste?: string;
    paidAt?: any; // Firestore Timestamp
  };
  shipping?: {
    status: ShippingStatus;
    carrier?: string | null;
    trackingCode?: string | null;
    trackingUrl?: string | null;
    protocolStartedAt?: any;
    preparingAt?: any;
    shippedAt?: any;
    deliveredAt?: any;
    updatedAt?: any;
    updatedBy?: string;
    notes?: string | null;
  };
  shippingEvents?: ShippingEvent[];
  fulfillment: {
    status: 'received' | 'paid' | 'preparing' | 'shipped' | 'in_transit' | 'delivered' | 'cancelled';
    trackingCode?: string;
    carrier?: string;
    shippedAt?: any;
    deliveredAt?: any;
  };
  source: {
    sessionId?: string;
    visitorId?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmContent?: string;
    utmTerm?: string;
    referrer?: string;
  };
  internalNotes?: string;
  createdAt: any;
  updatedAt: any;
}
