import { db } from "@/db";
import { handler } from "@/server/api";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
export const GET = handler(async () => {
  const dir = await mkdtemp(join(tmpdir(), "zhifan-backup-"));
  try {
    const file = join(dir, "journal.db");
    await db.$client.backup(file);
    return new Response(new Uint8Array(await readFile(file)), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="zhifan-${new Date().toISOString().slice(0, 10)}.db"`,
        "Cache-Control": "private, no-store",
      },
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
