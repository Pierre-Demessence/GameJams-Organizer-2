import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  matcher: [
    "/jams/new",
    "/jams/:slug/edit",
    "/jams/:slug/manage/:path*",
    "/jams/:slug/submit",
    "/jams/:slug/submissions/new",
    "/jams/:slug/rate",
    "/submissions/:id/edit",
    "/settings",
    "/admin",
    "/admin/:path*",
  ],
};
