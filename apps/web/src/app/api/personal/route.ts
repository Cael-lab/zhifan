import { db } from "@/db";
import { handler, ok, bad } from "@/server/api";
import { PersonalStore } from "@/server/personal-store";
import { randomUUID } from "node:crypto";

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
      const entry = new PersonalStore(db.$client).save(input);
      if (input.copyTrade) {
        if (entry.kind !== "case" || !entry.tradeKeys.includes(input.copyTrade))
          throw new Error("案例来源交易无效");
        const originals = db.$client
          .prepare(
            `SELECT * FROM attachments WHERE (owner_type = 'trade' AND owner_id = ?)
            OR (owner_type = 'personal' AND owner_id IN (
              SELECT id FROM personal_entries WHERE kind = 'review'
              AND json_extract(body, '$.tradeKeys[0]') = ?))`,
          )
          .all(input.copyTrade, input.copyTrade) as {
          name: string;
          mime: string;
          size: number;
          data: Buffer;
        }[];
        for (const a of originals)
          db.$client
            .prepare(
              "INSERT INTO attachments (id,owner_type,owner_id,name,mime,size,data,created_at) VALUES (?,?,?,?,?,?,?,?)",
            )
            .run(
              randomUUID(),
              "personal",
              entry.id,
              a.name,
              a.mime,
              a.size,
              a.data,
              new Date().toISOString(),
            );
      }
      return entry;
    })();
    return ok({ entry });
  } catch (e) {
    return bad(e instanceof Error ? e.message : "保存失败");
  }
});
