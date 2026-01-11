/**
 * Integration tests for session service.
 * Tests runtime behaviors that types cannot verify:
 * - Token expiration logic
 * - Session isolation between environments
 * - Clear session behavior
 */

import { describe, it, expect, beforeEach } from "bun:test"
import { Effect } from "effect"
import { SessionService } from "../src/services/session"

// Helper to run Effect programs with SessionService
const runWithSession = <A, E>(
  effect: Effect.Effect<A, E, SessionService>
): Promise<A> => {
  return Effect.runPromise(effect.pipe(Effect.provide(SessionService.Default)))
}

describe("SessionService", () => {
  // Clear all sessions before each test
  beforeEach(async () => {
    await runWithSession(SessionService.clearAllSessions())
  })

  describe("Password management", () => {
    it("should store and retrieve password", async () => {
      await runWithSession(SessionService.setPassword("env-1", "secret123"))

      const password = await runWithSession(SessionService.getPassword("env-1"))

      expect(password).toBe("secret123")
    })

    it("should return undefined for non-existent password", async () => {
      const password = await runWithSession(SessionService.getPassword("env-1"))

      expect(password).toBeUndefined()
    })

    it("should clear password", async () => {
      await runWithSession(SessionService.setPassword("env-1", "secret123"))
      await runWithSession(SessionService.clearPassword("env-1"))

      const password = await runWithSession(SessionService.getPassword("env-1"))

      expect(password).toBeUndefined()
    })

    it("should update password when set again", async () => {
      await runWithSession(SessionService.setPassword("env-1", "old-password"))
      await runWithSession(SessionService.setPassword("env-1", "new-password"))

      const password = await runWithSession(SessionService.getPassword("env-1"))

      expect(password).toBe("new-password")
    })
  })

  describe("Token management", () => {
    it("should store and retrieve token when not expired", async () => {
      const futureTime = Date.now() + 3600000 // 1 hour from now
      await runWithSession(
        SessionService.setImisToken("env-1", "token-abc", futureTime)
      )

      const token = await runWithSession(SessionService.getImisToken("env-1"))

      expect(token).toBe("token-abc")
    })

    it("should return undefined for non-existent token", async () => {
      const token = await runWithSession(SessionService.getImisToken("env-1"))

      expect(token).toBeUndefined()
    })

    it("should return undefined when token is expired", async () => {
      const pastTime = Date.now() - 1000 // 1 second ago
      await runWithSession(
        SessionService.setImisToken("env-1", "expired-token", pastTime)
      )

      const token = await runWithSession(SessionService.getImisToken("env-1"))

      expect(token).toBeUndefined()
    })

    it("should clear expired token on access", async () => {
      const pastTime = Date.now() - 1000
      await runWithSession(
        SessionService.setImisToken("env-1", "expired-token", pastTime)
      )

      // First access clears it
      await runWithSession(SessionService.getImisToken("env-1"))

      // Set a new password to ensure session still exists
      await runWithSession(SessionService.setPassword("env-1", "password"))

      // Token should still be undefined
      const token = await runWithSession(SessionService.getImisToken("env-1"))
      expect(token).toBeUndefined()
    })

    it("should return token that expires exactly at boundary", async () => {
      // Token that expires in the future
      const futureTime = Date.now() + 100
      await runWithSession(
        SessionService.setImisToken("env-1", "boundary-token", futureTime)
      )

      const token = await runWithSession(SessionService.getImisToken("env-1"))

      expect(token).toBe("boundary-token")
    })
  })

  describe("Session isolation", () => {
    it("should isolate passwords between environments", async () => {
      await runWithSession(SessionService.setPassword("env-1", "password1"))
      await runWithSession(SessionService.setPassword("env-2", "password2"))

      const password1 = await runWithSession(SessionService.getPassword("env-1"))
      const password2 = await runWithSession(SessionService.getPassword("env-2"))

      expect(password1).toBe("password1")
      expect(password2).toBe("password2")
    })

    it("should isolate tokens between environments", async () => {
      const futureTime = Date.now() + 3600000
      await runWithSession(
        SessionService.setImisToken("env-1", "token1", futureTime)
      )
      await runWithSession(
        SessionService.setImisToken("env-2", "token2", futureTime)
      )

      const token1 = await runWithSession(SessionService.getImisToken("env-1"))
      const token2 = await runWithSession(SessionService.getImisToken("env-2"))

      expect(token1).toBe("token1")
      expect(token2).toBe("token2")
    })

    it("should clear only specified environment session", async () => {
      await runWithSession(SessionService.setPassword("env-1", "password1"))
      await runWithSession(SessionService.setPassword("env-2", "password2"))

      await runWithSession(SessionService.clearSession("env-1"))

      const password1 = await runWithSession(SessionService.getPassword("env-1"))
      const password2 = await runWithSession(SessionService.getPassword("env-2"))

      expect(password1).toBeUndefined()
      expect(password2).toBe("password2")
    })

    it("should clear all sessions", async () => {
      await runWithSession(SessionService.setPassword("env-1", "password1"))
      await runWithSession(SessionService.setPassword("env-2", "password2"))
      await runWithSession(SessionService.setPassword("env-3", "password3"))

      await runWithSession(SessionService.clearAllSessions())

      const password1 = await runWithSession(SessionService.getPassword("env-1"))
      const password2 = await runWithSession(SessionService.getPassword("env-2"))
      const password3 = await runWithSession(SessionService.getPassword("env-3"))

      expect(password1).toBeUndefined()
      expect(password2).toBeUndefined()
      expect(password3).toBeUndefined()
    })
  })

  describe("Password and token coexistence", () => {
    it("should store both password and token in same session", async () => {
      const futureTime = Date.now() + 3600000
      await runWithSession(SessionService.setPassword("env-1", "password"))
      await runWithSession(
        SessionService.setImisToken("env-1", "token", futureTime)
      )

      const password = await runWithSession(SessionService.getPassword("env-1"))
      const token = await runWithSession(SessionService.getImisToken("env-1"))

      expect(password).toBe("password")
      expect(token).toBe("token")
    })

    it("should preserve password when token expires", async () => {
      const pastTime = Date.now() - 1000
      await runWithSession(SessionService.setPassword("env-1", "password"))
      await runWithSession(
        SessionService.setImisToken("env-1", "expired-token", pastTime)
      )

      // Access token (will clear it because expired)
      await runWithSession(SessionService.getImisToken("env-1"))

      // Password should still be there
      const password = await runWithSession(SessionService.getPassword("env-1"))
      expect(password).toBe("password")
    })

    it("should preserve token when password is cleared", async () => {
      const futureTime = Date.now() + 3600000
      await runWithSession(SessionService.setPassword("env-1", "password"))
      await runWithSession(
        SessionService.setImisToken("env-1", "token", futureTime)
      )

      await runWithSession(SessionService.clearPassword("env-1"))

      const password = await runWithSession(SessionService.getPassword("env-1"))
      const token = await runWithSession(SessionService.getImisToken("env-1"))

      expect(password).toBeUndefined()
      expect(token).toBe("token")
    })
  })

  describe("Edge cases", () => {
    it("should handle clearing non-existent session", async () => {
      // Should not throw
      await runWithSession(SessionService.clearSession("non-existent"))
    })

    it("should handle clearing password from non-existent session", async () => {
      // Should not throw
      await runWithSession(SessionService.clearPassword("non-existent"))
    })

    it("should handle empty password", async () => {
      await runWithSession(SessionService.setPassword("env-1", ""))

      const password = await runWithSession(SessionService.getPassword("env-1"))

      expect(password).toBe("")
    })

    it("should handle very long environment IDs", async () => {
      const longId = "a".repeat(1000)
      await runWithSession(SessionService.setPassword(longId, "password"))

      const password = await runWithSession(SessionService.getPassword(longId))

      expect(password).toBe("password")
    })
  })
})
