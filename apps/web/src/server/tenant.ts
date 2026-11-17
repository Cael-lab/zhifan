import { AsyncLocalStorage } from "node:async_hooks";
import { join } from "node:path";

export type Identity = { id: string; email: string; name: string; role: "owner" | "member" };
const globalScope = globalThis as typeof globalThis & {
  __tenantScope?: AsyncLocalStorage<Identity>;
};
export const tenantScope = (globalScope.__tenantScope ??= new AsyncLocalStorage<Identity>());
export const currentUser = () => tenantScope.getStore();
export const rootDataDir = () => process.env.JOURNAL_DATA_DIR ?? join(process.cwd(), "data");
export function tenantDataDir() {
  const user = currentUser();
  if (!user) {
    if (process.env.NODE_ENV === "test") return rootDataDir();
    throw new Error("Authenticated workspace required");
  }
  if (!/^[a-zA-Z0-9-]+$/.test(user.id)) throw new Error("Invalid workspace");
  return user.role === "owner" ? rootDataDir() : join(rootDataDir(), "users", user.id);
}
export const tenantCacheKey = () => currentUser()?.id ?? "test";
export const ownerEnvironment = () =>
  currentUser()?.role === "owner" || (!currentUser() && process.env.NODE_ENV === "test");
