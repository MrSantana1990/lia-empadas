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
import { toDateInputValue } from "../lib/date";
import {
  accountKindLabel,
  accountStatusLabel,
} from "../lib/labels";
import { trpcMutation, trpcQuery, type TrpcError } from "../lib/trpcClient";
import { AccountItemSchema, type AccountItem } from "../schemas";

function isOverdue(dueDateISO: string) {
  const todayISO = toDateInputValue(new Date());
  return dueDateISO < todayISO;
}

function dueLabel(dueDateISO: string) {
  const todayISO = toDateInputValue(new Date());
  if (dueDateISO === todayISO) return "Vence hoje";
  if (dueDateISO > todayISO) return "No prazo";
  return "Em atraso";
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function AccountsPage() {
  const title = useMemo(() => "Financeiro — Contas", []);
  const [items, setItems] = useState<AccountItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState<{
    status: AccountItem["status"] | "";
    kind: AccountItem["kind"] | "";
    onlyOverdue: boolean;
  }>(() => ({ status: "", kind: "", onlyOverdue: false }));

  const [editing, setEditing] = useState<AccountItem | null>(null);
  const [kind, setKind] = useState<AccountItem["kind"]>("PAYABLE");
  const [dueDateISO, setDueDateISO] = useState(() => toDateInputValue(new Date()));
  const [amount, setAmount] = useState<number>(0);
  const [status, setStatus] = useState<AccountItem["status"]>("OPEN");
  const [notes, setNotes] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await trpcQuery<{ items: AccountItem[] }>("finance.accounts.list");
      setItems(res.items.map((i) => AccountItemSchema.parse(i)));
    } catch (e) {
      setError((e as TrpcError).message || "Erro ao carregar contas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filteredItems = useMemo(() => {
    const copy = [...items];
    copy.sort((a, b) => (a.dueDateISO < b.dueDateISO ? -1 : 1));

    return copy.filter((a) => {
      if (filters.status && a.status !== filters.status) return false;
      if (filters.kind && a.kind !== filters.kind) return false;
      if (filters.onlyOverdue && !(a.status === "OPEN" && isOverdue(a.dueDateISO))) return false;
      return true;
    });
  }, [items, filters]);

  const resetForm = () => {
    setEditing(null);
    setKind("PAYABLE");
    setDueDateISO(toDateInputValue(new Date()));
    setAmount(0);
    setStatus("OPEN");
    setNotes("");
  };

  const startEdit = (a: AccountItem) => {
    setEditing(a);
    setKind(a.kind);
    setDueDateISO(a.dueDateISO);
    setAmount(a.amount);
    setStatus(a.status);
    setNotes(a.notes || "");
  };

  const save = async () => {
    setError("");
    if (!dueDateISO) {
      setError("Informe a data de vencimento.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Informe um valor maior que zero.");
      return;
    }

    try {
      if (editing) {
        await trpcMutation("finance.accounts.update", {
          id: editing.id,
          data: { kind, dueDateISO, amount, status, notes: notes.trim() || undefined },
        });
      } else {
        await trpcMutation("finance.accounts.create", {
          kind,
          dueDateISO,
          amount,
          status,
          notes: notes.trim() || undefined,
        });
      }
      await load();
      resetForm();
    } catch (e) {
      setError((e as TrpcError).message || "Erro ao salvar");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir conta?")) return;
    setError("");
    try {
      await trpcMutation("finance.accounts.delete", { id });
      await load();
    } catch (e) {
      setError((e as TrpcError).message || "Erro ao excluir");
    }
  };

  const pay = async (id: string) => {
    if (!confirm("Confirmar pagamento/recebimento desta conta?")) return;
    setError("");
    try {
      await trpcMutation("finance.accounts.pay", { id });
      await load();
    } catch (e) {
      setError((e as TrpcError).message || "Erro ao marcar como pago");
    }
  };

  const exportCsv = () => {
    const header = ["id", "kind", "dueDateISO", "amount", "status", "notes"];
    const rows = filteredItems.map((a) => [
      a.id,
      a.kind,
      a.dueDateISO,
      String(a.amount),
      a.status,
      (a.notes ?? "").replace(/\r?\n/g, " "),
    ]);
    const esc = (v: string) => {
      const s = String(v ?? "");
      if (/[\",;\n]/.test(s)) return `"${s.replace(/\"/g, '""')}"`;
      return s;
    };
    const csv = [header.join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
    downloadCsv("contas.csv", csv);
  };

  return (
    <AdminLayout title={title}>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
        <div className="space-y-3">
          <div className="flex flex-col md:flex-row md:items-end gap-3 justify-between">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                  <option value="OPEN">Em aberto</option>
                  <option value="PAID">Pago</option>
                  <option value="CANCELED">Cancelado</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-cta text-charcoal mb-1">
                  Tipo
                </label>
                <select
                  value={filters.kind}
                  onChange={(e) =>
                    setFilters((p) => ({ ...p, kind: e.target.value as any }))
                  }
                  className="w-full px-3 py-2 border border-gold/20 rounded-lg focus:outline-none focus:border-gold bg-white"
                >
                  <option value="">Todos</option>
                  <option value="PAYABLE">A pagar</option>
                  <option value="RECEIVABLE">A receber</option>
                </select>
              </div>
              <div className="flex items-end">
                <label className="inline-flex items-center gap-2 text-sm text-charcoal select-none">
                  <input
                    type="checkbox"
                    checked={filters.onlyOverdue}
                    onChange={(e) =>
                      setFilters((p) => ({ ...p, onlyOverdue: e.target.checked }))
                    }
                  />
                  Só em atraso
                </label>
              </div>
            </div>

            <div className="flex items-center gap-2 justify-end">
              <Button className="btn-secondary h-9 px-3" onClick={exportCsv}>
                CSV
              </Button>
              <div className="hidden md:block text-xs text-gray-medium">
                Dica: contas em atraso aparecem destacadas.
              </div>
            </div>
          </div>

          {loading ? (
            <div className="text-sm text-gray-medium">Carregando...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Aviso</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Observações</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((a) => (
                  <TableRow
                    key={a.id}
                    className={
                      a.status === "OPEN" && isOverdue(a.dueDateISO)
                        ? "bg-red-50/40"
                        : ""
                    }
                  >
                    <TableCell className="text-charcoal">{a.dueDateISO}</TableCell>
                    <TableCell className="text-gray-medium">
                      {dueLabel(a.dueDateISO)}
                    </TableCell>
                    <TableCell className="text-gray-medium">
                      {accountKindLabel[a.kind]}
                    </TableCell>
                    <TableCell className="text-gray-medium">
                      {accountStatusLabel[a.status]}
                    </TableCell>
                    <TableCell className="text-right font-bold text-charcoal">
                      {formatPrice(a.amount)}
                    </TableCell>
                    <TableCell className="text-gray-medium max-w-[320px]">
                      <div className="truncate" title={a.notes || ""}>
                        {a.notes || "—"}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex flex-wrap gap-2 justify-end">
                        {a.status === "OPEN" && (
                          <Button
                            variant="outline"
                            className="border-gold/20 hover:bg-primary/5"
                            onClick={() => pay(a.id)}
                          >
                            {a.kind === "RECEIVABLE"
                              ? "Marcar como recebido"
                              : "Marcar como pago"}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          className="border-gold/20 hover:bg-primary/5"
                          onClick={() => startEdit(a)}
                        >
                          Editar
                        </Button>
                        <Button
                          variant="outline"
                          className="border-gold/20 hover:bg-red-50"
                          onClick={() => remove(a.id)}
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
            {editing ? "Editar conta" : "Nova conta"}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-cta text-charcoal mb-1">
                Tipo
              </label>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as any)}
                className="w-full px-3 py-2 border border-gold/20 rounded-lg focus:outline-none focus:border-gold bg-white"
              >
                <option value="PAYABLE">A pagar</option>
                <option value="RECEIVABLE">A receber</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-cta text-charcoal mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3 py-2 border border-gold/20 rounded-lg focus:outline-none focus:border-gold bg-white"
              >
                <option value="OPEN">Em aberto</option>
                <option value="PAID">Pago</option>
                <option value="CANCELED">Cancelado</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-cta text-charcoal mb-1">
                Vencimento
              </label>
              <input
                type="date"
                value={dueDateISO}
                onChange={(e) => setDueDateISO(e.target.value)}
                className="w-full px-3 py-2 border border-gold/20 rounded-lg focus:outline-none focus:border-gold"
              />
            </div>
            <div>
              <label className="block text-sm font-cta text-charcoal mb-1">
                Valor
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gold/20 rounded-lg focus:outline-none focus:border-gold"
                min={0}
                step="0.01"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-cta text-charcoal mb-1">
              Observações
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gold/20 rounded-lg focus:outline-none focus:border-gold resize-none"
            />
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}

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
    </AdminLayout>
  );
}
