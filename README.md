# i-migrate

A desktop data migration tool for iMIS (association management software). Extract data from one iMIS environment, map fields, and load into another with row-level logging and retry capabilities.

## Installation

Download the latest release for your platform:

| Platform | Download |
|----------|----------|
| macOS (Apple Silicon) | [Download DMG](https://github.com/codythatsme/i-migrate/releases/latest/download/i-migrate-macos-arm64.dmg) |
| Windows (x64) | [Download EXE](https://github.com/codythatsme/i-migrate/releases/latest/download/i-migrate-windows-x64.exe) |

Or browse all releases: [GitHub Releases](https://github.com/codythatsme/i-migrate/releases)

### macOS

1. Download and open the DMG
2. Drag i-migrate to Applications
3. Right-click the app and select "Open" on first launch

### Windows

1. Download and run the EXE
2. If SmartScreen appears, click "More info" then "Run anyway"

The application automatically opens in your default browser.

## Getting Started

### 1. Add an Environment

When you first launch the app, you'll need to configure at least one iMIS environment:

1. Click **Add Environment**
2. Enter a name, base URL (your iMIS API endpoint), username, and iMIS version
3. Enter your password when prompted to authenticate

By default, passwords are stored in memory only and cleared when the app closes. You can optionally enable encrypted password storage in Settings.

### 2. Set Your Source Environment

Navigate to **Environments** and click the source icon on the environment you want to extract data from. This marks it as your source for migrations.

### 3. Create a Migration Job

Click **Export** from the home page. Choose your extraction method:

**From Data Source**
- Select a business object from your source environment
- Choose a destination environment and entity
- Map source fields to destination fields
- Queue the job

**From Query**
- Browse and select an IQA query from your source environment
- Choose a destination environment and entity
- Map query output columns to destination fields
- Queue the job

### 4. Run the Job

Navigate to **Jobs** to see all your migration jobs. Select a queued job and click **Run Job** to start the migration.

The job details panel shows:
- Real-time progress and row counts
- Processing rate (rows/second)
- Duration and status
- Field mappings used

### 5. Handle Failures

If a job completes with failures:
- Failed rows are listed with their error messages
- Click **Retry Failed Rows** to re-attempt just the failed records
- Each retry is tracked with attempt counts

## Features

- **Multiple extraction modes**: Pull from business objects or IQA queries
- **Field mapping**: Visual mapping between source and destination schemas
- **Batch processing**: Configurable concurrency for performance tuning
- **Progress tracking**: Real-time updates during job execution
- **Failure recovery**: Retry failed rows without re-running the entire job
- **Connection testing**: Verify environment connectivity before running jobs
- **Trace logging**: Detailed API request traces for debugging

## Security & Privacy

i-migrate is designed with your data security in mind. Here's how we protect sensitive information:

### Your Password is Never Stored (by default)

When you enter your iMIS environment password:
- It's held only in your computer's memory while the app is running
- It's **never** written to disk, saved to a file, or stored in a database
- When you close the app, the password is gone—you'll need to re-enter it next time

This means even if someone accesses your computer's files, they can't find your password.

### Optional: Store Passwords with a Master Password

For convenience, you can opt-in to storing environment passwords locally:

1. Go to **Settings** and enable "Store Passwords"
2. Create a master password—this encrypts all stored environment passwords
3. Your master password is **never stored**; you'll need to enter it each time you launch the app

When enabled:
- Environment passwords are encrypted with **AES-256-GCM** using a key derived from your master password
- Without the master password, stored passwords are unreadable
- You can disable this feature at any time, which deletes all stored passwords

### Customer Data Stays in Flight

During a successful migration, data flows directly from your source environment to your destination:
- Records are extracted from the source
- Transformed according to your field mappings
- Inserted into the destination
- **No customer data is permanently stored on your machine**

### Failed Rows Are Encrypted

If some records fail to migrate (due to validation errors, etc.), i-migrate saves them locally so you can retry later. This data is protected:

- **Encrypted with AES-256-GCM** (the same encryption standard used by banks)
- The encryption key is derived from your password—which isn't stored
- **Automatically deleted** when you successfully retry the failed row
- Cannot be decrypted by anyone who doesn't have your password

This means failed row data on your machine is unreadable without your password.

## Data Storage

Configuration and job metadata are stored in a local SQLite database at `data/i-migrate.db`.

## Building from Source

Requires [Bun](https://bun.sh) v1.3.0 or later.

```bash
# Install dependencies
bun install

# Development server with hot reload
bun dev

# Build standalone executable
bun run build:mac          # macOS
bun run build:windows      # Windows
```

### Code Signing

For development/testing, the build scripts use self-signed certificates:

```bash
bun run build:mac:signed      # macOS (ad-hoc signature)
bun run build:windows:signed  # Windows (auto-generated self-signed cert)
```

**Windows Requirements:**
- Install `osslsigncode`: `brew install osslsigncode`
- A self-signed certificate is auto-generated in `certs/` on first run

**Note:** Self-signed executables will trigger security warnings (Gatekeeper on macOS, SmartScreen on Windows). For distribution:
- **macOS**: Replace `-` in `scripts/sign-mac.ts` with your Developer ID Application certificate
- **Windows**: Use a code signing certificate from a trusted CA (DigiCert, Sectigo, etc.)

## License

MIT
