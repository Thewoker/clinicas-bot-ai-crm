/**
 * WhatsApp manager using @whiskeysockets/baileys.
 *
 * One Baileys socket per clinic. Sessions are persisted to
 * ./whatsapp-sessions/{clinicId}/ so connections survive server restarts.
 *
 * Exported as a singleton via the global object so Next.js hot-reloads
 * in development don't spawn duplicate sockets.
 */

import * as fs from "fs/promises";
import * as path from "path";
import { prisma } from "@/lib/prisma";
import { runBot, type BotMessage, type ClinicContext } from "@/lib/claude-bot";
import { transcribeAudioBuffer } from "@/lib/transcription";

const SESSIONS_DIR = path.join(process.cwd(), "whatsapp-sessions");

// Info-level logger to see what Baileys does internally
const silentLogger = {
  level: "info",
  info: (...a: unknown[]) => console.log("[baileys:info]", ...a),
  debug: () => {},
  warn: (...a: unknown[]) => console.warn("[baileys:warn]", ...a),
  error: (...a: unknown[]) => console.error("[baileys:error]", ...a),
  trace: () => {},
  child: function () { return silentLogger; },
};

interface ClinicConnection {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sock: any;
  qr?: string;
  connected: boolean;
}

class WhatsAppManager {
  private connections = new Map<string, ClinicConnection>();

  /** On startup: restore sessions for every active clinic that has a saved session. */
  async initialize(): Promise<void> {
    const clinics = await prisma.clinic.findMany({
      where: { waActive: true, waPhoneNumberId: { not: null } },
      select: { id: true },
    });
    for (const clinic of clinics) {
      const sessionDir = path.join(SESSIONS_DIR, clinic.id);
      try {
        await fs.access(sessionDir);
        await this.connectClinic(clinic.id);
      } catch {
        // No saved session — skip, user must scan QR again
      }
    }
  }

