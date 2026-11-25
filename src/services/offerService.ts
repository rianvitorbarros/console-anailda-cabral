import { collection, doc, getDoc, getDocs, setDoc, updateDoc, serverTimestamp, query, where, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Offer } from "../types";

const cleanData = (data: any) => {
  const cleaned = { ...data };
  Object.keys(cleaned).forEach(key => {
    if (cleaned[key] === undefined) {
      delete cleaned[key];
    }
  });
  return cleaned;
};

export async function getOffers(projectId: string) {
  const q = query(
    collection(db, "offers"),
    where("projectId", "==", projectId)
  );
  
  const snapshot = await getDocs(q);
  const offers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Offer));
  return offers.sort((a, b) => (a.priority || 0) - (b.priority || 0));
}

export async function getActiveOffers(projectId: string) {
  const q = query(
    collection(db, "offers"),
    where("projectId", "==", projectId),
    where("status", "==", "active")
  );
  
  const snapshot = await getDocs(q);
  const offers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Offer));
  return offers.sort((a, b) => (a.priority || 0) - (b.priority || 0));
}

export async function getOfferById(offerId: string) {
  const docRef = doc(db, "offers", offerId);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as Offer;
  }
  return null;
}

export async function getOffersByTriggerProduct(projectId: string, triggerProductId: string) {
  const q = query(
    collection(db, "offers"),
    where("projectId", "==", projectId),
    where("status", "==", "active"),
    where("triggerProductId", "==", triggerProductId)
  );
  
  const snapshot = await getDocs(q);
  const offers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Offer));
  return offers.sort((a, b) => (a.priority || 0) - (b.priority || 0));
}

export async function createOffer(data: Offer, userId?: string) {
  const id = data.id || `offer_${Date.now()}`;
  const docRef = doc(db, "offers", id);
  
  const offerData = cleanData({
    ...data,
    id,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: userId
  });
  
  await setDoc(docRef, offerData);
  return id;
}

export async function updateOffer(offerId: string, data: Partial<Offer>, userId?: string) {
  const docRef = doc(db, "offers", offerId);
  
  const offerData = cleanData({
    ...data,
    updatedAt: serverTimestamp(),
    updatedBy: userId
  });
  
  await updateDoc(docRef, offerData);
}

export async function archiveOffer(offerId: string, userId?: string) {
  return updateOffer(offerId, { status: "inactive" }, userId);
}

export async function deleteOffer(offerId: string) {
  const docRef = doc(db, "offers", offerId);
  await deleteDoc(docRef);
}
