-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "reminder24SentAt" TIMESTAMP(3),
ADD COLUMN     "reminder48SentAt" TIMESTAMP(3),
ADD COLUMN     "reminder4SentAt" TIMESTAMP(3);
