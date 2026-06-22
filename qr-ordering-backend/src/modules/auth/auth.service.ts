import bcrypt from 'bcryptjs';

import { prisma } from '../../lib/prisma';
import { ApiError } from '../../lib/response';
import { signAdminToken } from '../../lib/jwt';
import { config } from '../../config/env';
import { slugify } from '../../lib/slug';
import { randomTableCode } from '../../lib/code';
import type { LoginInput, RegisterInput } from '../../validators/auth';

// New tenants start with a few tables so the floor isn't empty on day one.
const STARTER_TABLE_COUNT = 4;

// Account lockout: after this many consecutive failures the account is locked
// for LOCK_MINUTES. The per-IP loginLimiter is the complementary first layer.
const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;

// A real bcrypt hash compared against when the email is unknown, so an unknown
// account costs the same time as a known one (no enumeration via timing).
const DUMMY_HASH = bcrypt.hashSync('timing-equalizer', 10);

export async function login(input: LoginInput) {
  const user = await prisma.adminUser.findUnique({
    where: { email: input.email.toLowerCase() },
  });

  // Same error — and the same (deliberately slow) bcrypt cost — whether the
  // email is unknown or the password is wrong.
  if (!user) {
    await bcrypt.compare(input.password, DUMMY_HASH);
    throw ApiError.unauthorized('Invalid email or password');
  }

  // Temporarily locked out from too many recent failures.
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw ApiError.locked('Too many failed attempts. Please try again later.');
  }

  const ok = await bcrypt.compare(input.password, user.password);
  if (!ok) {
    // Atomic increment so concurrent failures each advance the counter exactly
    // once (a read-then-write would let parallel guesses pin it below the limit).
    const { failedLoginAttempts } = await prisma.adminUser.update({
      where: { id: user.id },
      data: { failedLoginAttempts: { increment: 1 } },
      select: { failedLoginAttempts: true },
    });
    if (failedLoginAttempts >= MAX_FAILED_LOGINS) {
      await prisma.adminUser.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) },
      });
      throw ApiError.locked(
        `Too many failed attempts. Account locked for ${LOCK_MINUTES} minutes.`,
      );
    }
    throw ApiError.unauthorized('Invalid email or password');
  }

  // Success — clear any prior failure state.
  if (user.failedLoginAttempts !== 0 || user.lockedUntil) {
    await prisma.adminUser.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
  }

  // Platform super-admin: the persisted DB flag, or granted by the
  // PLATFORM_ADMIN_EMAILS allowlist (persisted on first such login so it sticks).
  let isPlatformAdmin = user.isPlatformAdmin;
  if (!isPlatformAdmin && config.platformAdminEmails.includes(user.email.toLowerCase())) {
    isPlatformAdmin = true;
    await prisma.adminUser.update({ where: { id: user.id }, data: { isPlatformAdmin: true } });
  }

  const token = signAdminToken({
    sub: user.id,
    email: user.email,
    storeId: user.storeId,
    isPlatformAdmin,
  });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      storeId: user.storeId,
      isPlatformAdmin,
    },
  };
}

/** Field names a Prisma P2002 (unique violation) targeted, or [] if not a P2002. */
function p2002Target(err: unknown): string[] {
  const e = err as { code?: string; meta?: { target?: unknown } };
  if (e?.code !== 'P2002') return [];
  const t = e.meta?.target;
  return Array.isArray(t) ? t.map(String) : typeof t === 'string' ? [t] : [];
}

/**
 * Provision a new tenant: creates a Store + its first admin and a small starter
 * workspace (tables + one sample menu item) in a single transaction, then
 * returns a login token. There is no public self-serve signup route — tenants
 * are created by the super-admin (platform console) — so this is the internal
 * provisioning primitive, used by the seed and the integration-test factory.
 *
 * The unique indexes on Store.slug / Table.code / AdminUser.email are the real
 * guards. Two concurrent calls can still race to the same slug or table code,
 * so the whole transaction is retried on those collisions (the next attempt
 * picks the next free slug / fresh codes). An email collision can't be resolved
 * by retrying, so it's translated to a clean 409 instead.
 */
