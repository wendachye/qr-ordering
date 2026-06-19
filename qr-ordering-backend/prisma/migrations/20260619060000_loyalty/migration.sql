-- Loyalty program (additive, all columns defaulted; existing rows unaffected).

-- Store: per-tenant program configuration.
ALTER TABLE "Store"
  ADD COLUMN "loyaltyEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "pointsEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "stampsEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "earnRatePoints" DECIMAL(10,4) NOT NULL DEFAULT 1,
  ADD COLUMN "redeemRatePoints" INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN "minRedeemPoints" INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN "maxRedeemPercent" DECIMAL(5,2) NOT NULL DEFAULT 100,
  ADD COLUMN "pointsExpiryMonths" INTEGER,
  ADD COLUMN "welcomeBonusPoints" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "birthdayBonusPoints" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "stampThreshold" INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN "stampMinSpend" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "stampRewardType" TEXT,
  ADD COLUMN "stampRewardValue" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "stampRewardItemId" TEXT,
  ADD COLUMN "tierThresholds" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "tierBasis" TEXT NOT NULL DEFAULT 'LIFETIME_POINTS';

-- TableSession: the member attached to a tab + what they earned/redeemed.
ALTER TABLE "TableSession"
  ADD COLUMN "memberId" TEXT,
  ADD COLUMN "pointsEarned" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "pointsRedeemed" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "loyaltyDiscount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "rewardRedemptionId" TEXT;

-- Member: phone-identified loyalty member (unique per store).
CREATE TABLE "Member" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "name" TEXT,
  "birthday" DATE,
  "pointsBalance" INTEGER NOT NULL DEFAULT 0,
  "lifetimePoints" INTEGER NOT NULL DEFAULT 0,
  "lifetimeSpend" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "tier" TEXT NOT NULL DEFAULT 'BRONZE',
  "stampCount" INTEGER NOT NULL DEFAULT 0,
  "consentMarketing" BOOLEAN NOT NULL DEFAULT false,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- PointsLedger: immutable signed points ledger.
CREATE TABLE "PointsLedger" (
  "id" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "points" INTEGER NOT NULL,
  "reason" TEXT,
  "sessionId" TEXT,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PointsLedger_pkey" PRIMARY KEY ("id")
);

-- StampLedger: immutable stamp ledger (parallel currency).
CREATE TABLE "StampLedger" (
  "id" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "delta" INTEGER NOT NULL,
  "reason" TEXT,
  "sessionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StampLedger_pkey" PRIMARY KEY ("id")
);

-- RewardCatalog: admin-defined points-purchasable rewards.
CREATE TABLE "RewardCatalog" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "pointsCost" INTEGER NOT NULL,
  "type" TEXT NOT NULL,
  "value" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "menuItemId" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RewardCatalog_pkey" PRIMARY KEY ("id")
);

-- RewardRedemption: an issued reward instance, burned at settlement.
CREATE TABLE "RewardRedemption" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "catalogId" TEXT,
  "type" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "value" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "menuItemId" TEXT,
  "pointsSpent" INTEGER NOT NULL DEFAULT 0,
  "source" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ISSUED',
  "expiresAt" TIMESTAMP(3),
  "sessionId" TEXT,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RewardRedemption_pkey" PRIMARY KEY ("id")
);

-- OtpChallenge: phone OTP for customer self-serve verification.
CREATE TABLE "OtpChallenge" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OtpChallenge_pkey" PRIMARY KEY ("id")
);

-- LoyaltyJobRun: single-instance guard for daily loyalty jobs.
CREATE TABLE "LoyaltyJobRun" (
  "id" TEXT NOT NULL,
  "job" TEXT NOT NULL,
  "runDate" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LoyaltyJobRun_pkey" PRIMARY KEY ("id")
);

-- Indexes + unique constraints.
CREATE UNIQUE INDEX "Member_storeId_phone_key" ON "Member"("storeId", "phone");
CREATE INDEX "Member_storeId_idx" ON "Member"("storeId");
CREATE INDEX "Member_storeId_lastActivityAt_idx" ON "Member"("storeId", "lastActivityAt");
CREATE INDEX "PointsLedger_memberId_createdAt_idx" ON "PointsLedger"("memberId", "createdAt");
CREATE INDEX "PointsLedger_storeId_type_createdAt_idx" ON "PointsLedger"("storeId", "type", "createdAt");
CREATE INDEX "PointsLedger_sessionId_idx" ON "PointsLedger"("sessionId");
CREATE INDEX "StampLedger_memberId_createdAt_idx" ON "StampLedger"("memberId", "createdAt");
CREATE INDEX "StampLedger_sessionId_idx" ON "StampLedger"("sessionId");
CREATE INDEX "RewardCatalog_storeId_idx" ON "RewardCatalog"("storeId");
CREATE INDEX "RewardRedemption_storeId_idx" ON "RewardRedemption"("storeId");
CREATE INDEX "RewardRedemption_memberId_status_idx" ON "RewardRedemption"("memberId", "status");
CREATE INDEX "RewardRedemption_sessionId_idx" ON "RewardRedemption"("sessionId");
CREATE INDEX "OtpChallenge_storeId_phone_idx" ON "OtpChallenge"("storeId", "phone");
CREATE UNIQUE INDEX "LoyaltyJobRun_job_runDate_key" ON "LoyaltyJobRun"("job", "runDate");
CREATE INDEX "TableSession_memberId_idx" ON "TableSession"("memberId");

-- Foreign keys.
ALTER TABLE "TableSession" ADD CONSTRAINT "TableSession_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Member" ADD CONSTRAINT "Member_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PointsLedger" ADD CONSTRAINT "PointsLedger_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StampLedger" ADD CONSTRAINT "StampLedger_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RewardCatalog" ADD CONSTRAINT "RewardCatalog_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RewardRedemption" ADD CONSTRAINT "RewardRedemption_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RewardRedemption" ADD CONSTRAINT "RewardRedemption_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "RewardCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
