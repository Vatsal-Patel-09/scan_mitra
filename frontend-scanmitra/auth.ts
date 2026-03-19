import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      id: "email-password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email as string },
          });

          if (!user || !user.passwordHash || !user.isActive) {
            return null;
          }

          const isValid = await bcrypt.compare(
            credentials.password as string,
            user.passwordHash
          );

          if (!isValid) {
            return null;
          }

          return {
            id: user.id,
            name: user.name,
            email: user.email ?? undefined,
            role: user.role,
          };
        } catch {
          return null;
        }
      },
    }),

    Credentials({
      id: "phone-otp",
      credentials: {
        phone: { label: "Phone", type: "text" },
        verified: { label: "Verified", type: "text" },
      },
      async authorize(credentials) {
        if (credentials?.verified !== "true") {
          return null;
        }

        try {
          const phone = credentials.phone as string;
          const user = await prisma.user.upsert({
            where: { phone },
            create: {
              phone,
              name: "Patient",
              role: "PATIENT",
              patient: { create: {} },
            },
            update: {},
          });

          return {
            id: user.id,
            name: user.name,
            role: user.role,
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = typeof token.id === "string" ? token.id : "";
      session.user.role =
        token.role === "DOCTOR" || token.role === "ADMIN"
          ? token.role
          : "PATIENT";
      return session;
    },
  },
  pages: {
    signIn: "/signin",
  },
  session: {
    strategy: "jwt",
  },
});
