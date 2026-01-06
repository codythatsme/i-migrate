#!/usr/bin/env bun
/**
 * Bundle macOS executable into a proper .app bundle with icon and metadata
 */

import { existsSync, mkdirSync, rmSync, copyFileSync, writeFileSync, chmodSync } from "fs";
import path from "path";

const projectRoot = path.dirname(import.meta.dir);
const pkg = await Bun.file(path.join(projectRoot, "package.json")).json();

const APP_NAME = "i-migrate";
const BUNDLE_ID = "com.i-migrate.app";
const EXECUTABLE = path.join(projectRoot, "dist", "i-migrate");
const ICON = path.join(projectRoot, "assets", "AppIcon.icns");
const OUTPUT_APP = path.join(projectRoot, "dist", `${APP_NAME}.app`);

// App bundle structure
const CONTENTS = path.join(OUTPUT_APP, "Contents");
const MACOS = path.join(CONTENTS, "MacOS");
const RESOURCES = path.join(CONTENTS, "Resources");

function main() {
  console.log(`\n📦 Bundling ${APP_NAME}.app...\n`);

  // Verify input files exist
  if (!existsSync(EXECUTABLE)) {
    console.error(`❌ Error: Executable not found at ${EXECUTABLE}`);
    console.error("   Run 'bun run build:mac' first");
    process.exit(1);
  }

  if (!existsSync(ICON)) {
    console.error(`❌ Error: Icon not found at ${ICON}`);
    console.error("   Run 'bun run generate-icons' first");
    process.exit(1);
  }

  // Clean previous bundle
  if (existsSync(OUTPUT_APP)) {
    console.log("🗑️  Removing previous bundle...");
    rmSync(OUTPUT_APP, { recursive: true });
  }

  // Create directory structure
  console.log("📁 Creating bundle structure...");
  mkdirSync(MACOS, { recursive: true });
  mkdirSync(RESOURCES, { recursive: true });

  // Copy executable
  console.log("📋 Copying executable...");
  const executableDest = path.join(MACOS, APP_NAME);
  copyFileSync(EXECUTABLE, executableDest);
  chmodSync(executableDest, 0o755);

  // Copy icon
  console.log("🎨 Copying icon...");
  copyFileSync(ICON, path.join(RESOURCES, "AppIcon.icns"));

  // Generate Info.plist
  console.log("📝 Generating Info.plist...");
  const infoPlist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>en</string>
    <key>CFBundleExecutable</key>
    <string>${APP_NAME}</string>
    <key>CFBundleIconFile</key>
    <string>AppIcon</string>
    <key>CFBundleIconName</key>
    <string>AppIcon</string>
    <key>CFBundleIdentifier</key>
    <string>${BUNDLE_ID}</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>${APP_NAME}</string>
    <key>CFBundleDisplayName</key>
    <string>${APP_NAME}</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>${pkg.version}</string>
    <key>CFBundleVersion</key>
    <string>${pkg.version}</string>
    <key>LSMinimumSystemVersion</key>
    <string>12.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>NSHumanReadableCopyright</key>
    <string>Copyright © ${new Date().getFullYear()} ${pkg.author || APP_NAME}. All rights reserved.</string>
    <key>LSApplicationCategoryType</key>
    <string>public.app-category.developer-tools</string>
</dict>
</plist>`;

  writeFileSync(path.join(CONTENTS, "Info.plist"), infoPlist);

  // Copy entitlements for signing reference
  const entitlementsSrc = path.join(projectRoot, "entitlements.plist");
  if (existsSync(entitlementsSrc)) {
    copyFileSync(entitlementsSrc, path.join(RESOURCES, "entitlements.plist"));
  }

  console.log(`\n✅ App bundle created: ${OUTPUT_APP}`);
  console.log(`\n📝 Bundle contents:`);
  console.log(`   ${APP_NAME}.app/`);
  console.log(`   └── Contents/`);
  console.log(`       ├── Info.plist`);
  console.log(`       ├── MacOS/`);
  console.log(`       │   └── ${APP_NAME}`);
  console.log(`       └── Resources/`);
  console.log(`           └── AppIcon.icns`);
  console.log(`\n💡 Next: Run 'bun run sign:mac' to sign the bundle`);
}

main();
