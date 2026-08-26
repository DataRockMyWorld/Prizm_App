import * as SecureStore from "expo-secure-store";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { AuthTokens, Profile, getProfile } from "./auth";
import { establishSessionFromTokens, restoreSession } from "./sessionEstablishment";

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

  // Swallows failure — only safe here because this path refreshes an
  // *already-established* session (see refreshProfile below); a transient
  // failure shouldn't log out a user who was already in. Establishing a
  // session for the first time (mount-effect restore, setSession after
  // login) must NOT swallow — see sessionEstablishment.ts for why.
  const loadProfile = useCallback(async (token: string) => {
    try {
      const data = await getProfile(token);
      setProfileState(data);
    } catch {
      // Intentionally ignored — see comment above.
    }
  }, []);

  useEffect(() => {
    (async () => {
      const storedRefresh = await SecureStore.getItemAsync(REFRESH_KEY);
      if (storedRefresh) {
        const session = await restoreSession(storedRefresh);
        if (session) {
          setAccessToken(session.access);
          setRefreshToken(session.refresh);
          setProfileState(session.profile);
          await SecureStore.setItemAsync(ACCESS_KEY, session.access);
        } else {
          await SecureStore.deleteItemAsync(ACCESS_KEY);
          await SecureStore.deleteItemAsync(REFRESH_KEY);
        }
      }
      setIsLoading(false);
    })();
  }, []);

  const setSession = useCallback(async (tokens: AuthTokens) => {
    const session = await establishSessionFromTokens(tokens);
    setAccessToken(session.access);
    setRefreshToken(session.refresh);
    setProfileState(session.profile);
    await SecureStore.setItemAsync(ACCESS_KEY, session.access);
    await SecureStore.setItemAsync(REFRESH_KEY, session.refresh);
  }, []);

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
