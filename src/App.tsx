import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import EquipmentChecklistPage from "./pages/EquipmentChecklistPage";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Index = lazy(() => import("./pages/Index"));
const CompanyRequirements = lazy(() => import("./pages/CompanyRequirements"));
const CompanyChecklists = lazy(() => import("./pages/CompanyChecklists"));
const CompanyReport = lazy(() => import("./pages/CompanyReport"));
const Auth = lazy(() => import("./pages/Auth"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const RouteLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="flex items-center gap-3 text-sm text-muted-foreground">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
      Carregando...
    </div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <Suspense fallback={<RouteLoader />}>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/cadastro" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/exigencias/:id" element={<ProtectedRoute><CompanyRequirements /></ProtectedRoute>} />
            <Route path="/checklists/:id" element={<ProtectedRoute><CompanyChecklists /></ProtectedRoute>} />
            <Route path="/relatorios/:id" element={<ProtectedRoute><CompanyReport /></ProtectedRoute>} />
            <Route path="/equipamentos/:kind/:token" element={<EquipmentChecklistPage />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
