import 'express';

declare global {
  namespace Express {
    interface Request {
      admin?: {
        id: string;
        email: string;
        storeId: string;
        isPlatformAdmin: boolean;
        imp?: string; // operator email when this is an impersonation token
      };
    }
  }
}

export {};
