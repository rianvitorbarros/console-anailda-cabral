import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, updateDoc, getDoc } from 'firebase/firestore';

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
    const uid = cred.user.uid;
    const userRef = doc(db, 'users', uid);
    
    // We are the user ourselves, we might not have permission to update our own active status
    // Wait, let's see if we have permission. If not, I can just update the code to handle `status === 'active'`
    await updateDoc(userRef, { active: true });
    console.log("Updated users/ivana active: true");
  } catch (e) {
    console.log("Error updating:", e.code, e.message);
  }

  process.exit(0);
}

run();
