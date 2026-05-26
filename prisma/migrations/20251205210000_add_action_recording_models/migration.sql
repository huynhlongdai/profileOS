-- CreateTable
CREATE TABLE "ActionRecording" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "accountType" TEXT,
    "url" TEXT,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "author" TEXT,
    "tags" TEXT,
    "actionsJson" TEXT NOT NULL,
    "actionCount" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ActionRecordingRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recordingId" TEXT NOT NULL,
    "accountId" TEXT,
    "profileId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'running',
    "currentActionIndex" INTEGER NOT NULL DEFAULT 0,
    "totalActions" INTEGER NOT NULL DEFAULT 0,
    "successfulActions" INTEGER NOT NULL DEFAULT 0,
    "failedActions" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "durationMs" INTEGER,
    "logsJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActionRecordingRun_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "ActionRecording" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ActionRecording_accountType_idx" ON "ActionRecording"("accountType");

-- CreateIndex
CREATE INDEX "ActionRecording_status_idx" ON "ActionRecording"("status");

-- CreateIndex
CREATE INDEX "ActionRecording_name_idx" ON "ActionRecording"("name");

-- CreateIndex
CREATE INDEX "ActionRecordingRun_recordingId_idx" ON "ActionRecordingRun"("recordingId");

-- CreateIndex
CREATE INDEX "ActionRecordingRun_accountId_idx" ON "ActionRecordingRun"("accountId");

-- CreateIndex
CREATE INDEX "ActionRecordingRun_status_idx" ON "ActionRecordingRun"("status");

-- CreateIndex
CREATE INDEX "ActionRecordingRun_startedAt_idx" ON "ActionRecordingRun"("startedAt");

