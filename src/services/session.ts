import { Effect, Context, Layer } from "effect"

// In-memory storage for passwords and IMIS tokens
// Passwords are entered by users per session and never persisted
// IMIS tokens are obtained from IMIS API and stored for subsequent calls

type SessionData = {
  password?: string
  imisToken?: string
  tokenExpiresAt?: number
}

// Service interface
export type SessionService = {
  readonly setPassword: (envId: string, password: string) => Effect.Effect<void>
  readonly getPassword: (envId: string) => Effect.Effect<string | undefined>
  readonly clearPassword: (envId: string) => Effect.Effect<void>
  readonly setImisToken: (envId: string, token: string, expiresAt: number) => Effect.Effect<void>
  readonly getImisToken: (envId: string) => Effect.Effect<string | undefined>
  readonly clearSession: (envId: string) => Effect.Effect<void>
  readonly clearAllSessions: () => Effect.Effect<void>
}

// Service tag
export const SessionService = Context.GenericTag<SessionService>("app/SessionService")

// Service implementation using in-memory Map
const makeSessionService = (): SessionService => {
  const sessions = new Map<string, SessionData>()

  const getOrCreateSession = (envId: string): SessionData => {
    if (!sessions.has(envId)) {
      sessions.set(envId, {})
    }
    return sessions.get(envId)!
  }

  return {
    setPassword: (envId: string, password: string) =>
      Effect.sync(() => {
        const session = getOrCreateSession(envId)
        session.password = password
      }),

    getPassword: (envId: string) =>
      Effect.sync(() => {
        return sessions.get(envId)?.password
      }),

    clearPassword: (envId: string) =>
      Effect.sync(() => {
        const session = sessions.get(envId)
        if (session) {
          delete session.password
        }
      }),

    setImisToken: (envId: string, token: string, expiresAt: number) =>
      Effect.sync(() => {
        const session = getOrCreateSession(envId)
        session.imisToken = token
        session.tokenExpiresAt = expiresAt
      }),

    getImisToken: (envId: string) =>
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

    clearSession: (envId: string) =>
      Effect.sync(() => {
        sessions.delete(envId)
      }),

    clearAllSessions: () =>
      Effect.sync(() => {
        sessions.clear()
      }),
  }
}

// Layer
export const SessionServiceLive = Layer.succeed(SessionService, makeSessionService())

