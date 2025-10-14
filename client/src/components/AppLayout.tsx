// No Outlet needed in wouter - children are rendered directly
import { Sidebar } from "./Sidebar";
import { QueueHealthBadge } from "./QueueHealthBadge";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, login } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="max-w-md w-full space-y-8 p-8">
          <div className="text-center">
            <div className="w-24 h-24 flex items-center justify-center mx-auto mb-4">
              <img
                src="/logo.png"
                alt="DASH Logo"
                className="w-full h-full object-contain dark:invert transition-all"
              />
            </div>
            <h2 className="text-3xl font-bold text-foreground tracking-wide">Welcome to DASH</h2>
            <p className="mt-2 text-muted-foreground">
              Sign in to access your data validation and management platform
            </p>
          </div>
          <Button
            onClick={login}
            className="w-full"
            size="lg"
            data-testid="button-auth0-signin"
          >
            Sign in with Auth0
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header with Queue Health Badge */}
        <header className="bg-card border-b border-border px-6 py-3 flex items-center justify-end">
          <QueueHealthBadge />
        </header>
        {children}
      </main>
    </div>
  );
}
