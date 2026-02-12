import { Route, Switch } from "wouter";
import AdminGuard from "./AdminGuard";
import AccountsPage from "./pages/AccountsPage";
import CategoriesPage from "./pages/CategoriesPage";
import FinanceDashboard from "./pages/FinanceDashboard";
import ProductsPage from "./pages/ProductsPage";
import TransactionsPage from "./pages/TransactionsPage";

function AdminNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="card-premium bg-white p-6">
        <div className="font-bold text-charcoal mb-2">Página não encontrada</div>
        <div className="text-sm text-gray-medium">Verifique a rota.</div>
      </div>
    </div>
  );
}

export default function AdminApp() {
  return (
    <AdminGuard>
      <Switch>
        <Route path="/admin/finance" component={FinanceDashboard} />
        <Route path="/admin/finance/transactions" component={TransactionsPage} />
        <Route path="/admin/finance/categories" component={CategoriesPage} />
        <Route path="/admin/finance/accounts" component={AccountsPage} />
        <Route path="/admin/products" component={ProductsPage} />
        <Route component={AdminNotFound} />
      </Switch>
    </AdminGuard>
  );
}

