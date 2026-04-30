-- CreateTable
CREATE TABLE "user_clinics" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'ADMIN',

    CONSTRAINT "user_clinics_pkey" PRIMARY KEY ("id")
);

-- Migrate existing user-clinic relationships before dropping the columns
INSERT INTO "user_clinics" ("id", "userId", "clinicId", "role")
SELECT gen_random_uuid()::text, "id", "clinicId", "role"
FROM "users";

-- AddForeignKey
ALTER TABLE "user_clinics" ADD CONSTRAINT "user_clinics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_clinics" ADD CONSTRAINT "user_clinics_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "user_clinics_userId_clinicId_key" ON "user_clinics"("userId", "clinicId");

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_clinicId_fkey";

-- DropColumn
ALTER TABLE "users" DROP COLUMN "clinicId";

-- DropColumn
ALTER TABLE "users" DROP COLUMN "role";
