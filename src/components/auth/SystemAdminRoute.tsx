import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";

interface SystemAdminRouteProps {
  children: ReactNode;
}

export const SystemAdminRoute = ({ children }: SystemAdminRouteProps) => {
  const { user, loading, isSystemAdmin } = useAuth();

  if (loading) {
    return (
      <div className="fire-app-shell flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!isSystemAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};
