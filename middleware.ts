import { NextRequest, NextResponse } from "next/server";

/**
 * Funnel gating by cookie:
 *  - /thanks requires the booking cookie (else -> back to /book)
 *
 * /report is deliberately ungated. The diagnosis is the product now, and the
 * booking is the conversion. Gating it here would bounce every visitor,
 * because tunnel_optin is only set by the (now optional) email capture.
 *
 * Origami visitor proxy:
 *  - /_ov/{o.js,e,identify} forward to Origami with the visitor IP and the
 *    secret key attached server-side (company-level only, never the person).
 *  - Anything else under /_ov/ is a 404. Never forward /_ov/* wholesale:
 *    Origami's /v1/s accepts deletions and this proxy carries the secret key.
 */
const ORIGAMI_ALLOWED = new Set(["o.js", "e", "identify"]);

function origamiProxy(req: NextRequest) {
  const path = req.nextUrl.pathname.slice("/_ov/".length);
  if (!ORIGAMI_ALLOWED.has(path)) return new NextResponse(null, { status: 404 });

  // Vercel's edge overwrites x-real-ip / x-forwarded-for, so the browser cannot spoof them.
  const ip =
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "";
  const k = process.env.ORIGAMI_VISITORS_SECRET_KEY ?? ""; console.log(`[origami-key-check] ${path} present=${k.length > 0} sk=${k.startsWith("og_sk_")} len=${k.length}`); // TEMP
  const headers = new Headers(req.headers);
  headers.set("X-Origami-Client-IP", ip);
  headers.set("Authorization", `Bearer ${process.env.ORIGAMI_VISITORS_SECRET_KEY ?? ""}`);
  headers.delete("cookie");

  const target = new URL("https://origami-web-visitors.com/v1/" + path + req.nextUrl.search);
  return NextResponse.rewrite(target, { request: { headers } });
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/_ov/")) return origamiProxy(req);

  if (pathname.startsWith("/thanks")) {
    const booking = req.cookies.get("tunnel_booking");
    if (!booking?.value) {
      return NextResponse.redirect(new URL("/book", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/thanks/:path*", "/_ov/:path*"],
};