export async function registerStore(input: RegisterInput) {
  const email = input.email.toLowerCase();

  // Friendly pre-check (the email P2002 below is the race-safe backstop).
  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) throw ApiError.conflict('An account with this email already exists');

  const passwordHash = await bcrypt.hash(input.password, 10);
  const baseSlug = slugify(input.restaurantName) || 'store';

  for (let attempt = 0; ; attempt++) {
    try {
      const { admin, store } = await prisma.$transaction(async (tx) => {
        // Pick an unused slug (base, base-2, base-3, …).
        let slug = baseSlug;
        let n = 1;
        while (await tx.store.findUnique({ where: { slug } })) {
          n += 1;
          slug = `${baseSlug}-${n}`;
        }

        const store = await tx.store.create({
          data: {
            name: input.restaurantName.trim(),
            slug,
            // Start every new tenant on a trial; billing gates after it ends.
            trialEndsAt: new Date(Date.now() + config.billing.trialDays * 86_400_000),
          },
        });

        const admin = await tx.adminUser.create({
          data: {
            email,
            password: passwordHash,
            name: input.ownerName?.trim() || null,
            storeId: store.id,
          },
        });

        // Starter data so the new tenant has a usable, demoable workspace at
        // once: one sample menu item (editable/replaceable) and a few tables.
        const category = await tx.menuCategory.create({
          data: { storeId: store.id, name: 'Mains', sortOrder: 1 },
        });
        await tx.menuItem.create({
          data: {
            storeId: store.id,
            categoryId: category.id,
            name: 'Sample Dish',
            price: 10,
            sortOrder: 1,
          },
        });

        const usedCodes = new Set<string>();
        for (let i = 1; i <= STARTER_TABLE_COUNT; i++) {
          let code = randomTableCode();
          while (usedCodes.has(code) || (await tx.table.findUnique({ where: { code } }))) {
            code = randomTableCode();
          }
          usedCodes.add(code);
          await tx.table.create({ data: { storeId: store.id, name: `Table ${i}`, code } });
        }

        return { admin, store };
      });

      const token = signAdminToken({ sub: admin.id, email: admin.email, storeId: store.id });
      return {
        token,
        user: {
          id: admin.id,
          email: admin.email,
          name: admin.name,
          storeId: store.id,
          isPlatformAdmin: false,
        },
      };
    } catch (err) {
      const target = p2002Target(err);
      // Email collision can't be fixed by retrying — surface it cleanly.
      if (target.some((t) => t.includes('email'))) {
        throw ApiError.conflict('An account with this email already exists');
      }
      // Slug / table-code race — recompute and retry a bounded number of times.
      if (target.length > 0 && attempt < 4) continue;
      throw err;
    }
  }
}

export async function getProfile(adminId: string, isPlatformAdmin: boolean, imp?: string) {
  const user = await prisma.adminUser.findUnique({ where: { id: adminId } });
  if (!user) throw ApiError.unauthorized('Account no longer exists');
  // The session's platform-admin status is the TOKEN claim, not the DB flag —
  // so an impersonation token (isPlatformAdmin=false) is reflected here even
  // when its `sub` happens to be the operator's own account. `imp` (the operator
  // email) lets the UI reliably detect + label an impersonation session.
  return { id: user.id, email: user.email, name: user.name, isPlatformAdmin, imp: imp ?? null };
}

/**
 * Confirm the signed-in admin's password — gates manager-only actions.
 * Returns { ok } at 200 (a wrong password is NOT a 401, so the admin client
 * doesn't treat it as an expired session and log the user out).
 */
export async function verifyPassword(adminId: string, password: string) {
  const user = await prisma.adminUser.findUnique({ where: { id: adminId } });
  if (!user) throw ApiError.unauthorized('Account no longer exists');
  const ok = await bcrypt.compare(password, user.password);
  return { ok };
}
