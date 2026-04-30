import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "clinica-natura-secret-change-in-production"
);

const SESSION_COOKIE = "cn_session";
const PENDING_COOKIE = "cn_pending";
const EXPIRES_IN = 60 * 60 * 24 * 7; // 7 days
const PENDING_EXPIRES_IN = 60 * 10;   // 10 minutes

// Full session — user has selected a clinic
export type SessionPayload = {
  userId: string;
  clinicId: string;
  clinicName: string;
  clinicSlug: string;
  userName: string;
  userEmail: string;
  role: string;
};

// Pending session — authenticated but clinic not yet selected
export type PendingPayload = {
  userId: string;
  userName: string;
  userEmail: string;
};

async function sign(payload: object, expiresIn: number): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${expiresIn}s`)
    .sign(SECRET);
}

async function verify<T>(token: string): Promise<T | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as T;
  } catch {
    return null;
  }
}

// ── Full session ──────────────────────────────────────────────────────────────

export async function signSession(payload: SessionPayload): Promise<string> {
  return sign(payload, EXPIRES_IN);
}

export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verify<SessionPayload>(token);
}

export async function setSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: EXPIRES_IN,
    path: "/",
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

// ── Pending session (multi-clinic login) ──────────────────────────────────────

export async function signPendingSession(payload: PendingPayload): Promise<string> {
  return sign(payload, PENDING_EXPIRES_IN);
}

export async function getPendingSession(): Promise<PendingPayload | null> {
  const jar = await cookies();
  const token = jar.get(PENDING_COOKIE)?.value;
  if (!token) return null;
  return verify<PendingPayload>(token);
}

export async function setPendingCookie(token: string) {
  const jar = await cookies();
  jar.set(PENDING_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: PENDING_EXPIRES_IN,
    path: "/",
  });
}

export async function clearPendingCookie() {
  const jar = await cookies();
  jar.delete(PENDING_COOKIE);
}

// Legacy alias kept for backwards compatibility
export async function verifySession(token: string): Promise<SessionPayload | null> {
  return verify<SessionPayload>(token);
}
