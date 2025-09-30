import { createRoot } from "react-dom/client";
import { Auth0Provider } from "@auth0/auth0-react";
import App from "./App";
import "./index.css";
import { initializeTheme } from "./lib/theme";

const domain = import.meta.env.VITE_AUTH0_DOMAIN;
const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
const audience = import.meta.env.VITE_AUTH0_AUDIENCE;

// Debug logging
console.log("Auth0 Config:", { domain, clientId, audience, origin: window.location.origin });

// Initialize theme before React renders to prevent flash
initializeTheme();

createRoot(document.getElementById("root")!).render(
  <Auth0Provider
    domain={domain}
    clientId={clientId}
    authorizationParams={{
      redirect_uri: `${window.location.origin}/callback`,
      audience: audience,
      scope: "openid profile email offline_access"
    }}
    cacheLocation="localstorage"
    useRefreshTokens={true}
    useRefreshTokensFallback={false}
  >
    <App />
  </Auth0Provider>
);
