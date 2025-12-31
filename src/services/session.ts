import { Effect, Layer } from "effect"

// ---------------------
// Types
// ---------------------

// In-memory storage for passwords and IMIS tokens
// Passwords are entered by users per session and never persisted
// IMIS tokens are obtained from IMIS API and stored for subsequent calls
type SessionData = {
  password?: string
  imisToken?: string
  tokenExpiresAt?: number
}

// ---------------------
// Module-level session store (persists across all requests)
// ---------------------
const sessions = new Map<string, SessionData>()

const getOrCreateSession = (envId: string): SessionData => {
  if (!sessions.has(envId)) {
    sessions.set(envId, {})
  }
  return sessions.get(envId)!
}

// ---------------------
// Service Definition
// ---------------------

// Using the modern Effect.Service pattern (Effect 3.9+)
export class SessionService extends Effect.Service<SessionService>()("app/SessionService", {
  accessors: true,

  sync: () => {
    return {
      setPassword: (envId: string, password: string): Effect.Effect<void> =>
        Effect.sync(() => {
          const session = getOrCreateSession(envId)
          session.password = password
        }),

      getPassword: (envId: string): Effect.Effect<string | undefined> =>
        Effect.sync(() => {
          return sessions.get(envId)?.password
        }),

      clearPassword: (envId: string): Effect.Effect<void> =>
        Effect.sync(() => {
          const session = sessions.get(envId)
          if (session) {
            delete session.password
          }
        }),

      setImisToken: (envId: string, token: string, expiresAt: number): Effect.Effect<void> =>
        Effect.sync(() => {
          const session = getOrCreateSession(envId)
          session.imisToken = token
          session.tokenExpiresAt = expiresAt
        }),

      getImisToken: (envId: string): Effect.Effect<string | undefined> =>
        Effect.sync(() => {
          const session = sessions.get(envId)
          if (!session?.imisToken) return undefined

          // Check if token is expired
          if (session.tokenExpiresAt && Date.now() > session.tokenExpiresAt) {
            delete session.imisToken
            delete session.tokenExpiresAt
            return undefined
          }

          return session.imisToken
        }),

      clearSession: (envId: string): Effect.Effect<void> =>
        Effect.sync(() => {
          sessions.delete(envId)
        }),

      clearAllSessions: (): Effect.Effect<void> =>
        Effect.sync(() => {
          sessions.clear()
        }),
    }
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
    })
  )
}

// ---------------------
// Convenience Alias (for backward compatibility)
// ---------------------

export const SessionServiceLive = SessionService.Default

