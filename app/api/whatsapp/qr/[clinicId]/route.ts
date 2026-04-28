/**
 * GET /api/whatsapp/qr/[clinicId]
 *
 * Polling endpoint used by the settings UI while waiting for QR scan.
 * Returns one of three states:
 *   { status: "waiting" }              — socket created, QR not yet available
 *   { status: "qr", qr: "data:..." }  — QR ready as base64 PNG data URL
 *   { status: "connected" }           — scan completed, bot is live
 *   { status: "idle" }                — no connection attempt in progress
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { whatsappManager } from "@/lib/whatsapp/manager";
import QRCode from "qrcode";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clinicId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clinicId } = await params;

  // Clinics can only poll their own connection
  if (clinicId !== session.clinicId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (whatsappManager.isConnected(clinicId)) {
    return NextResponse.json({ status: "connected" });
  }

  const qrString = whatsappManager.getQR(clinicId);

  if (qrString) {
    const png = await QRCode.toDataURL(qrString, { width: 300, margin: 2 });
    return NextResponse.json({ status: "qr", qr: png });
  }

  if (whatsappManager.isPending(clinicId)) {
    return NextResponse.json({ status: "waiting" });
  }

  return NextResponse.json({ status: "idle" });
}
