import { identities, requestToken, SESSION_COOKIE, IdentityError } from "@/server/identity";
import { handler, ok } from "@/server/api";

export const GET = handler(
  (request: Request) =>
    ok({ user: identities().resolve(requestToken(request)), setup: !identities().ready() }),
  { public: true },
);
export const POST = handler(
  async (request: Request) => {
    const text = await request.text();
    if (text.length > 4096) throw new IdentityError("Request too large");
    let input;
    try {
      input = JSON.parse(text);
    } catch {
      throw new IdentityError("Invalid request");
    }
    if (!input || typeof input !== "object" || Array.isArray(input))
      throw new IdentityError("Invalid request");
    const store = identities();
    // Bound password work globally as well as by account; never trust client IP headers.
    store.throttle("authentication", 120);
    const result =
      input.action === "register" ? await store.register(input) : await store.login(input);
    const response = ok({ user: result.user });
    response.cookies.set(SESSION_COOKIE, result.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: new URL(request.url).protocol === "https:",
      path: "/",
      maxAge: 7 * 86400,
    });
    return response;
  },
  { public: true },
);
export const DELETE = handler(
  (request: Request) => {
    identities().logout(requestToken(request));
    const response = ok({ signedOut: true });
    response.cookies.set(SESSION_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return response;
  },
  { public: true },
);
