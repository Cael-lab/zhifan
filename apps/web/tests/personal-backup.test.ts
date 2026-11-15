import { afterEach, beforeEach, expect, it } from "vitest";
import type Database from "better-sqlite3";
import { openJournalDatabase } from "../src/db/bootstrap";
import { PersonalStore } from "../src/server/personal-store";
import { exportPersonal, importPersonal } from "../src/server/personal-backup";
import { emptyContent } from "../src/lib/personal";
let source: Database.Database, target: Database.Database;
beforeEach(() => {
  source = openJournalDatabase(":memory:");
  target = openJournalDatabase(":memory:");
});
afterEach(() => {
  source.close();
  target.close();
});
function fixture() {
  const store = new PersonalStore(source);
  const p = store.save({ ...emptyContent(), kind: "knowledge", title: "突破回踩" });
  const c = store.save({ ...emptyContent(), kind: "case", title: "案例图片", parentId: p.id });
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  source
    .prepare("INSERT INTO attachments VALUES (?,?,?,?,?,?,?,?)")
    .run(
      "picture",
      "personal",
      c.id,
      "before.png",
      "image/png",
      png.length,
      png,
      new Date().toISOString(),
    );
  return { p, c, png };
}
it("restores knowledge, cases, and exact image bytes and is idempotent", () => {
  const { p, c, png } = fixture();
  const doc = exportPersonal(source);
  expect(importPersonal(target, doc)).toMatchObject({ imported: 2, images: 1 });
  const restored = new PersonalStore(target);
  expect(restored.get(c.id)?.parentId).toBe(p.id);
  expect((target.prepare("SELECT data FROM attachments").get() as { data: Buffer }).data).toEqual(
    png,
  );
  expect(importPersonal(target, doc)).toMatchObject({ imported: 0, skipped: 2, images: 0 });
});
it("rejects a corrupted image without importing any records", () => {
  fixture();
  const doc = exportPersonal(source);
  doc.attachments[0]!.data = "ZmFrZQ==";
  expect(() => importPersonal(target, doc)).toThrow("附件");
  expect(new PersonalStore(target).list()).toHaveLength(0);
});
it("never overwrites an edited record with an older backup", () => {
  const { p } = fixture();
  const doc = exportPersonal(source);
  importPersonal(target, doc);
  const store = new PersonalStore(target);
  const live = store.get(p.id)!;
  store.save({ ...live, title: "新标题" }, p.id);
  importPersonal(target, doc);
  expect(store.get(p.id)?.title).toBe("新标题");
});

it("restores review completion only when the corresponding trade exists", () => {
  const insert = `INSERT INTO trades
    (key,account_id,symbol,direction,status,opened_at,quantity,open_quantity,avg_entry,
     gross_pnl,fees,net_pnl,execution_count,execution_ids_json,exits_json)
    VALUES ('trade','account','TEST','long','win','2026-11-13T01:00:00Z',1,0,100,4,2,2,2,'[]','[]')`;
  source.prepare(insert).run();
  const review = new PersonalStore(source).save({
    ...emptyContent(),
    kind: "review",
    title: "已完成的交易复盘",
    tradeKeys: ["trade"],
  });
  const doc = exportPersonal(source);
  expect(importPersonal(target, doc)).toMatchObject({ imported: 0, skipped: 1, missingTrades: 1 });
  target.prepare(insert).run();
  expect(importPersonal(target, doc)).toMatchObject({ imported: 1, skipped: 0 });
  expect(new PersonalStore(target).get(review.id)?.tradeKeys).toEqual(["trade"]);
  expect(target.prepare("SELECT reviewed_at FROM trades").get()).toMatchObject({
    reviewed_at: expect.any(String),
  });
});
