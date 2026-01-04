/**
 * Integration tests for encryption module.
 * Tests runtime behaviors that types cannot verify:
 * - Round-trip encryption/decryption
 * - Error handling for wrong passwords
 * - Randomness of salt/IV
 * - JSON serialization edge cases
 */

import { describe, it, expect } from "bun:test"
import { encrypt, decrypt, encryptJson, decryptJson } from "../src/lib/encryption"

describe("Encryption", () => {
  describe("encrypt/decrypt round-trip", () => {
    it("should return original plaintext after encrypt -> decrypt", async () => {
      const original = "Hello, World!"
      const password = "test-password-123"

      const encrypted = await encrypt(original, password)
      const decrypted = await decrypt(encrypted, password)

      expect(decrypted).toBe(original)
    })

    it("should work with unicode characters", async () => {
      const original = "Hello, 世界! 🌍 مرحبا"
      const password = "unicode-password"

      const encrypted = await encrypt(original, password)
      const decrypted = await decrypt(encrypted, password)

      expect(decrypted).toBe(original)
    })

    it("should work with empty string", async () => {
      const original = ""
      const password = "empty-string-password"

      const encrypted = await encrypt(original, password)
      const decrypted = await decrypt(encrypted, password)

      expect(decrypted).toBe(original)
    })

    it("should work with very long strings", async () => {
      const original = "a".repeat(100_000)
      const password = "long-string-password"

      const encrypted = await encrypt(original, password)
      const decrypted = await decrypt(encrypted, password)

      expect(decrypted).toBe(original)
    })

    it("should work with special characters", async () => {
      const original = "!@#$%^&*()_+-=[]{}|;':\",./<>?\n\t\r"
      const password = "special-chars-password"

      const encrypted = await encrypt(original, password)
      const decrypted = await decrypt(encrypted, password)

      expect(decrypted).toBe(original)
    })
  })

  describe("Wrong password", () => {
    it("should throw when decrypting with wrong password", async () => {
      const encrypted = await encrypt("secret message", "correct-password")

      await expect(decrypt(encrypted, "wrong-password")).rejects.toThrow()
    })

    it("should throw when password is slightly different", async () => {
      const encrypted = await encrypt("secret message", "password123")

      await expect(decrypt(encrypted, "password124")).rejects.toThrow()
    })
  })

  describe("Randomness", () => {
    it("should produce different ciphertext for same plaintext (random salt/IV)", async () => {
      const plaintext = "same message"
      const password = "password"

      const encrypted1 = await encrypt(plaintext, password)
      const encrypted2 = await encrypt(plaintext, password)

      expect(encrypted1).not.toBe(encrypted2)
    })

    it("should produce different ciphertext every time", async () => {
      const plaintext = "test"
      const password = "pw"
      const results = new Set<string>()

      for (let i = 0; i < 10; i++) {
        results.add(await encrypt(plaintext, password))
      }

      expect(results.size).toBe(10)
    })
  })

  describe("encryptJson/decryptJson", () => {
    it("should handle simple objects", async () => {
      const original = { name: "John", age: 30 }
      const password = "json-password"

      const encrypted = await encryptJson(original, password)
      const decrypted = await decryptJson<typeof original>(encrypted, password)

      expect(decrypted).toEqual(original)
    })

    it("should handle complex nested objects", async () => {
      const original = {
        name: "John",
        nested: {
          items: [1, 2, 3],
          deep: { value: "test" },
        },
        nullValue: null,
        boolValue: true,
      }
      const password = "complex-json-password"

      const encrypted = await encryptJson(original, password)
      const decrypted = await decryptJson<typeof original>(encrypted, password)

      expect(decrypted).toEqual(original)
    })

    it("should handle arrays", async () => {
      const original = [1, "two", { three: 3 }, null, true]
      const password = "array-password"

      const encrypted = await encryptJson(original, password)
      const decrypted = await decryptJson<typeof original>(encrypted, password)

      expect(decrypted).toEqual(original)
    })

    it("should handle empty objects and arrays", async () => {
      const emptyObject = {}
      const emptyArray: unknown[] = []
      const password = "empty-password"

      const encryptedObj = await encryptJson(emptyObject, password)
      const encryptedArr = await encryptJson(emptyArray, password)

      expect(await decryptJson(encryptedObj, password)).toEqual({})
      expect(await decryptJson(encryptedArr, password)).toEqual([])
    })
  })

  describe("Corrupted data", () => {
    it("should throw when ciphertext is corrupted", async () => {
      const encrypted = await encrypt("secret", "password")
      // Corrupt the end of the ciphertext (where auth tag is)
      const corrupted = encrypted.slice(0, -5) + "XXXXX"

      await expect(decrypt(corrupted, "password")).rejects.toThrow()
    })

    it("should throw when base64 is invalid", async () => {
      await expect(decrypt("not-valid-base64!!!", "password")).rejects.toThrow()
    })

    it("should throw when encrypted data is truncated", async () => {
      const encrypted = await encrypt("secret", "password")
      // Truncate to less than salt + iv length
      const truncated = encrypted.slice(0, 10)

      await expect(decrypt(truncated, "password")).rejects.toThrow()
    })

    it("should throw when encrypted data is empty", async () => {
      await expect(decrypt("", "password")).rejects.toThrow()
    })
  })

  describe("Edge cases", () => {
    it("should handle password with unicode characters", async () => {
      const original = "secret message"
      const password = "密码🔐パスワード"

      const encrypted = await encrypt(original, password)
      const decrypted = await decrypt(encrypted, password)

      expect(decrypted).toBe(original)
    })

    it("should handle very long passwords", async () => {
      const original = "secret message"
      const password = "x".repeat(10_000)

      const encrypted = await encrypt(original, password)
      const decrypted = await decrypt(encrypted, password)

      expect(decrypted).toBe(original)
    })

    it("should handle empty password", async () => {
      const original = "secret message"
      const password = ""

      const encrypted = await encrypt(original, password)
      const decrypted = await decrypt(encrypted, password)

      expect(decrypted).toBe(original)
    })
  })
})
