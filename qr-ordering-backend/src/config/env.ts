import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ quiet: true });

const schema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  // How long an operator "view as" (impersonation) token is valid. Short by design.
  IMPERSONATION_TTL: z.string().default('15m'),
  PRINT_AGENT_API_KEY: z.string().min(1, 'PRINT_AGENT_API_KEY is required'),
  CORS_ORIGIN: z.string().default('*'),
  ORDER_NUMBER_BASE: z.coerce.number().default(1000),
  // Reliability / ops
  PRINT_MAX_RETRIES: z.coerce.number().default(5),
  ALERT_WEBHOOK_URL: z.string().optional(),
  // Upload storage: 'local' (disk) or 's3' (S3-compatible object storage).
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ENDPOINT: z.string().optional(), // for R2/MinIO/etc.; omit for AWS S3
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_PUBLIC_URL: z.string().optional(), // public/CDN base for object URLs
  // Observability
  LOG_LEVEL: z.string().default('info'),
  SENTRY_DSN: z.string().optional(),
  METRICS_TOKEN: z.string().optional(), // gate /metrics in production
  // Billing (Stripe) — unset = billing disabled (trial-only / dev mode)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_STARTER: z.string().optional(),
  STRIPE_PRICE_PRO: z.string().optional(),
  STRIPE_PRICE_BASIC: z.string().optional(),
  BILLING_TRIAL_DAYS: z.coerce.number().default(14),
  APP_URL: z.string().default('http://localhost:3001'), // admin app base for billing redirects
  // Comma-separated emails granted platform super-admin (can edit Plan configs).
  PLATFORM_ADMIN_EMAILS: z.string().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const env = parsed.data;

// Secret / CORS hardening. In production we refuse to start on weak or default
// values so an insecure deploy can never come up; in development we only warn.
const WEAK_SECRETS = new Set([
  '',
  'change-me',
  'changeme',
  'secret',
  'dev-secret',
  'your-secret',
  'secret-key',
  'password',
]);
const isWeakSecret = (v: string, min: number) =>
  v.length < min || WEAK_SECRETS.has(v.toLowerCase());

if (env.NODE_ENV === 'production') {
  const problems: string[] = [];
  if (isWeakSecret(env.JWT_SECRET, 32)) {
    problems.push('JWT_SECRET must be a strong, non-default value of at least 32 characters');
  }
  if (isWeakSecret(env.PRINT_AGENT_API_KEY, 16)) {
    problems.push(
      'PRINT_AGENT_API_KEY must be a strong, non-default value of at least 16 characters',
    );
  }
  const corsList = env.CORS_ORIGIN.split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (env.CORS_ORIGIN.trim() === '*') {
    problems.push('CORS_ORIGIN must be an explicit allowlist (not "*")');
  } else if (corsList.length === 0) {
    problems.push('CORS_ORIGIN must list at least one allowed origin');
  }
  if (problems.length > 0) {
    console.error(
      'Refusing to start — insecure production configuration:\n - ' + problems.join('\n - '),
    );
    process.exit(1);
  }
} else {
  const warnings: string[] = [];
  if (isWeakSecret(env.JWT_SECRET, 32)) warnings.push('JWT_SECRET is weak');
  if (env.CORS_ORIGIN.trim() === '*') warnings.push('CORS is open to all origins');
  if (warnings.length > 0) {
    console.warn(
      '[config] dev-only insecure settings (would fail in production): ' + warnings.join('; '),
    );
  }
}

// If S3 object storage is selected, its config must be complete (any environment).
if (env.STORAGE_DRIVER === 's3') {
  const missing = (
    ['S3_BUCKET', 'S3_REGION', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'] as const
  ).filter((k) => !env[k] || !String(env[k]).trim());
  if (missing.length > 0) {
    console.error('STORAGE_DRIVER=s3 requires: ' + missing.join(', '));
    process.exit(1);
  }
  // A custom endpoint (R2/MinIO) whose API host isn't publicly readable needs an
  // explicit public/CDN base, or stored image URLs won't resolve in browsers.
  if (env.S3_ENDPOINT?.trim() && !env.S3_PUBLIC_URL?.trim()) {
    console.warn(
      '[config] STORAGE_DRIVER=s3 with a custom S3_ENDPOINT but no S3_PUBLIC_URL — image URLs may not be publicly resolvable; set S3_PUBLIC_URL to your CDN/public base.',
    );
  }
}

export const config = {
  databaseUrl: env.DATABASE_URL,
  port: env.PORT,
  nodeEnv: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  jwtSecret: env.JWT_SECRET,
  jwtExpiresIn: env.JWT_EXPIRES_IN,
  impersonationTtl: env.IMPERSONATION_TTL,
  printAgentApiKey: env.PRINT_AGENT_API_KEY,
  // '*' means allow all; otherwise a list of allowed origins
  corsOrigin:
    env.CORS_ORIGIN === '*'
      ? '*'
      : env.CORS_ORIGIN.split(',')
          .map((o) => o.trim())
          .filter(Boolean),
  orderNumberBase: env.ORDER_NUMBER_BASE,
  printMaxRetries: env.PRINT_MAX_RETRIES,
  alertWebhookUrl: env.ALERT_WEBHOOK_URL?.trim() || undefined,
  storage: {
    driver: env.STORAGE_DRIVER,
    bucket: env.S3_BUCKET,
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT?.trim() || undefined,
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    publicUrl: env.S3_PUBLIC_URL?.trim() || undefined,
  },
  logLevel: env.LOG_LEVEL,
  sentryDsn: env.SENTRY_DSN?.trim() || undefined,
  metricsToken: env.METRICS_TOKEN?.trim() || undefined,
  billing: {
    trialDays: env.BILLING_TRIAL_DAYS,
    appUrl: env.APP_URL.replace(/\/$/, ''),
    stripeSecretKey: env.STRIPE_SECRET_KEY?.trim() || undefined,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET?.trim() || undefined,
    prices: {
      basic: env.STRIPE_PRICE_BASIC?.trim() || env.STRIPE_PRICE_STARTER?.trim() || undefined,
      pro: env.STRIPE_PRICE_PRO?.trim() || undefined,
    },
  },
  // Emails that get platform super-admin (edit the global Plan definitions).
  platformAdminEmails: (env.PLATFORM_ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
};
