import { NextRequest, NextResponse } from "next/server";

/**
 * Funnel gating by cookie:
 *  - /report requires the opt-in cookie (else -> back to landing)
 *  - /thanks requires the booking cookie (else -> back to /book)
 *
 * This is a real UX gate that mirrors the funnel flow. To test freely,
 * walk the funnel from the start.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/report")) {
    const optin = req.cookies.get("tunnel_optin");
    if (!optin?.value) {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  if (pathname.startsWith("/thanks")) {
    const booking = req.cookies.get("tunnel_booking");
    if (!booking?.value) {
      return NextResponse.redirect(new URL("/book", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/report/:path*", "/thanks/:path*"],
};
