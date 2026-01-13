---
name: release
description: Guide for releases and changelog. Triggers on: changelog, release, version.
---

# Release Guide

## How Releases Work

Releases happen **automatically** when PRs merge to main:

1. PR merges to main
2. Workflow analyzes commits since last tag
3. If releasable commits found (feat:/fix:/breaking), bumps version
4. Updates CHANGELOG.md automatically
5. Creates git tag → triggers build + GitHub release

**No manual version bumps or changelog updates needed.**

## Conventional Commits (Required)

Format: `type(scope): description`

Types that trigger releases:
- `feat:` → minor bump (0.X.0)
- `fix:` → patch bump (0.0.X)
- `feat!:` or `fix!:` → major bump (X.0.0)
- `BREAKING CHANGE:` in commit body → major bump

Non-release types (no version bump):
- `docs:` - documentation
- `refactor:` - code restructure
- `test:` - test changes
- `chore:` - maintenance
- `ci:` - CI changes

Examples:
```
feat: add batch retry for failed rows
fix: correct token refresh timing
feat(api): add new endpoint for exports
fix!: change auth flow (breaking change)
```

## What Gets Released

A release happens when ANY commit since the last tag has:
- `feat:` prefix (new feature)
- `fix:` prefix (bug fix)
- `!` suffix or `BREAKING CHANGE:` (breaking change)

Multiple features/fixes in one PR = one release with all changes.

## Skipping Releases

If you need to merge without releasing:
- Use non-release commit types: `docs:`, `refactor:`, `test:`, `chore:`, `ci:`
- Only commits with `feat:` or `fix:` trigger releases

## Version Numbering

Semver automatically determined:
- **MAJOR** (X.0.0): breaking changes (`!` or `BREAKING CHANGE:`)
- **MINOR** (0.X.0): new features (`feat:`)
- **PATCH** (0.0.X): bug fixes (`fix:`)

Highest bump wins: if PR has both `feat:` and `fix:`, minor bump is used.

## Changelog Format

Auto-generated in CHANGELOG.md with sections:
- **Breaking Changes** - from `!` or `BREAKING CHANGE:`
- **Added** - from `feat:` commits
- **Fixed** - from `fix:` commits

## Manual Override (Emergency)

If you need to manually release:
```bash
# Bump version in package.json
# Update CHANGELOG.md
git commit -m "chore: release vX.Y.Z"
git tag vX.Y.Z
git push origin main vX.Y.Z
```

The `chore: release` prefix prevents double-release.
