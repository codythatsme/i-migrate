# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.6.2] - 2025-01-19

### Fixed

- 2017 IQA "source properties not found" error during migration (use Caption for property mappings)

## [0.6.0] - 2025-01-17

### Added

- Pre-insert validation for migration jobs
- Verbose logging setting for iMIS API requests
- Custom endpoint support for non-BO destinations
- Pre-commit hooks for format, lint, and type checks

### Fixed

- Refresh attempt history after manual row retry
- Auto-release workflow now uses tag-only approach (fixes branch protection issue)

### Changed

- Job creation now saves without auto-running
- Consolidate custom endpoint config into single CUSTOM_ENDPOINTS array
- Release process now requires manual version bump before merge

## [0.5.4] - 2025-01-13

### Fixed

- Make RenderingInformation text fields optional in iMIS schema (HelpText, ToolTip, WatermarkText)

## [0.5.3] - 2025-01-11

### Fixed

- Handle missing Value field in 2017 IQA query responses
- Enable running job indicator query

## [0.5.2] - 2025-01-11

### Fixed

- Add iMIS 2017 environment compatibility for query definitions (sparse API responses, missing Document field)
- Handle optional fields in 2017 data source responses (Description, Properties, PrimaryParentEntityTypeName)
- Preserve iMIS error details through RPC boundary for better error messages
- Make BoEntityDefinition schema fields optional for sparse API responses
- Improve auth error handling with granular types and span context
- Resolve TypeScript strict mode errors
- Fix Effect layer composition ordering

## [0.5.1] - 2025-01-11

### Fixed

- Skip role check for iMIS 2017 environments (UserSecurity endpoint not supported)

## [0.5.0] - 2025-01-11

### Added

- Export traces to JSON with automatic sanitization of sensitive data (environment IDs, URLs)

## [0.4.0] - 2025-01-11

### Added

- Unified rows/attempts tracking for job results
- Redesigned job details with dedicated page and data table

### Changed

- Update Bun version requirement to v1.3.0

## [0.3.4] - 2025-01-10

### Fixed

- Fix binary property migration silently dropping file data

## [0.3.3] - 2025-01-10

### Fixed

- Fix Windows browser opening error due to `start` being a shell built-in

## [0.3.2] - 2025-01-09

### Changed

- Remove Windows hide console flag for debugging startup issues

## [0.3.1] - 2025-01-09

### Fixed

- Windows executable failing on startup with "EPERM: operation not permitted, mkdir" error due to incorrect database path detection when executable is renamed

## [0.2.0] - 2025-01-09

### Added

- GitHub Actions release pipeline for automated builds
- Download links in README
- Improve environment tile password UX

### Changed

- Set process title to i-migrate for port visibility

## [0.1.0] - 2025-01-09

### Added

- Initial release
- iMIS environment management with encrypted credential storage
- Migration job execution with concurrent batch processing
- Failed row tracking and retry capabilities
- Trace/span observability for debugging
- Desktop executable builds for macOS and Windows
