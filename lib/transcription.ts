/**
 * Audio transcription via Groq Whisper (free tier).
 *
 * Env vars required:
 *   GROQ_API_KEY       — Groq API key (console.groq.com)
 *   TWILIO_ACCOUNT_SID — used to authenticate the media download
 *   TWILIO_AUTH_TOKEN  — used to authenticate the media download
 */

import Groq from "groq-sdk";

const CONTENT_TYPE_TO_EXT: Record<string, string> = {
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/mp4a-latm": "m4a",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/webm": "webm",
  "audio/amr": "amr",
};

function getExt(contentType: string): string {
  const base = contentType.split(";")[0].trim().toLowerCase();
  return CONTENT_TYPE_TO_EXT[base] ?? "ogg";
}

/**
 * Downloads a Twilio media file and transcribes it with Groq Whisper.
 * Returns the transcribed text in Spanish.
 */
export async function transcribeWhatsAppAudio(
  mediaUrl: string,
  contentType: string
): Promise<string> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID ?? "";
  const authToken = process.env.TWILIO_AUTH_TOKEN ?? "";
  const apiKey = process.env.GROQ_API_KEY ?? "";

  if (!apiKey) throw new Error("GROQ_API_KEY is not set");

  // Twilio media URLs require HTTP Basic auth
  const basicAuth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const response = await fetch(mediaUrl, {
    headers: { Authorization: `Basic ${basicAuth}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to download audio from Twilio: HTTP ${response.status}`);
  }

  const audioBuffer = await response.arrayBuffer();
  const ext = getExt(contentType);

  const groq = new Groq({ apiKey });

  const transcription = await groq.audio.transcriptions.create({
    file: new File([audioBuffer], `audio.${ext}`, { type: contentType }),
    model: "whisper-large-v3-turbo",
    language: "es",
    response_format: "text",
  });

  return (transcription as unknown as string).trim();
}
