import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useAuth0 } from "@auth0/auth0-react";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
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

  useEffect(() => {
    console.log("Auth0 State:", { isAuthenticated, isLoading, auth0User });

    if (!isLoading) {
      if (isAuthenticated && auth0User) {
        console.log("User is authenticated, getting access token...");

        // Get real Auth0 access token
        getAccessTokenSilently({
          authorizationParams: {
            audience: import.meta.env.VITE_AUTH0_AUDIENCE || "facnet-validator-api",
            scope: "openid profile email offline_access"
          }
        })
        .then((accessToken) => {
          console.log("Got Auth0 access token");

          // Create user object from Auth0 data
          const userData: User = {
            id: auth0User.sub || "",
            email: auth0User.email || "",
            name: auth0User.name || auth0User.email || "",
            role: "admin" // Default role for now
          };

          setUser(userData);
          setToken(accessToken);
          localStorage.setItem("authToken", accessToken);
          console.log("Auth0 user authenticated:", userData);
        })
        .catch((error) => {
          console.error("Error getting access token:", error);
          setUser(null);
          setToken(null);
          localStorage.removeItem("authToken");
        });
      } else {
        console.log("Not authenticated, clearing state");
        setUser(null);
        setToken(null);
        localStorage.removeItem("authToken");
      }
    }
  }, [isAuthenticated, auth0User, isLoading, getAccessTokenSilently]);

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
