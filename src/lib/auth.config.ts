import type { NextAuthConfig } from "next-auth";
import Discord from "next-auth/providers/discord";
import Credentials from "next-auth/providers/credentials";

// Edge-compatible auth config (no Prisma / Node.js imports)
export const authConfig = {
  pages: {
    signIn: "/sign-in",
    newUser: "/sign-up",
  },
  providers: [
    Discord,
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      // Credentials authorize runs server-side only (not in middleware)
      authorize: () => null,
    }),
  ],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      if (!isLoggedIn) {
        return Response.redirect(new URL("/sign-in", nextUrl));
      }
      return true;
    },
  },
} satisfies NextAuthConfig;
