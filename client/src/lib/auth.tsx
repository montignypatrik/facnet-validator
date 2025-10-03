import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useAuth0 } from "@auth0/auth0-react";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  token: string | null;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const {
    user: auth0User,
    isAuthenticated,
    isLoading,
    getAccessTokenSilently,
    loginWithRedirect,
    logout: auth0Logout
  } = useAuth0();

  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    console.log("Auth0 State:", { isAuthenticated, isLoading, auth0User });

    if (!isLoading) {
      if (isAuthenticated && auth0User && !isVerifying) {
        console.log("User is authenticated, getting access token...");
        setIsVerifying(true);

        // Get real Auth0 access token
        getAccessTokenSilently({
          authorizationParams: {
            audience: import.meta.env.VITE_AUTH0_AUDIENCE || "facnet-validator-api",
            scope: "openid profile email offline_access"
          }
        })
        .then(async (accessToken) => {
          console.log("Got Auth0 access token");

          // Verify token with backend and get user with role
          try {
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api"}/auth/verify`, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/json"
              }
            });

            if (!response.ok) {
              throw new Error("Failed to verify user with backend");
            }

            const { user: backendUser } = await response.json();

            // Create user object with role from backend
            const userData: User = {
              id: backendUser.id,
              email: backendUser.email,
              name: backendUser.name || backendUser.email,
              role: backendUser.role,
              createdAt: backendUser.createdAt
            };

            setUser(userData);
            setToken(accessToken);
            localStorage.setItem("authToken", accessToken);
            console.log("Auth0 user authenticated:", userData);
          } catch (error) {
            console.error("Error verifying user with backend:", error);
            throw error;
          } finally {
            setIsVerifying(false);
          }
        })
        .catch((error) => {
          console.error("Error getting access token:", error);
          setUser(null);
          setToken(null);
          localStorage.removeItem("authToken");
          setIsVerifying(false);
        });
      } else if (!isAuthenticated) {
        console.log("Not authenticated, clearing state");
        setUser(null);
        setToken(null);
        localStorage.removeItem("authToken");
        setIsVerifying(false);
      }
    }
  }, [isAuthenticated, auth0User, isLoading]);

  const login = () => {
    loginWithRedirect();
  };

  const logout = () => {
    localStorage.removeItem("authToken");
    auth0Logout({
      logoutParams: {
        returnTo: window.location.origin
      }
    });
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading: isLoading,
      token,
      login,
      logout
    }}>
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
