# i-migrate

A desktop data migration tool for iMIS (association management software). Extract data from one iMIS environment, map fields, and load into another with row-level logging and retry capabilities.

## Installation

Download the latest release for your platform:

- **macOS**: `i-migrate` (standalone executable)
- **Windows**: `i-migrate.exe`

Run the executable to start the application. It will open a browser window at `http://localhost:3000`.

## Getting Started

### 1. Add an Environment

When you first launch the app, you'll need to configure at least one iMIS environment:

1. Click **Add Environment**
2. Enter a name, base URL (your iMIS API endpoint), username, and iMIS version
3. Enter your password when prompted to authenticate

Passwords are stored in memory only and never persisted to disk.

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

## Data Storage

The application stores configuration and job data in a local SQLite database. Sensitive data like failed row payloads is encrypted with AES-256-GCM.

## Building from Source

Requires [Bun](https://bun.sh) v1.1.0 or later.

```bash
# Install dependencies
bun install

# Development server with hot reload
bun dev

# Build standalone executable
bun run build:mac          # macOS
bun run build:windows      # Windows
```

## License

MIT
