#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
bash scripts/build.sh
dotnet test tests/WidgetWorks.Tests
npm test --prefix client
npm run e2e --prefix client
