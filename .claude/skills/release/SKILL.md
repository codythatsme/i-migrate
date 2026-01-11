---
name: release
description: Guide for releases and changelog. Use when updating changelog or preparing releases. Triggers on: changelog, release, version bump.
---

# Release Guide

## Changelog Management

When making changes that should be documented, update `CHANGELOG.md`:

1. Add entry to `## [Unreleased]` section
2. Use appropriate category:
   - **Added** - new features
   - **Changed** - changes to existing functionality
   - **Deprecated** - soon-to-be removed features
   - **Removed** - removed features
   - **Fixed** - bug fixes
   - **Security** - vulnerability fixes

3. Format: Start with lowercase verb, be concise
   - Good: `- Add dark mode toggle to settings`
   - Bad: `- Added a new dark mode toggle feature to the settings page`

## Commit Messages

Format: `type: description`

Types:
- `feat:` - new feature
- `fix:` - bug fix
- `docs:` - documentation only
- `refactor:` - code change that neither fixes nor adds
- `test:` - adding or updating tests
- `chore:` - maintenance tasks

Examples:
- `feat: add batch retry for failed rows`
- `fix: correct token refresh timing`
- `docs: update API documentation`

## Preparing a Release

1. Run pre-release checks: `bun run format && bun run lint && bun run check-types`
2. Move `[Unreleased]` entries to new version section in `CHANGELOG.md`
3. Add release date: `## [X.Y.Z] - YYYY-MM-DD`
4. Update version in `package.json`
5. Commit: `chore: release vX.Y.Z`
6. Tag: `git tag vX.Y.Z`
7. Push: `git push origin main --tags`

## Version Numbering

Follow semver:
- **MAJOR** (X.0.0): breaking changes
- **MINOR** (0.X.0): new features (backwards compatible)
- **PATCH** (0.0.X): bug fixes (backwards compatible)

## When to Update Changelog

Update the changelog for:
- New features or capabilities
- Bug fixes
- Breaking changes
- Security fixes
- Deprecations

Skip changelog for:
- Internal refactoring with no user impact
- Test-only changes
- Documentation updates (unless significant)
- Build/CI configuration changes

## When to Update README

Update `README.md` when adding significant new features that users should know about:
- New major capabilities or functionality
- Changes to installation or setup process
- New configuration options or environment variables
- New CLI commands or flags
- Breaking changes to existing behavior

Keep the README focused on what users need to get started. Detailed feature documentation can go elsewhere.
