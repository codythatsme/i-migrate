# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
