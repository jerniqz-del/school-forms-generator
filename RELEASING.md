# Releasing

This repository uses Conventional Commits and semantic-release.

Use these commit prefixes:

- `fix:` for bug fixes and patch releases (`1.3.0` -> `1.3.1`)
- `feat:` for backward-compatible features and minor releases (`1.3.0` -> `1.4.0`)
- `BREAKING CHANGE:` for major releases
- `chore:` or `docs:` for changes that do not create a release

Every push to `main` runs the release workflow. When a release is needed, GitHub Actions updates `package.json` and `package-lock.json`, commits the version, creates a tag, and publishes the GitHub release automatically.

For a local one-command release, use:

```powershell
npm run release:patch
npm run release:minor
```

These commands run type checking and linting, update the version, commit tracked changes, and push the current branch. They do not stage unrelated untracked files.