import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useEffect, useMemo, useState } from "react";
import AdminLayout from "../AdminLayout";
import {
  productAvailabilityLabel,
  type ProductAvailability,
} from "../lib/labels";
import { trpcMutation, trpcQuery, type TrpcError } from "../lib/trpcClient";

type CatalogProduct = {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  availability: ProductAvailability;
};

const CATEGORY_LABEL: Record<string, string> = {
  classic: "Clássica",
  premium: "Premium",
  vegetarian: "Vegetariana",
  all: "Todos",
};

export default function ProductsPage() {
  const title = useMemo(() => "Catálogo — Sabores & Preços", []);
  const [items, setItems] = useState<CatalogProduct[]>([]);
  const [draft, setDraft] = useState<
    Record<string, { price: string; availability: ProductAvailability }>
  >({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string>("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await trpcQuery<{ items: CatalogProduct[] }>(
        "catalog.products.list"
      );
      setItems(res.items);
      setDraft(
        Object.fromEntries(
          res.items.map((p) => [
            p.id,
            {
              price: String(p.price),
              availability: p.availability,
            },
          ])
        )
      );
    } catch (e) {
      setError((e as TrpcError).message || "Erro ao carregar catálogo");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async (id: string) => {
    setError("");
    const d = draft[id];
    if (!d) return;

    const price = Number(d.price);
    if (!Number.isFinite(price) || price < 0) {
      setError("Preço inválido. Use um valor maior ou igual a zero.");
      return;
    }

    setSavingId(id);
    try {
      await trpcMutation("catalog.products.update", {
        id,
        price,
        availability: d.availability,
      });
      await load();
    } catch (e) {
      setError((e as TrpcError).message || "Erro ao salvar");
    } finally {
      setSavingId("");
    }
  };

  const reset = async (id: string) => {
    if (!confirm("Voltar ao padrão deste sabor?")) return;
    setError("");
    setSavingId(id);
    try {
      await trpcMutation("catalog.products.reset", { id });
      await load();
    } catch (e) {
      setError((e as TrpcError).message || "Erro ao resetar");
    } finally {
      setSavingId("");
    }
  };

  return (
    <AdminLayout title={title}>
      <div className="space-y-3">
        <div className="text-sm text-gray-medium">
          Aqui você define o <span className="font-semibold">preço</span> e se o
          sabor fica <span className="font-semibold">disponível</span>,{" "}
          <span className="font-semibold">sob demanda</span> ou{" "}
          <span className="font-semibold">indisponível</span>. Isso afeta a
          vitrine pública.
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-sm text-gray-medium">Carregando...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sabor</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Preço (R$)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((p) => {
                const d = draft[p.id];
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-semibold text-charcoal">
                      {p.name}
                      <div className="text-xs text-gray-medium line-clamp-1">
                        {p.description}
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-medium">
                      {CATEGORY_LABEL[p.category] ?? p.category}
                    </TableCell>
                    <TableCell className="text-right">
                      <input
                        type="number"
                        value={d?.price ?? String(p.price)}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            [p.id]: {
                              price: e.target.value,
                              availability:
                                prev[p.id]?.availability ?? p.availability,
                            },
                          }))
                        }
                        className="w-28 text-right px-3 py-2 border border-gold/20 rounded-lg focus:outline-none focus:border-gold"
                        min={0}
                        step="0.01"
                      />
                    </TableCell>
                    <TableCell>
                      <select
                        value={d?.availability ?? p.availability}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            [p.id]: {
                              price: prev[p.id]?.price ?? String(p.price),
                              availability: e.target.value as any,
                            },
                          }))
                        }
                        className="px-3 py-2 border border-gold/20 rounded-lg focus:outline-none focus:border-gold bg-white"
                      >
                        {(
                          ["available", "on_demand", "unavailable"] as const
                        ).map((v) => (
                          <option key={v} value={v}>
                            {productAvailabilityLabel[v]}
                          </option>
                        ))}
                      </select>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          className="border-gold/20 hover:bg-primary/5"
                          disabled={savingId === p.id}
                          onClick={() => save(p.id)}
                        >
                          {savingId === p.id ? "Salvando..." : "Salvar"}
                        </Button>
                        <Button
                          variant="outline"
                          className="border-gold/20 hover:bg-red-50"
                          disabled={savingId === p.id}
                          onClick={() => reset(p.id)}
                        >
                          Padrão
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </AdminLayout>
  );
}

