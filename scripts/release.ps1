param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('patch', 'minor')]
  [string]$Bump
)

$ErrorActionPreference = 'Stop'

Write-Host "Running validation before $Bump release..."
npm run typecheck
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
npm run lint
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

npm version $Bump --no-git-tag-version
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$version = node -p "require('./package.json').version"
git add -u
git add package.json package-lock.json
git commit -m "chore(release): v$version"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

git push origin (git branch --show-current)
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Released v$version. GitHub Actions will create the GitHub release and tag."