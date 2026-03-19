import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export async function POST(req: NextRequest) {
  const { phone, code } = await req.json();

  if (!phone || !code) {
    return NextResponse.json(
      { error: "Phone and code required" },
      { status: 400 }
    );
  }

  if (!process.env.TWILIO_VERIFY_SERVICE_SID) {
    return NextResponse.json(
      { error: "Twilio is not configured" },
      { status: 500 }
    );
  }

  try {
    const check = await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID)
      .verificationChecks.create({ to: phone, code });

    if (check.status !== "approved") {
      return NextResponse.json({ error: "Invalid OTP" }, { status: 401 });
    }

    return NextResponse.json({ verified: true });
  } catch (error) {
    console.error("OTP verify error:", error);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
