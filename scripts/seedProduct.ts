import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, serverTimestamp } from "firebase/firestore";
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../.env') });

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function seedProduct() {
  console.log("Seeding product...");
  try {
    const productData = {
      id: "anailda-book-main",
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
      stockEnabled: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    await setDoc(doc(db, "products", "anailda-book-main"), productData);
    console.log("Product seeded successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding product:", error);
    process.exit(1);
  }
}

seedProduct();
