import { db } from "@/db";
import { handler, ok, bad } from "@/server/api";
import { exportPersonal, importPersonal } from "@/server/personal-backup";
export const GET = handler(() =>
  ok(exportPersonal(db.$client), {
    headers: {
      "Content-Disposition": `attachment; filename="zhifan-personal-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  }),
);
export const POST = handler(async (request: Request) => {
  const limit = 64 * 1024 * 1024;
  if (Number(request.headers.get("content-length") ?? 0) > limit)
    return bad("备份超过 64 MB，请使用完整数据库恢复流程", 413);
  const reader = request.body?.getReader();
  if (!reader) return bad("没有备份内容");
  let size = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return bad("备份超过 64 MB", 413);
    }
    chunks.push(value);
  }
  try {
    return ok(importPersonal(db.$client, JSON.parse(Buffer.concat(chunks).toString("utf8"))));
  } catch (e) {
    return bad(e instanceof Error ? e.message : "恢复失败");
  }
});
