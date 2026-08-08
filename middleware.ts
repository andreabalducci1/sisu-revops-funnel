import { NextRequest, NextResponse } from "next/server";

/**
 * Funnel gating by cookie:
 *  - /thanks requires the booking cookie (else -> back to /book)
 *
 * /report is deliberately ungated. The diagnosis is the product now, and the
 * booking is the conversion. Gating it here would bounce every visitor,
 * because tunnel_optin is only set by the (now optional) email capture.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/thanks")) {
    const booking = req.cookies.get("tunnel_booking");
    if (!booking?.value) {
      return NextResponse.redirect(new URL("/book", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/thanks/:path*"],
};
