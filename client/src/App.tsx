import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import { Suspense, lazy } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";

const AdminLogin = lazy(() => import("./admin/pages/AdminLogin"));
const AdminApp = lazy(() => import("./admin/AdminApp"));

function AdminLoginRoute() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Carregando...</div>}>
      <AdminLogin />
    </Suspense>
  );
}

function AdminAppRoute() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Carregando...</div>}>
      <AdminApp />
    </Suspense>
  );
}


function Router() {
  return (
    <Switch>
      <Route path={"/admin/login"} component={AdminLoginRoute} />
      {/* Avoid wildcard patterns to keep routing reliable in production builds */}
      <Route path={"/admin"} component={AdminLoginRoute} />
      <Route path={"/admin/finance"} component={AdminAppRoute} />
      <Route path={"/admin/finance/transactions"} component={AdminAppRoute} />
      <Route path={"/admin/finance/categories"} component={AdminAppRoute} />
      <Route path={"/admin/finance/accounts"} component={AdminAppRoute} />
      <Route path={"/admin/products"} component={AdminAppRoute} />
      <Route path={"/"} component={Home} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
