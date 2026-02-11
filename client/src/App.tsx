import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import AdminLogin from "./admin/pages/AdminLogin";
import AdminApp from "./admin/AdminApp";


function Router() {
  return (
    <Switch>
      <Route path={"/admin/login"} component={AdminLogin} />
      {/* Avoid wildcard patterns to keep routing reliable in production builds */}
      <Route path={"/admin"} component={AdminLogin} />
      <Route path={"/admin/finance"} component={AdminApp} />
      <Route path={"/admin/finance/transactions"} component={AdminApp} />
      <Route path={"/admin/finance/categories"} component={AdminApp} />
      <Route path={"/admin/finance/accounts"} component={AdminApp} />
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
