import { afterEach, vi } from "vitest";
afterEach(() => vi.restoreAllMocks());
// Existing domain tests exercise a fixture workspace; security tests explicitly unmock this module.
vi.mock("@/server/identity", async (original) => ({
  ...(await original<typeof import("../src/server/identity")>()),
  resolveUser: () => ({
    id: "fixture",
    email: "fixture@example.test",
    name: "Fixture",
    role: "owner",
  }),
}));
