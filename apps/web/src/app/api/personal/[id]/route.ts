import { db } from "@/db";
import { handler, ok, bad } from "@/server/api";
import { PersonalStore } from "@/server/personal-store";
type Context = {params:Promise<{id:string}>};
export const PATCH = handler(async (request:Request,context:Context) => {
  try { return ok({entry:new PersonalStore(db.$client).save(await request.json(),(await context.params).id)}); }
  catch(e) { return bad(e instanceof Error ? e.message : "保存失败"); }
});
export const DELETE = handler(async (_request:Request,context:Context) => {
  try { new PersonalStore(db.$client).remove((await context.params).id); return ok({deleted:true}); }
  catch(e) { return bad(e instanceof Error ? e.message : "删除失败"); }
});
