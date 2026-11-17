import { beforeAll, afterAll, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
vi.unmock("@/server/identity");
import { IdentityStore, identities, SESSION_COOKIE } from "../src/server/identity";
import { tenantScope, tenantDataDir } from "../src/server/tenant";
import { handler, ok } from "../src/server/api";
import { db, settings } from "../src/db";
import { aiKeyEnvironment } from "../src/server/settings";
import { GET as personalGet } from "../src/app/api/personal/route";
import { GET as attachmentGet } from "../src/app/api/attachments/[id]/route";
import { GET as backupGet } from "../src/app/api/database-backup/route";
import { POST as createInvite } from "../src/app/api/invitations/route";
import { PersonalStore } from "../src/server/personal-store";
import { POST as authenticate } from "../src/app/api/auth/route";

const dir = mkdtempSync(join(tmpdir(), "zhifan-identity-"));
const previous = process.env.JOURNAL_DATA_DIR;
let store: IdentityStore;
let owner: Awaited<ReturnType<IdentityStore["register"]>>, member: typeof owner;
const password = "a-long-test-password-42";
const req = (token?: string, method = "GET") =>
  new Request("http://localhost/api/test", {
    method,
    headers: token ? { cookie: SESSION_COOKIE + "=" + token } : undefined,
  });
beforeAll(async () => {
  process.env.JOURNAL_DATA_DIR = dir;
  store = identities();
  owner = await store.register({
    email: "owner@example.test",
    name: "Owner",
    password,
    invite: readFileSync(join(dir, "owner-invite.txt"), "utf8").trim(),
  });
  member = await store.register({
    email: "member@example.test",
    name: "Member",
    password,
    invite: store.invite(null, 7).code,
  });
});
afterAll(() => {
  for (const identity of [owner.user, member.user])
    tenantScope.run(identity, () => db.$client.close());
  store.sql.close();
  if (previous === undefined) delete process.env.JOURNAL_DATA_DIR;
  else process.env.JOURNAL_DATA_DIR = previous;
  rmSync(dir, { recursive: true, force: true });
});
it("rejects missing, forged and legacy sessions before reading data", async () => {
  const action = vi.fn((_request: Request) => ok({ secret: true }));
  for (const token of [undefined, "forged", "0".repeat(64)])
    expect((await handler(action)(req(token))).status).toBe(401);
  expect(action).not.toHaveBeenCalled();
});
it("rejects malformed authentication payloads as client errors", async () => {
  for (const body of ["{", "null", "[]", '"string"']) {
    const response = await authenticate(
      new Request("http://localhost/api/auth", { method: "POST", body }),
    );
    expect(response.status).toBe(400);
  }
});
it("requires invitations, email binding and a non-expired non-revoked code", async () => {
  const input = { email: "other@example.test", name: "Other", password };
  await expect(store.register({ ...input, invite: "unknown" })).rejects.toThrow("Invitation");
  const bound = store.invite("bound@example.test", 7);
  await expect(store.register({ ...input, invite: bound.code })).rejects.toThrow("Invitation");
  store.revoke(bound.id);
  await expect(
    store.register({ ...input, email: "bound@example.test", invite: bound.code }),
  ).rejects.toThrow("Invitation");
  const expired = store.invite(null, 1);
  store.sql.prepare("UPDATE invites SET expires=0 WHERE id=?").run(expired.id);
  await expect(store.register({ ...input, invite: expired.code })).rejects.toThrow("Invitation");
});
it("consumes a one-time invitation atomically during concurrent registration", async () => {
  const invitation = store.invite(null, 1);
  const results = await Promise.allSettled(
    ["race1", "race2"].map((email) =>
      store.register({
        email: email + "@example.test",
        name: email,
        password,
        invite: invitation.code,
      }),
    ),
  );
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
});
it("isolates simultaneous async requests including identical record ids, attachments and database backups", async () => {
  for (const identity of [owner.user, member.user])
    tenantScope.run(identity, () => {
      db.insert(settings).values({ key: "secret", value: identity.id }).run();
      new PersonalStore(db.$client).save({ kind: "diary", title: identity.name });
    });
  tenantScope.run(owner.user, () =>
    db.$client
      .prepare("INSERT INTO attachments VALUES (?,?,?,?,?,?,?,?)")
      .run(
        "private-image",
        "personal",
        "entry",
        "private.png",
        "image/png",
        3,
        Buffer.from([1, 2, 3]),
        new Date().toISOString(),
      ),
  );
  const route = handler(async (_request: Request) => {
    await new Promise((r) => setTimeout(r, 10));
    return ok({ dir: tenantDataDir(), rows: db.select().from(settings).all() });
  });
  const [a, b] = await Promise.all([route(req(owner.token)), route(req(member.token))]);
  expect((await a.json()).rows[0].value).toBe(owner.user.id);
  expect((await b.json()).rows[0].value).toBe(member.user.id);
  expect(
    (await (await personalGet(req(member.token))).json()).entries.map(
      (e: { title: string }) => e.title,
    ),
  ).toEqual(["Member"]);
  expect(
    (await attachmentGet(req(member.token), { params: Promise.resolve({ id: "private-image" }) }))
      .status,
  ).toBe(404);
  const backup = await (backupGet as (r: Request) => Promise<Response>)(req(member.token));
  const bytes = Buffer.from(await backup.arrayBuffer());
  expect(bytes.includes(Buffer.from(owner.user.id))).toBe(false);
  expect(bytes.includes(Buffer.from(member.user.id))).toBe(true);
});
it("does not grant invitation administration or owner environment keys to members", async () => {
  expect((await createInvite(req(member.token, "POST"))).status).toBe(403);
  vi.stubEnv("OPENAI_API_KEY", "owner-only-test-key");
  expect(tenantScope.run(member.user, () => aiKeyEnvironment("openai"))).toBeNull();
  expect(tenantScope.run(owner.user, () => aiKeyEnvironment("openai"))).toBe("owner-only-test-key");
  vi.unstubAllEnvs();
});
it("revokes sessions on logout and never stores raw passwords or session tokens", async () => {
  const login = await store.login({ email: "member@example.test", password });
  expect(store.resolve(login.token)?.id).toBe(member.user.id);
  store.logout(login.token);
  expect(store.resolve(login.token)).toBeNull();
  const saved = store.sql.prepare("SELECT password FROM users WHERE id=?").get(member.user.id) as {
    password: string;
  };
  expect(saved.password).not.toContain(password);
  expect(
    store.sql.prepare("SELECT hash FROM sessions WHERE hash=?").get(member.token),
  ).toBeUndefined();
  await expect(store.login({ email: "member@example.test", password: "wrong" })).rejects.toThrow(
    "incorrect",
  );
});
it("rejects cross-origin mutations even with a valid session", async () => {
  const action = vi.fn((_request: Request) => ok({ saved: true }));
  const request = new Request("http://localhost/api/test", {
    method: "POST",
    headers: { origin: "https://untrusted.example", cookie: SESSION_COOKIE + "=" + owner.token },
  });
  expect((await handler(action)(request)).status).toBe(403);
  expect(action).not.toHaveBeenCalled();
});
