-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'AUTHORIZED', 'SUSPENDED');

-- AlterTable
ALTER TABLE "clinics" ADD COLUMN "authorized" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" ADD COLUMN "status" "UserStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "users" ADD COLUMN "superAdmin" BOOLEAN NOT NULL DEFAULT false;
