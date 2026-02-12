import { Card, CardContent } from "@/components/ui/card";
import { formatPrice } from "@/lib/whatsappUtils";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import AdminLayout from "../AdminLayout";
import { startOfMonthISO, toDateInputValue } from "../lib/date";
import {
  accountKindLabel,
  paymentMethodLabel,
  transactionStatusLabel,
  transactionTypeLabel,
} from "../lib/labels";
import { trpcMutation, trpcQuery } from "../lib/trpcClient";
import {
  AccountItemSchema,
  TransactionSchema,
  type AccountItem,
  type Transaction,
} from "../schemas";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type DashboardSummary = {
  range: { from: string; to: string };
  totals: {
    inConfirmed: number;
    outConfirmed: number;
    balance: number;
    pendingCount: number;
    pendingAmount: number;
  };
  byCategory: { categoryId: string; categoryName: string; total: number }[];
  byPayment: { method: string; total: number }[];
};

function parseISODate(dateISO: string) {
  const [y, m, d] = dateISO.split("-").map((x) => Number(x));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

function daysBetween(a: Date, b: Date) {
  const ms = 24 * 60 * 60 * 1000;
  return Math.floor((b.getTime() - a.getTime()) / ms);
}

function dueLabel(dueDateISO: string) {
  const today = parseISODate(toDateInputValue(new Date()));
  const due = parseISODate(dueDateISO);
  if (!today || !due) return "—";
  const diff = daysBetween(today, due);
  if (diff === 0) return "Vence hoje";
  if (diff === 1) return "Vence amanhã";
  if (diff > 1) return `Vence em ${diff} dias`;
  const late = Math.abs(diff);
  if (late === 1) return "Atrasado 1 dia";
  return `Atrasado ${late} dias`;
}

function isOverdue(dueDateISO: string) {
  const todayISO = toDateInputValue(new Date());
  return dueDateISO < todayISO;
}

function addDaysISO(dateISO: string, delta: number) {
  const [y, m, d] = dateISO.split("-").map((x) => Number(x));
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
  dt.setDate(dt.getDate() + delta);
  return toDateInputValue(dt);
}

function isoMax(a: string, b: string) {
  return a > b ? a : b;
}

function isoMin(a: string, b: string) {
  return a < b ? a : b;
}

export default function FinanceDashboard() {
  const [mode, setMode] = useState<"all" | "period">("all");
  const [from, setFrom] = useState(() => startOfMonthISO());
  const [to, setTo] = useState(() => toDateInputValue(new Date()));
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [tx, setTx] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [payingId, setPayingId] = useState<string>("");

  const title = useMemo(() => "Financeiro — Resumo", []);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");

    Promise.all([
      trpcQuery<DashboardSummary>(
        "finance.dashboard.summary",
        mode === "period" ? { from, to } : {}
      ),
      trpcQuery<{ items: Transaction[] }>("finance.transactions.list", {
        from: mode === "period" ? from : undefined,
        to: mode === "period" ? to : undefined,
      }),
      trpcQuery<{ items: AccountItem[] }>("finance.accounts.list"),
    ])
      .then(([summary, txRes, accountsRes]) => {
        if (!mounted) return;
        setData(summary);
        setTx(txRes.items.map((t) => TransactionSchema.parse(t)));
        setAccounts(accountsRes.items.map((a) => AccountItemSchema.parse(a)));
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e?.message || "Erro ao carregar resumo");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [from, to, mode]);

  const openAccounts = useMemo(
    () => accounts.filter((a) => a.status === "OPEN").sort((a, b) => (a.dueDateISO < b.dueDateISO ? -1 : 1)),
    [accounts]
  );

  const payablesOpen = useMemo(
    () => openAccounts.filter((a) => a.kind === "PAYABLE"),
    [openAccounts]
  );
  const receivablesOpen = useMemo(
    () => openAccounts.filter((a) => a.kind === "RECEIVABLE"),
    [openAccounts]
  );

  const payableAmountOpen = useMemo(
    () => payablesOpen.reduce((acc, a) => acc + a.amount, 0),
    [payablesOpen]
  );
  const receivableAmountOpen = useMemo(
    () => receivablesOpen.reduce((acc, a) => acc + a.amount, 0),
    [receivablesOpen]
  );

  const overdueOpen = useMemo(
    () => openAccounts.filter((a) => isOverdue(a.dueDateISO)),
    [openAccounts]
  );

  const overdueAmount = useMemo(
    () => overdueOpen.reduce((acc, a) => acc + a.amount, 0),
    [overdueOpen]
  );

  const txSorted = useMemo(() => {
    const copy = [...tx];
    copy.sort((a, b) => (a.dateISO < b.dateISO ? 1 : -1));
    return copy;
  }, [tx]);

  const txConfirmed = useMemo(
    () => txSorted.filter((t) => t.status === "CONFIRMED"),
    [txSorted]
  );

  const txPending = useMemo(
    () => txSorted.filter((t) => t.status === "PENDING"),
    [txSorted]
  );

  const pendingInAmount = useMemo(
    () => txPending.filter((t) => t.type === "IN").reduce((acc, t) => acc + t.amount, 0),
    [txPending]
  );
  const pendingOutAmount = useMemo(
    () => txPending.filter((t) => t.type === "OUT").reduce((acc, t) => acc + t.amount, 0),
    [txPending]
  );

  const cashflowChart = useMemo(() => {
    const todayISO = toDateInputValue(new Date());
    const defaultFrom = addDaysISO(todayISO, -29);
    const defaultTo = todayISO;

    const rawFrom = mode === "period" && from ? from : defaultFrom;
    const rawTo = mode === "period" && to ? to : defaultTo;
    const chartFrom = isoMin(rawFrom, rawTo);
    const chartTo = isoMax(rawFrom, rawTo);

    const confirmed = txConfirmed.filter((t) => t.dateISO >= chartFrom && t.dateISO <= chartTo);

    const byDate = new Map<string, { in: number; out: number }>();
    for (const t of confirmed) {
      const row = byDate.get(t.dateISO) ?? { in: 0, out: 0 };
      if (t.type === "IN") row.in += t.amount;
      if (t.type === "OUT") row.out += t.amount;
      byDate.set(t.dateISO, row);
    }

    const rows: { date: string; in: number; out: number; balance: number }[] = [];
    for (let cur = chartFrom; cur <= chartTo; cur = addDaysISO(cur, 1)) {
      const row = byDate.get(cur) ?? { in: 0, out: 0 };
      rows.push({ date: cur, in: row.in, out: row.out, balance: row.in - row.out });
    }

    return { from: chartFrom, to: chartTo, rows };
  }, [txConfirmed, mode, from, to]);

  const byCategoryChart = useMemo(() => {
    if (!data) return [];
    return data.byCategory.map((r) => ({
      name: r.categoryName,
      total: r.total,
    }));
  }, [data]);

  const byPaymentChart = useMemo(() => {
    if (!data) return [];
    return data.byPayment.map((r) => ({
      name: (paymentMethodLabel as any)[r.method] ?? r.method,
      total: r.total,
    }));
  }, [data]);

  const pay = async (id: string) => {
    setError("");
    setPayingId(id);
    try {
      await trpcMutation("finance.accounts.pay", { id });
      const res = await trpcQuery<{ items: AccountItem[] }>("finance.accounts.list");
      setAccounts(res.items.map((a) => AccountItemSchema.parse(a)));
    } catch (e: any) {
      setError(e?.message || "Erro ao marcar como pago");
    } finally {
      setPayingId("");
    }
  };

  const downloadCsv = (filename: string, csv: string) => {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const exportAccountsCsv = () => {
    const header = ["id", "kind", "dueDateISO", "amount", "status", "notes"];
    const rows = accounts.map((a) => [
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
      <div className="flex flex-col md:flex-row gap-3 md:items-end md:justify-between mb-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className={mode === "all" ? "btn-premium h-9 px-3" : "btn-secondary h-9 px-3"}
              onClick={() => setMode("all")}
            >
              Resumo geral
            </Button>
            <Button
              type="button"
              className={mode === "period" ? "btn-premium h-9 px-3" : "btn-secondary h-9 px-3"}
              onClick={() => {
                setMode("period");
                setFrom((v) => v || startOfMonthISO());
                setTo((v) => v || toDateInputValue(new Date()));
              }}
            >
              Filtrar por período
            </Button>
          </div>

          {mode === "period" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-cta text-charcoal mb-1">
                  De
                </label>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="w-full px-3 py-2 border border-gold/20 rounded-lg focus:outline-none focus:border-gold"
                />
              </div>
              <div>
                <label className="block text-sm font-cta text-charcoal mb-1">
                  Até
                </label>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="w-full px-3 py-2 border border-gold/20 rounded-lg focus:outline-none focus:border-gold"
                />
              </div>
            </div>
          )}
        </div>

        <div className="text-xs text-gray-medium">
          {mode === "period"
            ? "Considera lançamentos CONFIRMED no período."
            : "Resumo geral: considera todos os lançamentos CONFIRMED."}
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-gray-medium">Carregando...</div>
      ) : error ? (
        <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </div>
      ) : !data ? null : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="border-0 bg-cream">
              <CardContent className="pt-6">
                <div className="text-xs text-gray-medium">
                  Entradas (CONFIRMED)
                </div>
                <div className="text-2xl font-bold text-charcoal">
                  {formatPrice(data.totals.inConfirmed)}
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 bg-cream">
              <CardContent className="pt-6">
                <div className="text-xs text-gray-medium">
                  Saídas (compras — CONFIRMED)
                </div>
                <div className="text-2xl font-bold text-charcoal">
                  {formatPrice(data.totals.outConfirmed)}
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 bg-cream">
              <CardContent className="pt-6">
                <div className="text-xs text-gray-medium">Saldo</div>
                <div className="text-2xl font-bold text-charcoal">
                  {formatPrice(data.totals.balance)}
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 bg-cream">
              <CardContent className="pt-6">
                <div className="text-xs text-gray-medium">Pendentes</div>
                <div className="text-2xl font-bold text-charcoal">
                  {data.totals.pendingCount}
                </div>
                <div className="text-xs text-gray-medium">
                  {formatPrice(data.totals.pendingAmount)}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="border-0 bg-cream">
              <CardContent className="pt-6">
                <div className="text-xs text-gray-medium">A receber (em aberto)</div>
                <div className="text-2xl font-bold text-charcoal">
                  {formatPrice(receivableAmountOpen)}
                </div>
                <div className="text-xs text-gray-medium">
                  {receivablesOpen.length} conta(s)
                </div>
                {pendingInAmount > 0 && (
                  <div className="text-xs text-gray-medium mt-1">
                    Pendentes (entrada): {formatPrice(pendingInAmount)}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-0 bg-cream">
              <CardContent className="pt-6">
                <div className="text-xs text-gray-medium">A pagar (em aberto)</div>
                <div className="text-2xl font-bold text-charcoal">
                  {formatPrice(payableAmountOpen)}
                </div>
                <div className="text-xs text-gray-medium">
                  {payablesOpen.length} conta(s)
                </div>
                {pendingOutAmount > 0 && (
                  <div className="text-xs text-gray-medium mt-1">
                    Pendentes (saída): {formatPrice(pendingOutAmount)}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-0 bg-cream">
              <CardContent className="pt-6">
                <div className="text-xs text-gray-medium">Em atraso (contas)</div>
                <div className="text-2xl font-bold text-charcoal">{overdueOpen.length}</div>
                <div className="text-xs text-gray-medium">{formatPrice(overdueAmount)}</div>
              </CardContent>
            </Card>

            <Card className="border-0 bg-cream">
              <CardContent className="pt-6">
                <div className="text-xs text-gray-medium">Relatórios</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    className="btn-secondary h-9 px-3"
                    onClick={() => {
                      const qs = new URLSearchParams();
                      if (from) qs.set("from", from);
                      if (to) qs.set("to", to);
                      window.open(`/api/finance/transactions/export.csv?${qs.toString()}`, "_blank");
                    }}
                  >
                    CSV lançamentos
                  </Button>
                  <Button className="btn-secondary h-9 px-3" onClick={exportAccountsCsv}>
                    CSV contas
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card-premium bg-white p-4">
              <div className="font-bold text-charcoal mb-2">Top categorias</div>
              {data.byCategory.length === 0 ? (
                <div className="text-sm text-gray-medium">Sem dados</div>
              ) : (
                <div className="space-y-2">
                  {data.byCategory.map((row) => (
                    <div
                      key={row.categoryId}
                      className="flex items-center justify-between text-sm"
                    >
                      <div className="text-charcoal">{row.categoryName}</div>
                      <div className="font-bold text-charcoal">
                        {formatPrice(row.total)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card-premium bg-white p-4">
              <div className="font-bold text-charcoal mb-2">Por pagamento</div>
              {data.byPayment.length === 0 ? (
                <div className="text-sm text-gray-medium">Sem dados</div>
              ) : (
                <div className="space-y-2">
                  {data.byPayment.map((row) => (
                    <div
                      key={row.method}
                      className="flex items-center justify-between text-sm"
                    >
                      <div className="text-charcoal">
                        {(paymentMethodLabel as any)[row.method] ?? row.method}
                      </div>
                      <div className="font-bold text-charcoal">
                        {formatPrice(row.total)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card-premium bg-white p-4">
              <div className="font-bold text-charcoal mb-2">
                Gráfico — Entradas vs Saídas (CONFIRMED)
              </div>
              <div className="text-xs text-gray-medium mb-3">
                {mode === "period"
                  ? `Período: ${cashflowChart.from} a ${cashflowChart.to}`
                  : `Últimos 30 dias: ${cashflowChart.from} a ${cashflowChart.to}`}
              </div>
              <div style={{ width: "100%", height: 240 }}>
                <ResponsiveContainer>
                  <ComposedChart data={cashflowChart.rows}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(v: any, name: any) => {
                        const label =
                          name === "in"
                            ? "Entradas"
                            : name === "out"
                              ? "Saídas"
                              : "Saldo";
                        return [formatPrice(Number(v) || 0), label];
                      }}
                    />
                    <Bar dataKey="in" name="in" fill="#16a34a" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="out" name="out" fill="#dc2626" radius={[4, 4, 0, 0]} />
                    <Line
                      type="monotone"
                      dataKey="balance"
                      name="balance"
                      stroke="#111827"
                      strokeWidth={2}
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card-premium bg-white p-4 space-y-4">
              <div>
                <div className="font-bold text-charcoal mb-2">Gráfico — Top categorias</div>
                {byCategoryChart.length === 0 ? (
                  <div className="text-sm text-gray-medium">Sem dados</div>
                ) : (
                  <div style={{ width: "100%", height: 190 }}>
                    <ResponsiveContainer>
                      <BarChart data={byCategoryChart}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip
                          formatter={(v: any) => [formatPrice(Number(v) || 0), "Total"]}
                        />
                        <Bar dataKey="total" fill="#b91c1c" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div>
                <div className="font-bold text-charcoal mb-2">Gráfico — Por pagamento</div>
                {byPaymentChart.length === 0 ? (
                  <div className="text-sm text-gray-medium">Sem dados</div>
                ) : (
                  <div style={{ width: "100%", height: 190 }}>
                    <ResponsiveContainer>
                      <BarChart data={byPaymentChart}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip
                          formatter={(v: any) => [formatPrice(Number(v) || 0), "Total"]}
                        />
                        <Bar dataKey="total" fill="#b91c1c" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card-premium bg-white p-4">
              <div className="font-bold text-charcoal mb-2">
                {mode === "period" ? "Lançamentos no período" : "Lançamentos (geral)"}
              </div>
              {txSorted.length === 0 ? (
                <div className="text-sm text-gray-medium">Sem lançamentos</div>
              ) : (
                <div className="space-y-2">
                  {txSorted.slice(0, 30).map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-gold/10 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-charcoal truncate">
                          {t.description}
                        </div>
                        <div className="text-xs text-gray-medium">
                          {t.dateISO} • {(transactionTypeLabel as any)[t.type] ?? t.type} •{" "}
                          {(transactionStatusLabel as any)[t.status] ?? t.status} •{" "}
                          {(paymentMethodLabel as any)[t.paymentMethod] ?? t.paymentMethod}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-sm font-bold text-charcoal">
                          {formatPrice(t.amount)}
                        </div>
                      </div>
                    </div>
                  ))}
                  {txSorted.length > 30 && (
                    <div className="text-xs text-gray-medium">
                      Mostrando 30 de {txSorted.length}. Use “Lançamentos” para ver tudo.
                    </div>
                  )}
                </div>
              )}

              {txPending.length > 0 && (
                <div className="mt-4">
                  <div className="font-bold text-charcoal mb-2">Pendentes (ação rápida)</div>
                  <div className="space-y-2">
                    {txPending.slice(0, 10).map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-red-100 bg-red-50/40 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-charcoal truncate">
                            {t.description}
                          </div>
                          <div className="text-xs text-gray-medium">
                            {t.dateISO} • {formatPrice(t.amount)}
                          </div>
                        </div>
                        <div className="shrink-0 flex gap-2">
                          <Button
                            className="btn-premium h-9 px-3"
                            onClick={async () => {
                              try {
                                await trpcMutation("finance.transactions.confirm", { id: t.id });
                                const txRes = await trpcQuery<{ items: Transaction[] }>(
                                  "finance.transactions.list",
                                  {
                                    from: mode === "period" ? from : undefined,
                                    to: mode === "period" ? to : undefined,
                                  }
                                );
                                setTx(txRes.items.map((x) => TransactionSchema.parse(x)));
                                const summary = await trpcQuery<DashboardSummary>(
                                  "finance.dashboard.summary",
                                  mode === "period" ? { from, to } : {}
                                );
                                setData(summary);
                              } catch (e: any) {
                                setError(e?.message || "Erro ao confirmar lançamento");
                              }
                            }}
                          >
                            Confirmar
                          </Button>
                          <Button
                            className="btn-secondary h-9 px-3"
                            onClick={async () => {
                              try {
                                await trpcMutation("finance.transactions.cancel", { id: t.id });
                                const txRes = await trpcQuery<{ items: Transaction[] }>(
                                  "finance.transactions.list",
                                  {
                                    from: mode === "period" ? from : undefined,
                                    to: mode === "period" ? to : undefined,
                                  }
                                );
                                setTx(txRes.items.map((x) => TransactionSchema.parse(x)));
                                const summary = await trpcQuery<DashboardSummary>(
                                  "finance.dashboard.summary",
                                  mode === "period" ? { from, to } : {}
                                );
                                setData(summary);
                              } catch (e: any) {
                                setError(e?.message || "Erro ao cancelar lançamento");
                              }
                            }}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ))}
                    {txPending.length > 10 && (
                      <div className="text-xs text-gray-medium">
                        Mostrando 10 de {txPending.length}. Use “Lançamentos” para ver tudo.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="card-premium bg-white p-4">
              <div className="font-bold text-charcoal mb-2">Contas em aberto</div>
              {openAccounts.length === 0 ? (
                <div className="text-sm text-gray-medium">Sem contas em aberto</div>
              ) : (
                <div className="space-y-2">
                  {openAccounts.slice(0, 30).map((a) => {
                    const overdue = isOverdue(a.dueDateISO);
                    const actionLabel = a.kind === "RECEIVABLE" ? "Marcar como recebido" : "Marcar como pago";
                    return (
                      <div
                        key={a.id}
                        className={
                          "flex items-center justify-between gap-3 rounded-lg border px-3 py-2 " +
                          (overdue ? "border-red-100 bg-red-50/40" : "border-gold/10")
                        }
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-charcoal truncate">
                            {accountKindLabel[a.kind]} • {formatPrice(a.amount)}
                          </div>
                          <div className="text-xs text-gray-medium">
                            {a.dueDateISO} • {dueLabel(a.dueDateISO)}
                            {a.notes ? ` • ${a.notes}` : ""}
                          </div>
                        </div>
                        <div className="shrink-0">
                          <Button
                            variant="outline"
                            className="border-gold/20 hover:bg-primary/5 h-9"
                            disabled={payingId === a.id}
                            onClick={() => pay(a.id)}
                          >
                            {payingId === a.id ? "Confirmando..." : actionLabel}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  {openAccounts.length > 30 && (
                    <div className="text-xs text-gray-medium">
                      Mostrando 30 de {openAccounts.length}. Use “Contas” para ver tudo.
                    </div>
                  )}
                </div>
              )}

              {overdueOpen.length > 0 && (
                <div className="mt-4 text-xs text-gray-medium">
                  Dica: contas destacadas em vermelho estão em atraso.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
