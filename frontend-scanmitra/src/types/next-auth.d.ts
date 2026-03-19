import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "PATIENT" | "DOCTOR" | "ADMIN";
    } & DefaultSession["user"];
  }

  interface User {
    role: "PATIENT" | "DOCTOR" | "ADMIN";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: "PATIENT" | "DOCTOR" | "ADMIN";
  }
}
