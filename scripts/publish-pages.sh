#!/bin/sh
# Builds the game and publishes dist/ to the gh-pages branch (served by GitHub Pages).
set -e
cd "$(dirname "$0")/.."
npm run build
TMP=$(mktemp -d)
cp -R dist/. "$TMP/"
touch "$TMP/.nojekyll"
REMOTE=$(git remote get-url origin)
NAME=$(git config user.name)
EMAIL=$(git config user.email)
cd "$TMP"
git init -q -b gh-pages
git config user.name "$NAME"
git config user.email "$EMAIL"
git add -A
git commit -q -m "Publish built game"
git push -q -f "$REMOTE" gh-pages
rm -rf "$TMP"
echo "Published."