  /** Create (or restart) the Baileys socket for a clinic. */
  async connectClinic(clinicId: string): Promise<void> {
    // Close existing connection cleanly
    const existing = this.connections.get(clinicId);
    if (existing) {
      try {
        existing.sock.ws?.close();
      } catch {}
      this.connections.delete(clinicId);
    }

    const sessionDir = path.join(SESSIONS_DIR, clinicId);
    await fs.mkdir(sessionDir, { recursive: true });

    // Dynamic import to work with Baileys ESM and Next.js bundler
    const {
      default: makeWASocket,
      useMultiFileAuthState,
      DisconnectReason,
      downloadMediaMessage,
      fetchLatestBaileysVersion,
    } = await import("@whiskeysockets/baileys");

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

    // Fetch the current WA Web version to avoid protocol mismatches
    const { version } = await fetchLatestBaileysVersion();
    console.log(`[wa] Creating socket for clinic ${clinicId} (WA version: ${version.join(".")})...`);

    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: silentLogger as never,
      connectTimeoutMs: 20_000,
    });

    const entry: ClinicConnection = { sock, connected: false };
    this.connections.set(clinicId, entry);
    console.log(`[wa] Socket created, waiting for connection events...`);

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on(
      "connection.update",
      async (update: {
        connection?: string;
        qr?: string;
        lastDisconnect?: { error?: unknown };
      }) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          console.log(`[wa] QR received for clinic ${clinicId}`);
          entry.qr = qr;
        }

        console.log(`[wa] connection.update for ${clinicId}:`, { connection, hasQR: !!qr });

        if (connection === "open") {
          entry.connected = true;
          entry.qr = undefined;
          const rawId: string = sock.user?.id ?? "";
          const phone = rawId.split(":")[0].split("@")[0];
          if (phone) {
            await prisma.clinic
              .update({
                where: { id: clinicId },
                data: { waPhoneNumberId: `+${phone}`, waActive: true },
              })
              .catch(console.error);
          }
          console.log(`[wa] Clinic ${clinicId} connected (+${phone})`);
        }

        if (connection === "close") {
          entry.connected = false;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const loggedOut = statusCode === DisconnectReason.loggedOut;

          if (loggedOut) {
            console.log(`[wa] Clinic ${clinicId} logged out`);
            this.connections.delete(clinicId);
            await fs
              .rm(sessionDir, { recursive: true, force: true })
              .catch(() => {});
            await prisma.clinic
              .update({
                where: { id: clinicId },
                data: { waPhoneNumberId: null, waActive: false },
              })
              .catch(console.error);
          } else {
            console.log(
              `[wa] Clinic ${clinicId} disconnected (code ${statusCode}), reconnecting in 5s...`
            );
            setTimeout(
              () => this.connectClinic(clinicId).catch(console.error),
              5000
            );
          }
        }
      }
    );

    sock.ev.on(
      "messages.upsert",
      async ({
        messages,
        type,
      }: {
        messages: unknown[];
        type: string;
      }) => {
        if (type !== "notify") return;
        for (const msg of messages) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const m = msg as any;
          if (m.key?.fromMe || !m.key?.remoteJid) continue;
          if (m.key.remoteJid.endsWith("@g.us")) continue; // skip groups
          await this.handleIncoming(
            clinicId,
            sock,
            m,
            downloadMediaMessage
          ).catch((err) => {
            console.error(
              `[wa] Error handling message for clinic ${clinicId}:`,
              err
            );
          });
        }
      }
    );
  }

  private async handleIncoming(
    clinicId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sock: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    msg: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    downloadMediaMessage: any
  ): Promise<void> {
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: {
        id: true,
        name: true,
        phone: true,
        address: true,
        apiKey: true,
        timezone: true,
        waBotName: true,
        waBotWelcome: true,
        waActive: true,
      },
    });

    if (!clinic?.waActive) return;

    const jid: string = msg.key.remoteJid;
    const rawPhone = jid.replace("@s.whatsapp.net", "");
    const patientPhone = rawPhone.startsWith("+") ? rawPhone : `+${rawPhone}`;

    const content = msg.message;
    if (!content) return;

    const isAudio = !!content.audioMessage;
    const rawText: string =
      content.conversation || content.extendedTextMessage?.text || "";

    if (!rawText && !isAudio) return;

    let messageText = rawText;

    if (isAudio) {
      try {
        const buffer = (await downloadMediaMessage(
          msg,
          "buffer",
          {}
        )) as Buffer;
        const contentType: string =
          content.audioMessage?.mimetype ?? "audio/ogg";
        messageText = await transcribeAudioBuffer(buffer, contentType);
        console.log(
          `[wa] Transcribed audio from ${patientPhone}: "${messageText}"`
        );
      } catch (err) {
        console.error(`[wa] Audio transcription failed:`, err);
        await sock
          .sendMessage(jid, {
            text: "Lo siento, no pude procesar tu mensaje de voz. ¿Podés escribirme lo que necesitás?",
          })
          .catch(() => {});
        return;
      }
    }

    if (!messageText.trim()) return;

    // Load / create / reset stale conversation
    let conversation = await prisma.whatsappConversation.findUnique({
      where: { clinicId_patientPhone: { clinicId, patientPhone } },
    });

    const isStale =
      conversation &&
      Date.now() - new Date(conversation.updatedAt).getTime() >
        24 * 60 * 60 * 1000;

    if (!conversation) {
      conversation = await prisma.whatsappConversation.create({
        data: { clinicId, patientPhone, messages: [] },
      });
    } else if (isStale) {
      await prisma.whatsappConversation.update({
        where: { id: conversation.id },
        data: { messages: [] },
      });
      conversation.messages = [];
    }

    const history = (conversation.messages as unknown as BotMessage[]) ?? [];

    const clinicCtx: ClinicContext = {
      id: clinic.id,
      name: clinic.name,
      phone: clinic.phone,
      address: clinic.address,
      apiKey: clinic.apiKey,
      waBotName: clinic.waBotName,
      waBotWelcome: clinic.waBotWelcome,
      timezone: clinic.timezone,
    };

    const { reply, updatedHistory } = await runBot(
      clinicCtx,
      history,
      messageText,
      patientPhone
    );

    await prisma.whatsappConversation.update({
      where: { id: conversation.id },
      data: { messages: updatedHistory as unknown as never[] },
    });

    await sock.sendMessage(jid, { text: reply });
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  getQR(clinicId: string): string | undefined {
    return this.connections.get(clinicId)?.qr;
  }

  isConnected(clinicId: string): boolean {
    return this.connections.get(clinicId)?.connected ?? false;
  }

  isPending(clinicId: string): boolean {
    const c = this.connections.get(clinicId);
    return !!c && !c.connected;
  }

  /** Send a text message from the clinic's socket (used for manual replies). */
  async sendMessage(
    clinicId: string,
    toPhone: string,
    text: string
  ): Promise<void> {
    const entry = this.connections.get(clinicId);
    if (!entry?.connected) throw new Error("WhatsApp no está conectado");
    const jid = toPhone.replace("+", "") + "@s.whatsapp.net";
    await entry.sock.sendMessage(jid, { text });
  }

  /** Logout and delete the session for a clinic. */
  async disconnectClinic(clinicId: string): Promise<void> {
    const entry = this.connections.get(clinicId);
    if (entry) {
      try {
        await entry.sock.logout();
      } catch {}
      this.connections.delete(clinicId);
    }
    const sessionDir = path.join(SESSIONS_DIR, clinicId);
    await fs.rm(sessionDir, { recursive: true, force: true }).catch(() => {});
  }
}

// ─── Singleton ─────────────────────────────────────────────────────────────────
declare global {
  // eslint-disable-next-line no-var
  var __whatsappManager: WhatsAppManager | undefined;
}

if (!global.__whatsappManager) {
  global.__whatsappManager = new WhatsAppManager();
  global.__whatsappManager
    .initialize()
    .catch((err) => console.error("[wa] Initialization error:", err));
}

export const whatsappManager = global.__whatsappManager;
