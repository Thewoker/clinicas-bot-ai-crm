/**
 * Twilio API wrapper for WhatsApp messaging
 *
 * Env vars required:
 *   TWILIO_ACCOUNT_SID  — Twilio Account SID
 *   TWILIO_AUTH_TOKEN   — Twilio Auth Token
 *
 * Architecture: one shared Twilio account for the whole platform.
 * Each clinic stores its assigned WhatsApp number in waPhoneNumberId
 * (E.164 format, e.g. "+14155238886"). Inbound webhooks are routed to
 * the right clinic by matching the "To" field to that number.
 */

import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID ?? "";
const authToken = process.env.TWILIO_AUTH_TOKEN ?? "";

function getClient() {
  if (!accountSid || !authToken) {
    throw new Error("TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set");
  }
  return twilio(accountSid, authToken);
}

/**
 * Send a WhatsApp text message from the clinic's number to a patient.
 * @param fromNumber  Clinic's Twilio number in E.164, e.g. "+14155238886"
 * @param toNumber    Patient's number in E.164, e.g. "+5491112345678"
 */
export async function sendWhatsAppMessage(
  fromNumber: string,
  toNumber: string,
  body: string
): Promise<void> {
  const client = getClient();
  await client.messages.create({
    from: `whatsapp:${fromNumber}`,
    to: `whatsapp:${toNumber}`,
    body,
  });
}

/**
 * Strip the "whatsapp:" prefix Twilio adds to From/To webhook fields.
 * "whatsapp:+5491112345678" → "+5491112345678"
 */
export function parseWhatsAppNumber(twilioField: string): string {
  return twilioField.replace(/^whatsapp:/, "");
}

/**
 * Validate that an incoming webhook actually came from Twilio.
 * Should be called before processing any webhook payload.
 */
export function validateTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string
): boolean {
  if (!authToken) return false;
  return twilio.validateRequest(authToken, signature, url, params);
}
