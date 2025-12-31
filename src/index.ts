import { serve } from "bun"
import { Effect, Layer } from "effect"
import index from "./index.html"
import {
  PersistenceService,
  PersistenceServiceLive,
  DatabaseError,
  EnvironmentNotFoundError,
} from "./services/persistence"
import { SessionService, SessionServiceLive } from "./services/session"
import {
  ImisApiService,
  ImisApiServiceLive,
  ImisAuthError,
  ImisRequestError,
  ImisResponseError,
  MissingCredentialsError,
} from "./services/imis-api"
import type { NewEnvironment } from "./db/schema"

// Create the runtime with all services
const MainLayer = Layer.mergeAll(PersistenceServiceLive, SessionServiceLive, ImisApiServiceLive)

// Helper to run Effect programs with the service layer
const runEffect = <A, E>(effect: Effect.Effect<A, E, PersistenceService | SessionService | ImisApiService>) =>
  Effect.runPromise(Effect.provide(effect, MainLayer))

// Helper to generate UUIDs
const generateId = () => crypto.randomUUID()

// Helper to create error responses
const errorResponse = (message: string, status: number) =>
  Response.json({ error: message }, { status })

const server = serve({
  routes: {
    // Serve index.html for all unmatched routes (SPA fallback)
    "/*": index,

    // ============================================
    // Environment API Routes
    // ============================================

    "/api/environments": {
      // GET /api/environments - List all environments
      async GET() {
        try {
          const environments = await runEffect(
            Effect.gen(function* () {
              const persistence = yield* PersistenceService
              return yield* persistence.getEnvironments()
            })
          )
          return Response.json(environments)
        } catch (error) {
          console.error("Failed to fetch environments:", error)
          return errorResponse("Failed to fetch environments", 500)
        }
      },

      // POST /api/environments - Create a new environment
      async POST(req) {
        try {
          const body = await req.json()

          // Validate required fields
          if (!body.name || !body.baseUrl || !body.username) {
            return errorResponse("Missing required fields: name, baseUrl, username", 400)
          }

          const now = new Date().toISOString()
          const newEnv: NewEnvironment = {
            id: generateId(),
            name: body.name,
            baseUrl: body.baseUrl,
            username: body.username,
            createdAt: now,
            updatedAt: now,
          }

          const created = await runEffect(
            Effect.gen(function* () {
              const persistence = yield* PersistenceService
              return yield* persistence.createEnvironment(newEnv)
            })
          )

          return Response.json(created, { status: 201 })
        } catch (error) {
          console.error("Failed to create environment:", error)
          return errorResponse("Failed to create environment", 500)
        }
      },
    },

    "/api/environments/:id": {
      // GET /api/environments/:id - Get a single environment
      async GET(req) {
        const { id } = req.params

        try {
          const environment = await runEffect(
            Effect.gen(function* () {
              const persistence = yield* PersistenceService
              return yield* persistence.getEnvironmentById(id)
            })
          )
          return Response.json(environment)
        } catch (error) {
          if (error instanceof EnvironmentNotFoundError) {
            return errorResponse(`Environment not found: ${id}`, 404)
          }
          console.error("Failed to fetch environment:", error)
          return errorResponse("Failed to fetch environment", 500)
        }
      },

      // PUT /api/environments/:id - Update an environment
      async PUT(req) {
        const { id } = req.params

        try {
          const body = await req.json()

          // Only allow updating specific fields
          const updates: Partial<{ name: string; baseUrl: string; username: string }> = {}
          if (body.name !== undefined) updates.name = body.name
          if (body.baseUrl !== undefined) updates.baseUrl = body.baseUrl
          if (body.username !== undefined) updates.username = body.username

          if (Object.keys(updates).length === 0) {
            return errorResponse("No valid fields to update", 400)
          }

          const updated = await runEffect(
            Effect.gen(function* () {
              const persistence = yield* PersistenceService
              return yield* persistence.updateEnvironment(id, updates)
            })
          )

          return Response.json(updated)
        } catch (error) {
          if (error instanceof EnvironmentNotFoundError) {
            return errorResponse(`Environment not found: ${id}`, 404)
          }
          console.error("Failed to update environment:", error)
          return errorResponse("Failed to update environment", 500)
        }
      },

      // DELETE /api/environments/:id - Delete an environment
      async DELETE(req) {
        const { id } = req.params

        try {
          await runEffect(
            Effect.gen(function* () {
              const persistence = yield* PersistenceService
              const session = yield* SessionService
              // Clear session data (password, tokens) when environment is deleted
              yield* session.clearSession(id)
              return yield* persistence.deleteEnvironment(id)
            })
          )

          return new Response(null, { status: 204 })
        } catch (error) {
          if (error instanceof EnvironmentNotFoundError) {
            return errorResponse(`Environment not found: ${id}`, 404)
          }
          console.error("Failed to delete environment:", error)
          return errorResponse("Failed to delete environment", 500)
        }
      },
    },

    // ============================================
    // Password API Routes (server-side in-memory storage)
    // ============================================

    "/api/environments/:id/password": {
      // POST /api/environments/:id/password - Set password for an environment
      async POST(req) {
        const { id } = req.params

        try {
          const body = await req.json()

          if (!body.password || typeof body.password !== "string") {
            return errorResponse("Missing required field: password", 400)
          }

          await runEffect(
            Effect.gen(function* () {
              // Verify environment exists first
              const persistence = yield* PersistenceService
              yield* persistence.getEnvironmentById(id)

              // Store password in server-side memory
              const session = yield* SessionService
              yield* session.setPassword(id, body.password)
            })
          )

          return Response.json({ success: true })
        } catch (error) {
          if (error instanceof EnvironmentNotFoundError) {
            return errorResponse(`Environment not found: ${id}`, 404)
          }
          console.error("Failed to set password:", error)
          return errorResponse("Failed to set password", 500)
        }
      },

      // DELETE /api/environments/:id/password - Clear password for an environment
      async DELETE(req) {
        const { id } = req.params

        try {
          await runEffect(
            Effect.gen(function* () {
              const session = yield* SessionService
              yield* session.clearPassword(id)
            })
          )

          return new Response(null, { status: 204 })
        } catch (error) {
          console.error("Failed to clear password:", error)
          return errorResponse("Failed to clear password", 500)
        }
      },
    },

    "/api/environments/:id/password/status": {
      // GET /api/environments/:id/password/status - Check if password is set (without exposing it)
      async GET(req) {
        const { id } = req.params

        try {
          const hasPassword = await runEffect(
            Effect.gen(function* () {
              const session = yield* SessionService
              const password = yield* session.getPassword(id)
              return password !== undefined
            })
          )

          return Response.json({ hasPassword })
        } catch (error) {
          console.error("Failed to check password status:", error)
          return errorResponse("Failed to check password status", 500)
        }
      },
    },

    // ============================================
    // Connection Test API Routes
    // ============================================

    "/api/environments/:id/test": {
      // POST /api/environments/:id/test - Test connection to IMIS environment
      async POST(req) {
        const { id } = req.params

        try {
          const result = await runEffect(
            Effect.gen(function* () {
              const imisApi = yield* ImisApiService
              return yield* imisApi.healthCheck(id)
            })
          )

          return Response.json(result)
        } catch (error: unknown) {
          // Effect errors have a _tag property for discrimination
          const tag = (error as { _tag?: string })?._tag
          const message = (error as { message?: string })?.message

          // Handle specific error types by their tag
          if (tag === "EnvironmentNotFoundError") {
            return errorResponse(`Environment not found: ${id}`, 404)
          }
          if (tag === "MissingCredentialsError") {
            return errorResponse("Password not set for this environment. Please set the password first.", 401)
          }
          if (tag === "ImisAuthError") {
            return errorResponse(message || "Authentication failed. Check your username and password.", 401)
          }
          if (tag === "ImisResponseError") {
            const status = (error as { status?: number })?.status || 500
            return errorResponse(message || `IMIS returned an error (status ${status})`, status)
          }
          if (tag === "ImisRequestError") {
            return errorResponse(message || "Failed to connect to IMIS. Check the base URL and network connectivity.", 503)
          }
          if (tag === "DatabaseError") {
            return errorResponse("Database error occurred", 500)
          }

          // Log unexpected errors for debugging
          console.error("Failed to test connection:", error)
          return errorResponse(message || "Connection test failed", 500)
        }
      },
    },
  },

  development: process.env.NODE_ENV !== "production" && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },
})

console.log(`🚀 Server running at ${server.url}`)
