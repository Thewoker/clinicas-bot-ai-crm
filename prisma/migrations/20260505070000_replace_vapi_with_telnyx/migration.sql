-- Drop Vapi columns
ALTER TABLE "clinics" DROP COLUMN IF EXISTS "vapiApiKey";
ALTER TABLE "clinics" DROP COLUMN IF EXISTS "vapiPhoneNumberId";
ALTER TABLE "clinics" DROP COLUMN IF EXISTS "vapiPhoneNumber";
ALTER TABLE "clinics" DROP COLUMN IF EXISTS "vapiAssistantId";

-- Add Telnyx columns
ALTER TABLE "clinics" ADD COLUMN "telnyxApiKey" TEXT;
ALTER TABLE "clinics" ADD COLUMN "telnyxPhoneNumberId" TEXT;
ALTER TABLE "clinics" ADD COLUMN "telnyxPhoneNumber" TEXT;
ALTER TABLE "clinics" ADD COLUMN "telnyxAppId" TEXT;
