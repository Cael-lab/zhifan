import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import {
  ENTRY_KINDS,
  parsePersonalContent,
  type EntryKind,
  type PersonalEntry,
} from "../lib/personal";

type Row = {
  id: string;
  kind: EntryKind;
  parent_id: string | null;
  body: string;
  revision: number;
  created_at: string;
  updated_at: string;
};
const decode = (r: Row): PersonalEntry => ({
  ...JSON.parse(r.body),
  id: r.id,
  kind: r.kind,
  parentId: r.parent_id,
  revision: r.revision,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});
export class PersonalStore {
  constructor(private sqlite: Database.Database) {}
  get(id: string) {
    const row = this.sqlite.prepare("SELECT * FROM personal_entries WHERE id = ?").get(id) as
      Row | undefined;
    return row ? decode(row) : null;
  }
  list() {
    const rows = this.sqlite
      .prepare("SELECT * FROM personal_entries ORDER BY updated_at DESC")
      .all() as Row[];
    const images = this.sqlite
      .prepare(
        "SELECT id, owner_id FROM attachments WHERE owner_type = 'personal' AND mime LIKE 'image/%' ORDER BY created_at",
      )
      .all() as { id: string; owner_id: string }[];
    return rows.map((r) => ({
      ...decode(r),
      coverId:
        images.find((a) => a.owner_id === r.id)?.id ??
        images.find((a) => rows.some((c) => c.parent_id === r.id && c.id === a.owner_id))?.id,
      attachmentCount: images.filter((a) => a.owner_id === r.id).length,
      caseCount: rows.filter((c) => c.parent_id === r.id).length,
    }));
  }
  save(input: Record<string, unknown>, id?: string): PersonalEntry {
    return this.sqlite.transaction(() => {
      const previous = id ? this.get(id) : null;
      if (id && !previous) throw new Error("记录不存在");
      if (previous && input.revision !== previous.revision)
        throw new Error("记录已在其他页面更新，请刷新后重试，避免覆盖新内容");
      const kind = previous?.kind ?? (input.kind as EntryKind);
      if (!ENTRY_KINDS.includes(kind)) throw new Error("记录类型无效");
      const body = parsePersonalContent(input);
      const parentId =
        previous?.parentId ?? (typeof input.parentId === "string" ? input.parentId : null);
      if (kind === "case" && (!parentId || this.get(parentId)?.kind !== "knowledge"))
        throw new Error("案例必须属于一个知识点");
      if (kind !== "case" && parentId) throw new Error("该记录类型不能设置父级");
      for (const key of body.tradeKeys) {
        if (!this.sqlite.prepare("SELECT key FROM trades WHERE key = ?").get(key))
          throw new Error("关联交易不存在，请重新选择");
      }
      for (const key of body.knowledgeIds)
        if (this.get(key)?.kind !== "knowledge") throw new Error("关联知识点不存在");
      if (kind === "review") {
        if (body.tradeKeys.length !== 1) throw new Error("复盘必须关联一笔交易");
        const existing = this.sqlite
          .prepare(
            "SELECT id FROM personal_entries WHERE kind = 'review' AND json_extract(body, '$.tradeKeys[0]') = ? AND id != ?",
          )
          .get(body.tradeKeys[0], id ?? "");
        if (existing) throw new Error("此交易已有复盘，请刷新后编辑");
      }
      const now = new Date().toISOString();
      const entryId = id ?? randomUUID();
      if (previous)
        this.sqlite
          .prepare(
            "UPDATE personal_entries SET body = ?, revision = revision + 1, updated_at = ? WHERE id = ?",
          )
          .run(JSON.stringify(body), now, entryId);
      else
        this.sqlite
          .prepare(
            "INSERT INTO personal_entries(id,kind,parent_id,body,created_at,updated_at) VALUES (?,?,?,?,?,?)",
          )
          .run(entryId, kind, parentId, JSON.stringify(body), now, now);
      if (kind === "review")
        this.sqlite
          .prepare("UPDATE trades SET reviewed_at = ? WHERE key = ?")
          .run(now, body.tradeKeys[0]);
      return this.get(entryId)!;
    })();
  }
  remove(id: string) {
    this.sqlite.transaction(() => {
      if (!this.get(id)) throw new Error("记录不存在");
      const removed = [
        id,
        ...(
          this.sqlite.prepare("SELECT id FROM personal_entries WHERE parent_id = ?").all(id) as {
            id: string;
          }[]
        ).map((r) => r.id),
      ];
      for (const key of removed)
        this.sqlite
          .prepare("DELETE FROM attachments WHERE owner_type = 'personal' AND owner_id = ?")
          .run(key);
      this.sqlite.prepare("DELETE FROM personal_entries WHERE id = ?").run(id);
      for (const row of this.sqlite.prepare("SELECT * FROM personal_entries").all() as Row[]) {
        const entry = decode(row);
        if (entry.knowledgeIds.some((k) => removed.includes(k))) {
          entry.knowledgeIds = entry.knowledgeIds.filter((k) => !removed.includes(k));
          this.sqlite
            .prepare(
              "UPDATE personal_entries SET body = ?, revision = revision + 1, updated_at = ? WHERE id = ?",
            )
            .run(JSON.stringify(parsePersonalContent(entry)), new Date().toISOString(), entry.id);
        }
      }
    })();
  }
}
