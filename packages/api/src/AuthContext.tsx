import * as SecureStore from "expo-secure-store";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { AuthTokens, Profile, getProfile, refreshAccessToken } from "./auth";

const ACCESS_KEY = "prizm.accessToken";
const REFRESH_KEY = "prizm.refreshToken";

interface AuthContextValue {
  accessToken: string | null;
  refreshToken: string | null;
  profile: Profile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setSession: (tokens: AuthTokens) => Promise<void>;
  clearSession: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  setProfile: (profile: Profile) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [profile, setProfileState] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadProfile = useCallback(async (token: string) => {
    try {
      const data = await getProfile(token);
      setProfileState(data);
    } catch {
      // A failed profile fetch shouldn't crash the app — screens that need
      // it handle their own loading/error state.
    }
  }, []);

  useEffect(() => {
    (async () => {
      const storedRefresh = await SecureStore.getItemAsync(REFRESH_KEY);
      if (storedRefresh) {
        try {
          const { access } = await refreshAccessToken(storedRefresh);
          setAccessToken(access);
          setRefreshToken(storedRefresh);
          await SecureStore.setItemAsync(ACCESS_KEY, access);
          await loadProfile(access);
        } catch {
          await SecureStore.deleteItemAsync(ACCESS_KEY);
          await SecureStore.deleteItemAsync(REFRESH_KEY);
        }
      }
      setIsLoading(false);
    })();
  }, [loadProfile]);

  const setSession = useCallback(
    async (tokens: AuthTokens) => {
      setAccessToken(tokens.access);
      setRefreshToken(tokens.refresh);
      await SecureStore.setItemAsync(ACCESS_KEY, tokens.access);
      await SecureStore.setItemAsync(REFRESH_KEY, tokens.refresh);
      await loadProfile(tokens.access);
    },
    [loadProfile]
  );

  const clearSession = useCallback(async () => {
    setAccessToken(null);
    setRefreshToken(null);
    setProfileState(null);
    await SecureStore.deleteItemAsync(ACCESS_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (accessToken) {
      await loadProfile(accessToken);
    }
  }, [accessToken, loadProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      accessToken,
      refreshToken,
      profile,
      isLoading,
      isAuthenticated: Boolean(accessToken),
      setSession,
      clearSession,
      refreshProfile,
      setProfile: setProfileState,
    }),
    [accessToken, refreshToken, profile, isLoading, setSession, clearSession, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
