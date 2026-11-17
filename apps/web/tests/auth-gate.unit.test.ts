import { expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "../src/middleware";
it("redirects visitors to login even without the old shared password", () => {
  expect(middleware(new NextRequest("http://localhost/trades")).headers.get("location")).toBe(
    "http://localhost/login",
  );
});
it("blocks unauthenticated APIs", () => {
  expect(middleware(new NextRequest("http://localhost/api/personal")).status).toBe(401);
});
it.each(["/login", "/register", "/api/auth"])("permits public account entry %s", (path) => {
  expect(middleware(new NextRequest("http://localhost" + path)).status).toBe(200);
});
it("passes cookie presence to the cryptographic server gate", () => {
  expect(
    middleware(
      new NextRequest("http://localhost/api/personal", {
        headers: { cookie: "zhifan_session=opaque" },
      }),
    ).status,
  ).toBe(200);
});
