import Database from "better-sqlite3";
import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { rootDataDir, type Identity } from "./tenant";

const derive = promisify(scrypt);
const digest = (text: string) => createHash("sha256").update(text).digest("hex");
const randomToken = () => randomBytes(32).toString("base64url");
export const SESSION_COOKIE = "zhifan_session";
export class IdentityError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
type UserRow = Identity & { password: string; disabled: number };
type Invite = {
  id: string;
  role: "owner" | "member";
  expires: number;
  used_by: string | null;
  revoked: number;
  email: string | null;
};
async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = (await derive(password, salt, 64)) as Buffer;
  return `${salt}:${key.toString("hex")}`;
}
async function matches(password: string, encoded: string) {
  const [salt, hash] = encoded.split(":");
  const expected = Buffer.from(hash ?? "", "hex");
  const actual = (await derive(password, salt ?? "invalid", 64)) as Buffer;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
function cleanEmail(input: unknown) {
  if (
    typeof input !== "string" ||
    input.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.trim())
  )
    throw new IdentityError("Enter a valid email address");
  return input.trim().toLowerCase();
}
function cleanPassword(value: unknown): asserts value is string {
  if (typeof value !== "string" || value.length < 12 || value.length > 128)
    throw new IdentityError("Use a password with 12 to 128 characters");
}
export class IdentityStore {
  readonly sql: Database.Database;
  constructor(readonly dir: string) {
    mkdirSync(dir, { recursive: true });
    this.sql = new Database(join(dir, "identity.db"));
    this.sql.pragma("journal_mode = WAL");
    this.sql.pragma("busy_timeout = 5000");
    this.sql
      .exec(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL, password TEXT NOT NULL, disabled INTEGER NOT NULL DEFAULT 0);
      CREATE UNIQUE INDEX IF NOT EXISTS one_owner ON users(role) WHERE role='owner';
      CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS invites (id TEXT PRIMARY KEY, hash TEXT UNIQUE NOT NULL, role TEXT NOT NULL, email TEXT, expires INTEGER NOT NULL, used_by TEXT, revoked INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS attempts (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);`);
    this.sql
      .transaction(() => {
        if (this.sql.prepare("SELECT id FROM users WHERE role='owner'").get()) return;
        if (
          this.sql
            .prepare("SELECT id FROM invites WHERE role='owner' AND revoked=0 AND expires>?")
            .get(Date.now())
        )
          return;
        const code = randomToken();
        writeFileSync(join(dir, "owner-invite.txt"), code + "\n", { mode: 0o600 });
        this.sql
          .prepare("INSERT INTO invites VALUES (?,?, 'owner',NULL,?,NULL,0,?)")
          .run(randomUUID(), digest(code), Date.now() + 7 * 86400000, Date.now());
      })
      .immediate();
  }
  throttle(key: string, limit = 20) {
    const hashed = digest(key);
    const now = Date.now();
    this.sql.prepare("DELETE FROM attempts WHERE expires<=?").run(now);
    this.sql
      .prepare("INSERT INTO attempts VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1")
      .run(hashed, now + 15 * 60000);
    const row = this.sql.prepare("SELECT count FROM attempts WHERE key=?").get(hashed) as {
      count: number;
    };
    if (row.count > limit)
      throw new IdentityError("Too many attempts. Try again in 15 minutes", 429);
  }
  private validInvite(code: unknown, email?: string) {
    if (typeof code !== "string" || code.length > 200)
      throw new IdentityError("Invitation is invalid, expired or already used");
    const invite = this.sql
      .prepare("SELECT * FROM invites WHERE hash=?")
      .get(digest(code.trim())) as Invite | undefined;
    if (
      !invite ||
      invite.revoked ||
      invite.used_by ||
      invite.expires <= Date.now() ||
      (email && invite.email && invite.email !== email)
    )
      throw new IdentityError("Invitation is invalid, expired or already used");
    return invite;
  }
  async register(input: Record<string, unknown>) {
    const email = cleanEmail(input.email);
    cleanPassword(input.password);
    if (typeof input.name !== "string" || !input.name.trim() || input.name.length > 80)
      throw new IdentityError("Enter a name (up to 80 characters)");
    this.validInvite(input.invite, email);
    const password = await hashPassword(input.password);
    const user = this.sql
      .transaction(() => {
        const invite = this.validInvite(input.invite, email);
        if (this.sql.prepare("SELECT id FROM users WHERE email=?").get(email))
          throw new IdentityError("This email is already registered");
        const identity: Identity = {
          id: randomUUID(),
          email,
          name: (input.name as string).trim(),
          role: invite.role,
        };
        this.sql
          .prepare("INSERT INTO users (id,email,name,role,password) VALUES (?,?,?,?,?)")
          .run(identity.id, email, identity.name, identity.role, password);
        this.sql.prepare("UPDATE invites SET used_by=? WHERE id=?").run(identity.id, invite.id);
        return identity;
      })
      .immediate();
    if (user.role === "owner") {
      try {
        unlinkSync(join(this.dir, "owner-invite.txt"));
      } catch {
        /* Already consumed. */
      }
    }
    return { user, token: this.session(user.id) };
  }
  async login(input: Record<string, unknown>) {
    const email = cleanEmail(input.email);
    if (typeof input.password !== "string" || input.password.length > 128)
      throw new IdentityError("Email or password is incorrect", 401);
    this.throttle("login:" + email, 10);
    const row = this.sql.prepare("SELECT * FROM users WHERE email=?").get(email) as
      UserRow | undefined;
    const valid = await matches(input.password, row?.password ?? "invalid:" + "0".repeat(128));
    if (!row || row.disabled || !valid)
      throw new IdentityError("Email or password is incorrect", 401);
    this.sql.prepare("DELETE FROM attempts WHERE key=?").run(digest("login:" + email));
    return {
      user: { id: row.id, email: row.email, name: row.name, role: row.role },
      token: this.session(row.id),
    };
  }
  session(userId: string) {
    const token = randomToken();
    this.sql.prepare("DELETE FROM sessions WHERE expires<=?").run(Date.now());
    this.sql
      .prepare("INSERT INTO sessions VALUES (?,?,?)")
      .run(digest(token), userId, Date.now() + 7 * 86400000);
    return token;
  }
  resolve(token?: string): Identity | null {
    if (!token || token.length > 200) return null;
    return (
      (this.sql
        .prepare(
          "SELECT u.id,u.email,u.name,u.role FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.hash=? AND s.expires>? AND u.disabled=0",
        )
        .get(digest(token), Date.now()) as Identity) ?? null
    );
  }
  logout(token?: string) {
    if (token) this.sql.prepare("DELETE FROM sessions WHERE hash=?").run(digest(token));
  }
  invite(email: unknown, days: unknown) {
    const address = email ? cleanEmail(email) : null;
    if (typeof days !== "number" || !Number.isInteger(days) || days < 1 || days > 30)
      throw new IdentityError("Choose 1 to 30 days");
    const code = randomToken(),
      id = randomUUID(),
      expires = Date.now() + days * 86400000;
    this.sql
      .prepare("INSERT INTO invites VALUES (?,?,'member',?,?,NULL,0,?)")
      .run(id, digest(code), address, expires, Date.now());
    return { id, code, expires };
  }
  invites() {
    return this.sql
      .prepare(
        "SELECT id,email,expires,used_by,revoked,created FROM invites WHERE role='member' ORDER BY created DESC",
      )
      .all();
  }
  revoke(id: string) {
    this.sql.prepare("UPDATE invites SET revoked=1 WHERE id=? AND role='member'").run(id);
  }
  ready() {
    return !!this.sql.prepare("SELECT id FROM users WHERE role='owner'").get();
  }
}
const registry = globalThis as typeof globalThis & { __identities?: Map<string, IdentityStore> };
export function identities() {
  const stores = (registry.__identities ??= new Map());
  const dir = rootDataDir();
  if (!stores.has(dir)) stores.set(dir, new IdentityStore(dir));
  return stores.get(dir)!;
}
export function requestToken(request?: Request) {
  return request?.headers
    .get("cookie")
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(SESSION_COOKIE + "="))
    ?.slice(SESSION_COOKIE.length + 1);
}
export const resolveUser = (request?: Request) => identities().resolve(requestToken(request));
