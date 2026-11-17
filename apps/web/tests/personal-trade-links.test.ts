import { expect, it } from "vitest";
import { openJournalDatabase } from "../src/db/bootstrap";
import { PersonalStore } from "../src/server/personal-store";
import { reconcilePersonalTradeLinks } from "../src/server/personal-trade-links";
function fixture() {
  const db = openJournalDatabase(":memory:");
  for (const key of ["old", "new"])
    db.prepare(
      `INSERT INTO trades (key,account_id,symbol,direction,status,opened_at,quantity,open_quantity,avg_entry,gross_pnl,fees,net_pnl,execution_count,execution_ids_json,exits_json) VALUES (?,'account','TEST','long','win','2026-11-16T01:00:00Z',1,0,100,4,2,2,2,'[]','[]')`,
    ).run(key);
  const store = new PersonalStore(db);
  const diary = store.save({ kind: "diary", title: "随记", tradeKeys: ["old"] });
  const review = store.save({
    kind: "review",
    title: "交易复盘",
    tradeKeys: ["old"],
    entryReason: "回踩确认",
    exitReason: "达到目标",
    content: "原始正文",
  });
  db.prepare("INSERT INTO attachments VALUES (?,?,?,?,?,?,?,?)").run(
    "evidence",
    "trade",
    "old",
    "entry.png",
    "image/png",
    3,
    Buffer.from([1, 2, 3]),
    new Date().toISOString(),
  );
  db.prepare("DELETE FROM trades WHERE key='old'").run();
  return { db, store, diary, review };
}
it("keeps notes editable and preserves deleted trades' reviews and images as diary entries", () => {
  const { db, store, diary, review } = fixture();
  try {
    reconcilePersonalTradeLinks(db, ["old"]);
    const kept = store.get(review.id)!;
    expect(kept.kind).toBe("diary");
    expect(kept.tradeKeys).toEqual([]);
    expect(kept.content).toContain("回踩确认");
    expect(kept.content).toContain("原始正文");
    expect(db.prepare("SELECT owner_type,owner_id FROM attachments").get()).toEqual({
      owner_type: "personal",
      owner_id: review.id,
    });
    expect(() =>
      store.save({ ...store.get(diary.id)!, content: "仍可编辑" }, diary.id),
    ).not.toThrow();
  } finally {
    db.close();
  }
});
it("moves review and diary links and image ownership to the transferred trade", () => {
  const { db, store, diary, review } = fixture();
  try {
    reconcilePersonalTradeLinks(db, ["old"], new Map([["old", "new"]]));
    expect(store.get(review.id)?.kind).toBe("review");
    expect(store.get(review.id)?.tradeKeys).toEqual(["new"]);
    expect(store.get(diary.id)?.tradeKeys).toEqual(["new"]);
    expect(db.prepare("SELECT owner_type,owner_id FROM attachments").get()).toEqual({
      owner_type: "trade",
      owner_id: "new",
    });
  } finally {
    db.close();
  }
});
it("archives the source review without overwriting a destination review", () => {
  const { db, store, review } = fixture();
  try {
    const destination = store.save({
      kind: "review",
      title: "目标账户的复盘",
      tradeKeys: ["new"],
      content: "已存在的观察",
    });
    reconcilePersonalTradeLinks(db, ["old"], new Map([["old", "new"]]));
    expect(store.get(destination.id)?.content).toBe("已存在的观察");
    expect(store.get(review.id)?.kind).toBe("diary");
    expect(store.get(review.id)?.content).toContain("原始正文");
    expect(db.prepare("SELECT owner_type,owner_id FROM attachments").get()).toEqual({
      owner_type: "personal",
      owner_id: review.id,
    });
  } finally {
    db.close();
  }
});
