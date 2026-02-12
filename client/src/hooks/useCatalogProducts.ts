import { PRODUCTS } from "@/const";
import { useEffect, useState } from "react";

export type CatalogProduct = {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  availability: "available" | "on_demand" | "unavailable";
};

function parseTrpcResponse(body: any) {
  if (body?.result?.data?.json !== undefined) return body.result.data.json;
  if (body?.result?.data !== undefined) return body.result.data;
  return body;
}

async function trpcQuery<TOutput>(path: string, input?: unknown): Promise<TOutput> {
  const qs = new URLSearchParams();
  if (input !== undefined) qs.set("input", JSON.stringify(input));
  const url = qs.size > 0 ? `/api/trpc/${path}?${qs.toString()}` : `/api/trpc/${path}`;

  const res = await fetch(url, { method: "GET" });
  const body = await res.json().catch(() => null);
  if (!res.ok || body?.error) {
    throw new Error(body?.error?.message || res.statusText);
  }
  return parseTrpcResponse(body) as TOutput;
}

export function useCatalogProducts() {
  const [products, setProducts] = useState<CatalogProduct[]>(() =>
    (PRODUCTS as any) as CatalogProduct[]
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    trpcQuery<{ items: CatalogProduct[] }>("catalog.products.list")
      .then((res) => {
        if (!mounted) return;
        if (Array.isArray(res.items) && res.items.length > 0) {
          setProducts(res.items);
        }
      })
      .catch(() => {
        // Keep fallback (static PRODUCTS)
      })
      .finally(() => {
        if (!mounted) return;
        setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return { products, isLoading };
}

