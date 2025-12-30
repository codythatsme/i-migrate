import { serve } from "bun"
import { Effect, Layer } from "effect"
import index from "./index.html"
import {
  PersistenceService,
  PersistenceServiceLive,
  DatabaseError,
  EnvironmentNotFoundError,
} from "./services/persistence"
import type { NewEnvironment } from "./db/schema"

// Create the runtime with all services
const MainLayer = Layer.merge(PersistenceServiceLive, Layer.empty)

// Helper to run Effect programs with the service layer
const runEffect = <A, E>(effect: Effect.Effect<A, E, PersistenceService>) =>
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
  },

  development: process.env.NODE_ENV !== "production" && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },
})

console.log(`🚀 Server running at ${server.url}`)
