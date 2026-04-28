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

// Disconnect codes that mean the session is permanently broken.
// On these, delete session files instead of reconnecting blindly.
const BAD_SESSION_CODES = new Set([
  405, // Registration rejected / protocol mismatch
  403, // Forbidden
  500, // BadSession (Baileys' own constant)
]);

const silentLogger = {
  level: "silent",
  info: () => {},
  debug: () => {},
  warn: () => {},
  error: (...a: unknown[]) => console.error("[baileys:error]", ...a),
  trace: () => {},
  child: function () { return silentLogger; },
};

interface ClinicConnection {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sock: any;
  qr?: string;
  connected: boolean;
  /** Pending reconnect timer — cancelled when disconnectClinic() is called. */
  reconnectTimer?: ReturnType<typeof setTimeout>;
  /** Set to false by disconnectClinic() to prevent any further reconnects. */
  shouldReconnect: boolean;
}

/** Delete all session files for a clinic. */
async function clearSession(clinicId: string): Promise<void> {
  const dir = path.join(SESSIONS_DIR, clinicId);
  await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
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
    // Cancel any pending reconnect and close the existing socket cleanly
    const existing = this.connections.get(clinicId);
    if (existing) {
      existing.shouldReconnect = false;
      if (existing.reconnectTimer) clearTimeout(existing.reconnectTimer);
      try { existing.sock.ws?.close(); } catch {}
      this.connections.delete(clinicId);
    }

    const sessionDir = path.join(SESSIONS_DIR, clinicId);
    await fs.mkdir(sessionDir, { recursive: true });

    const {
      default: makeWASocket,
      useMultiFileAuthState,
      DisconnectReason,
      downloadMediaMessage,
      fetchLatestBaileysVersion,
    } = await import("@whiskeysockets/baileys");

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version } = await fetchLatestBaileysVersion();

    console.log(`[wa] Connecting clinic ${clinicId} (WA ${version.join(".")})`);

    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: silentLogger as never,
      connectTimeoutMs: 30_000,
    });

    const entry: ClinicConnection = {
      sock,
      connected: false,
      shouldReconnect: true,
    };
    this.connections.set(clinicId, entry);

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
          entry.qr = qr;
        }

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
          const badSession = BAD_SESSION_CODES.has(statusCode);

          console.log(`[wa] Clinic ${clinicId} closed (code ${statusCode})`);

          if (loggedOut || badSession) {
            // Permanent failure — wipe session so the next connect starts fresh
            console.log(`[wa] Clearing session for clinic ${clinicId} (code ${statusCode})`);
            this.connections.delete(clinicId);
            await clearSession(clinicId);
            await prisma.clinic
              .update({
                where: { id: clinicId },
                data: { waPhoneNumberId: null, waActive: false },
              })
              .catch(console.error);
          } else if (entry.shouldReconnect) {
            // Transient failure — reconnect after a short delay
            entry.reconnectTimer = setTimeout(
              () => this.connectClinic(clinicId).catch(console.error),
              8_000
            );
          }
        }
      }
    );

    sock.ev.on(
      "messages.upsert",
      async ({ messages, type }: { messages: unknown[]; type: string }) => {
        if (type !== "notify") return;
        for (const msg of messages) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const m = msg as any;
          if (m.key?.fromMe || !m.key?.remoteJid) continue;
          if (m.key.remoteJid.endsWith("@g.us")) continue;
          await this.handleIncoming(clinicId, sock, m, downloadMediaMessage).catch(
            (err) => console.error(`[wa] Message error for clinic ${clinicId}:`, err)
          );
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
        const buffer = (await downloadMediaMessage(msg, "buffer", {})) as Buffer;
        const contentType: string = content.audioMessage?.mimetype ?? "audio/ogg";
        messageText = await transcribeAudioBuffer(buffer, contentType);
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

  async sendMessage(clinicId: string, toPhone: string, text: string): Promise<void> {
    const entry = this.connections.get(clinicId);
    if (!entry?.connected) throw new Error("WhatsApp no está conectado");
    const jid = toPhone.replace("+", "") + "@s.whatsapp.net";
    await entry.sock.sendMessage(jid, { text });
  }

  /** Logout, cancel reconnects, and delete session files for a clinic. */
  async disconnectClinic(clinicId: string): Promise<void> {
    const entry = this.connections.get(clinicId);
    if (entry) {
      // Prevent any scheduled reconnect from firing after we return
      entry.shouldReconnect = false;
      if (entry.reconnectTimer) clearTimeout(entry.reconnectTimer);
      try { await entry.sock.logout(); } catch {}
      this.connections.delete(clinicId);
    }
    await clearSession(clinicId);
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
