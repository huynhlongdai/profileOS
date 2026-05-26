-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "passwordEncrypted" TEXT,
    "twoFactorSecret" TEXT,
    "gpmloginProfileId" TEXT,
    "proxyId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "autoChangeProxy" BOOLEAN NOT NULL DEFAULT false,
    "lastCheck" DATETIME,
    "lastLogin" DATETIME,
    "lastCare" DATETIME,
    "cookiesJson" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Account_proxyId_fkey" FOREIGN KEY ("proxyId") REFERENCES "Proxy" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Account_gpmloginProfileId_fkey" FOREIGN KEY ("gpmloginProfileId") REFERENCES "Profile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Proxy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "rawProxy" TEXT NOT NULL,
    "proxyServerUrl" TEXT,
    "ipBefore" TEXT,
    "ipAfter" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastCheck" DATETIME,
    "lastReset" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "profileUid" TEXT NOT NULL,
    "proxyId" TEXT,
    "groupId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "remoteDebuggingPort" INTEGER,
    "autoResetIp" BOOLEAN NOT NULL DEFAULT false,
    "lastOpened" DATETIME,
    "lastClosed" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Profile_proxyId_fkey" FOREIGN KEY ("proxyId") REFERENCES "Proxy" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT,
    "module" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metaJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Log_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ModuleStatus" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "lastRun" DATETIME,
    "detailJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ModuleStatus_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ModuleConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "configJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "Account_accountType_idx" ON "Account"("accountType");

-- CreateIndex
CREATE INDEX "Account_status_idx" ON "Account"("status");

-- CreateIndex
CREATE INDEX "Account_gpmloginProfileId_idx" ON "Account"("gpmloginProfileId");

-- CreateIndex
CREATE INDEX "Account_proxyId_idx" ON "Account"("proxyId");

-- CreateIndex
CREATE INDEX "Proxy_status_idx" ON "Proxy"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_profileUid_key" ON "Profile"("profileUid");

-- CreateIndex
CREATE INDEX "Profile_profileUid_idx" ON "Profile"("profileUid");

-- CreateIndex
CREATE INDEX "Profile_status_idx" ON "Profile"("status");

-- CreateIndex
CREATE INDEX "Profile_proxyId_idx" ON "Profile"("proxyId");

-- CreateIndex
CREATE INDEX "Profile_groupId_idx" ON "Profile"("groupId");

-- CreateIndex
CREATE INDEX "Log_accountId_idx" ON "Log"("accountId");

-- CreateIndex
CREATE INDEX "Log_module_idx" ON "Log"("module");

-- CreateIndex
CREATE INDEX "Log_type_idx" ON "Log"("type");

-- CreateIndex
CREATE INDEX "Log_createdAt_idx" ON "Log"("createdAt");

-- CreateIndex
CREATE INDEX "ModuleStatus_accountId_idx" ON "ModuleStatus"("accountId");

-- CreateIndex
CREATE INDEX "ModuleStatus_module_idx" ON "ModuleStatus"("module");

-- CreateIndex
CREATE INDEX "ModuleStatus_status_idx" ON "ModuleStatus"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ModuleStatus_accountId_module_key" ON "ModuleStatus"("accountId", "module");

-- CreateIndex
CREATE UNIQUE INDEX "ModuleConfig_name_key" ON "ModuleConfig"("name");
