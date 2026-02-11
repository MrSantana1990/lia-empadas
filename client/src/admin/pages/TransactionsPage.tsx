import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPrice } from "@/lib/whatsappUtils";
import { useEffect, useMemo, useState } from "react";
import AdminLayout from "../AdminLayout";
import { startOfMonthISO, toDateInputValue } from "../lib/date";
import { trpcCall, type TrpcError } from "../lib/trpcClient";
import {
  CategorySchema,
  TransactionSchema,
  type Category,
  type Transaction,
} from "../schemas";

type TxFilters = {
  from?: string;
  to?: string;
  status?: Transaction["status"] | "";
  type?: Transaction["type"] | "";
  categoryId?: string | "";
};

export default function TransactionsPage() {
  const title = useMemo(() => "Financeiro — Lançamentos", []);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [filters, setFilters] = useState<TxFilters>(() => ({
    from: startOfMonthISO(),
    to: toDateInputValue(new Date()),
    status: "",
    type: "",
    categoryId: "",
  }));

  const [editing, setEditing] = useState<Transaction | null>(null);
  const [form, setForm] = useState<{
    dateISO: string;
    type: Transaction["type"];
    amount: number;
    categoryId: string;
    paymentMethod: Transaction["paymentMethod"];
    description: string;
    status: Transaction["status"];
  }>({
    dateISO: toDateInputValue(new Date()),
    type: "IN",
    amount: 0,
    categoryId: "",
    paymentMethod: "PIX",
    description: "",
    status: "PENDING",
  });

  const loadAll = async () => {
    setLoading(true);
    setError("");
    try {
      const [catsRes, txRes] = await Promise.all([
        trpcCall<{ items: Category[] }>("finance.categories.list"),
        trpcCall<{ items: Transaction[] }>("finance.transactions.list", {
          from: filters.from || undefined,
          to: filters.to || undefined,
          status: filters.status || undefined,
          type: filters.type || undefined,
          categoryId: filters.categoryId || undefined,
        }),
      ]);

      const cats = catsRes.items.map(c => CategorySchema.parse(c));
      setCategories(cats);

      const tx = txRes.items.map(t => TransactionSchema.parse(t));
      setItems(tx);
    } catch (e) {
      setError((e as TrpcError).message || "Erro");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFilters = async () => {
    await loadAll();
  };

  const resetForm = () => {
    setEditing(null);
    setForm({
      dateISO: toDateInputValue(new Date()),
      type: "IN",
      amount: 0,
      categoryId: categories[0]?.id || "",
      paymentMethod: "PIX",
      description: "",
      status: "PENDING",
    });
  };

  useEffect(() => {
    if (!form.categoryId && categories.length > 0) {
      setForm(prev => ({ ...prev, categoryId: categories[0].id }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories.length]);

  const startEdit = (t: Transaction) => {
    setEditing(t);
    setForm({
      dateISO: t.dateISO,
      type: t.type,
      amount: t.amount,
      categoryId: t.categoryId,
      paymentMethod: t.paymentMethod,
      description: t.description,
      status: t.status,
    });
  };

  const save = async () => {
    setError("");
    try {
      if (!form.categoryId) {
        setError("Selecione uma categoria.");
        return;
      }

      if (editing) {
        await trpcCall("finance.transactions.update", {
          id: editing.id,
          data: { ...form },
        });
      } else {
        await trpcCall("finance.transactions.create", {
          ...form,
          source: "manual",
          reference: undefined,
        });
      }
      await loadAll();
      resetForm();
    } catch (e) {
      setError((e as TrpcError).message || "Erro ao salvar");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir lançamento?")) return;
    setError("");
    try {
      await trpcCall("finance.transactions.delete", { id });
      await loadAll();
    } catch (e) {
      setError((e as TrpcError).message || "Erro ao excluir");
    }
  };

  const confirmTx = async (id: string) => {
    setError("");
    try {
      await trpcCall("finance.transactions.confirm", { id });
      await loadAll();
    } catch (e) {
      setError((e as TrpcError).message || "Erro ao confirmar");
    }
  };

  const cancelTx = async (id: string) => {
    setError("");
    try {
      await trpcCall("finance.transactions.cancel", { id });
      await loadAll();
    } catch (e) {
      setError((e as TrpcError).message || "Erro ao cancelar");
    }
  };

  const exportCsv = () => {
    const qs = new URLSearchParams();
    if (filters.from) qs.set("from", filters.from);
    if (filters.to) qs.set("to", filters.to);
    window.open(`/api/finance/transactions/export.csv?${qs.toString()}`, "_blank");
  };

  const categoryName = (id: string) =>
    categories.find(c => c.id === id)?.name || id;

  return (
    <AdminLayout title={title}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
          <div className="space-y-3">
            <div className="card-premium bg-white p-3">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <div>
                  <label className="block text-sm font-cta text-charcoal mb-1">
                    De
                  </label>
                  <input
                    type="date"
                    value={filters.from || ""}
                    onChange={e =>
                      setFilters(prev => ({ ...prev, from: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gold/20 rounded-lg focus:outline-none focus:border-gold"
                  />
                </div>
                <div>
                  <label className="block text-sm font-cta text-charcoal mb-1">
                    Até
                  </label>
                  <input
                    type="date"
                    value={filters.to || ""}
                    onChange={e =>
                      setFilters(prev => ({ ...prev, to: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gold/20 rounded-lg focus:outline-none focus:border-gold"
                  />
                </div>
                <div>
                  <label className="block text-sm font-cta text-charcoal mb-1">
                    Status
                  </label>
                  <select
                    value={filters.status || ""}
                    onChange={e =>
                      setFilters(prev => ({
                        ...prev,
                        status: e.target.value as any,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gold/20 rounded-lg focus:outline-none focus:border-gold bg-white"
                  >
                    <option value="">Todos</option>
                    <option value="PENDING">PENDING</option>
                    <option value="CONFIRMED">CONFIRMED</option>
                    <option value="CANCELED">CANCELED</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-cta text-charcoal mb-1">
                    Tipo
                  </label>
                  <select
                    value={filters.type || ""}
                    onChange={e =>
                      setFilters(prev => ({ ...prev, type: e.target.value as any }))
                    }
                    className="w-full px-3 py-2 border border-gold/20 rounded-lg focus:outline-none focus:border-gold bg-white"
                  >
                    <option value="">Todos</option>
                    <option value="IN">IN</option>
                    <option value="OUT">OUT</option>
                    <option value="ADJUST">ADJUST</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-cta text-charcoal mb-1">
                    Categoria
                  </label>
                  <select
                    value={filters.categoryId || ""}
                    onChange={e =>
                      setFilters(prev => ({
                        ...prev,
                        categoryId: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gold/20 rounded-lg focus:outline-none focus:border-gold bg-white"
                  >
                    <option value="">Todas</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button className="btn-premium" onClick={applyFilters}>
                  Filtrar
                </Button>
                <Button className="btn-secondary" onClick={exportCsv}>
                  Exportar CSV
                </Button>
              </div>
            </div>

            {error && <div className="text-sm text-red-600">{error}</div>}

            {loading ? (
              <div className="text-sm text-gray-medium">Carregando…</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Pag.</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map(t => (
                    <TableRow key={t.id}>
                      <TableCell className="text-charcoal">{t.dateISO}</TableCell>
                      <TableCell className="text-gray-medium">{t.type}</TableCell>
                      <TableCell className="text-gray-medium">
                        {categoryName(t.categoryId)}
                      </TableCell>
                      <TableCell className="text-gray-medium">{t.status}</TableCell>
                      <TableCell className="text-gray-medium">
                        {t.paymentMethod}
                      </TableCell>
                      <TableCell className="text-right font-bold text-charcoal">
                        {formatPrice(t.amount)}
                      </TableCell>
                      <TableCell className="max-w-[260px] truncate text-gray-medium">
                        {t.description}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex gap-2">
                          <Button
                            variant="outline"
                            className="border-gold/20 hover:bg-primary/5"
                            onClick={() => startEdit(t)}
                          >
                            Editar
                          </Button>
                          {t.status === "PENDING" && (
                            <Button
                              variant="outline"
                              className="border-gold/20 hover:bg-primary/5"
                              onClick={() => confirmTx(t.id)}
                            >
                              Confirmar
                            </Button>
                          )}
                          {t.status !== "CANCELED" && (
                            <Button
                              variant="outline"
                              className="border-gold/20 hover:bg-red-50"
                              onClick={() => cancelTx(t.id)}
                            >
                              Cancelar
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            className="border-gold/20 hover:bg-red-50"
                            onClick={() => remove(t.id)}
                          >
                            Excluir
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <div className="card-premium bg-white p-4 space-y-3">
            <div className="font-bold text-charcoal">
              {editing ? "Editar lançamento" : "Novo lançamento"}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-cta text-charcoal mb-1">
                  Data
                </label>
                <input
                  type="date"
                  value={form.dateISO}
                  onChange={e =>
                    setForm(prev => ({ ...prev, dateISO: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gold/20 rounded-lg focus:outline-none focus:border-gold"
                />
              </div>
              <div>
                <label className="block text-sm font-cta text-charcoal mb-1">
                  Tipo
                </label>
                <select
                  value={form.type}
                  onChange={e =>
                    setForm(prev => ({ ...prev, type: e.target.value as any }))
                  }
                  className="w-full px-3 py-2 border border-gold/20 rounded-lg focus:outline-none focus:border-gold bg-white"
                >
                  <option value="IN">IN</option>
                  <option value="OUT">OUT</option>
                  <option value="ADJUST">ADJUST</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-cta text-charcoal mb-1">
                  Valor
                </label>
                <input
                  type="number"
                  value={form.amount}
                  onChange={e =>
                    setForm(prev => ({
                      ...prev,
                      amount: Number(e.target.value),
                    }))
                  }
                  className="w-full px-3 py-2 border border-gold/20 rounded-lg focus:outline-none focus:border-gold"
                />
              </div>
              <div>
                <label className="block text-sm font-cta text-charcoal mb-1">
                  Pagamento
                </label>
                <select
                  value={form.paymentMethod}
                  onChange={e =>
                    setForm(prev => ({
                      ...prev,
                      paymentMethod: e.target.value as any,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gold/20 rounded-lg focus:outline-none focus:border-gold bg-white"
                >
                  <option value="PIX">PIX</option>
                  <option value="DINHEIRO">DINHEIRO</option>
                  <option value="CARTAO">CARTAO</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-cta text-charcoal mb-1">
                Categoria
              </label>
              <select
                value={form.categoryId}
                onChange={e =>
                  setForm(prev => ({ ...prev, categoryId: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gold/20 rounded-lg focus:outline-none focus:border-gold bg-white"
              >
                {categories.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-cta text-charcoal mb-1">
                Descrição
              </label>
              <input
                value={form.description}
                onChange={e =>
                  setForm(prev => ({ ...prev, description: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gold/20 rounded-lg focus:outline-none focus:border-gold"
              />
            </div>

            <div>
              <label className="block text-sm font-cta text-charcoal mb-1">
                Status (admin)
              </label>
              <select
                value={form.status}
                onChange={e =>
                  setForm(prev => ({ ...prev, status: e.target.value as any }))
                }
                className="w-full px-3 py-2 border border-gold/20 rounded-lg focus:outline-none focus:border-gold bg-white"
              >
                <option value="PENDING">PENDING</option>
                <option value="CONFIRMED">CONFIRMED</option>
                <option value="CANCELED">CANCELED</option>
              </select>
            </div>

            <div className="flex gap-2">
              <Button className="btn-premium flex-1" onClick={save}>
                Salvar
              </Button>
              <Button className="btn-secondary" onClick={resetForm}>
                Limpar
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

