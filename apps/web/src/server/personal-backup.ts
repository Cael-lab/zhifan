import type Database from "better-sqlite3";
import { PersonalStore } from "./personal-store";
import { ENTRY_KINDS, parsePersonalContent } from "../lib/personal";
import { attachmentMime, MAX_ATTACHMENT_SIZE } from "../lib/attachment-validation";
type Attachment = {
  id: string;
  owner_id: string;
  name: string;
  mime: string;
  size: number;
  data: Buffer;
  created_at: string;
};
export function exportPersonal(sqlite: Database.Database) {
  return {
    format: "zhifan-personal",
    version: 1,
    exportedAt: new Date().toISOString(),
    entries: new PersonalStore(sqlite).list(),
    attachments: (
      sqlite.prepare("SELECT * FROM attachments WHERE owner_type='personal'").all() as Attachment[]
    ).map(({ data, ...a }) => ({ ...a, data: data.toString("base64") })),
  };
}
export function importPersonal(sqlite: Database.Database, input: unknown) {
  if (!input || typeof input !== "object") throw new Error("备份格式无效");
  const doc = input as ReturnType<typeof exportPersonal>;
  if (
    doc.format !== "zhifan-personal" ||
    doc.version !== 1 ||
    !Array.isArray(doc.entries) ||
    !Array.isArray(doc.attachments) ||
    doc.entries.length > 50000 ||
    doc.attachments.length > 50000
  )
    throw new Error("不是受支持的知返学习备份");
  const ids = new Set<string>();
  const validId = (id: unknown): id is string =>
    typeof id === "string" && id.length > 0 && id.length < 200;
  const entries = doc.entries.map((e) => {
    if (!e || !validId(e.id) || ids.has(e.id) || !ENTRY_KINDS.includes(e.kind))
      throw new Error("记录 ID 或类型无效");
    ids.add(e.id);
    if (e.parentId !== null && !validId(e.parentId)) throw new Error("父级 ID 无效");
    const body = parsePersonalContent(e);
    return {
      ...body,
      id: e.id,
      kind: e.kind,
      parentId: e.parentId,
      createdAt:
        typeof e.createdAt === "string" && Number.isFinite(Date.parse(e.createdAt))
          ? e.createdAt
          : new Date().toISOString(),
    };
  });
  const store = new PersonalStore(sqlite);
  const effective = (id: string) => store.get(id) ?? entries.find((e) => e.id === id);
  for (const e of entries) {
    if (e.kind === "case" && (!e.parentId || effective(e.parentId)?.kind !== "knowledge"))
      throw new Error("案例缺少有效的父级知识点");
    if (e.kind !== "case" && e.parentId) throw new Error("父级关联无效");
    if (e.knowledgeIds.some((id) => effective(id)?.kind !== "knowledge"))
      throw new Error("知识点关联无效");
  }
  const attachmentIds = new Set<string>();
  const files = doc.attachments.map((a) => {
    if (
      !a ||
      !validId(a.id) ||
      attachmentIds.has(a.id) ||
      !validId(a.owner_id) ||
      !effective(a.owner_id) ||
      typeof a.name !== "string" ||
      a.name.length > 200 ||
      typeof a.data !== "string" ||
      a.data.length > MAX_ATTACHMENT_SIZE * 1.4
    )
      throw new Error("附件记录无效");
    attachmentIds.add(a.id);
    const bytes = Buffer.from(a.data, "base64");
    const mime = attachmentMime(bytes);
    if (
      !bytes.length ||
      bytes.length > MAX_ATTACHMENT_SIZE ||
      !mime ||
      mime !== a.mime ||
      bytes.length !== a.size
    )
      throw new Error("附件内容或大小无效");
    return { ...a, bytes, mime };
  });
  return sqlite.transaction(() => {
    let imported = 0,
      skipped = 0,
      missingTrades = 0,
      images = 0;
    // Existing IDs are never overwritten; repeated imports are safe.
    for (const e of [...entries].sort(
      (a, b) => Number(a.kind === "case") - Number(b.kind === "case"),
    )) {
      if (store.get(e.id)) {
        skipped++;
        continue;
      }
      const tradeKeys = e.tradeKeys.filter(
        (k) => !!sqlite.prepare("SELECT key FROM trades WHERE key=?").get(k),
      );
      missingTrades += e.tradeKeys.length - tradeKeys.length;
      if (e.kind === "review" && tradeKeys.length !== 1) {
        skipped++;
        continue;
      }
      if (
        e.kind === "review" &&
        sqlite
          .prepare(
            "SELECT id FROM personal_entries WHERE kind='review' AND json_extract(body,'$.tradeKeys[0]')=?",
          )
          .get(tradeKeys[0])
      ) {
        skipped++;
        continue;
      }
      sqlite
        .prepare(
          "INSERT INTO personal_entries(id,kind,parent_id,body,created_at,updated_at) VALUES(?,?,?,?,?,?)",
        )
        .run(
          e.id,
          e.kind,
          e.parentId,
          JSON.stringify(parsePersonalContent({ ...e, tradeKeys })),
          e.createdAt,
          new Date().toISOString(),
        );
      imported++;
      if (e.kind === "review")
        sqlite
          .prepare("UPDATE trades SET reviewed_at = ? WHERE key = ?")
          .run(new Date().toISOString(), tradeKeys[0]);
    }
    for (const a of files) {
      if (!store.get(a.owner_id)) continue;
      const result = sqlite
        .prepare(
          "INSERT OR IGNORE INTO attachments(id,owner_type,owner_id,name,mime,size,data,created_at) VALUES(?,'personal',?,?,?,?,?,?)",
        )
        .run(a.id, a.owner_id, a.name, a.mime, a.bytes.length, a.bytes, new Date().toISOString());
      images += result.changes;
    }
    return { imported, skipped, images, missingTrades };
  })();
}
