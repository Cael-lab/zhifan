import { identities } from "@/server/identity";
import { currentUser } from "@/server/tenant";
import { bad, handler, ok } from "@/server/api";
export const GET = handler(() =>
  currentUser()?.role !== "owner"
    ? bad("Owner access required", 403)
    : ok({ invitations: identities().invites() }),
);
export const POST = handler(async (request: Request) => {
  if (currentUser()?.role !== "owner") return bad("Owner access required", 403);
  const body = await request.json();
  return ok(identities().invite(body.email, body.days));
});
export const DELETE = handler(async (request: Request) => {
  if (currentUser()?.role !== "owner") return bad("Owner access required", 403);
  const { id } = await request.json();
  if (typeof id !== "string") return bad("Invalid invitation");
  identities().revoke(id);
  return ok({ revoked: true });
});
