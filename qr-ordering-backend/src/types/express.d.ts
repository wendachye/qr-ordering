import 'express';
import type { Role } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      admin?: {
        id: string;
        email: string;
        storeId: string;
        role: Role; // staff role (RBAC)
        isPlatformAdmin: boolean;
        imp?: string; // operator email when this is an impersonation token
      };
    }
  }
}

export {};
