"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { authApi, outletsApi, platformOutletsApi } from "@/lib/endpoints";
import { clearToken, getToken, setToken } from "@/lib/api";
import type { AuthUser } from "@/lib/types";

// While impersonating, the operator's real token is parked here and the active
// token (qr_admin_token) is the short-lived outlet token.
const REAL_TOKEN_KEY = "qr_admin_real_token";
const IMP_OUTLET_KEY = "qr_admin_imp_outlet";

interface AuthContextValue {
  user: AuthUser | null;
  status: "loading" | "authenticated" | "unauthenticated";
  // Set when the operator is "viewing as" an outlet.
  impersonating: { outletName: string } | null;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (payload: {
    restaurantName: string;
    email: string;
    password: string;
    ownerName?: string;
  }) => Promise<void>;
  logout: () => void;
  impersonate: (storeId: string, outletName: string) => Promise<void>;
  exitImpersonation: () => Promise<void>;
  // A client owner switching to one of their other outlets (full session swap).
  switchOutlet: (storeId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readImpersonation(): { outletName: string } | null {
  if (typeof window === "undefined") return null;
  if (!window.localStorage.getItem(REAL_TOKEN_KEY)) return null;
  return { outletName: window.localStorage.getItem(IMP_OUTLET_KEY) || "outlet" };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthContextValue["status"]>("loading");
  const [impersonating, setImpersonating] = useState<{ outletName: string } | null>(null);

  // On mount, validate any stored token via /admin/auth/me.
  useEffect(() => {
    let active = true;
    const token = getToken();
    if (!token) {
      setStatus("unauthenticated");
      return;
    }
    authApi
      .me()
      .then((u) => {
        if (!active) return;
        setUser(u);
        setImpersonating(readImpersonation());
        setStatus("authenticated");
      })
      .catch(() => {
        if (!active) return;
        clearToken();
        setUser(null);
        setStatus("unauthenticated");
      });
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    setToken(res.token);
    setUser(res.user);
    setImpersonating(null);
    setStatus("authenticated");
    return res.user;
  }, []);

  const register = useCallback(
    async (payload: {
      restaurantName: string;
      email: string;
      password: string;
      ownerName?: string;
    }) => {
      const res = await authApi.register(payload);
      setToken(res.token);
      setUser(res.user);
      setStatus("authenticated");
    },
    []
  );

  const clearImpersonationKeys = () => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(REAL_TOKEN_KEY);
    window.localStorage.removeItem(IMP_OUTLET_KEY);
  };

  const logout = useCallback(() => {
    clearToken();
    clearImpersonationKeys();
    setUser(null);
    setImpersonating(null);
    setStatus("unauthenticated");
    router.replace("/admin/login");
  }, [router]);

  // Operator "view as" an outlet: swap the active token for a scoped outlet
  // token, parking the real token to restore on exit.
  const impersonate = useCallback(
    async (storeId: string, outletName: string) => {
      const res = await platformOutletsApi.impersonate(storeId);
      const real = getToken();
      if (real && typeof window !== "undefined") {
        window.localStorage.setItem(REAL_TOKEN_KEY, real);
        window.localStorage.setItem(IMP_OUTLET_KEY, outletName);
      }
      setToken(res.token);
      const u = await authApi.me();
      setUser(u);
      setImpersonating({ outletName });
      setStatus("authenticated");
      router.replace("/admin/floor");
    },
    [router]
  );

  const exitImpersonation = useCallback(async () => {
    const real =
      typeof window !== "undefined" ? window.localStorage.getItem(REAL_TOKEN_KEY) : null;
    if (real) setToken(real);
    clearImpersonationKeys();
    setImpersonating(null);
    try {
      const u = await authApi.me();
      setUser(u);
      setStatus("authenticated");
    } catch {
      clearToken();
      setUser(null);
      setStatus("unauthenticated");
    }
    router.replace("/platform/clients");
  }, [router]);

  // Client owner switches to a sibling outlet: swap in the new scoped token and
  // hard-reload into the floor so every query refetches for the new outlet.
  const switchOutlet = useCallback(async (storeId: string) => {
    const res = await outletsApi.switch(storeId);
    setToken(res.token);
    if (typeof window !== "undefined") window.location.href = "/admin/floor";
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        status,
        impersonating,
        login,
        register,
        logout,
        impersonate,
        exitImpersonation,
        switchOutlet,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
