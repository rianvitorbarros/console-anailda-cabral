import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "console-anailda",
  appId: "1:588056723391:web:b0306b9051b5ecacbd6b0a",
  apiKey: "AIzaSyBURLcsUnnMl5x-dNgNUQl_oInZcS33p04",
  authDomain: "console-anailda.firebaseapp.com",
  messagingSenderId: "588056723391"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function run() {
  const email = "ivana@gmail.com";
  const password = "102310";

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const userRef = doc(db, 'users', cred.user.uid);
    const userSnap = await getDoc(userRef);
    console.log("users doc:", userSnap.data());
  } catch (e) {
    console.log("Error:", e);
  }
  process.exit(0);
}

run();
