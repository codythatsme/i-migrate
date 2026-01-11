#!/usr/bin/env bun
import { $ } from "bun";

const pkg = await Bun.file("package.json").json();
const version = pkg.version as string;
const windowsVersion = `${version}.0`;

const platform = process.argv[2] ?? "web";

switch (platform) {
  case "web":
    await $`bun run db:gen-index && bun run generate-routes && bun run scripts/build.ts`;
    break;
  case "mac":
    await $`bun run db:gen-index && bun run generate-routes && bun run scripts/build.ts --compile --target=bun-darwin-arm64 --outfile=dist/i-migrate`;
    break;
  case "windows":
    await $`bun run db:gen-index && bun run generate-routes && bun run scripts/build.ts --compile --target=bun-windows-x64 --outfile=dist/i-migrate.exe --windows-icon=assets/app.ico --windows-title=i-migrate --windows-description="Desktop data migration tool for iMIS" --windows-version=${windowsVersion}`;
    break;
  default:
    console.error(`Unknown platform: ${platform}`);
    process.exit(1);
}
