import { expect, it } from "vitest";
import { openJournalDatabase } from "../src/db/bootstrap";
import { PersonalStore } from "../src/server/personal-store";
import { copyTradeEvidence } from "../src/server/personal-evidence";

it("keeps copied case images and inline links independent of the original trade evidence", () => {
  const sqlite = openJournalDatabase(":memory:");
  try {
    const store = new PersonalStore(sqlite);
    const parent = store.save({ kind: "knowledge", title: "回踩" });
    const example = store.save({ kind: "case", title: "交易案例", parentId: parent.id });
    // The attachment copy itself does not depend on the materialized trade row.
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    sqlite
      .prepare("INSERT INTO attachments VALUES (?,?,?,?,?,?,?,?)")
      .run(
        "source-picture",
        "trade",
        "trade",
        "entry.png",
        "image/png",
        bytes.length,
        bytes,
        new Date().toISOString(),
      );
    const content = sqlite.transaction(() =>
      copyTradeEvidence(
        sqlite,
        "trade",
        example.id,
        "![进场](/api/attachments/source-picture)\n![外部图片](https://example.com/chart.png)",
      ),
    )();
    sqlite.prepare("DELETE FROM attachments WHERE owner_type='trade'").run();
    const copy = sqlite.prepare("SELECT id,data,owner_id FROM attachments").get() as {
      id: string;
      data: Buffer;
      owner_id: string;
    };
    expect(copy.owner_id).toBe(example.id);
    expect(copy.data).toEqual(bytes);
    expect(content).toContain(`![进场](/api/attachments/${copy.id})`);
    expect(content).not.toContain("source-picture");
    expect(content).toContain("https://example.com/chart.png");
  } finally {
    sqlite.close();
  }
});
