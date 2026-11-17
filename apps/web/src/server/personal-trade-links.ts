import type Database from "better-sqlite3";
import { PersonalStore } from "./personal-store";
import { parsePersonalContent } from "../lib/personal";

/** Run in the caller's transaction, after replacement trades have been materialized. */
export function reconcilePersonalTradeLinks(
  sqlite: Database.Database,
  removedKeys: string[],
  replacements = new Map<string, string>(),
) {
  const removed = new Set(removedKeys);
  if (!removed.size) return;
  for (const entry of new PersonalStore(sqlite).list()) {
    if (!entry.tradeKeys.some((k) => removed.has(k))) continue;
    const originalKeys = entry.tradeKeys.filter((k) => removed.has(k));
    const tradeKeys = [
      ...new Set(
        entry.tradeKeys.flatMap((k) => {
          if (!removed.has(k)) return [k];
          const next = replacements.get(k);
          return next && sqlite.prepare("SELECT key FROM trades WHERE key=?").get(next)
            ? [next]
            : [];
        }),
      ),
    ];
    const duplicateReview =
      entry.kind === "review" &&
      tradeKeys.length === 1 &&
      sqlite
        .prepare(
          "SELECT id FROM personal_entries WHERE kind='review' AND id!=? AND json_extract(body,'$.tradeKeys[0]')=?",
        )
        .get(entry.id, tradeKeys[0]);
    const archive = entry.kind === "review" && (tradeKeys.length !== 1 || !!duplicateReview);
    const body = parsePersonalContent({
      ...entry,
      tradeKeys: archive ? [] : tradeKeys,
      content: archive
        ? `${entry.content}\n\n---\nArchived trade review / 已归档交易复盘\n${originalKeys.join("\n")}\n\n## Entry reason / 进场理由\n${entry.entryReason}\n\n## Exit reason / 出场理由\n${entry.exitReason}\n\n## Improvements / 改进\n${entry.improvement}\n\n${entry.followedPlan} · ${entry.mood}`
        : entry.content,
    });
    sqlite
      .prepare(
        "UPDATE personal_entries SET kind=?,body=?,revision=revision+1,updated_at=? WHERE id=?",
      )
      .run(
        archive ? "diary" : entry.kind,
        JSON.stringify(body),
        new Date().toISOString(),
        entry.id,
      );
    if (archive)
      for (const key of originalKeys)
        sqlite
          .prepare(
            "UPDATE attachments SET owner_type='personal',owner_id=? WHERE owner_type='trade' AND owner_id=?",
          )
          .run(entry.id, key);
  }
  for (const key of removed) {
    const next = replacements.get(key);
    if (next && sqlite.prepare("SELECT key FROM trades WHERE key=?").get(next))
      sqlite
        .prepare("UPDATE attachments SET owner_id=? WHERE owner_type='trade' AND owner_id=?")
        .run(next, key);
    else sqlite.prepare("DELETE FROM attachments WHERE owner_type='trade' AND owner_id=?").run(key);
  }
}
