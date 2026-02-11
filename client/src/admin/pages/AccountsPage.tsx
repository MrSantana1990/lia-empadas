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
import { trpcMutation, trpcQuery, type TrpcError } from "../lib/trpcClient";
import { AccountItemSchema, type AccountItem } from "../schemas";

export default function AccountsPage() {
  const title = useMemo(() => "Financeiro — Contas", []);
  const [items, setItems] = useState<AccountItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
      setItems(res.items.map(i => AccountItemSchema.parse(i)));
    } catch (e) {
      setError((e as TrpcError).message || "Erro");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

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
    try {
      if (editing) {
        await trpcMutation("finance.accounts.update", {
          id: editing.id,
          data: { kind, dueDateISO, amount, status, notes },
        });
      } else {
        await trpcMutation("finance.accounts.create", {
          kind,
          dueDateISO,
          amount,
          status,
          notes,
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
    setError("");
    try {
      await trpcMutation("finance.accounts.pay", { id });
      await load();
    } catch (e) {
      setError((e as TrpcError).message || "Erro ao pagar");
    }
  };

  return (
    <AdminLayout title={title}>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
        <div className="space-y-3">
          {loading ? (
            <div className="text-sm text-gray-medium">Carregando...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(a => (
                  <TableRow key={a.id}>
                    <TableCell className="text-charcoal">
                      {a.dueDateISO}
                    </TableCell>
                    <TableCell className="text-gray-medium">{a.kind}</TableCell>
                    <TableCell className="text-gray-medium">
                      {a.status}
                    </TableCell>
                    <TableCell className="text-right font-bold text-charcoal">
                      {formatPrice(a.amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-2">
                        {a.status === "OPEN" && (
                          <Button
                            variant="outline"
                            className="border-gold/20 hover:bg-primary/5"
                            onClick={() => pay(a.id)}
                          >
                            Marcar pago
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
                onChange={e => setKind(e.target.value as any)}
                className="w-full px-3 py-2 border border-gold/20 rounded-lg focus:outline-none focus:border-gold bg-white"
              >
                <option value="PAYABLE">PAYABLE</option>
                <option value="RECEIVABLE">RECEIVABLE</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-cta text-charcoal mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as any)}
                className="w-full px-3 py-2 border border-gold/20 rounded-lg focus:outline-none focus:border-gold bg-white"
              >
                <option value="OPEN">OPEN</option>
                <option value="PAID">PAID</option>
                <option value="CANCELED">CANCELED</option>
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
                onChange={e => setDueDateISO(e.target.value)}
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
                onChange={e => setAmount(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gold/20 rounded-lg focus:outline-none focus:border-gold"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-cta text-charcoal mb-1">
              Observações
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
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
