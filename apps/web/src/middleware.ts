import { NextResponse, type NextRequest } from "next/server";
export const middleware = (request: NextRequest) => {
  const { pathname } = request.nextUrl;
  if (["/login", "/register", "/api/auth", "/icon.svg"].includes(pathname))
    return NextResponse.next();
  if (!request.cookies.get("zhifan_session")?.value) {
    if (pathname.startsWith("/api/"))
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
};
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|fonts/).*)"] };
