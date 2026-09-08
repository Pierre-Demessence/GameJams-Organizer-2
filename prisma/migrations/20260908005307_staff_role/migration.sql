-- CreateEnum
CREATE TYPE "StaffRoleType" AS ENUM ('SITE_ADMIN');

-- CreateTable
CREATE TABLE "StaffRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "StaffRoleType" NOT NULL,

    CONSTRAINT "StaffRole_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffRole_userId_role_key" ON "StaffRole"("userId", "role");

-- AddForeignKey
ALTER TABLE "StaffRole" ADD CONSTRAINT "StaffRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
