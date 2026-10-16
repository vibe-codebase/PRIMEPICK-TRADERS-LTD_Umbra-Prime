#!/usr/bin/env bash
# Cloud release build for this game: the keystore is generated and kept on the Expo server, and the AAB is built by EAS.
# Nothing is compiled on this computer. Run from the game folder:  bash scripts/eas-release.sh
set -euo pipefail
cd "$(dirname "$0")/.."

PACK="$(ls -d Delivery/V1_*\(game\) | head -1)"
SLUG="$(node -p "require('./app.json').expo.slug")"
OWNER="$(node -p "require('./app.json').expo.owner")"
EAS="npx --yes eas-cli@latest"
export EXPO_NO_METRO_WORKSPACE_ROOT=1 EXPO_NO_TELEMETRY=1

echo "== 1/6 Expo account"
if ! WHO="$($EAS whoami 2>/dev/null | head -1)"; then $EAS login; WHO="$($EAS whoami | head -1)"; fi
echo "Signed in as: $WHO (app.json owner: $OWNER)"
if [ "$(printf %s "$WHO" | tr A-Z a-z)" != "$(printf %s "$OWNER" | tr A-Z a-z)" ]; then
  echo "The signed-in account is not $OWNER. Sign in as $OWNER (eas logout && eas login), or set expo.owner in app.json."; exit 1
fi
node -e "const f='app.json',a=require('./'+f);a.expo.owner='$WHO';require('fs').writeFileSync(f,JSON.stringify(a,null,2)+'\n')"

echo "== 2/6 Dependencies"
npm ci --no-audit --no-fund

echo "== 3/6 Project link (writes extra.eas.projectId into app.json)"
node -e "process.exit(require('./app.json').expo.extra?.eas?.projectId?0:1)" || $EAS init --non-interactive --force

echo "== 4/6 Commit the release state"
[ -d .git ] || git init -q -b main
git config user.name "$OWNER"; git config user.email "release@$SLUG.invalid"
git add -A && git commit -qm "Release build" || true

echo "== 5/6 EAS cloud build (production AAB). EAS generates the upload keystore and stores it on the Expo server."
$EAS build -p android --profile production --non-interactive --wait
URL="$($EAS build:list -p android --status finished --limit 1 --json --non-interactive | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s)[0].artifacts.buildUrl))")"
curl -fL "$URL" -o "$PACK/$SLUG-release.aab"
echo "AAB saved: $PACK/$SLUG-release.aab"

echo "== 6/6 Keystore copy for your records"
echo "In the menu that opens choose: Android → production → Keystore → Download existing keystore"
echo "(or credentials.json → Download credentials from EAS to credentials.json). Then exit the menu."
$EAS credentials -p android || true
KS="$(ls credentials/android/keystore.jks android/keystores/*.jks android/keystores/*.keystore *.jks 2>/dev/null | head -1 || true)"
[ -n "$KS" ] && mv "$KS" "$PACK/$SLUG-release.jks"
[ -f credentials.json ] && node -e "
const c=require('./credentials.json').android.keystore;
require('fs').writeFileSync(process.argv[1],JSON.stringify({keystorePath:'$SLUG-release.jks',keystorePassword:c.keystorePassword,keyAlias:c.keyAlias,keyPassword:c.keyPassword},null,2)+'\n')" "$PACK/$SLUG-credentials.json" && rm -f credentials.json
rm -rf credentials
ls -la "$PACK"
echo "Done. The keystore also stays stored on the Expo server; the .jks and credentials here are git-ignored."
