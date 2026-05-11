import { cookies } from "next/headers";
import { createHash, createHmac, pbkdf2, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { getSql } from "@/lib/db";
import { PIN_LENGTH } from "@/lib/limits";
import { ensureSchema } from "@/lib/schema";

const SESSION_COOKIE = "sv_session";
const SESSION_DAYS = 7;
const PASSWORD_ITERATIONS = 310_000;
const PASSWORD_KEY_LENGTH = 32;
const PASSWORD_DIGEST = "sha256";
const CAPTCHA_SECRET = process.env.DATABASE_URL || "sv-captcha-fallback-key";

const pbkdf2Async = promisify(pbkdf2);

export type User = {
  id: string;
  email: string;
  avatarUrl: string | null;
  createdAt: string;
};

type UserRow = {
  id: string;
  email: string;
  passwordHash?: string;
  password_hash?: string;
  avatarUrl?: string | null;
  avatar_url?: string | null;
  auth_provider?: string;
  createdAt?: string;
  created_at?: string;
};

export class AuthError extends Error {
  status = 400;
}

export class UnauthorizedError extends Error {
  status = 401;
}

/* ─── PIN Validation ─── */

function validatePin(pin: string) {
  if (!/^\d{4}$/.test(pin)) {
    throw new AuthError(`PIN must be exactly ${PIN_LENGTH} digits.`);
  }

  if (/^(\d)\1{3}$/.test(pin)) {
    throw new AuthError("PIN cannot be all the same digit.");
  }

  let ascending = true;
  let descending = true;
  for (let i = 1; i < pin.length; i++) {
    if (Number(pin[i]) !== Number(pin[i - 1]) + 1) ascending = false;
    if (Number(pin[i]) !== Number(pin[i - 1]) - 1) descending = false;
  }
  if (ascending || descending) {
    throw new AuthError("PIN cannot be a sequential number.");
  }
}

/* ─── CAPTCHA ─── */

export function generateCaptcha() {
  const ops = [
    { sym: "+", fn: (a: number, b: number) => a + b },
    { sym: "-", fn: (a: number, b: number) => a - b },
    { sym: "x", fn: (a: number, b: number) => a * b },
  ];
  const op = ops[Math.floor(Math.random() * ops.length)];
  let a = Math.floor(Math.random() * 10) + 2;
  let b = Math.floor(Math.random() * 10) + 1;
  if (op.sym === "-" && a < b) [a, b] = [b, a];
  if (op.sym === "x") {
    a = Math.floor(Math.random() * 9) + 2;
    b = Math.floor(Math.random() * 9) + 2;
  }
  const answer = String(op.fn(a, b));
  const nonce = randomBytes(8).toString("hex");
  const mac = createHmac("sha256", CAPTCHA_SECRET).update(`${nonce}:${answer}`).digest("hex");
  return { question: `${a} ${op.sym} ${b} = ?`, token: `${nonce}:${mac}` };
}

export function verifyCaptcha(answer: string, token: string) {
  const sep = token.indexOf(":");
  if (sep === -1) return false;
  const nonce = token.slice(0, sep);
  const mac = token.slice(sep + 1);
  const expected = createHmac("sha256", CAPTCHA_SECRET).update(`${nonce}:${answer.trim()}`).digest("hex");
  return expected === mac;
}

/* ─── Registration ─── */

export async function registerUser(email: string, pin: string) {
  const normalizedEmail = normalizeEmail(email);

  if (!isValidEmail(normalizedEmail)) {
    throw new AuthError("Enter a valid email address.");
  }

  validatePin(pin);

  await ensureSchema();

  const passwordHash = await hashPassword(pin);
  const sql = getSql();

  try {
    const rows = (await sql`
      INSERT INTO users (id, email, password_hash)
      VALUES (${randomUUID()}, ${normalizedEmail}, ${passwordHash})
      RETURNING id, email, avatar_url AS "avatarUrl", created_at AS "createdAt"
    `) as UserRow[];

    return mapUser(rows[0]);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AuthError("An account with that email already exists.");
    }

    throw error;
  }
}

/* ─── Google OAuth ─── */

