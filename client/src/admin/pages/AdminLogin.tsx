import BrandLogo from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useState } from "react";
import { useLocation } from "wouter";
import { trpcMutation, type TrpcError } from "../lib/trpcClient";

function getLoginErrorMessage(err: unknown) {
  const e = err as Partial<TrpcError> | undefined;
  const status = typeof e?.status === "number" ? e.status : undefined;
  const message = typeof e?.message === "string" ? e.message : undefined;

  if (status === 401) return "Usuário ou senha inválidos.";

  if (status === 404) {
    return "Backend não encontrado. Para o Admin funcionar local, rode `pnpm dlx netlify-cli dev` e acesse http://localhost:8888/admin/login.";
  }

  if (status === 500) {
    return "Erro no backend. Verifique se suas env vars estão carregadas (JWT_SECRET, ADMIN_USERNAME, ADMIN_PASSWORD, GOOGLE_*).";
  }

  if (message && /failed to fetch|networkerror|load failed/i.test(message)) {
    return "Falha de rede ao chamar o backend. Rode `pnpm dlx netlify-cli dev` (porta 8888) e tente novamente.";
  }

  return message || "Falha no login";
}

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setError("");

    const trimmedUsername = username.trim();
    if (!trimmedUsername || !password) {
      setError("Preencha usuário e senha.");
      return;
    }

    setIsSubmitting(true);
    try {
      await trpcMutation("auth.login", { username: trimmedUsername, password });
      setLocation("/admin/finance");
    } catch (err) {
      setError(getLoginErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cream via-white to-cream px-4">
      <Card className="card-premium w-full max-w-md bg-white/90 backdrop-blur-sm">
        <CardContent className="pt-8 pb-8">
          <div className="flex justify-center mb-6">
            <BrandLogo />
          </div>

          <h1 className="text-2xl font-bold text-charcoal text-center mb-2">
            Login Admin
          </h1>
          <p className="text-sm text-gray-medium text-center mb-6">
            Entre para acessar o financeiro
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-cta text-charcoal mb-1">
                Usuário
              </label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 border border-gold/20 rounded-lg focus:outline-none focus:border-gold"
                autoComplete="username"
              />
            </div>

            <div>
              <label className="block text-sm font-cta text-charcoal mb-1">
                Senha
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gold/20 rounded-lg focus:outline-none focus:border-gold"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={isSubmitting}
              className="btn-premium w-full"
            >
              {isSubmitting ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
