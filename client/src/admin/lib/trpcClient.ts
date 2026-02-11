export type TrpcError = {
  status: number;
  message: string;
  code?: string;
};

function tryParseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function parseTrpcResponse(body: any) {
  if (body?.result?.data?.json !== undefined) return body.result.data.json; // legacy/compat
  if (body?.result?.data !== undefined) return body.result.data; // tRPC standard
  return body;
}

function normalizeErrorMessage(message: unknown) {
  if (typeof message !== "string") return "Erro";

  const parsed = tryParseJson(message);
  if (Array.isArray(parsed)) {
    const msgs = parsed
      .map((x) => (typeof x?.message === "string" ? x.message : null))
      .filter(Boolean) as string[];
    if (msgs.length > 0) return msgs[0];
  }

  return message;
}

async function readJsonResponse(res: Response) {
  const rawText = await res.text();
  return rawText ? tryParseJson(rawText) : null;
}

function throwTrpcErrorFromResponse(res: Response, body: any) {
  const message = normalizeErrorMessage(body?.error?.message) || res.statusText;
  const code = body?.error?.code;
  const err: TrpcError = { status: res.status, message, code };
  throw err;
}

export async function trpcQuery<TOutput>(path: string, input?: unknown): Promise<TOutput> {
  const qs = new URLSearchParams();
  if (input !== undefined) {
    qs.set("input", JSON.stringify(input));
  }

  const url = qs.size > 0 ? `/api/trpc/${path}?${qs.toString()}` : `/api/trpc/${path}`;
  const res = await fetch(url, { method: "GET", credentials: "include" });
  const body = await readJsonResponse(res);

  if (!res.ok || body?.error) {
    throwTrpcErrorFromResponse(res, body);
  }

  return parseTrpcResponse(body) as TOutput;
}

export async function trpcMutation<TOutput>(path: string, input?: unknown): Promise<TOutput> {
  const res = await fetch(`/api/trpc/${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input ?? {}),
  });

  const body = await readJsonResponse(res);

  if (!res.ok || body?.error) {
    throwTrpcErrorFromResponse(res, body);
  }

  return parseTrpcResponse(body) as TOutput;
}
