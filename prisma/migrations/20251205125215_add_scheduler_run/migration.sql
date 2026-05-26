-- CreateTable
CREATE TABLE "SchedulerRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scheduleId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "accountsEnqueued" INTEGER NOT NULL DEFAULT 0,
    "accountsProcessed" INTEGER,
    "errorMessage" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "durationMs" INTEGER,
    "metaJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SchedulerRun_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "ModuleSchedule" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SchedulerRun_scheduleId_idx" ON "SchedulerRun"("scheduleId");

-- CreateIndex
CREATE INDEX "SchedulerRun_status_idx" ON "SchedulerRun"("status");

-- CreateIndex
CREATE INDEX "SchedulerRun_startedAt_idx" ON "SchedulerRun"("startedAt");

