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
import {
  paymentMethodLabel,
  transactionStatusLabel,
  transactionTypeLabel,
} from "../lib/labels";
import { trpcMutation, trpcQuery, type TrpcError } from "../lib/trpcClient";
import {
  CategorySchema,
  TransactionSchema,
  type Category,
  type Transaction,
} from "../schemas";

const DESCRIPTION_OPTIONS: Record<Transaction["type"], string[]> = {
  IN: ["Venda balcão", "Venda encomenda", "Venda delivery", "Outros"],
  OUT: [
    "Compra de embalagens",
    "Compra de ingredientes",
    "Compra de material",
    "Gás",
    "Transporte",
    "Marketing",
    "Outros",
  ],
  ADJUST: ["Ajuste de caixa", "Outros"],
};

type TxPreset = {
  label: string;
  data: Partial<Pick<TxForm, "type" | "paymentMethod" | "status">> & {
    description: string;
    preferredCategoryName?: string;
  };
};

const TX_PRESETS: TxPreset[] = [
  {
    label: "Venda (PIX)",
    data: { type: "IN", paymentMethod: "PIX", status: "CONFIRMED", description: "Venda balcão" },
  },
  {
    label: "Venda (Dinheiro)",
    data: { type: "IN", paymentMethod: "DINHEIRO", status: "CONFIRMED", description: "Venda balcão" },
  },
  {
    label: "Embalagens",
    data: {
      type: "OUT",
      paymentMethod: "PIX",
      status: "PENDING",
      description: "Compra de embalagens",
      preferredCategoryName: "Embalagens",
    },
  },
  {
    label: "Material",
    data: {
      type: "OUT",
      paymentMethod: "PIX",
      status: "PENDING",
      description: "Compra de material",
      preferredCategoryName: "Material",
    },
  },
  {
    label: "Ingredientes",
    data: {
      type: "OUT",
      paymentMethod: "PIX",
      status: "PENDING",
      description: "Compra de ingredientes",
      preferredCategoryName: "Ingredientes",
    },
  },
];

type TxFilters = {
  from: string;
  to: string;
  status: Transaction["status"] | "";
  type: Transaction["type"] | "";
  categoryId: string | "";
};

