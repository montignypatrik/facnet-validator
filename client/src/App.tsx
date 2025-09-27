import { Switch, Route, Redirect } from "wouter";
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
import Settings from "./pages/Settings";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      
      {/* Validator routes */}
      <Route path="/validator">
        <Redirect to="/validator/upload" />
      </Route>
      <Route path="/validator/upload" component={Upload} />
      <Route path="/validator/runs" component={Runs} />
      <Route path="/validator/runs/:id" component={RunDetails} />
      <Route path="/validator/analytics" component={Analytics} />
      
      {/* Database routes */}
      <Route path="/database">
        <Redirect to="/database/codes" />
      </Route>
      <Route path="/database/codes" component={Codes} />
      <Route path="/database/contexts" component={Contexts} />
      <Route path="/database/establishments" component={Establishments} />
      <Route path="/database/rules" component={Rules} />
      
      {/* Settings */}
      <Route path="/settings" component={Settings} />
      
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <AppLayout>
            <Router />
          </AppLayout>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
