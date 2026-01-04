#!/usr/bin/env bun
/**
 * Sign Windows executable using osslsigncode (self-signed certificate)
 * Requires: brew install osslsigncode
 * For distribution, use a certificate from a trusted CA (DigiCert, Sectigo, etc.)
 */
import { $ } from "bun";
import { existsSync } from "fs";
import { mkdir } from "fs/promises";
import path from "path";

const projectRoot = path.dirname(import.meta.dir);
const certsDir = path.join(projectRoot, "certs");
const executable = process.argv[2] ?? path.join(projectRoot, "dist", "i-migrate.exe");
const signedExecutable = executable.replace(/\.exe$/, "-signed.exe");

// Certificate files
const certPfx = path.join(certsDir, "self-signed.pfx");
const certKey = path.join(certsDir, "key.pem");
const certPem = path.join(certsDir, "cert.pem");

if (!existsSync(executable)) {
  console.error(`Error: Executable not found at ${executable}`);
  process.exit(1);
}

// Check if osslsigncode is installed
try {
  await $`which osslsigncode`.quiet();
} catch {
  console.error("Error: osslsigncode is not installed.");
  console.error("Install it with: brew install osslsigncode");
  process.exit(1);
}

// Create certs directory if it doesn't exist
if (!existsSync(certsDir)) {
  await mkdir(certsDir, { recursive: true });
}

// Generate self-signed certificate if it doesn't exist
if (!existsSync(certPfx)) {
  console.log("Generating self-signed certificate...");

  // Generate key and certificate
  await $`openssl req -x509 -newkey rsa:4096 \
    -keyout ${certKey} \
    -out ${certPem} \
    -days 365 \
    -nodes \
    -subj "/CN=i-migrate/O=Self-Signed/C=US"`;

  // Convert to PFX format
  await $`openssl pkcs12 -export \
    -out ${certPfx} \
    -inkey ${certKey} \
    -in ${certPem} \
    -passout pass:`;

  console.log(`Self-signed certificate created at ${certPfx}`);
  console.log("");
  console.log("Note: Self-signed certificates will trigger Windows SmartScreen warnings.");
  console.log("For distribution, obtain a certificate from a trusted CA.");
  console.log("");
}

console.log(`Signing ${executable}...`);

// Sign the executable using Bun.spawn for reliable argument passing
const signResult = Bun.spawnSync([
  "osslsigncode",
  "sign",
  "-pkcs12", certPfx,
  "-pass", "",
  "-n", "i-migrate",
  "-h", "sha256",
  "-in", executable,
  "-out", signedExecutable,
]);

if (signResult.exitCode !== 0) {
  console.error(signResult.stderr.toString());
  console.error("Failed");
  process.exit(1);
}

// Replace original with signed version
await $`mv ${signedExecutable} ${executable}`;

console.log("Verifying signature...");
// Use the self-signed cert as the CA for verification
await $`osslsigncode verify -CAfile ${certPem} ${executable}`;

console.log("Windows executable signed successfully!");
