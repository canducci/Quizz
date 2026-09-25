import nodemailer from "nodemailer";
import type Mail from "nodemailer/lib/mailer";

const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
    : undefined,
});

export async function sendMail(
  to: string,
  subject: string,
  text: string,
  attachments?: Mail.Attachment[],
) {
  await transport.sendMail({ from: process.env.EMAIL_FROM, to, subject, text, attachments });
}
