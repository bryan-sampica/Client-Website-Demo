#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [ ! -f server/wwwroot/index.html ]; then bash scripts/build.sh; fi
printf 'Widget Works: http://localhost:5080\nStaff credentials: server/App_Data/staff-credentials.txt\n'
export ASPNETCORE_ENVIRONMENT=Development
export Demo__Enabled=true
exec dotnet run --project server --no-launch-profile --urls http://localhost:5080
