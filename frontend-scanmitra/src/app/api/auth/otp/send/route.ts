import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export async function POST(req: NextRequest) {
  const { phone } = await req.json();

  if (!phone || !/^\+[1-9]\d{7,14}$/.test(phone)) {
    return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
  }

  if (!process.env.TWILIO_VERIFY_SERVICE_SID) {
    return NextResponse.json(
      { error: "Twilio is not configured" },
      { status: 500 }
    );
  }

  try {
    await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID)
      .verifications.create({ to: phone, channel: "sms" });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("OTP send error:", error);
    return NextResponse.json({ error: "Failed to send OTP" }, { status: 500 });
  }
}
