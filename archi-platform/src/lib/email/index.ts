import { Resend } from "resend";
import { env } from "@/lib/env";

export interface EmailMessage {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export interface EmailDriver {
  send(msg: EmailMessage): Promise<void>;
}

const consoleDriver: EmailDriver = {
  async send(msg) {
    // eslint-disable-next-line no-console
    console.log(
      "\n[EMAIL] →",
      Array.isArray(msg.to) ? msg.to.join(", ") : msg.to,
      "\n  subject:",
      msg.subject,
      "\n  text:",
      msg.text ?? msg.html.replace(/<[^>]+>/g, "").slice(0, 200),
      "\n",
    );
  },
};

const resendClient = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

const resendDriver: EmailDriver = {
  async send(msg) {
    if (!resendClient) throw new Error("RESEND_API_KEY not configured");
    await resendClient.emails.send({
      from: env.EMAIL_FROM,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
    });
  },
};

export const email: EmailDriver =
  env.EMAIL_DRIVER === "resend" ? resendDriver : consoleDriver;
