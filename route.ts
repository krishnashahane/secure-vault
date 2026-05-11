import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { name?: string; email?: string; message?: string };
    const { name, email, message } = body;

    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return NextResponse.json({ error: "All fields are required." }, { status: 400 });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
    }

    const sql = getSql();

    await sql`
      CREATE TABLE IF NOT EXISTS contact_messages (
        id BIGSERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;

    await sql`
      INSERT INTO contact_messages (name, email, message)
      VALUES (${name.trim()}, ${email.trim()}, ${message.trim()})
    `;

    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (smtpUser && smtpPass) {
      try {
        const nodemailer = (await import("nodemailer")).default;
        const transporter = nodemailer.createTransport({
          host: "smtp.gmail.com",
          port: 587,
          secure: false,
          auth: { user: smtpUser, pass: smtpPass },
        });

        await transporter.sendMail({
          from: `"SecureVault Contact" <${smtpUser}>`,
          to: "devwsaumya@gmail.com",
          replyTo: email,
          subject: `SecureVault Contact: ${name}`,
          text: `Name: ${name}\nEmail: ${email}\n\n${message}`,
          html: `
            <div style="font-family:sans-serif;max-width:600px;background:#08090c;color:#f0f6fc;padding:32px;border-radius:12px">
              <h2 style="color:#58d5a2;margin:0 0 20px">New Contact Message</h2>
              <p style="margin:0 0 8px"><strong>From:</strong> ${name}</p>
              <p style="margin:0 0 20px"><strong>Email:</strong> <a href="mailto:${email}" style="color:#58a6ff">${email}</a></p>
              <hr style="border:1px solid rgba(99,110,130,0.2);margin:0 0 20px"/>
              <p style="white-space:pre-wrap;margin:0;color:#c9d1d9">${message}</p>
            </div>
          `,
        });
      } catch (mailErr) {
        console.error("Email send failed (message saved to DB):", mailErr);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Contact form error:", err);
    return NextResponse.json({ error: "Failed to send. Please try again." }, { status: 500 });
  }
}
