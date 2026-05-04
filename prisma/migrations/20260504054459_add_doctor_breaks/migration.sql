-- CreateTable
CREATE TABLE "doctor_breaks" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "dayOfWeek" INTEGER,
    "startTime" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,

    CONSTRAINT "doctor_breaks_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "doctor_breaks" ADD CONSTRAINT "doctor_breaks_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_breaks" ADD CONSTRAINT "doctor_breaks_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