export async function googleLoginOrRegister(email: string, avatarUrl: string | null) {
  const normalizedEmail = normalizeEmail(email);
  await ensureSchema();
  const sql = getSql();

  const existing = (await sql`
    SELECT id, email, avatar_url AS "avatarUrl", created_at AS "createdAt"
    FROM users WHERE email = ${normalizedEmail} LIMIT 1
  `) as UserRow[];

  if (existing[0]) {
    if (avatarUrl) {
      await sql`UPDATE users SET avatar_url = ${avatarUrl} WHERE id = ${existing[0].id}`;
    }
    return mapUser({ ...existing[0], avatarUrl: avatarUrl ?? existing[0].avatarUrl ?? existing[0].avatar_url ?? null });
  }

  const randomHash = await hashPassword(randomBytes(32).toString("hex"));
  const rows = (await sql`
    INSERT INTO users (id, email, password_hash, auth_provider, avatar_url)
    VALUES (${randomUUID()}, ${normalizedEmail}, ${randomHash}, 'google', ${avatarUrl})
    RETURNING id, email, avatar_url AS "avatarUrl", created_at AS "createdAt"
  `) as UserRow[];

  return mapUser(rows[0]);
}

/* ─── Login ─── */

export async function loginUser(email: string, pin: string) {
  const normalizedEmail = normalizeEmail(email);

  await ensureSchema();

  const sql = getSql();
  const rows = (await sql`
    SELECT id, email, password_hash AS "passwordHash", avatar_url AS "avatarUrl",
           auth_provider, created_at AS "createdAt"
    FROM users
    WHERE email = ${normalizedEmail}
    LIMIT 1
  `) as UserRow[];

  const user = rows[0];

  if (!user) {
    throw new UnauthorizedError("Email or PIN is incorrect.");
  }

  if (user.auth_provider === "google") {
    throw new UnauthorizedError("This account uses Google sign-in.");
  }

  if (!(await verifyPassword(pin, user.passwordHash ?? user.password_hash ?? ""))) {
    throw new UnauthorizedError("Email or PIN is incorrect.");
  }

  return mapUser(user);
}

/* ─── Session ─── */

export async function createSession(userId: string) {
  await ensureSchema();

  const token = randomBytes(32).toString("base64url");
  const tokenHash = sha256(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const sql = getSql();

  await sql`
    INSERT INTO sessions (id, user_id, token_hash, expires_at)
    VALUES (${randomUUID()}, ${userId}, ${tokenHash}, ${expiresAt.toISOString()})
  `;

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await ensureSchema();
    await getSql()`DELETE FROM sessions WHERE token_hash = ${sha256(token)}`;
  }

  cookieStore.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  await ensureSchema();

  const rows = (await getSql()`
    SELECT users.id, users.email, users.avatar_url AS "avatarUrl", users.created_at AS "createdAt"
    FROM sessions
    INNER JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ${sha256(token)}
      AND sessions.expires_at > now()
    LIMIT 1
  `) as UserRow[];

  if (!rows[0]) {
    return null;
  }

  return mapUser(rows[0]);
}

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    throw new UnauthorizedError("Sign in to continue.");
  }

  return user;
}

/* ─── Helpers ─── */

function mapUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    avatarUrl: row.avatarUrl ?? row.avatar_url ?? null,
    createdAt: String(row.createdAt ?? row.created_at ?? new Date().toISOString()),
  };
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await pbkdf2Async(
    password,
    salt,
    PASSWORD_ITERATIONS,
    PASSWORD_KEY_LENGTH,
    PASSWORD_DIGEST,
  );

  return `pbkdf2-${PASSWORD_DIGEST}$${PASSWORD_ITERATIONS}$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

async function verifyPassword(password: string, encoded: string) {
  const [algorithm, iterationText, saltText, hashText] = encoded.split("$");

  if (algorithm !== `pbkdf2-${PASSWORD_DIGEST}` || !iterationText || !saltText || !hashText) {
    return false;
  }

  const iterations = Number(iterationText);
  const salt = Buffer.from(saltText, "base64url");
  const expected = Buffer.from(hashText, "base64url");
  const actual = await pbkdf2Async(password, salt, iterations, expected.length, PASSWORD_DIGEST);

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}
