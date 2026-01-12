/**
 * Encryption utilities for securing sensitive data in the database.
 * Uses AES-256-GCM via the Web Crypto API for authenticated encryption.
 */

// Constants
const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits recommended for GCM
const SALT_LENGTH = 16;
const ITERATIONS = 100000;

/**
 * Derives an AES-256 key from a password using PBKDF2.
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);

  // Import password as raw key material
  const keyMaterial = await crypto.subtle.importKey("raw", passwordBuffer, "PBKDF2", false, [
    "deriveBits",
    "deriveKey",
  ]);

  // Derive AES key using PBKDF2
  // Create a new ArrayBuffer copy to ensure correct type for Web Crypto API
  const saltBuffer = new ArrayBuffer(salt.byteLength);
  new Uint8Array(saltBuffer).set(salt);

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBuffer,
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * Encrypts data using AES-256-GCM with a password-derived key.
 *
 * @param data - The plaintext string to encrypt
 * @param password - The password to derive the encryption key from
 * @returns Base64-encoded string containing: salt (16 bytes) + iv (12 bytes) + ciphertext + auth tag
 */
export async function encrypt(data: string, password: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);

  // Generate random salt and IV
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  // Derive key from password
  const key = await deriveKey(password, salt);

  // Encrypt the data
  const ciphertext = await crypto.subtle.encrypt({ name: ALGORITHM, iv }, key, dataBuffer);

  // Combine salt + iv + ciphertext into a single buffer
  const combined = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(ciphertext), salt.length + iv.length);

  // Encode as base64 for storage (chunked to avoid stack overflow with large data)
  let binaryString = "";
  const chunkSize = 8192;
  for (let i = 0; i < combined.length; i += chunkSize) {
    const chunk = combined.subarray(i, Math.min(i + chunkSize, combined.length));
    binaryString += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binaryString);
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
  // Decode from base64 (iterative to avoid stack overflow with large data)
  const decoded = atob(encryptedData);
  const combined = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) {
    combined[i] = decoded.charCodeAt(i);
  }

  // Extract salt, iv, and ciphertext
  const salt = combined.slice(0, SALT_LENGTH);
  const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const ciphertext = combined.slice(SALT_LENGTH + IV_LENGTH);

  // Derive key from password
  const key = await deriveKey(password, salt);

  // Decrypt the data
  const decrypted = await crypto.subtle.decrypt({ name: ALGORITHM, iv }, key, ciphertext);

  // Decode the plaintext
  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

/**
 * Encrypts a JSON-serializable object.
 */
export async function encryptJson<T>(data: T, password: string): Promise<string> {
  const jsonString = JSON.stringify(data);
  return encrypt(jsonString, password);
}

/**
 * Decrypts data that was encrypted with encryptJson.
 */
export async function decryptJson<T>(encryptedData: string, password: string): Promise<T> {
  const jsonString = await decrypt(encryptedData, password);
  return JSON.parse(jsonString) as T;
}

// ---------------------
// Master Password Utilities
// ---------------------

/**
 * Hashes a password using SHA-256 for verification purposes.
 * This is NOT for encryption - only for verifying the master password is correct.
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = new Uint8Array(hashBuffer);
  // Convert to hex string
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Verifies a password against a stored hash.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const hash = await hashPassword(password);
  return hash === storedHash;
}

/**
 * Derives a stable encryption key from a master password.
 * Uses PBKDF2 with a fixed app-specific salt for consistent key derivation.
 * This allows the same password to always produce the same key.
 */
export async function deriveMasterKey(masterPassword: string): Promise<CryptoKey> {
  // Fixed salt for master password key derivation
  // This ensures the same password always derives the same key
  const APP_SALT = "i-migrate-master-key-v1";
  const encoder = new TextEncoder();
  const salt = encoder.encode(APP_SALT);

  const passwordBuffer = encoder.encode(masterPassword);

  const keyMaterial = await crypto.subtle.importKey("raw", passwordBuffer, "PBKDF2", false, [
    "deriveBits",
    "deriveKey",
  ]);

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * Encrypts data using a pre-derived CryptoKey.
 * Use this with deriveMasterKey() for master password encryption.
 */
export async function encryptWithKey(data: string, key: CryptoKey): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);

  // Generate random IV (no salt needed since key is pre-derived)
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  const ciphertext = await crypto.subtle.encrypt({ name: ALGORITHM, iv }, key, dataBuffer);

  // Combine iv + ciphertext
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);

  // Encode as base64
  let binaryString = "";
  const chunkSize = 8192;
  for (let i = 0; i < combined.length; i += chunkSize) {
    const chunk = combined.subarray(i, Math.min(i + chunkSize, combined.length));
    binaryString += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binaryString);
}

/**
 * Decrypts data using a pre-derived CryptoKey.
 * Use this with deriveMasterKey() for master password decryption.
 */
export async function decryptWithKey(encryptedData: string, key: CryptoKey): Promise<string> {
  const decoded = atob(encryptedData);
  const combined = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) {
    combined[i] = decoded.charCodeAt(i);
  }

  // Extract iv and ciphertext (no salt since key is pre-derived)
  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);

  const decrypted = await crypto.subtle.decrypt({ name: ALGORITHM, iv }, key, ciphertext);

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}
