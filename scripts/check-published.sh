#!/usr/bin/env bash
set -euo pipefail

package=${1:?Pass an exact npm package version}
fixture=$(mktemp -d)
trap 'rm -rf -- "$fixture"' EXIT
cd "$fixture"
printf '{"private":true}\n' > package.json
touch npmrc

attempts=20
for ((attempt=1; attempt<=attempts; attempt++)); do
  if npm install "$package" --userconfig="$fixture/npmrc" --cache="$fixture/cache" \
      --registry=https://registry.npmjs.org --prefer-online --fetch-retries=0 --fetch-timeout=12000 \
      --no-audit --no-fund --no-package-lock --ignore-scripts > install.log 2>&1; then
    cat install.log
    exit 0
  fi
  cat install.log >&2
  if ! grep -Eq 'code (E404|ETARGET|E429|E5[0-9][0-9]|ETIMEDOUT|ECONNRESET)([^[:alnum:]]|$)' install.log; then
    exit 1
  fi
  if ((attempt < attempts)); then
    sleep 15
  fi
done
echo "::error::$package is listed in npm but is not installable yet. Run CI again after it becomes available." >&2
exit 1
