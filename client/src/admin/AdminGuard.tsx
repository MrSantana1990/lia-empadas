import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpcQuery, type TrpcError } from "./lib/trpcClient";

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"loading" | "authed" | "anon" | "error">(
    "loading"
  );
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let mounted = true;
    trpcQuery<{ role: "admin" }>("auth.me")
      .then(() => {
        if (!mounted) return;
        setStatus("authed");
      })
      .catch((e: TrpcError) => {
        if (!mounted) return;
        if (e.status === 401) {
          setStatus("anon");
          setLocation("/admin/login");
          return;
        }
        setError(e.message || "Erro ao validar sessão");
        setStatus("error");
      });
    return () => {
      mounted = false;
    };
  }, [setLocation]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-lg w-full card-premium p-6 bg-white">
          <div className="font-bold text-charcoal mb-2">Erro</div>
          <div className="text-sm text-gray-medium">{error}</div>
        </div>
      </div>
    );
  }

  if (status === "anon") return null;
  return <>{children}</>;
}
