import { useState, useMemo } from 'react';
import { ShoppingCart, Menu, X, ChevronRight, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ProductCard from '@/components/ProductCard';
import { useCart } from '@/hooks/useCart';
import { PRODUCTS, CATEGORIES } from '@/const';
import CartDrawer from '@/components/CartDrawer';
import BrandLogo from '@/components/BrandLogo';
import { useLocation } from 'wouter';

/**
 * Design: Luxo Minimalista Moderno
 * - Paleta: Dourado champagne, branco, cinza grafite, verde oliva
 * - Tipografia: Playfair Display (títulos) + Lato (corpo)
 * - Layout: Assimétrico com espaçamento generoso
 * - Animações: Suaves e sofisticadas (300-400ms)
 */

export default function Home() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { addItem, getTotalQuantity, isLoaded } = useCart();
  const [, setLocation] = useLocation();

  // Filtrar produtos por categoria
  const filteredProducts = useMemo(() => {
    if (selectedCategory === 'all') {
      return PRODUCTS;
    }
    return PRODUCTS.filter(product => product.category === selectedCategory);
  }, [selectedCategory]);

  const handleAddToCart = (productId: string, quantity: number) => {
    const product = PRODUCTS.find(p => p.id === productId);
    if (product) {
      addItem(productId, product.name, product.price, product.image, quantity);
    }
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-gold"></div>
          <p className="mt-4 text-charcoal font-semibold">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div id="topo" className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/85 supports-[backdrop-filter]:bg-white/70 backdrop-blur-xl border-b border-gold/20 shadow-sm">
        <div className="container py-4 flex items-center justify-between">
          {/* Logo */}
          <a
            href="#topo"
            className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
            aria-label="Voltar para o topo"
          >
            <BrandLogo />
          </a>

          {/* Desktop Menu */}
          <nav className="hidden md:flex items-center gap-8">
            <a href="#produtos" className="text-charcoal hover:text-gold transition-colors font-semibold text-sm">
              Produtos
            </a>
            <a href="#sobre" className="text-charcoal hover:text-gold transition-colors font-semibold text-sm">
              Sobre
            </a>
            <a href="#contato" className="text-charcoal hover:text-gold transition-colors font-semibold text-sm">
              Contato
            </a>
          </nav>

          {/* Cart Button & Mobile Menu */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setLocation('/admin/login')}
              className="inline-flex items-center gap-2 px-2 sm:px-3 py-2 rounded-lg border border-gold/30 bg-white/60 hover:bg-white transition-colors text-charcoal text-sm font-semibold"
              aria-label="Acessar área administrativa"
            >
              <Shield size={18} className="text-charcoal" />
              <span className="hidden sm:inline">Admin</span>
            </button>

            <button
              onClick={() => setIsCartOpen(true)}
              className="relative p-2 hover:bg-primary/10 rounded-lg transition-colors"
              aria-label="Abrir carrinho"
            >
              <ShoppingCart size={24} className="text-charcoal" />
              {getTotalQuantity() > 0 && (
                <span className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {getTotalQuantity()}
                </span>
              )}
            </button>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 hover:bg-primary/10 rounded-lg transition-colors"
              aria-label="Menu"
            >
              {isMobileMenuOpen ? (
                <X size={24} className="text-charcoal" />
              ) : (
                <Menu size={24} className="text-charcoal" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-gold/20 bg-cream">
            <nav className="container py-4 flex flex-col gap-4">
              <a href="#produtos" className="text-charcoal hover:text-gold transition-colors font-semibold">
                Produtos
              </a>
              <a href="#sobre" className="text-charcoal hover:text-gold transition-colors font-semibold">
                Sobre
              </a>
              <a href="#contato" className="text-charcoal hover:text-gold transition-colors font-semibold">
                Contato
              </a>
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setLocation('/admin/login');
                }}
                className="flex items-center gap-2 text-charcoal hover:text-gold transition-colors font-semibold text-left"
                aria-label="Acessar área administrativa"
              >
                <Shield size={18} />
                <span>Admin</span>
              </button>
            </nav>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-cream via-white to-cream py-12 md:py-20">
        <div className="container">
          <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
            {/* Conteúdo */}
            <div className="space-y-6">
              <div>
                <p className="text-gold font-semibold text-sm tracking-widest mb-2">BEM-VINDO</p>
                <h1 className="text-4xl md:text-5xl text-charcoal mb-4">
                  Empadas Artesanais da Lia
                </h1>
                <p className="text-lg text-gray-medium leading-relaxed">
                  Feitas com ingredientes selecionados e muito amor. Cada empada é um convite para saborear tradição e qualidade.
                </p>
              </div>

              <div className="flex gap-4">
                <Button
                  onClick={() => document.getElementById('produtos')?.scrollIntoView({ behavior: 'smooth' })}
                  className="btn-premium flex items-center gap-2"
                >
                  Ver Cardápio
                  <ChevronRight size={18} />
                </Button>
              </div>

              {/* Destaque */}
              <div className="pt-6 border-t border-gold/20">
                <p className="text-sm text-gray-medium mb-2">✓ Entrega rápida</p>
                <p className="text-sm text-gray-medium">✓ Peça no WhatsApp em segundos</p>
              </div>
            </div>

            {/* Imagem Hero */}
            <div className="relative h-96 md:h-full">
              <img
                src="/images/empada-hero-banner.jpg"
                alt="Empadas da Lia"
                className="w-full h-full object-cover rounded-lg shadow-lg"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-lg" />
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="mt-12 md:mt-20">
          <div className="divider-gold h-0.5" />
        </div>
      </section>

      {/* Produtos Section */}
      <section id="produtos" className="py-16 md:py-24 bg-white">
        <div className="container">
          {/* Título */}
          <div className="mb-12 text-center">
            <p className="text-gold font-semibold text-sm tracking-widest mb-2">NOSSOS SABORES</p>
            <h2 className="text-3xl md:text-4xl text-charcoal mb-4">
              Escolha seus Favoritos
            </h2>
            <p className="text-gray-medium max-w-2xl mx-auto">
              Uma seleção cuidadosa de sabores que combinam tradição com inovação
            </p>
          </div>

          {/* Filtro de Categorias */}
          <div className="flex flex-wrap gap-3 mb-12 justify-center">
            {CATEGORIES.map(category => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`font-semibold px-6 py-2 rounded-lg transition-all duration-300 ${
                  selectedCategory === category.id
                    ? 'bg-primary text-primary-foreground shadow-lg'
                    : 'bg-gray-light text-charcoal hover:bg-primary/10'
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>

          {/* Grid de Produtos */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {filteredProducts.map(product => (
              <ProductCard
                key={product.id}
                id={product.id}
                name={product.name}
                description={product.description}
                price={product.price}
                image={product.image}
                availability={"availability" in product ? product.availability : "available"}
                onAddToCart={(quantity) => handleAddToCart(product.id, quantity)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Sobre Section */}
      <section id="sobre" className="py-16 md:py-24 bg-cream">
        <div className="container">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Imagem */}
            <div className="relative h-96">
              <img
                src="/images/empada-lifestyle.jpg"
                alt="Empadas da Lia"
                className="w-full h-full object-cover rounded-lg shadow-lg"
              />
            </div>

            {/* Conteúdo */}
            <div className="space-y-6">
              <div>
                <p className="text-gold font-semibold text-sm tracking-widest mb-2">NOSSA HISTÓRIA</p>
                <h2 className="text-3xl md:text-4xl text-charcoal mb-4">
                  Tradição e Qualidade
                </h2>
              </div>

              <p className="text-gray-medium leading-relaxed">
                As Empadas da Lia são feitas com receita tradicional, utilizando apenas ingredientes de qualidade superior. Cada empada é preparada com cuidado e atenção aos detalhes.
              </p>

              <p className="text-gray-medium leading-relaxed">
                Acreditamos que a comida caseira é mais que um alimento, é um gesto de amor. Por isso, cada empada é feita pensando em você.
              </p>

              <ul className="space-y-3 pt-4">
                <li className="flex items-center gap-3">
                  <span className="text-gold font-bold">✓</span>
                  <span className="text-charcoal">Ingredientes selecionados</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="text-gold font-bold">✓</span>
                  <span className="text-charcoal">Preparação artesanal</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="text-gold font-bold">✓</span>
                  <span className="text-charcoal">Entrega fresca</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-24 bg-gradient-to-r from-charcoal to-charcoal/90">
        <div className="container text-center">
          <h2 className="text-3xl md:text-4xl text-white mb-4">
            Pronto para Saborear?
          </h2>
          <p className="text-gold/80 mb-8 max-w-2xl mx-auto">
            Escolha seus sabores favoritos e envie seu pedido diretamente para o WhatsApp
          </p>
          <Button
            onClick={() => setIsCartOpen(true)}
            className="btn-premium px-8 py-3 font-semibold text-lg"
          >
            Fazer Pedido Agora
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-charcoal text-white py-8 border-t border-gold/20">
        <div className="container">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <h3 className="font-bold mb-4">Empadas da Lia</h3>
              <p className="text-gray-light text-sm">Feitas com amor, entregues com cuidado.</p>
            </div>
            <div>
              <h3 className="font-bold mb-4">Contato</h3>
              <p className="text-gray-light text-sm">WhatsApp: (71) 98792-2212</p>
              <p className="text-gray-light text-sm">Instagram: @empadasdalia</p>
            </div>
            <div>
              <h3 className="font-bold mb-4">Horário</h3>
              <p className="text-gray-light text-sm">Seg-Sex: 8h às 18h</p>
              <p className="text-gray-light text-sm">Sab: 8h às 14h</p>
            </div>
          </div>

          <div className="divider-gold h-0.5 mb-8" />

          <div className="text-center text-gray-light text-sm">
            <p>&copy; 2026 Empadas da Lia. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>

      {/* Cart Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
      />
    </div>
  );
}
