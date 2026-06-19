-- Per-tenant Stripe billing state on the Store (one subscription per tenant).
CREATE TYPE "BillingStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED');

ALTER TABLE "Store" ADD COLUMN "stripeCustomerId" TEXT;
ALTER TABLE "Store" ADD COLUMN "stripeSubscriptionId" TEXT;
ALTER TABLE "Store" ADD COLUMN "plan" TEXT;
ALTER TABLE "Store" ADD COLUMN "subscriptionStatus" "BillingStatus" NOT NULL DEFAULT 'TRIALING';
ALTER TABLE "Store" ADD COLUMN "trialEndsAt" TIMESTAMP(3);
ALTER TABLE "Store" ADD COLUMN "currentPeriodEnd" TIMESTAMP(3);
