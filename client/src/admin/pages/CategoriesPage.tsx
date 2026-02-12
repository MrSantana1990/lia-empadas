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
import { categoryKindLabel } from "../lib/labels";
import { trpcMutation, trpcQuery, type TrpcError } from "../lib/trpcClient";
import { CategorySchema, type Category } from "../schemas";

export default function CategoriesPage() {
  const title = useMemo(() => "Financeiro — Categorias", []);
  const [items, setItems] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isCreatingDefaults, setIsCreatingDefaults] = useState(false);

  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<Category["kind"]>("BOTH");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await trpcQuery<{ items: Category[] }>("finance.categories.list");
      setItems(res.items.map((i) => CategorySchema.parse(i)));
    } catch (e) {
      setError((e as TrpcError).message || "Erro ao carregar categorias");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const createDefaults = async () => {
    setError("");
    setIsCreatingDefaults(true);

    const defaults: Array<{ name: string; kind: Category["kind"] }> = [
      { name: "Vendas", kind: "IN" },
      { name: "Embalagens", kind: "OUT" },
      { name: "Ingredientes", kind: "OUT" },
      { name: "Material", kind: "OUT" },
      { name: "Gás", kind: "OUT" },
      { name: "Transporte", kind: "OUT" },
      { name: "Marketing", kind: "OUT" },
      { name: "Outros", kind: "BOTH" },
    ];

    const normalize = (s: string) =>
      s
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "");

    try {
      const existing = new Set(items.map((c) => normalize(c.name)));
      for (const c of defaults) {
        if (existing.has(normalize(c.name))) continue;
        await trpcMutation("finance.categories.create", { name: c.name, kind: c.kind });
      }
      await load();
    } catch (e) {
      setError((e as TrpcError).message || "Erro ao criar categorias padrão");
    } finally {
      setIsCreatingDefaults(false);
    }
  };

  const startCreate = () => {
    setEditing(null);
    setName("");
    setKind("BOTH");
  };

  const startEdit = (c: Category) => {
    setEditing(c);
    setName(c.name);
    setKind(c.kind);
  };

  const save = async () => {
    setError("");
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Informe o nome da categoria.");
      return;
    }

    try {
      if (editing) {
        await trpcMutation("finance.categories.update", {
          id: editing.id,
          data: { name: trimmed, kind },
        });
      } else {
        await trpcMutation("finance.categories.create", { name: trimmed, kind });
      }
      await load();
      startCreate();
    } catch (e) {
      setError((e as TrpcError).message || "Erro ao salvar");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir categoria?")) return;
    setError("");
    try {
      await trpcMutation("finance.categories.delete", { id });
      await load();
    } catch (e) {
      setError((e as TrpcError).message || "Erro ao excluir");
    }
  };

  return (
    <AdminLayout title={title}>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
            <div className="text-sm text-gray-medium">
              Dica: use categorias de <span className="font-semibold">Saída</span> para compras
              (embalagens, ingredientes, material...).
            </div>
            <Button
              variant="outline"
              className="border-gold/20 hover:bg-primary/5"
              disabled={isCreatingDefaults}
              onClick={createDefaults}
            >
              {isCreatingDefaults ? "Criando..." : "Criar categorias padrão"}
            </Button>
          </div>

          {loading ? (
            <div className="text-sm text-gray-medium">Carregando...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-semibold text-charcoal">
                      {c.name}
                    </TableCell>
                    <TableCell className="text-gray-medium">
                      {categoryKindLabel[c.kind]}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-2">
                        <Button
                          variant="outline"
                          className="border-gold/20 hover:bg-primary/5"
                          onClick={() => startEdit(c)}
                        >
                          Editar
                        </Button>
                        <Button
                          variant="outline"
                          className="border-gold/20 hover:bg-red-50"
                          onClick={() => remove(c.id)}
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
            {editing ? "Editar categoria" : "Nova categoria"}
          </div>

          <div>
            <label className="block text-sm font-cta text-charcoal mb-1">
              Nome
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gold/20 rounded-lg focus:outline-none focus:border-gold"
            />
          </div>

          <div>
            <label className="block text-sm font-cta text-charcoal mb-1">
              Tipo
            </label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as any)}
              className="w-full px-3 py-2 border border-gold/20 rounded-lg focus:outline-none focus:border-gold bg-white"
            >
              <option value="IN">Entrada</option>
              <option value="OUT">Saída</option>
              <option value="BOTH">Ambos</option>
            </select>
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}

          <div className="flex gap-2">
            <Button className="btn-premium flex-1" onClick={save}>
              Salvar
            </Button>
            <Button className="btn-secondary" onClick={startCreate}>
              Limpar
            </Button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
