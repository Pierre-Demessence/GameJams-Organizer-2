import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter, AdapterUser } from "next-auth/adapters";
import { compare } from "bcryptjs";
import { db } from "@/lib/db";
import { isStaff } from "@/lib/staff-permissions";
import { recordAudit } from "@/lib/audit";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: customPrismaAdapter(),
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
  events: {
    async signIn({ user }) {
      if (user?.id && (await isStaff(user.id))) {
        await recordAudit({
          actorId: user.id,
          action: "auth:staff_signin",
          targetType: "user",
          targetId: user.id,
        });
      }
    },
  },
});

// The default PrismaAdapter writes Auth.js's canonical fields (name, image) and
// omits our required `username`. Wrap createUser/updateUser to map onto this
// project's User model (name->displayName, image->avatarUrl) and mint a unique
// username on first OAuth sign-in.
function customPrismaAdapter(): Adapter {
  const base = PrismaAdapter(db);
  return {
    ...base,
    createUser: async (data) => {
      const seed =
        (data.name ?? data.email ?? "user").toLowerCase().replace(/[^a-z0-9]/g, "") ||
        "user";
      let username = seed;
      for (let suffix = 0; suffix < 20; suffix++) {
        if (suffix > 0) username = `${seed}${suffix}`;
        try {
          const user = await db.user.create({
            data: {
              email: data.email || null,
              emailVerified: data.emailVerified ?? null,
              username,
              displayName: data.name ?? null,
              avatarUrl: data.image ?? null,
            },
          });
          return toAdapterUser(user);
        } catch (e) {
          if (isUniqueViolation(e)) continue;
          throw e;
        }
      }
      throw new Error("Could not generate a unique username");
    },
    updateUser: async ({ id, ...data }) => {
      const user = await db.user.update({
        where: { id },
        data: {
          email: data.email ?? undefined,
          emailVerified: data.emailVerified ?? undefined,
          displayName: data.name ?? undefined,
          avatarUrl: data.image ?? undefined,
        },
      });
      return toAdapterUser(user);
    },
  };
}

function toAdapterUser(u: {
  id: string;
  email: string | null;
  emailVerified: Date | null;
  displayName: string | null;
  avatarUrl: string | null;
}): AdapterUser {
  return {
    id: u.id,
    email: u.email ?? "",
    emailVerified: u.emailVerified,
    name: u.displayName,
    image: u.avatarUrl,
  };
}

function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && "code" in e && e.code === "P2002";
}