type TxForm = {
  dateISO: string;
  type: Transaction["type"];
  amount: number;
  categoryId: string;
  paymentMethod: Transaction["paymentMethod"];
  description: string;
  status: Transaction["status"];
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
  const [form, setForm] = useState<TxForm>(() => ({
    dateISO: toDateInputValue(new Date()),
    type: "IN",
    amount: 0,
    categoryId: "",
    paymentMethod: "PIX",
    description: "",
    status: "PENDING",
  }));

  const [descMode, setDescMode] = useState<"select" | "custom">("select");
  const [descSelected, setDescSelected] = useState<string>("");
  const [descCustom, setDescCustom] = useState<string>("");

  const descOptions = useMemo(() => DESCRIPTION_OPTIONS[form.type] ?? ["Outros"], [form.type]);

  const normalizeName = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "");

  const findCategoryIdByName = (name: string | undefined) => {
    if (!name) return null;
    const n = normalizeName(name);
    return categories.find((c) => normalizeName(c.name) === n)?.id ?? null;
  };

  const bestCategoryForType = (type: Transaction["type"], currentCategoryId?: string) => {
    if (categories.length === 0) return "";
    const current = categories.find((c) => c.id === (currentCategoryId ?? form.categoryId));
    const okForType = (c: Category) => {
      if (type === "ADJUST") return true;
      if (type === "IN") return c.kind === "IN" || c.kind === "BOTH";
      if (type === "OUT") return c.kind === "OUT" || c.kind === "BOTH";
      return true;
    };

    if (current && okForType(current)) return current.id;
    return categories.find(okForType)?.id ?? categories[0].id;
  };

  const syncDescriptionControls = (nextType: Transaction["type"], desc: string) => {
    const options = DESCRIPTION_OPTIONS[nextType] ?? ["Outros"];
    if (options.includes(desc)) {
      setDescMode("select");
      setDescSelected(desc);
      setDescCustom("");
    } else if (desc) {
      setDescMode("custom");
      setDescSelected("Outros");
      setDescCustom(desc);
    } else {
      setDescMode("select");
      setDescSelected(options[0] ?? "Outros");
      setDescCustom("");
    }
  };

  const setTypeAndDefaults = (nextType: Transaction["type"]) => {
    const options = DESCRIPTION_OPTIONS[nextType] ?? ["Outros"];
    const defaultDesc = options[0] ?? "Outros";

    setForm((p) => ({
      ...p,
      type: nextType,
      categoryId: bestCategoryForType(nextType, p.categoryId),
      description:
        (p.description && options.includes(p.description)) ? p.description : defaultDesc,
    }));

    syncDescriptionControls(nextType, defaultDesc);
  };

  const resetForm = (nextCategories: Category[] = categories) => {
    setEditing(null);
    const nextType: Transaction["type"] = "IN";
    const next = {
      dateISO: toDateInputValue(new Date()),
      type: nextType,
      amount: 0,
      categoryId: nextCategories[0]?.id || "",
      paymentMethod: "PIX",
      description: "",
      status: "PENDING",
    } satisfies TxForm;
    setForm(next);
    syncDescriptionControls(nextType, next.description);
  };

  const loadAll = async () => {
    setLoading(true);
    setError("");
    try {
      const [catsRes, txRes] = await Promise.all([
        trpcQuery<{ items: Category[] }>("finance.categories.list"),
        trpcQuery<{ items: Transaction[] }>("finance.transactions.list", {
          from: filters.from || undefined,
          to: filters.to || undefined,
          status: filters.status || undefined,
          type: filters.type || undefined,
          categoryId: filters.categoryId || undefined,
        }),
      ]);

      const cats = catsRes.items.map((c) => CategorySchema.parse(c));
      setCategories(cats);

      const tx = txRes.items.map((t) => TransactionSchema.parse(t));
      setItems(tx);

      if (!form.categoryId && cats.length > 0) {
        setForm((prev) => ({ ...prev, categoryId: cats[0].id }));
      }
    } catch (e) {
      setError((e as TrpcError).message || "Erro ao carregar lançamentos");
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
    syncDescriptionControls(t.type, t.description);
  };

  const save = async () => {
    setError("");

    if (!form.dateISO) {
      setError("Informe a data.");
      return;
    }
    if (!form.categoryId) {
      setError("Selecione uma categoria.");
      return;
    }
    if (!Number.isFinite(form.amount) || form.amount <= 0) {
      setError("Informe um valor maior que zero.");
      return;
    }
    const descriptionFinal =
      descMode === "custom"
        ? descCustom.trim()
        : (descSelected || "").trim();

    if (!descriptionFinal) {
      setError("Informe a descrição.");
      return;
    }

    try {
      if (editing) {
        await trpcMutation("finance.transactions.update", {
          id: editing.id,
          data: { ...form, description: descriptionFinal },
        });
      } else {
        await trpcMutation("finance.transactions.create", {
          ...form,
          description: descriptionFinal,
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
      await trpcMutation("finance.transactions.delete", { id });
      await loadAll();
    } catch (e) {
      setError((e as TrpcError).message || "Erro ao excluir");
    }
  };

  const confirmTx = async (id: string) => {
    setError("");
    try {
      await trpcMutation("finance.transactions.confirm", { id });
      await loadAll();
    } catch (e) {
      setError((e as TrpcError).message || "Erro ao confirmar");
    }
  };

  const cancelTx = async (id: string) => {
    setError("");
    try {
      await trpcMutation("finance.transactions.cancel", { id });
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

  const catName = (categoryId: string) =>
    categories.find((c) => c.id === categoryId)?.name || "—";

  return (
    <AdminLayout title={title}>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_1fr_1fr_140px] gap-3 items-end">
            <div>
              <label className="block text-sm font-cta text-charcoal mb-1">
                De
              </label>
              <input
                type="date"
                value={filters.from}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, from: e.target.value }))
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
                value={filters.to}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, to: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gold/20 rounded-lg focus:outline-none focus:border-gold"
              />
            </div>
            <div>
              <label className="block text-sm font-cta text-charcoal mb-1">
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, status: e.target.value as any }))
                }
                className="w-full px-3 py-2 border border-gold/20 rounded-lg focus:outline-none focus:border-gold bg-white"
              >
                <option value="">Todos</option>
                <option value="PENDING">Pendente</option>
                <option value="CONFIRMED">Confirmado</option>
                <option value="CANCELED">Cancelado</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-cta text-charcoal mb-1">
                Tipo
              </label>
              <select
                value={filters.type}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, type: e.target.value as any }))
                }
                className="w-full px-3 py-2 border border-gold/20 rounded-lg focus:outline-none focus:border-gold bg-white"
              >
                <option value="">Todos</option>
                <option value="IN">Entrada</option>
                <option value="OUT">Saída</option>
                <option value="ADJUST">Ajuste</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-cta text-charcoal mb-1">
                Categoria
              </label>
              <select
                value={filters.categoryId}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, categoryId: e.target.value as any }))
                }
                className="w-full px-3 py-2 border border-gold/20 rounded-lg focus:outline-none focus:border-gold bg-white"
              >
                <option value="">Todas</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <Button className="btn-premium flex-1" onClick={applyFilters}>
                Filtrar
              </Button>
              <Button className="btn-secondary" onClick={exportCsv}>
                CSV
              </Button>
            </div>
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
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-charcoal">{t.dateISO}</TableCell>
                    <TableCell className="text-charcoal font-semibold">
                      {t.description}
                    </TableCell>
                    <TableCell className="text-gray-medium">
                      {transactionTypeLabel[t.type]}
                    </TableCell>
                    <TableCell className="text-gray-medium">
                      {catName(t.categoryId)}
                    </TableCell>
                    <TableCell className="text-gray-medium">
                      {transactionStatusLabel[t.status]}
                    </TableCell>
                    <TableCell className="text-gray-medium">
                      {paymentMethodLabel[t.paymentMethod]}
                    </TableCell>
                    <TableCell className="text-right font-bold text-charcoal">
                      {formatPrice(t.amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex flex-wrap gap-2 justify-end">
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
                          className="border-gold/20 hover:bg-primary/5"
                          onClick={() => startEdit(t)}
                        >
                          Editar
                        </Button>
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

          <div className="rounded-lg border border-gold/10 bg-cream px-3 py-3">
            <div className="text-xs font-semibold text-charcoal mb-2">
              Atalhos (menos digitação)
            </div>
            <div className="flex flex-wrap gap-2">
              {TX_PRESETS.map((p) => (
                <Button
                  key={p.label}
                  type="button"
                  className="btn-secondary h-9 px-3"
                  onClick={() => {
                    const nextType = p.data.type ?? form.type;
                    const preferredCategoryId = findCategoryIdByName(p.data.preferredCategoryName ?? "");

                    setForm((prev) => {
                      const nextCategoryId =
                        preferredCategoryId ?? bestCategoryForType(nextType);
    const next: TxForm = {
      ...prev,
      type: nextType,
      paymentMethod: p.data.paymentMethod ?? prev.paymentMethod,
      status: p.data.status ?? prev.status,
      description: p.data.description,
      categoryId: nextCategoryId,
    };
                      return next;
                    });
                    syncDescriptionControls(nextType, p.data.description);
                  }}
                >
                  {p.label}
                </Button>
              ))}
            </div>
            <div className="text-[11px] text-gray-medium mt-2">
              Dica: <span className="font-semibold">Saída</span> use para compras de material/embalagens/ingredientes.
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-cta text-charcoal mb-1">
                Data
              </label>
              <input
                type="date"
                value={form.dateISO}
                onChange={(e) =>
                  setForm((p) => ({ ...p, dateISO: e.target.value }))
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
                onChange={(e) => setTypeAndDefaults(e.target.value as any)}
                className="w-full px-3 py-2 border border-gold/20 rounded-lg focus:outline-none focus:border-gold bg-white"
              >
                <option value="IN">Entrada</option>
                <option value="OUT">Saída</option>
                <option value="ADJUST">Ajuste</option>
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
                onChange={(e) =>
                  setForm((p) => ({ ...p, amount: Number(e.target.value) }))
                }
                className="w-full px-3 py-2 border border-gold/20 rounded-lg focus:outline-none focus:border-gold"
                min={0}
                step="0.01"
              />
            </div>
            <div>
              <label className="block text-sm font-cta text-charcoal mb-1">
                Pagamento
              </label>
              <select
                value={form.paymentMethod}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    paymentMethod: e.target.value as any,
                  }))
                }
                className="w-full px-3 py-2 border border-gold/20 rounded-lg focus:outline-none focus:border-gold bg-white"
              >
                <option value="PIX">PIX</option>
                <option value="DINHEIRO">Dinheiro</option>
                <option value="CARTAO">Cartão</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-cta text-charcoal mb-1">
              Categoria
            </label>
            <select
              value={form.categoryId}
              onChange={(e) =>
                setForm((p) => ({ ...p, categoryId: e.target.value }))
              }
              className="w-full px-3 py-2 border border-gold/20 rounded-lg focus:outline-none focus:border-gold bg-white"
            >
              {categories.length === 0 ? (
                <option value="">Crie uma categoria primeiro</option>
              ) : (
                categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="block text-sm font-cta text-charcoal mb-1">
              Descrição
            </label>
            <div className="grid grid-cols-1 gap-2">
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={descSelected || descOptions[0] || "Outros"}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDescSelected(v);
                    if (v === "Outros") {
                      setDescMode("custom");
                      setForm((p) => ({ ...p, description: "" }));
                      return;
                    }
                    setDescMode("select");
                    setDescCustom("");
                    setForm((p) => ({ ...p, description: v }));
                  }}
                  className="w-full px-3 py-2 border border-gold/20 rounded-lg focus:outline-none focus:border-gold bg-white"
                >
                  {descOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
                <select
                  value={descMode}
                  onChange={(e) => setDescMode(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gold/20 rounded-lg focus:outline-none focus:border-gold bg-white"
                >
                  <option value="select">Usar opção</option>
                  <option value="custom">Personalizar</option>
                </select>
              </div>

              {descMode === "custom" && (
                <input
                  value={descCustom}
                  onChange={(e) => setDescCustom(e.target.value)}
                  placeholder="Digite a descrição (ex: Compra embalagens — Fornecedor X)"
                  className="w-full px-3 py-2 border border-gold/20 rounded-lg focus:outline-none focus:border-gold"
                />
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-cta text-charcoal mb-1">
              Status (admin)
            </label>
            <select
              value={form.status}
              onChange={(e) =>
                setForm((p) => ({ ...p, status: e.target.value as any }))
              }
              className="w-full px-3 py-2 border border-gold/20 rounded-lg focus:outline-none focus:border-gold bg-white"
            >
              <option value="PENDING">Pendente</option>
              <option value="CONFIRMED">Confirmado</option>
              <option value="CANCELED">Cancelado</option>
            </select>
          </div>

          <div className="flex gap-2">
            <Button className="btn-premium flex-1" onClick={save}>
              Salvar
            </Button>
            <Button className="btn-secondary" onClick={() => resetForm()}>
              Limpar
            </Button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
