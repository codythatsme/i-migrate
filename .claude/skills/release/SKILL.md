---
name: release
description: Guide for releases and changelog. Triggers on: changelog, release, version.
---

# Release Guide

## How Releases Work

Releases happen **automatically** when PRs merge to main:

1. PR merges to main
2. Workflow checks PR merge commit subject for release prefix
3. If releasable prefix found, bumps version accordingly
4. Updates CHANGELOG.md automatically
5. Creates git tag → triggers build + GitHub release

**No manual version bumps or changelog updates needed.**

## PR Title Format (Required)

The **PR title** determines if a release happens and what type:

| PR Title Prefix | Version Bump |
|-----------------|--------------|
| `feat:` or `minor:` | Minor (0.X.0) |
| `fix:` or `patch:` | Patch (0.0.X) |
| `major:` or `type!:` | Major (X.0.0) |
| Other prefixes | No release |

Examples:
```
feat: add batch retry for failed rows     → v0.6.0
fix: correct token refresh timing         → v0.5.5
minor: add new export formats             → v0.6.0
patch: handle edge case in parser         → v0.5.5
major: redesign API endpoints             → v1.0.0
feat!: change auth flow (breaking)        → v1.0.0
```

## Skipping Releases

PRs with non-release prefixes won't trigger releases:
- `docs:` - documentation
- `refactor:` - code restructure
- `test:` - test changes
- `chore:` - maintenance
- `ci:` - CI changes

## Changelog Format

Auto-generated in CHANGELOG.md based on bump type:
- **Breaking Changes** - from `major:` or `!:` suffix
- **Added** - from `feat:` or `minor:`
- **Fixed** - from `fix:` or `patch:`

Entry uses the PR title description (after the prefix).

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
