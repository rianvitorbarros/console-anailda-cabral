import { Order, Product, Project } from "../types";

export const mockProject: Project = {
  id: "anailda-book",
  name: "Livro Anailda Cabral",
  slug: "livro-anailda",
  status: "active",
  publicSiteUrl: "https://anailda-book.eyecode.com.br",
  supportEmail: "suporte@anaildacabral.com",
};

export const mockProduct: Product = {
  id: "prod_1",
  projectId: "anailda-book",
  title: "A Mulher — Anailda Cabral",
  subtitle: "Descubra a força que existe em você",
  author: "Anailda Cabral",
  originalPrice: 100,
  promotionalPrice: 79.9,
  offerLabel: "Oferta de lançamento",
  active: true,
  stockQuantity: 150,
  defaultShipping: 0,
  estimatedDelivery: "7 a 10 dias úteis",
};

export const mockOrders: Order[] = [
  {
    id: "ord_1",
    projectId: "anailda-book",
    productId: "prod_1",
    code: "ORD-AB1001",
    publicStatusToken: "tok_123",
    status: "approved",
    paymentStatus: "approved",
    customer: {
      name: "João Silva",
      email: "joao.silva@email.com",
      phone: "11999999999",
      cpf: "123.456.789-00",
    },
    shippingAddress: {
      zipCode: "01001-000",
      street: "Praça da Sé",
      number: "1",
      district: "Sé",
      city: "São Paulo",
      state: "SP",
    },
    product: {
      id: "prod_1",
      title: "A Mulher",
      quantity: 1,
      unitPrice: 79.9,
    },
    amounts: {
      originalSubtotal: 100,
      discount: 20.1,
      subtotal: 79.9,
      shipping: 15,
      total: 94.9,
    },
    payment: {
      provider: "mercado_pago",
      method: "pix",
      status: "approved",
      paymentId: "mp_12345",
      paidAt: new Date().toISOString(),
    },
    fulfillment: {
      status: "paid",
    },
    source: {
      utmSource: "instagram",
      utmCampaign: "lancamento_feed",
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "ord_2",
    projectId: "anailda-book",
    productId: "prod_1",
    code: "ORD-AB1002",
    publicStatusToken: "tok_124",
    status: "pending",
    paymentStatus: "pending",
    customer: {
      name: "Maria Oliveira",
      email: "maria.oliveira@email.com",
      phone: "21988888888",
      cpf: "098.765.432-11",
    },
    shippingAddress: {
      zipCode: "20040-002",
      street: "Avenida Rio Branco",
      number: "156",
      district: "Centro",
      city: "Rio de Janeiro",
      state: "RJ",
    },
    product: {
      id: "prod_1",
      title: "A Mulher",
      quantity: 2,
      unitPrice: 79.9,
    },
    amounts: {
      originalSubtotal: 200,
      discount: 40.2,
      subtotal: 159.8,
      shipping: 25,
      total: 184.8,
    },
    payment: {
      provider: "mercado_pago",
      method: "credit_card",
      status: "pending",
      paymentId: "mp_67890",
    },
    fulfillment: {
      status: "received",
    },
    source: {
      utmSource: "facebook",
    },
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
  }
];

export const mockComboProduct: Product = {
  id: "prod_combo_1",
  projectId: "anailda-book",
  productType: "combo",
  title: "Combo A Mulher — Livro + Caixa + Marca-página",
  subtitle: "O pacote completo para viver a experiência do livro",
  author: "Anailda Cabral",
  originalPrice: 150,
  promotionalPrice: 119.9,
  active: true,
  stockQuantity: 50,
  defaultShipping: 0,
  comboItems: [
    {
      id: "item1",
      sourceType: "linkedProduct",
      linkedProductId: "prod_1",
      name: "A Mulher — Anailda Cabral",
      quantity: 1,
      unitPriceMode: "dynamic",
      fixedUnitPrice: 79.9
    },
    {
      id: "item2",
      sourceType: "manual",
      name: "Caixa personalizada",
      quantity: 1,
      fixedUnitPrice: 50
    },
    {
      id: "item3",
      sourceType: "manual",
      name: "Marca-página",
      quantity: 1,
      fixedUnitPrice: 20
    }
  ]
};

export const mockOffer = {
  id: "offer_1",
  projectId: "anailda-book",
  title: "Upsell Combo A Mulher",
  description: "Oferta de upsell para quem compra o livro simples.",
  offerType: "checkout_upsell",
  status: "active",
  triggerProductId: "anailda-book-main",
  offeredProductId: "combo-a-mulher",
  priority: 1,
  displayTitle: "Leve o combo completo",
  displayDescription: "Receba o livro A Mulher com caixa personalizada e marca-página exclusivo.",
  primaryButtonText: "Quero o combo completo",
  secondaryButtonText: "Continuar apenas com o livro",
  badgeText: "Oferta especial",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};
