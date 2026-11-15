import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

/** Called inside the case-creation transaction. Copies bytes and rewrites inline image links. */
export function copyTradeEvidence(
  sqlite: Database.Database,
  tradeKey: string,
  caseId: string,
  content: string,
) {
  const originals = sqlite
    .prepare(
      `SELECT * FROM attachments
    WHERE (owner_type = 'trade' AND owner_id = ?)
    OR (owner_type = 'personal' AND owner_id IN (
      SELECT id FROM personal_entries WHERE kind = 'review'
      AND json_extract(body, '$.tradeKeys[0]') = ?))`,
    )
    .all(tradeKey, tradeKey) as {
    id: string;
    name: string;
    mime: string;
    size: number;
    data: Buffer;
  }[];
  const replacements = new Map<string, string>();
  for (const a of originals) {
    const id = randomUUID();
    replacements.set(a.id, id);
    sqlite
      .prepare(
        "INSERT INTO attachments (id,owner_type,owner_id,name,mime,size,data,created_at) VALUES (?,'personal',?,?,?,?,?,?)",
      )
      .run(id, caseId, a.name, a.mime, a.size, a.data, new Date().toISOString());
  }
  return content.replace(/\/api\/attachments\/([^\s)"'<>?#]+)/g, (url, id: string) =>
    replacements.has(id) ? `/api/attachments/${replacements.get(id)}` : url,
  );
}
