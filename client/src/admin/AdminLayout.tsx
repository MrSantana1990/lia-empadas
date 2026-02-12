import BrandLogo from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  CreditCard,
  Home,
  LogOut,
  Receipt,
  Tags,
  UtensilsCrossed,
} from "lucide-react";
import { useLocation } from "wouter";
import { trpcMutation } from "./lib/trpcClient";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

const NAV: NavItem[] = [
  { href: "/admin/finance", label: "Resumo", icon: <BarChart3 size={16} /> },
  {
    href: "/admin/finance/transactions",
    label: "Lançamentos",
    icon: <Receipt size={16} />,
  },
  {
    href: "/admin/finance/categories",
    label: "Categorias",
    icon: <Tags size={16} />,
  },
  {
    href: "/admin/finance/accounts",
    label: "Contas",
    icon: <CreditCard size={16} />,
  },
  {
    href: "/admin/products",
    label: "Sabores & Preços",
    icon: <UtensilsCrossed size={16} />,
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/admin/finance") return pathname === href;
  return pathname.startsWith(href);
}

export default function AdminLayout({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [location, setLocation] = useLocation();

  const handleLogout = async () => {
    await trpcMutation("auth.logout");
    setLocation("/admin/login");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
          <aside className="card-premium bg-white p-4">
            <div className="mb-4 px-1">
              <BrandLogo size="sm" />
              <div className="mt-3 text-xs text-gray-medium">
                Painel Administrativo
              </div>
            </div>

            <nav className="space-y-1">
              {NAV.map((item) => (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => setLocation(item.href)}
                  className={cn(
                    "w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                    isActive(location, item.href)
                      ? "bg-primary/10 text-charcoal"
                      : "hover:bg-primary/5 text-charcoal"
                  )}
                >
                  <span className="text-charcoal">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </nav>
          </aside>

          <main className="space-y-4">
            <header className="card-premium bg-white p-4 flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-medium">Admin</div>
                <div className="text-lg font-bold text-charcoal">{title}</div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setLocation("/")}
                  className="border-gold/20 hover:bg-primary/5"
                >
                  <Home className="mr-2 h-4 w-4" />
                  Voltar para vendas
                </Button>
                <Button
                  variant="outline"
                  onClick={handleLogout}
                  className="border-gold/20 hover:bg-primary/5"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </Button>
              </div>
            </header>

            <div className="card-premium bg-white p-4">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
