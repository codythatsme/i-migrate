import { Effect, Layer } from "effect";

// ---------------------
// Types
// ---------------------

// In-memory storage for passwords and IMIS tokens
// Passwords can optionally be persisted encrypted (controlled by settings)
// IMIS tokens are obtained from IMIS API and stored for subsequent calls
type SessionData = {
  password?: string;
  imisToken?: string;
  tokenExpiresAt?: number;
};

// Master password state - stored in memory for the session
type MasterPasswordState = {
  password: string;
  derivedKey: CryptoKey;
} | null;

// ---------------------
// Module-level session store (persists across all requests)
// ---------------------
const sessions = new Map<string, SessionData>();
let masterPasswordState: MasterPasswordState = null;

const getOrCreateSession = (envId: string): SessionData => {
  if (!sessions.has(envId)) {
    sessions.set(envId, {});
  }
  return sessions.get(envId)!;
};

// ---------------------
// Service Definition
// ---------------------

// Using the modern Effect.Service pattern (Effect 3.9+)
export class SessionService extends Effect.Service<SessionService>()("app/SessionService", {
  accessors: true,

  sync: () => {
    return {
      setPassword: (envId: string, password: string) =>
        Effect.sync(() => {
          const session = getOrCreateSession(envId);
          session.password = password;
        }),

      getPassword: (envId: string) =>
        Effect.sync(() => {
          return sessions.get(envId)?.password;
        }),

      clearPassword: (envId: string) =>
        Effect.sync(() => {
          const session = sessions.get(envId);
          if (session) {
            delete session.password;
          }
        }),

      setImisToken: (envId: string, token: string, expiresAt: number) =>
        Effect.sync(() => {
          const session = getOrCreateSession(envId);
          session.imisToken = token;
          session.tokenExpiresAt = expiresAt;
        }),

      getImisToken: (envId: string) =>
        Effect.sync(() => {
          const session = sessions.get(envId);
          if (!session?.imisToken) return undefined;

          // Check if token is expired
          if (session.tokenExpiresAt && Date.now() > session.tokenExpiresAt) {
            delete session.imisToken;
            delete session.tokenExpiresAt;
            return undefined;
          }

          return session.imisToken;
        }),

      clearSession: (envId: string) =>
        Effect.sync(() => {
          sessions.delete(envId);
        }),

      clearAllSessions: () =>
        Effect.sync(() => {
          sessions.clear();
        }),

      // ---------------------
      // Master Password Methods
      // ---------------------

      setMasterPassword: (password: string, derivedKey: CryptoKey) =>
        Effect.sync(() => {
          masterPasswordState = { password, derivedKey };
        }),

      getMasterPassword: () =>
        Effect.sync(() => masterPasswordState),

      clearMasterPassword: () =>
        Effect.sync(() => {
          masterPasswordState = null;
        }),

      isMasterPasswordSet: () =>
        Effect.sync(() => masterPasswordState !== null),
    };
  },
}) {
  // Static Test layer with empty implementations
  static Test = Layer.succeed(
    this,
    new SessionService({
      setPassword: () => Effect.void,
      getPassword: () => Effect.succeed(undefined),
      clearPassword: () => Effect.void,
      setImisToken: () => Effect.void,
      getImisToken: () => Effect.succeed(undefined),
      clearSession: () => Effect.void,
      clearAllSessions: () => Effect.void,
      // Master password methods
      setMasterPassword: () => Effect.void,
      getMasterPassword: () => Effect.succeed(null),
      clearMasterPassword: () => Effect.void,
      isMasterPasswordSet: () => Effect.succeed(false),
    }),
  );
}

// ---------------------
// Convenience Alias (for backward compatibility)
// ---------------------

export const SessionServiceLive = SessionService.Default;
