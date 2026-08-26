import { AuthTokens, Profile, getProfile, refreshAccessToken } from "./auth";

export interface EstablishedSession {
  access: string;
  refresh: string;
  profile: Profile;
}

/** Given a stored refresh token, produce a fully-usable session (a valid
 * access token *and* its profile) or null — never a partial result. Bundling
 * the profile fetch into session establishment (rather than letting a caller
 * mark the session "authenticated" from the access token alone and fetch the
 * profile as an afterthought) is deliberate: this app's screens branch on
 * "authenticated but profile still null" as a transient loading state, not a
 * terminal one, so producing that combination from a real failure here left
 * the app stuck on its splash screen forever with no recovery path — hit
 * live 2026-08-26 via a refresh token whose underlying account had been
 * deleted (the refresh itself still validated; the profile fetch 401'd). */
export async function restoreSession(storedRefresh: string): Promise<EstablishedSession | null> {
  try {
    const { access } = await refreshAccessToken(storedRefresh);
    const profile = await getProfile(access);
    return { access, refresh: storedRefresh, profile };
  } catch {
    return null;
  }
}

/** Same all-or-nothing contract as restoreSession, for the "just logged in"
 * path — a fresh access token from register()/login() is only turned into a
 * session once its profile is confirmed loadable. Throws (doesn't swallow)
 * on failure: the caller is mid-submit on a login/PIN screen with its own
 * try/catch and loading state already, so surfacing the error there is more
 * useful than silently doing nothing. */
export async function establishSessionFromTokens(tokens: AuthTokens): Promise<EstablishedSession> {
  const profile = await getProfile(tokens.access);
  return { access: tokens.access, refresh: tokens.refresh, profile };
}
