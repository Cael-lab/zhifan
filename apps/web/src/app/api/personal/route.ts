import { db } from "@/db";
import { handler, ok, bad } from "@/server/api";
import { PersonalStore } from "@/server/personal-store";
import { copyTradeEvidence } from "@/server/personal-evidence";

export const GET = handler((request: Request) => {
  const p = new URL(request.url).searchParams;
  let entries = new PersonalStore(db.$client).list();
  if (p.get("kind")) entries = entries.filter((e) => e.kind === p.get("kind"));
  if (p.get("trade")) entries = entries.filter((e) => e.tradeKeys.includes(p.get("trade")!));
  return ok({ entries });
});
export const POST = handler(async (request: Request) => {
  try {
    const input = await request.json();
    const entry = db.$client.transaction(() => {
      const store = new PersonalStore(db.$client);
      let entry = store.save(input);
      if (input.copyTrade) {
        if (entry.kind !== "case" || !entry.tradeKeys.includes(input.copyTrade))
          throw new Error("案例来源交易无效");
        const content = copyTradeEvidence(db.$client, input.copyTrade, entry.id, entry.content);
        if (content !== entry.content) entry = store.save({ ...entry, content }, entry.id);
      }
      return entry;
    })();
    return ok({ entry });
  } catch (e) {
    return bad(e instanceof Error ? e.message : "保存失败");
  }
});
