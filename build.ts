#!/usr/bin/env bun
import plugin from "bun-plugin-tailwind";
import { reactCompilerPlugin } from "./src/plugins/react-compiler";
import { existsSync } from "fs";
import { rm, mkdir } from "fs/promises";
import path from "path";

const isCompileMode = process.argv.includes("--compile");

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`
🏗️  Bun Build Script

Usage: bun run build.ts [options]

Common Options:
  --outdir <path>          Output directory (default: "dist")
  --minify                 Enable minification (or --minify.whitespace, --minify.syntax, etc)
  --sourcemap <type>      Sourcemap type: none|linked|inline|external
  --target <target>        Build target: browser|bun|node (or bun-darwin-arm64, bun-windows-x64, etc.)
  --format <format>        Output format: esm|cjs|iife
  --splitting              Enable code splitting
  --packages <type>        Package handling: bundle|external
  --public-path <path>     Public path for assets
  --env <mode>             Environment handling: inline|disable|prefix*
  --conditions <list>      Package.json export conditions (comma separated)
  --external <list>        External packages (comma separated)
  --banner <text>          Add banner text to output
  --footer <text>          Add footer text to output
  --define <obj>           Define global constants (e.g. --define.VERSION=1.0.0)
  --compile                Build a standalone executable (two-step: bundle with plugins, then compile)
  --outfile <path>         Output file path for compiled executable (only with --compile)
  --help, -h               Show this help message

Example:
  bun run build.ts --outdir=dist --minify --sourcemap=linked --external=react,react-dom
  bun run build.ts --compile --target=bun-darwin-arm64 --outfile=dist/i-migrate
`);
  process.exit(0);
}

const toCamelCase = (str: string): string => str.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());

const parseValue = (value: string): any => {
  if (value === "true") return true;
  if (value === "false") return false;

  if (/^\d+$/.test(value)) return parseInt(value, 10);
  if (/^\d*\.\d+$/.test(value)) return parseFloat(value);

  if (value.includes(",")) return value.split(",").map(v => v.trim());

  return value;
};

function parseArgs(): Record<string, unknown> {
  const config: Record<string, unknown> = {};
  const args = process.argv.slice(2);

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === undefined) continue;
    if (!arg.startsWith("--")) continue;

    if (arg.startsWith("--no-")) {
      const key = toCamelCase(arg.slice(5));
      config[key] = false;
      continue;
    }

    if (!arg.includes("=") && (i === args.length - 1 || args[i + 1]?.startsWith("--"))) {
      const key = toCamelCase(arg.slice(2));
      config[key] = true;
      continue;
    }

    let key: string;
    let value: string;

    if (arg.includes("=")) {
      [key, value] = arg.slice(2).split("=", 2) as [string, string];
    } else {
      key = arg.slice(2);
      value = args[++i] ?? "";
    }

    key = toCamelCase(key);

    if (key.includes(".")) {
      const [parentKey, childKey] = key.split(".", 2);
      if (parentKey && childKey) {
        const parent = (config[parentKey] ?? {}) as Record<string, unknown>;
        parent[childKey] = parseValue(value);
        config[parentKey] = parent;
      }
    } else {
      config[key] = parseValue(value);
    }
  }

  return config;
}

const formatFileSize = (bytes: number): string => {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
};

console.log("\n🚀 Starting build process...\n");

const cliConfig = parseArgs();
const outdir = (cliConfig.outdir as string | undefined) ?? path.join(process.cwd(), "dist");
const outfile = (cliConfig.outfile as string | undefined) ?? path.resolve("dist", "app");
const target = cliConfig.target as string | undefined;

// Clean output directory
if (existsSync(outdir)) {
  console.log(`🗑️ Cleaning previous build at ${outdir}`);
  await rm(outdir, { recursive: true, force: true });
}

// Ensure output directory exists for compile mode
if (isCompileMode) {
  const outfileDir = path.dirname(outfile);
  if (!existsSync(outfileDir)) {
    await mkdir(outfileDir, { recursive: true });
  }
}

const start = performance.now();

// When compiling to executable, use src/index.ts as entry point
// See: https://github.com/oven-sh/bun/pull/23748
const entrypoints = isCompileMode
  ? [path.resolve("src", "index.ts")]
  : [...new Bun.Glob("**.html").scanSync("src")]
      .map(a => path.resolve("src", a))
      .filter(dir => !dir.includes("node_modules"));

if (isCompileMode) {
  console.log(`📦 Compile mode: building executable with Tailwind plugin...\n`);
} else {
  console.log(`📄 Found ${entrypoints.length} HTML ${entrypoints.length === 1 ? "file" : "files"} to process\n`);
}

// Remove CLI-specific options before passing to Bun.build()
const { compile: _, outfile: __, target: ___, ...buildConfig } = cliConfig;

const result = await Bun.build({
  entrypoints,
  outdir: isCompileMode ? undefined : outdir,
  plugins: [plugin, reactCompilerPlugin()],
  minify: true,
  target: isCompileMode ? (target as any) ?? "bun" : "browser",
  sourcemap: isCompileMode ? "none" : "linked",
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  // Use Bun.build()'s compile option directly for single-file executables
  // This properly bundles Tailwind CSS and all assets into the executable
  ...(isCompileMode
    ? {
        compile: {
          outfile,
        },
      }
    : {}),
  ...buildConfig,
});

if (!result.success) {
  console.error("❌ Build failed:");
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

const end = performance.now();

const outputTable = result.outputs.map(output => ({
  File: path.relative(process.cwd(), output.path),
  Type: output.kind,
  Size: formatFileSize(output.size),
}));

console.table(outputTable);
const buildTime = (end - start).toFixed(2);

if (isCompileMode) {
  console.log(`\n✅ Executable built successfully in ${buildTime}ms`);
  console.log(`   Output: ${outfile}\n`);
} else {
  console.log(`\n✅ Build completed in ${buildTime}ms\n`);
}
