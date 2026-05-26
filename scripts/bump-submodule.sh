#!/usr/bin/env bash
# Bump the pxt submodule to the latest master and commit.
# Use sparingly — prefer Dependabot's monthly PR which gives you a diff to review.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/vendor/pxt"

git fetch origin master
OLD_SHA=$(git rev-parse --short HEAD)
git checkout origin/master
NEW_SHA=$(git rev-parse --short HEAD)

if [[ "$OLD_SHA" == "$NEW_SHA" ]]; then
  echo "Already at latest ($NEW_SHA). No bump needed."
  exit 0
fi

cd "$ROOT"
git add vendor/pxt
git commit -m "deps(pxt): bump submodule $OLD_SHA -> $NEW_SHA"

echo ""
echo "Bumped pxt: $OLD_SHA -> $NEW_SHA"
echo "Review with: cd vendor/pxt && git log --oneline $OLD_SHA..$NEW_SHA -- kiosk/ react-common/"
echo "Then push and let the workflow validate the build."
