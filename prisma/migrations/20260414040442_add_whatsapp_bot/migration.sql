-- AlterTable
ALTER TABLE "clinics" ADD COLUMN     "wa360ApiKey" TEXT,
ADD COLUMN     "waActive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "waBotName" TEXT,
ADD COLUMN     "waBotWelcome" TEXT,
ADD COLUMN     "waPhoneNumberId" TEXT;

-- CreateTable
CREATE TABLE "whatsapp_conversations" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "patientPhone" TEXT NOT NULL,
    "patientId" TEXT,
    "messages" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_conversations_clinicId_patientPhone_key" ON "whatsapp_conversations"("clinicId", "patientPhone");

-- AddForeignKey
ALTER TABLE "whatsapp_conversations" ADD CONSTRAINT "whatsapp_conversations_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_conversations" ADD CONSTRAINT "whatsapp_conversations_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
