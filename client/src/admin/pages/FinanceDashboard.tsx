import { Card, CardContent } from "@/components/ui/card";
import { formatPrice } from "@/lib/whatsappUtils";
import { useEffect, useMemo, useState } from "react";
import AdminLayout from "../AdminLayout";
import { startOfMonthISO, toDateInputValue } from "../lib/date";
import { trpcCall } from "../lib/trpcClient";

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

export default function FinanceDashboard() {
  const [from, setFrom] = useState(() => startOfMonthISO());
  const [to, setTo] = useState(() => toDateInputValue(new Date()));
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const title = useMemo(() => "Financeiro — Dashboard", []);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");
    trpcCall<DashboardSummary>("finance.dashboard.summary", { from, to })
      .then(res => {
        if (!mounted) return;
        setData(res);
      })
      .catch(e => {
        if (!mounted) return;
        setError(e?.message || "Erro ao carregar dashboard");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [from, to]);

  return (
    <AdminLayout title={title}>
      <div className="flex flex-col md:flex-row gap-3 md:items-end md:justify-between mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-cta text-charcoal mb-1">
              De
            </label>
            <input
              type="date"
              value={from}
              onChange={e => setFrom(e.target.value)}
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
              onChange={e => setTo(e.target.value)}
              className="w-full px-3 py-2 border border-gold/20 rounded-lg focus:outline-none focus:border-gold"
            />
          </div>
        </div>
        <div className="text-xs text-gray-medium">
          Considera lançamentos CONFIRMED no período.
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-gray-medium">Carregando…</div>
      ) : error ? (
        <div className="text-sm text-red-600">{error}</div>
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
                  Saídas (CONFIRMED)
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card-premium bg-white p-4">
              <div className="font-bold text-charcoal mb-2">Top categorias</div>
              {data.byCategory.length === 0 ? (
                <div className="text-sm text-gray-medium">Sem dados</div>
              ) : (
                <div className="space-y-2">
                  {data.byCategory.map(row => (
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
                  {data.byPayment.map(row => (
                    <div
                      key={row.method}
                      className="flex items-center justify-between text-sm"
                    >
                      <div className="text-charcoal">{row.method}</div>
                      <div className="font-bold text-charcoal">
                        {formatPrice(row.total)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

