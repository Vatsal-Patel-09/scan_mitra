import { NextResponse } from "next/server";
import { auth } from "@/auth";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const role = req.auth?.user?.role;
  const isLoggedIn = !!req.auth;

  if (pathname.startsWith("/doctor")) {
    if (!isLoggedIn || (role !== "DOCTOR" && role !== "ADMIN")) {
      return NextResponse.redirect(new URL("/signin", req.url));
    }
  }

  if (pathname.startsWith("/admin")) {
    if (!isLoggedIn || role !== "ADMIN") {
      return NextResponse.redirect(new URL("/signin", req.url));
    }
  }

  if (pathname.startsWith("/dashboard")) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL("/signin", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/doctor/:path*",
    "/admin/:path*",
    "/api/appointments/:path*",
    "/api/doctor/:path*",
    "/api/admin/:path*",
  ],
};
