"use client";

import { AppwriteException, OAuthProvider, type Models } from "appwrite";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { appwriteAccount } from "@/lib/appwrite";

interface AuthContextValue {
  user: Models.User<Models.Preferences> | null;
  isLoading: boolean;
  isProcessing: boolean;
  error: string | null;
  refresh: (options?: { silent?: boolean }) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Models.User<Models.Preferences> | null>(
    null
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!silent && isMountedRef.current) {
        setIsLoading(true);
      }

      try {
        const account = await appwriteAccount.get();
        if (!isMountedRef.current) return;

        setUser(account);
        setError(null);
      } catch (err) {
        if (!isMountedRef.current) return;

        if (err instanceof AppwriteException && err.code === 401) {
          setUser(null);
          setError(null);
          return;
        }

        console.error("Appwrite session fetch failed", err);
        setUser(null);
        setError("Impossible de vérifier votre session.");
      } finally {
        if (!silent && isMountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    refresh().catch((err) => {
      console.error("Initial auth refresh failed", err);
    });
  }, [refresh]);

  const signInWithGoogle = useCallback(async () => {
    if (typeof window === "undefined") return;

    setError(null);

    const origin = window.location.origin;
    const successUrl = `${origin}/`;
    const failureUrl = `${origin}/auth/error`;

    try {
      await appwriteAccount.createOAuth2Session({
        provider: OAuthProvider.Google,
        success: successUrl,
        failure: failureUrl,
      });
    } catch (err) {
      console.error("Google OAuth initialisation failed", err);

      if (isMountedRef.current) {
        setError("Impossible de démarrer l'authentification Google.");
      }
    }
  }, []);

  const signOut = useCallback(async () => {
    setError(null);
    if (isMountedRef.current) {
      setIsProcessing(true);
    }

    try {
      await appwriteAccount.deleteSession("current");
    } catch (err) {
      console.error("Appwrite sign-out failed", err);
      if (isMountedRef.current) {
        setError("Impossible de vous déconnecter.");
      }
    } finally {
      if (isMountedRef.current) {
        setIsProcessing(false);
      }
    }

    await refresh({ silent: true });
  }, [refresh]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isProcessing,
      error,
      refresh,
      signInWithGoogle,
      signOut,
    }),
    [error, isLoading, isProcessing, refresh, signInWithGoogle, signOut, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
