import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User as FirebaseUser, onAuthStateChanged } from "firebase/auth";
import { auth, handleRedirectResult } from "./firebase";
import { apiRequest } from "./queryClient";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  token: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    // TEMPORARY: Bypass authentication for development
    // Create a mock admin user to enable app access
    const mockUser: User = {
      id: "temp-admin-user",
      email: "admin@dashvalidator.local",
      name: "Admin User",
      role: "admin"
    };

    console.log("Authentication bypassed - using mock admin user");
    setUser(mockUser);
    setToken("mock-token");
    
    // Store mock token in localStorage so the query client can access it
    localStorage.setItem("firebaseToken", "mock-token");
    
    setLoading(false);
    return;

    // Original auth code (commented out for temporary bypass)
    /*
    // Handle redirect result on app load
    handleRedirectResult().then((result) => {
      if (result) {
        console.log("Redirect result:", result);
      }
    }).catch((error) => {
      console.error("Redirect error:", error);
    });

    // If Firebase auth is not available, set loading to false and exit
    if (!auth) {
      console.warn("Firebase not configured - authentication disabled");
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setFirebaseUser(firebaseUser);
      
      if (firebaseUser) {
        try {
          const idToken = await firebaseUser.getIdToken();
          setToken(idToken);

          // Verify with backend
          const response = await fetch("/api/auth/verify", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${idToken}`,
              "Content-Type": "application/json",
            },
          });

          if (response.ok) {
            const { user } = await response.json();
            setUser(user);
          } else {
            console.error("Backend verification failed");
            setUser(null);
            setToken(null);
          }
        } catch (error) {
          console.error("Auth error:", error);
          setUser(null);
          setToken(null);
        }
      } else {
        setUser(null);
        setToken(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
    */
  }, []);

  return (
    <AuthContext.Provider value={{ user, firebaseUser, loading, token }}>
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
