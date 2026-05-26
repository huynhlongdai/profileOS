-- CreateTable
CREATE TABLE "AccountType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL UNIQUE,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "AccountType_name_idx" ON "AccountType"("name");

-- CreateIndex
CREATE INDEX "AccountType_isActive_idx" ON "AccountType"("isActive");

-- CreateIndex
CREATE INDEX "AccountType_sortOrder_idx" ON "AccountType"("sortOrder");

