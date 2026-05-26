-- CreateTable
CREATE TABLE "AccountChangeHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "fieldName" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "description" TEXT,
    "changedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccountChangeHistory_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProfileChangeHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "fieldName" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "description" TEXT,
    "changedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProfileChangeHistory_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AccountChangeHistory_accountId_idx" ON "AccountChangeHistory"("accountId");

-- CreateIndex
CREATE INDEX "AccountChangeHistory_changeType_idx" ON "AccountChangeHistory"("changeType");

-- CreateIndex
CREATE INDEX "AccountChangeHistory_createdAt_idx" ON "AccountChangeHistory"("createdAt");

-- CreateIndex
CREATE INDEX "ProfileChangeHistory_profileId_idx" ON "ProfileChangeHistory"("profileId");

-- CreateIndex
CREATE INDEX "ProfileChangeHistory_changeType_idx" ON "ProfileChangeHistory"("changeType");

-- CreateIndex
CREATE INDEX "ProfileChangeHistory_createdAt_idx" ON "ProfileChangeHistory"("createdAt");

