-- Track last-modified time on print jobs so the agent can apply retry backoff
-- and reclaim jobs stuck in PRINTING (agent crashed mid-print).
ALTER TABLE "PrintJob" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Index the "due jobs" query (status + recency).
CREATE INDEX "PrintJob_status_updatedAt_idx" ON "PrintJob"("status", "updatedAt");
