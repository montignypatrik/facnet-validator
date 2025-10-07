import React from "react";
import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "./lib/auth";
import { AppLayout } from "./components/AppLayout";
import Dashboard from "./pages/Dashboard";
import Upload from "./pages/validator/Upload";
import Runs from "./pages/validator/Runs";
import RunDetails from "./pages/validator/RunDetails";
import Analytics from "./pages/validator/Analytics";
import Codes from "./pages/database/Codes";
import Contexts from "./pages/database/Contexts";
import Establishments from "./pages/database/Establishments";
import Rules from "./pages/database/Rules";
import Users from "./pages/admin/Users";
import KnowledgeAdmin from "./pages/admin/KnowledgeAdmin";
import Settings from "./pages/Settings";
import Chatbot from "./pages/Chatbot";
import Tache from "./pages/Tache";
import Formation from "./pages/Formation";
import HorsRamq from "./pages/HorsRamq";
import NotFound from "@/pages/not-found";
import { useAuth0 } from "@auth0/auth0-react";

function AuthCallback() {
  const { handleRedirectCallback } = useAuth0();
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    // Check if we have the required query parameters
    const urlParams = new URLSearchParams(window.location.search);
    const hasCode = urlParams.has('code');
    const hasState = urlParams.has('state');

    if (!hasCode || !hasState) {
      // No Auth0 callback parameters, redirect to home
      window.location.href = "/";
      return;
    }

    // Process the Auth0 callback
    handleRedirectCallback()
      .then(() => {
        window.location.href = "/";
      })
      .catch((error) => {
        console.error("Auth0 callback error:", error);
        setError("Authentication failed. Please try again.");
        setTimeout(() => {
          window.location.href = "/";
        }, 3000);
      });
  }, [handleRedirectCallback]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <p className="text-gray-600">Redirecting to home page...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <p className="text-lg">Processing login...</p>
        <p className="text-gray-600 mt-2">Please wait while we complete your authentication.</p>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/callback" component={AuthCallback} />
      <Route path="/" component={Dashboard} />

      {/* Validator routes */}
      <Route path="/validator">
        <Redirect to="/validator/upload" />
      </Route>
      <Route path="/validator/upload" component={Upload} />
      <Route path="/validator/runs" component={Runs} />
      <Route path="/validator/runs/:id" component={RunDetails} />
      <Route path="/validator/analytics" component={Analytics} />

      {/* Module routes */}
      <Route path="/chatbot" component={Chatbot} />
      <Route path="/tache" component={Tache} />
      <Route path="/formation" component={Formation} />
      <Route path="/hors-ramq" component={HorsRamq} />

      {/* Database routes */}
      <Route path="/database">
        <Redirect to="/database/codes" />
      </Route>
      <Route path="/database/codes" component={Codes} />
      <Route path="/database/contexts" component={Contexts} />
      <Route path="/database/establishments" component={Establishments} />
      <Route path="/database/rules" component={Rules} />

      {/* Admin routes */}
      <Route path="/admin">
        <Redirect to="/admin/users" />
      </Route>
      <Route path="/admin/users" component={Users} />
      <Route path="/admin/knowledge" component={KnowledgeAdmin} />

      {/* Settings */}
      <Route path="/settings" component={Settings} />
      
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [location] = useLocation();
  const isCallback = location === "/callback";

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          {isCallback ? (
            <Router />
          ) : (
            <AppLayout>
              <Router />
            </AppLayout>
          )}
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
