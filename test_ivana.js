import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "console-anailda",
  appId: "1:588056723391:web:b0306b9051b5ecacbd6b0a",
  apiKey: "AIzaSyBURLcsUnnMl5x-dNgNUQl_oInZcS33p04",
  authDomain: "console-anailda.firebaseapp.com",
  messagingSenderId: "588056723391"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  console.log("Checking usernames/ivana...");
  const usernameRef = doc(db, 'usernames', 'ivana');
  const usernameSnap = await getDoc(usernameRef);
  if (usernameSnap.exists()) {
    console.log("usernames/ivana:", usernameSnap.data());
    
    console.log("Checking users/" + usernameSnap.data().uid + "...");
    const userRef = doc(db, 'users', usernameSnap.data().uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      console.log("users doc:", userSnap.data());
    } else {
      console.log("users doc DOES NOT EXIST");
    }
  } else {
    console.log("usernames/ivana DOES NOT EXIST");
  }

  console.log("\nChecking all users with email ivana@...");
  const usersRef = collection(db, 'users');
  const snap = await getDocs(usersRef);
  snap.forEach(doc => {
    if (doc.data().email && doc.data().email.startsWith('ivana@')) {
      console.log("User:", doc.id, doc.data());
    }
  });

  process.exit(0);
}

run();
