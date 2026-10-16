#!/usr/bin/env bash
# Push this game's source to a private repository in the vibe-codebase GitHub organisation.
# Run from the game folder:  bash scripts/push-github.sh
# Source only: keystores, AABs, credentials, .env files and node_modules are git-ignored and checked again below.
set -euo pipefail
cd "$(dirname "$0")/.."

ORG="vibe-codebase"
COMPANY="$(node -p "require('./app.json').expo.extra.company")"
APP="$(node -p "require('./app.json').expo.name")"
REPO="$(printf %s "$COMPANY" | tr "[:lower:]" "[:upper:]" | sed -E "s/[^A-Z0-9]+/-/g; s/^-|-\$//g")_$(printf %s "$APP" | sed -E "s/[^A-Za-z0-9]+/-/g; s/^-|-\$//g")"   # e.g. PRIME-PICK-TRADERS-LTD_Umbra-Prime (company caps, then game name)
[ -f .github-repo ] && REPO="$(tr -d "[:space:]" < .github-repo)"   # optional override of the repo name
URL="https://github.com/$ORG/$REPO.git"
OWNER="$(node -p "require('./app.json').expo.owner")"; SLUG="$(node -p "require('./app.json').expo.slug")"

echo "== Repository: $ORG/$REPO (private)"
[ -d .git ] || git init -q -b main
git config user.name "$OWNER"; git config user.email "release@$SLUG.invalid"
git branch -M main
git add -A
# never let a secret or build output into the repository
if git diff --cached --name-only | grep -E '\.(jks|keystore|aab|apk|p12|p8|key|zip)$|credentials\.json$|(^|/)\.env($|\.)|node_modules/' ; then
  echo "Refusing to push: the files above must stay out of the repository."; exit 1
fi
git diff --cached --quiet || git commit -qm "$APP source"

if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  gh repo view "$ORG/$REPO" >/dev/null 2>&1 || gh repo create "$ORG/$REPO" --private --description "$APP by $COMPANY"
else
  if ! git ls-remote "$URL" >/dev/null 2>&1; then
    echo "The GitHub CLI isn't signed in, and $ORG/$REPO doesn't exist yet."
    echo "Either run:  brew install gh && gh auth login   (then run this script again)"
    echo "or create a PRIVATE, EMPTY repository named $REPO at https://github.com/organizations/$ORG/repositories/new and run this again."
    exit 1
  fi
fi
git remote get-url origin >/dev/null 2>&1 && git remote set-url origin "$URL" || git remote add origin "$URL"
git push -u origin main
echo "Pushed: https://github.com/$ORG/$REPO"
