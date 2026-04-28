/**
 * Audio transcription via Groq Whisper.
 *
 * Env vars required:
 *   GROQ_API_KEY — Groq API key (console.groq.com)
 *
 * transcribeAudioBuffer — for Baileys WhatsApp audio (buffer already downloaded)
 * transcribeWhatsAppAudio — for Twilio voice recordings (URL with Basic auth)
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

function getGroq(): Groq {
  const apiKey = process.env.GROQ_API_KEY ?? "";
  if (!apiKey) throw new Error("GROQ_API_KEY is not set");
  return new Groq({ apiKey });
}

/** Transcribe an audio Buffer (used by Baileys WhatsApp audio). */
export async function transcribeAudioBuffer(
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const ext = getExt(contentType);
  const groq = getGroq();
  const transcription = await groq.audio.transcriptions.create({
    file: new File([new Uint8Array(buffer)], `audio.${ext}`, { type: contentType }),
    model: "whisper-large-v3-turbo",
    language: "es",
    response_format: "text",
  });
  return (transcription as unknown as string).trim();
}

/**
 * Downloads a Twilio media URL and transcribes it.
 * Used by the voice webhook (Twilio recordings require Basic auth).
 *
 * Env vars required additionally:
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 */
export async function transcribeWhatsAppAudio(
  mediaUrl: string,
  contentType: string
): Promise<string> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID ?? "";
  const authToken = process.env.TWILIO_AUTH_TOKEN ?? "";

  const basicAuth = Buffer.from(`${accountSid}:${authToken}`).toString(
    "base64"
  );
  const response = await fetch(mediaUrl, {
    headers: { Authorization: `Basic ${basicAuth}` },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to download audio from Twilio: HTTP ${response.status}`
    );
  }

  const audioBuffer = await response.arrayBuffer();
  return transcribeAudioBuffer(Buffer.from(audioBuffer), contentType);
}
