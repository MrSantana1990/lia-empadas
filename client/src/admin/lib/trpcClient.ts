export type TrpcError = {
  status: number;
  message: string;
  code?: string;
};

function parseTrpcResponse(body: any) {
  if (body?.result?.data?.json !== undefined) return body.result.data.json;
  if (body?.result?.data !== undefined) return body.result.data;
  return body;
}

export async function trpcCall<TOutput>(
  path: string,
  input: unknown = null
): Promise<TOutput> {
  const res = await fetch(`/api/trpc/${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ json: input }),
  });

  let body: any = null;
  try {
    body = await res.json();
  } catch {
    // ignore
  }

  if (!res.ok) {
    const message =
      body?.error?.json?.message || body?.error?.message || res.statusText;
    const code = body?.error?.json?.code || body?.error?.code;
    const err: TrpcError = { status: res.status, message, code };
    throw err;
  }

  if (body?.error) {
    const message = body?.error?.json?.message || "Erro";
    const code = body?.error?.json?.code;
    const err: TrpcError = { status: res.status, message, code };
    throw err;
  }

  return parseTrpcResponse(body) as TOutput;
}

