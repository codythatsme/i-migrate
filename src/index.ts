import { serve } from "bun"
import { Layer } from "effect"
import { RpcServer, RpcSerialization } from "@effect/rpc"
import * as Etag from "@effect/platform/Etag"
import { BunFileSystem, BunPath, BunHttpPlatform } from "@effect/platform-bun"
import index from "./index.html"
import { ApiGroup } from "./api/procedures"
import { HandlersLive } from "./api/handlers"
import {
  PersistenceServiceLive,
} from "./services/persistence"
import { SessionServiceLive } from "./services/session"
import { ImisApiServiceLive } from "./services/imis-api"
import { TraceStoreServiceLive, TracerLive } from "./services/trace-store"
import { MigrationJobServiceLive } from "./services/migration-job"

// ---------------------
// Service Layers
// ---------------------

// Combine all service layers
const ServicesLive = Layer.mergeAll(
  PersistenceServiceLive,
  SessionServiceLive,
  ImisApiServiceLive,
  TraceStoreServiceLive,
  MigrationJobServiceLive
)

// Handlers layer with all dependencies
const HandlersWithDeps = HandlersLive.pipe(
  Layer.provide(ServicesLive)
)

// Platform layers for HTTP services (DefaultServices)
// Etag and BunHttpPlatform depend on FileSystem, so provide that first
const PlatformLive = Layer.mergeAll(
  BunFileSystem.layer,
  BunPath.layer
).pipe(
  Layer.provideMerge(Etag.layer),
  Layer.provideMerge(BunHttpPlatform.layer)
)

// Complete layer for RPC server
// TracerLive must be merged at the top level to set the tracer for all Effects
const RpcLive = Layer.mergeAll(
  HandlersWithDeps,
  RpcSerialization.layerJson,
  PlatformLive,
  TracerLive  // Sets the custom tracer for all Effect.withSpan calls
)

// ---------------------
// Create RPC Handler
// ---------------------

const { handler: rpcHandler, dispose } = RpcServer.toWebHandler(ApiGroup, {
  layer: RpcLive,
})

// ---------------------
// Bun Server
// ---------------------

const server = serve({
  port: 0, // Let OS pick an available port
  routes: {
    // RPC endpoint (must be before wildcard)
    "/rpc": {
      async POST(req) {
        return rpcHandler(req)
      },
    },
    // Serve index.html for all routes (SPA fallback) - works with single-file executables
    // when built using Bun.build's compile option with Tailwind plugin
    "/*": index,
  },

  development: process.env.NODE_ENV !== "production" && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },
})

// Open browser automatically (only on initial startup, not hot reloads)
if (!process.env.__BROWSER_OPENED__) {
  process.env.__BROWSER_OPENED__ = "1"
  const platform = process.platform
  const command =
    platform === "darwin" ? "open" : platform === "win32" ? "start" : "xdg-open"
  Bun.spawn([command, server.url.href], { stdio: ["ignore", "ignore", "ignore"] })
}

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🛑 Shutting down server...")
  await dispose()
  process.exit(0)
})

process.on("SIGTERM", async () => {
  console.log("\n🛑 Shutting down server...")
  await dispose()
  process.exit(0)
})

console.log(`🚀 Server running at ${server.url}`)
