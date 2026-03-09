import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { compare } from "bcryptjs";
import { db } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt" },
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
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email as string;
        const password = credentials.password as string;

        const user = await db.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;

        const valid = await compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.displayName ?? user.username,
          image: user.avatarUrl,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
      }
      if (account) {
        token.provider = account.provider;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
    async signIn({ user, account }) {
      // For OAuth providers, generate a unique username on first sign-in
      if (account?.provider !== "credentials" && user.id) {
        const existing = await db.user.findUnique({ where: { id: user.id } });
        if (existing && !existing.username) {
          const baseUsername = (user.name ?? "user")
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "") || "user";
          let username = baseUsername;
          let suffix = 0;

          // Retry loop using DB unique constraint to avoid TOCTOU race
          for (let attempt = 0; attempt < 20; attempt++) {
            try {
              await db.user.update({
                where: { id: user.id },
                data: { username },
              });
              break;
            } catch (e: unknown) {
              if (typeof e === "object" && e !== null && "code" in e && e.code === "P2002") {
                suffix++;
                username = `${baseUsername}${suffix}`;
                continue;
              }
              throw e;
            }
          }
        }
      }
      return true;
    },
  },
});
