/**
 * Encryption utilities for securing sensitive data in the database.
 * Uses AES-256-GCM via the Web Crypto API for authenticated encryption.
 */

// Constants
const ALGORITHM = "AES-GCM"
const KEY_LENGTH = 256
const IV_LENGTH = 12 // 96 bits recommended for GCM
const SALT_LENGTH = 16
const ITERATIONS = 100000

/**
 * Derives an AES-256 key from a password using PBKDF2.
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const passwordBuffer = encoder.encode(password)

  // Import password as raw key material
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    passwordBuffer,
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  )

  // Derive AES key using PBKDF2
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  )
}

/**
 * Encrypts data using AES-256-GCM with a password-derived key.
 * 
 * @param data - The plaintext string to encrypt
 * @param password - The password to derive the encryption key from
 * @returns Base64-encoded string containing: salt (16 bytes) + iv (12 bytes) + ciphertext + auth tag
 */
export async function encrypt(data: string, password: string): Promise<string> {
  const encoder = new TextEncoder()
  const dataBuffer = encoder.encode(data)

  // Generate random salt and IV
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))

  // Derive key from password
  const key = await deriveKey(password, salt)

  // Encrypt the data
  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    dataBuffer
  )

  // Combine salt + iv + ciphertext into a single buffer
  const combined = new Uint8Array(salt.length + iv.length + ciphertext.byteLength)
  combined.set(salt, 0)
  combined.set(iv, salt.length)
  combined.set(new Uint8Array(ciphertext), salt.length + iv.length)

  // Encode as base64 for storage
  return btoa(String.fromCharCode(...combined))
}

/**
 * Decrypts data that was encrypted with the encrypt function.
 * 
 * @param encryptedData - Base64-encoded encrypted string
 * @param password - The password used during encryption
 * @returns The decrypted plaintext string
 * @throws Error if decryption fails (wrong password or corrupted data)
 */
export async function decrypt(encryptedData: string, password: string): Promise<string> {
  // Decode from base64
  const combined = new Uint8Array(
    atob(encryptedData)
      .split("")
      .map((c) => c.charCodeAt(0))
  )

  // Extract salt, iv, and ciphertext
  const salt = combined.slice(0, SALT_LENGTH)
  const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)
  const ciphertext = combined.slice(SALT_LENGTH + IV_LENGTH)

  // Derive key from password
  const key = await deriveKey(password, salt)

  // Decrypt the data
  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    ciphertext
  )

  // Decode the plaintext
  const decoder = new TextDecoder()
  return decoder.decode(decrypted)
}

/**
 * Encrypts a JSON-serializable object.
 */
export async function encryptJson<T>(data: T, password: string): Promise<string> {
  const jsonString = JSON.stringify(data)
  return encrypt(jsonString, password)
}

/**
 * Decrypts data that was encrypted with encryptJson.
 */
export async function decryptJson<T>(encryptedData: string, password: string): Promise<T> {
  const jsonString = await decrypt(encryptedData, password)
  return JSON.parse(jsonString) as T
}

