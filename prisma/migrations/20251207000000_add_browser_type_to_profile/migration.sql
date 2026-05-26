-- AlterTable
ALTER TABLE "Profile" ADD COLUMN "browserType" TEXT;

-- CreateIndex
CREATE INDEX "Profile_browserType_idx" ON "Profile"("browserType");

