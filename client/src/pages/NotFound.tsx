import BrandLogo from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Home } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  const handleGoHome = () => {
    setLocation("/");
  };

  return (
    <div
      id="topo"
      className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-cream via-white to-cream"
    >
      <Card className="card-premium w-full max-w-lg mx-4 bg-white/90 backdrop-blur-sm">
        <CardContent className="pt-8 pb-8 text-center">
          <div className="flex justify-center mb-6">
            <BrandLogo size="sm" withText={false} />
          </div>

          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-gold/15 rounded-full animate-pulse" />
              <AlertCircle className="relative h-16 w-16 text-charcoal" />
            </div>
          </div>

          <h1 className="text-4xl font-bold text-charcoal mb-2">404</h1>

          <h2 className="text-xl font-semibold text-charcoal mb-4">
            Página não encontrada
          </h2>

          <p className="text-gray-medium mb-8 leading-relaxed">
            A página que você procura não existe.
            <br />
            Ela pode ter sido movida ou removida.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              onClick={handleGoHome}
              className="btn-premium px-6 py-2.5 inline-flex"
            >
              <Home className="w-4 h-4 mr-2" />
              Voltar para o início
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
