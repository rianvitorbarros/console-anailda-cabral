import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut, User as FirebaseUser } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase";
import { disablePushNotifications } from "../services/pushNotifications";
import { PanelUser } from "../types";

interface AuthContextType {
  user: FirebaseUser | null;
  panelUser: PanelUser | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [panelUser, setPanelUser] = useState<PanelUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribePanelUser: () => void;

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // Fetch panel user doc
        unsubscribePanelUser = onSnapshot(doc(db, "users", currentUser.uid), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as PanelUser;
            console.log("[login-profile-loaded]", {
              uid: data.uid,
              email: data.email,
              username: data.username,
              role: data.role,
              active: data.active,
              projectId: data.projectId
            });
            if (data.active === false) {
              // Automatically logout if disabled
              signOut(auth);
              setPanelUser(null);
            } else {
              setPanelUser(data);
            }
          } else {
            console.log("[login-profile-loaded] document does not exist");
            // Document doesn't exist, maybe newly registered? 
            // Depending on architecture, maybe sign out or wait. We will set it to null.
            setPanelUser(null);
          }
          setLoading(false);
        });
      } else {
        setPanelUser(null);
        setLoading(false);
        if (unsubscribePanelUser) {
          unsubscribePanelUser();
        }
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribePanelUser) unsubscribePanelUser();
    };
  }, []);

  const logout = async () => {
    if (user) {
      await disablePushNotifications(user).catch(console.error);
    }
    return signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, panelUser, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

