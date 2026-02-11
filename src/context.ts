import jwt from "jsonwebtoken";
import type { Request, Response } from "express";

export type Role = "admin" | "anon";

export const ADMIN_AUTH_COOKIE = "admin_session";

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  const out: Record<string, string> = {};
  for (const part of cookieHeader.split(";")) {
    const [rawKey, ...rawVal] = part.trim().split("=");
    if (!rawKey) continue;
    out[rawKey] = decodeURIComponent(rawVal.join("=") || "");
  }
  return out;
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("Missing env JWT_SECRET");
  }
  return secret;
}

export function setAdminCookie(res: Response, token: string) {
  const secure = process.env.NODE_ENV === "production";
  const parts = [
    `${ADMIN_AUTH_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${60 * 60 * 24 * 7}`, // 7 days
  ];
  if (secure) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

export function clearAdminCookie(res: Response) {
  const secure = process.env.NODE_ENV === "production";
  const parts = [
    `${ADMIN_AUTH_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (secure) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

export function getRoleFromRequest(req: Request): Role {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[ADMIN_AUTH_COOKIE];
  if (!token) return "anon";

  try {
    const secret = getJwtSecret();
    const payload = jwt.verify(token, secret) as { role?: string } | string;
    if (typeof payload === "object" && payload.role === "admin") return "admin";
    return "anon";
  } catch {
    return "anon";
  }
}

export type Context = {
  req: Request;
  res: Response;
  role: Role;
};

export function createContext({ req, res }: { req: Request; res: Response }): Context {
  return { req, res, role: getRoleFromRequest(req) };
}

