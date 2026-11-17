import { NextResponse } from "next/server";
import { IdentityError, resolveUser } from "./identity";
import { tenantScope } from "./tenant";

export class RequestError extends Error {}
export function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new RequestError(message);
}

export const ok = (data: unknown, init?: ResponseInit) => {
  const headers = new Headers(init?.headers);
  if (!headers.has("Cache-Control")) headers.set("Cache-Control", "private, no-store");
  return NextResponse.json(data, { ...init, headers });
};

export const bad = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

/** Route-handler wrapper: uniform error JSON instead of HTML 500 pages. */
export const handler =
  <A extends unknown[]>(
    fn: (...args: A) => Promise<Response> | Response,
    options: { public?: boolean } = {},
  ) =>
  async (...args: A): Promise<Response> => {
    try {
      const request = args[0] instanceof Request ? args[0] : undefined;
      if (request && !["GET", "HEAD", "OPTIONS"].includes(request.method)) {
        const origin = request.headers.get("origin");
        // Next can normalize request.url to localhost when bound to 127.0.0.1.
        // The HTTP Host remains the browser-visible authority.
        const expectedOrigin = new URL(request.url);
        expectedOrigin.host = request.headers.get("host") ?? expectedOrigin.host;
        if (
          (origin && origin !== expectedOrigin.origin) ||
          request.headers.get("sec-fetch-site") === "cross-site"
        )
          return bad("Cross-site request rejected", 403);
      }
      if (options.public) return await fn(...args);
      const user = resolveUser(request);
      if (!user) return bad("Unauthorized", 401);
      return await tenantScope.run(user, () => fn(...args));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Internal error";
      return NextResponse.json(
        { error: message },
        {
          status:
            error instanceof IdentityError
              ? error.status
              : error instanceof RequestError
                ? 400
                : 500,
        },
      );
    }
  };
