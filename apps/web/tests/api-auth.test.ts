import { expect, it, vi } from "vitest";
vi.unmock("@/server/identity");
import { handler, ok } from "../src/server/api";
it("accepts the browser Host when Next normalizes the internal request URL", async () => {
  const route = handler((_request: Request) => ok({ saved: true }), { public: true });
  const request = new Request("http://localhost:3001/api/auth", {
    method: "POST",
    headers: { host: "127.0.0.1:3001", origin: "http://127.0.0.1:3001" },
  });
  expect((await route(request)).status).toBe(200);
});
it("marks successful API responses as private and non-cacheable", () => {
  expect(ok({ value: true }).headers.get("Cache-Control")).toBe("private, no-store");
});
it("allows only explicitly public handlers without a session", async () => {
  const action = vi.fn((_request: Request) => ok({ public: true }));
  expect(
    (await handler(action, { public: true })(new Request("http://localhost/api/auth"))).status,
  ).toBe(200);
  expect(action).toHaveBeenCalledOnce();
});
it("checks origin on public login mutations too", async () => {
  const action = vi.fn((_request: Request) => ok({ public: true }));
  expect(
    (
      await handler(action, { public: true })(
        new Request("http://localhost/api/auth", {
          method: "POST",
          headers: { origin: "https://other.example" },
        }),
      )
    ).status,
  ).toBe(403);
  expect(action).not.toHaveBeenCalled();
});
