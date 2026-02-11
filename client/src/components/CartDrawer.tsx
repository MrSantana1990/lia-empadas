import { useState } from "react";
import { Send, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/hooks/useCart";
import {
  type DeliveryMethod,
  type PaymentMethod,
  formatPrice,
  sendOrderToWhatsApp,
} from "@/lib/whatsappUtils";
import { PIX_KEY } from "@/const";

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const FALLBACK_PRODUCT_IMAGE = "/images/empada-close-up.jpg";

export default function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const { cart, removeItem, updateQuantity, clearCart, getTotalQuantity } =
    useCart();
  const [showCheckoutForm, setShowCheckoutForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<{
    name: string;
    phone: string;
    deliveryMethod: DeliveryMethod;
    address: string;
    paymentMethod: PaymentMethod;
    deliveryDate: string;
    notes: string;
  }>({
    name: "",
    phone: "",
    deliveryMethod: "delivery",
    address: "",
    paymentMethod: "cash",
    deliveryDate: "",
    notes: "",
  });

  const totalQuantity = getTotalQuantity();
  const canCheckout = totalQuantity > 0;

  const handleFieldChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmitOrder = async () => {
    if (cart.items.length === 0) {
      alert("Seu carrinho está vazio.");
      return;
    }

    if (!formData.name.trim() || !formData.phone.trim()) {
      alert("Por favor, preencha Nome e Telefone.");
      return;
    }

    if (formData.deliveryMethod === "delivery" && !formData.address.trim()) {
      alert("Por favor, informe o endereço para entrega.");
      return;
    }

    setIsSubmitting(true);

    try {
      sendOrderToWhatsApp({
        items: cart.items,
        total: cart.total,
        customerName: formData.name.trim(),
        customerPhone: formData.phone.trim(),
        deliveryMethod: formData.deliveryMethod,
        paymentMethod: formData.paymentMethod,
        customerAddress: formData.address.trim(),
        deliveryDate: formData.deliveryDate || undefined,
        notes: formData.notes.trim() || undefined,
      });

      setTimeout(() => {
        clearCart();
        setShowCheckoutForm(false);
        setFormData({
          name: "",
          phone: "",
          deliveryMethod: "delivery",
          address: "",
          paymentMethod: "cash",
          deliveryDate: "",
          notes: "",
        });
        onClose();
        alert("Pedido enviado com sucesso! Verifique seu WhatsApp.");
        setIsSubmitting(false);
      }, 500);
    } catch (error) {
      console.error("Erro ao enviar pedido:", error);
      alert("Erro ao enviar pedido. Tente novamente.");
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity duration-300"
        onClick={onClose}
      />

      <div className="fixed right-0 top-0 h-full w-full md:w-96 bg-white shadow-2xl z-50 flex flex-col overflow-hidden transition-transform duration-300">
        <div className="flex items-center justify-between p-6 border-b border-gold/20">
          <h2 className="text-2xl font-bold text-charcoal">Seu Carrinho</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-primary/10 rounded-lg transition-colors"
            aria-label="Fechar carrinho"
          >
            <X size={24} className="text-charcoal" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {cart.items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="text-4xl mb-4">🛒</div>
              <p className="text-gray-medium mb-2">Seu carrinho está vazio</p>
              <p className="text-sm text-gray-medium mb-4">
                Adicione empadas para começar seu pedido
              </p>
              <Button onClick={onClose} className="btn-secondary">
                Continuar Comprando
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {cart.items.map(item => (
                <div
                  key={item.id}
                  className="flex gap-4 p-4 bg-cream rounded-lg border border-gold/20 hover:border-gold/40 transition-colors"
                >
                  <img
                    src={item.image || FALLBACK_PRODUCT_IMAGE}
                    alt={item.name}
                    className="w-16 h-16 object-cover rounded"
                    loading="lazy"
                    decoding="async"
                    onError={e => {
                      if (e.currentTarget.src.includes(FALLBACK_PRODUCT_IMAGE)) return;
                      e.currentTarget.src = FALLBACK_PRODUCT_IMAGE;
                    }}
                  />

                  <div className="flex-1">
                    <h3 className="font-bold text-charcoal text-sm">
                      {item.name}
                    </h3>
                    <p className="text-gold font-bold text-sm mb-2">
                      {formatPrice(item.price)}
                    </p>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="p-1 hover:bg-primary/10 rounded transition-colors disabled:opacity-50"
                        disabled={item.quantity <= 1}
                        aria-label="Diminuir quantidade"
                      >
                        −
                      </button>
                      <span className="w-6 text-center text-sm font-bold">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="p-1 hover:bg-primary/10 rounded transition-colors"
                        aria-label="Aumentar quantidade"
                      >
                        +
                      </button>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="ml-auto p-1 hover:bg-red-100 rounded transition-colors"
                        aria-label="Remover item"
                      >
                        <Trash2 size={16} className="text-red-500" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {cart.items.length > 0 && (
          <div className="border-t border-gold/20 p-6 space-y-4">
            <div className="space-y-2 pb-4 border-b border-gold/20">
              <div className="flex justify-between text-sm">
                <span className="text-gray-medium">Quantidade:</span>
                <span className="font-bold text-charcoal">
                  {totalQuantity} unidades
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-medium">Subtotal:</span>
                <span className="font-bold text-charcoal">
                  {formatPrice(cart.total)}
                </span>
              </div>
            </div>

            {!canCheckout && (
              <div className="bg-gold/10 border border-gold/30 rounded-lg p-3">
                <p className="text-sm text-charcoal">
                  Adicione pelo menos 1 item para finalizar.
                </p>
              </div>
            )}

            {!showCheckoutForm ? (
              <div className="space-y-2">
                <Button
                  onClick={() => setShowCheckoutForm(true)}
                  disabled={!canCheckout}
                  className="btn-premium w-full flex items-center justify-center gap-2"
                >
                  <Send size={18} />
                  Finalizar Pedido
                </Button>
                <Button onClick={clearCart} className="btn-secondary w-full">
                  Limpar Carrinho
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-cta text-charcoal mb-1">
                        Nome *
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleFieldChange}
                        placeholder="Seu nome"
                        className="w-full px-3 py-2 border border-gold/20 rounded-lg focus:outline-none focus:border-gold"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-cta text-charcoal mb-1">
                        Telefone *
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleFieldChange}
                        placeholder="(71) 98792-2212"
                        className="w-full px-3 py-2 border border-gold/20 rounded-lg focus:outline-none focus:border-gold"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-cta text-charcoal mb-2">
                        Entrega *
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setFormData(prev => ({
                              ...prev,
                              deliveryMethod: "delivery",
                            }))
                          }
                          className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                            formData.deliveryMethod === "delivery"
                              ? "border-primary bg-primary/10 text-charcoal"
                              : "border-gold/20 hover:bg-primary/5 text-charcoal"
                          }`}
                        >
                          Entregar
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setFormData(prev => ({
                              ...prev,
                              deliveryMethod: "hand",
                            }))
                          }
                          className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                            formData.deliveryMethod === "hand"
                              ? "border-primary bg-primary/10 text-charcoal"
                              : "border-gold/20 hover:bg-primary/5 text-charcoal"
                          }`}
                        >
                          Em mãos
                        </button>
                      </div>
                      <p className="text-xs text-gray-medium mt-2">
                        Se escolher <span className="font-semibold">Em mãos</span>, eu mesmo levo e
                        combinamos por WhatsApp.
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-cta text-charcoal mb-1">
                        {formData.deliveryMethod === "delivery"
                          ? "Endereço *"
                          : "Local/Referência (opcional)"}
                      </label>
                      <input
                        type="text"
                        name="address"
                        value={formData.address}
                        onChange={handleFieldChange}
                        placeholder={
                          formData.deliveryMethod === "delivery"
                            ? "Rua, número, bairro"
                            : "Ex: Perto do shopping, ponto de encontro..."
                        }
                        className="w-full px-3 py-2 border border-gold/20 rounded-lg focus:outline-none focus:border-gold"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-cta text-charcoal mb-1">
                        Data de entrega (opcional)
                      </label>
                      <input
                        type="date"
                        name="deliveryDate"
                        value={formData.deliveryDate}
                        onChange={handleFieldChange}
                        className="w-full px-3 py-2 border border-gold/20 rounded-lg focus:outline-none focus:border-gold"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-cta text-charcoal mb-2">
                        Pagamento *
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setFormData(prev => ({ ...prev, paymentMethod: "pix" }))
                          }
                          className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                            formData.paymentMethod === "pix"
                              ? "border-primary bg-primary/10 text-charcoal"
                              : "border-gold/20 hover:bg-primary/5 text-charcoal"
                          }`}
                        >
                          PIX
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setFormData(prev => ({ ...prev, paymentMethod: "cash" }))
                          }
                          className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                            formData.paymentMethod === "cash"
                              ? "border-primary bg-primary/10 text-charcoal"
                              : "border-gold/20 hover:bg-primary/5 text-charcoal"
                          }`}
                        >
                          Dinheiro
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setFormData(prev => ({ ...prev, paymentMethod: "card" }))
                          }
                          className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                            formData.paymentMethod === "card"
                              ? "border-primary bg-primary/10 text-charcoal"
                              : "border-gold/20 hover:bg-primary/5 text-charcoal"
                          }`}
                        >
                          Cartão
                        </button>
                      </div>

                      {formData.paymentMethod === "pix" && (
                        <p className="text-xs text-gray-medium mt-2">
                          {PIX_KEY
                            ? "Chave PIX configurada e será enviada no pedido."
                            : "Chave PIX ainda não configurada (PIX_KEY)."}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-cta text-charcoal mb-1">
                        Observações (opcional)
                      </label>
                      <textarea
                        name="notes"
                        value={formData.notes}
                        onChange={handleFieldChange}
                        placeholder="Alguma observação especial?"
                        rows={3}
                        className="w-full px-3 py-2 border border-gold/20 rounded-lg focus:outline-none focus:border-gold resize-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-4 border-t border-gold/20">
                  <Button
                    onClick={handleSubmitOrder}
                    disabled={isSubmitting}
                    className="btn-premium w-full flex items-center justify-center gap-2"
                  >
                    <Send size={18} />
                    {isSubmitting ? "Enviando..." : "Enviar pedido no WhatsApp"}
                  </Button>
                  <Button
                    onClick={() => setShowCheckoutForm(false)}
                    className="btn-secondary w-full"
                  >
                    Voltar
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
