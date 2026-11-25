import { collection, doc, getDoc, getDocs, setDoc, updateDoc, serverTimestamp, query, where, orderBy } from "firebase/firestore";
import { db } from "../firebase";

export interface ComboItemData {
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

export interface ProductData {
  id?: string;
  projectId: string;
  productType?: 'simple' | 'book' | 'devotional' | 'accessory' | 'combo';
  comboItems?: ComboItemData[];
  type?: string;
  title: string;
  subtitle?: string;
  author?: string;
  slug: string;
  originalPrice: number;
  promotionalPrice: number;
  discountAmount?: number;
  currency: string;
  status: string;
  badge?: string;
  paymentMethods?: string[];
  deliveryType?: string;
  stockEnabled?: boolean;
  createdAt?: any;
  updatedAt?: any;
  updatedBy?: string;
  imageUrl?: string;
  galleryImages?: string[];
}

const cleanData = (data: any) => {
  const cleaned = { ...data };
  Object.keys(cleaned).forEach(key => {
    if (cleaned[key] === undefined) {
      delete cleaned[key];
    }
  });
  return cleaned;
};

export async function getProducts(projectId: string) {
  const q = query(
    collection(db, "products"),
    where("projectId", "==", projectId)
  );
  
  const snapshot = await getDocs(q);
  
  const products = snapshot.docs.map(doc => {
    const data = doc.data();
    console.log(`[getProducts] Produto carregado do Firestore: products/${doc.id}`);
    console.log(`- document exists: true`);
    console.log(`- document id: ${doc.id}`);
    console.log(`- document data:`, data);
    console.log(`- status: ${data.status}`);
    console.log(`- projectId: ${data.projectId}`);
    return {
      ...data,
      id: doc.id,
      projectId: data.projectId || projectId,
      title: data.title || "Produto sem título",
      slug: data.slug || doc.id,
      status: data.status || "draft",
      productType: data.productType || data.type || "simple",
      originalPrice: Number(data.originalPrice) || 0,
      promotionalPrice: Number(data.promotionalPrice) || 0,
      comboItems: Array.isArray(data.comboItems) ? data.comboItems : []
    } as ProductData;
  });
  
  return products;
}

export async function getProduct(productId: string) {
  const docRef = doc(db, "products", productId);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    const data = docSnap.data();
    console.log(`[getProduct] Produto carregado do Firestore: products/${docSnap.id}`);
    console.log(`- document exists: true`);
    console.log(`- document id: ${docSnap.id}`);
    console.log(`- document data:`, data);
    console.log(`- status: ${data.status}`);
    console.log(`- projectId: ${data.projectId}`);
    return { id: docSnap.id, ...data } as ProductData;
  }
  console.log(`[getProduct] Produto NÃO encontrado: products/${productId}`);
  return null;
}

export async function createProduct(data: ProductData, userId?: string) {
  const id = data.id || data.slug;
  const docRef = doc(db, "products", id);
  
  const productData = cleanData({
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: userId
  });

  await setDoc(docRef, productData);
  return id;
}

export async function updateProduct(productId: string, data: Partial<ProductData>, userId?: string) {
  const docRef = doc(db, "products", productId);
  
  const productData = cleanData({
    ...data,
    updatedAt: serverTimestamp(),
    updatedBy: userId
  });

  await updateDoc(docRef, productData);
}

export async function ensureMainProduct(userId?: string) {
  const mainProductId = "anailda-book-main";
  const existing = await getProduct(mainProductId);
  
  if (!existing) {
    await createProduct({
      id: mainProductId,
      projectId: "anailda-book",
      type: "book",
      title: "A Mulher — Anailda Cabral",
      subtitle: "Descubra a força que existe em você",
      author: "Anailda Cabral",
      slug: "a-mulher-anailda-cabral",
      originalPrice: 100.00,
      promotionalPrice: 79.90,
      discountAmount: 20.10,
      currency: "BRL",
      status: "active",
      badge: "Oferta de lançamento",
      paymentMethods: ["pix", "card"],
      deliveryType: "physical",
      stockEnabled: false
    }, userId);
    return await getProduct(mainProductId);
  }
  return existing;
}

export async function archiveProduct(productId: string, userId?: string) {
  return updateProduct(productId, { status: "archived" }, userId);
}
