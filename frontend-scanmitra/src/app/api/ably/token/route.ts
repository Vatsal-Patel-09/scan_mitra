import Ably from "ably";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.ABLY_API_KEY) {
    return NextResponse.json({ error: "Ably not configured" }, { status: 500 });
  }

  const ably = new Ably.Rest(process.env.ABLY_API_KEY);
  const tokenRequest = await ably.auth.createTokenRequest({
    clientId: session.user.id,
  });

  return NextResponse.json(tokenRequest);
}
