#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npm ci --prefix client
npm run build --prefix client
mkdir -p server/wwwroot
# Remove only generated frontend output, never runtime data.
find server/wwwroot -mindepth 1 -maxdepth 1 -exec rm -rf {} +
cp -R client/dist/client/browser/. server/wwwroot/
dotnet build server
