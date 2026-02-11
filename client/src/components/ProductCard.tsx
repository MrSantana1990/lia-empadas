import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageCircle, Minus, Plus, ShoppingCart } from "lucide-react";
import { sendOnDemandRequest } from "@/lib/whatsappUtils";

interface ProductCardProps {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  availability?: "available" | "on_demand";
  onAddToCart: (quantity: number) => void;
}

const FALLBACK_PRODUCT_IMAGE = "/images/empada-close-up.jpg";

export default function ProductCard({
  id: _id,
  name,
  description,
  price,
  image,
  availability = "available",
  onAddToCart,
}: ProductCardProps) {
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const [imgSrc, setImgSrc] = useState(image);

  const handleDecrement = () => {
    if (quantity > 1) setQuantity(quantity - 1);
  };

  const handleIncrement = () => {
    setQuantity(quantity + 1);
  };

  const handleAddToCart = () => {
    if (availability === "on_demand") return;
    setIsAdding(true);
    onAddToCart(quantity);

    setTimeout(() => {
      setQuantity(1);
      setIsAdding(false);
    }, 300);
  };

  return (
    <div className="card-premium overflow-hidden group">
      <div className="relative h-48 overflow-hidden bg-gray-light">
        {availability === "on_demand" && (
          <div className="absolute left-3 top-3 z-10">
            <span className="inline-flex items-center rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground shadow-sm">
              Sob demanda
            </span>
          </div>
        )}

        <img
          src={imgSrc}
          alt={name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
          decoding="async"
          onError={() => {
            if (imgSrc !== FALLBACK_PRODUCT_IMAGE) setImgSrc(FALLBACK_PRODUCT_IMAGE);
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>

      <div className="p-4 flex flex-col">
        <h3 className="text-lg font-bold text-charcoal mb-1">{name}</h3>
        <p className="text-sm text-gray-medium mb-3 flex-grow">{description}</p>

        <div className="mb-4 pb-4 border-b border-gold/20">
          <p className="text-2xl font-bold text-gold">R$ {price.toFixed(2)}</p>
          <p className="text-xs text-gray-medium">por unidade</p>
        </div>

        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-gray-medium font-cta">Quantidade:</span>
          <div className="flex items-center gap-2 bg-gray-light rounded-lg p-1">
            <button
              onClick={handleDecrement}
              disabled={quantity <= 1}
              className="p-1 hover:bg-gold/20 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Diminuir quantidade"
            >
              <Minus size={16} className="text-charcoal" />
            </button>
            <span className="w-8 text-center font-bold text-charcoal">
              {quantity}
            </span>
            <button
              onClick={handleIncrement}
              className="p-1 hover:bg-gold/20 rounded transition-colors"
              aria-label="Aumentar quantidade"
            >
              <Plus size={16} className="text-charcoal" />
            </button>
          </div>
        </div>

        {availability === "on_demand" ? (
          <Button
            onClick={() =>
              sendOnDemandRequest({
                productName: name,
                quantity,
              })
            }
            className="btn-secondary w-full flex items-center justify-center gap-2"
          >
            <MessageCircle size={18} />
            Solicitar
          </Button>
        ) : (
          <Button
            onClick={handleAddToCart}
            disabled={isAdding}
            className="btn-premium w-full flex items-center justify-center gap-2"
          >
            <ShoppingCart size={18} />
            {isAdding ? "Adicionando..." : "Adicionar"}
          </Button>
        )}
      </div>
    </div>
  );
}
