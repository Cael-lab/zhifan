import { db } from "@/db";
import { handler, ok, bad } from "@/server/api";
import { PersonalStore } from "@/server/personal-store";

export const GET = handler((request: Request) => {
  const p = new URL(request.url).searchParams;
  let entries = new PersonalStore(db.$client).list();
  if (p.get("kind")) entries = entries.filter(e=>e.kind===p.get("kind"));
  if (p.get("trade")) entries = entries.filter(e=>e.tradeKeys.includes(p.get("trade")!));
  return ok({entries});
});
export const POST = handler(async (request: Request) => {
  try { return ok({entry:new PersonalStore(db.$client).save(await request.json())}); }
  catch(e) { return bad(e instanceof Error ? e.message : "保存失败"); }
});
