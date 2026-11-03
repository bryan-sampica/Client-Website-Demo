# Client-Website-Demo

Widget Works is a fictional Framework Theory portfolio demo: Angular 22, ASP.NET Core 10, SQLite, account flows, SignalR chat/toasts, news CMS and contact/exchange requests. No real purchases or external email.

## Get started

Install [Git](https://git-scm.com/downloads), [Node.js 24 LTS](https://nodejs.org/en/download) (24.15+; includes npm), and the [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0). No global Angular CLI, Docker or database server is required.

- **macOS:** use Terminal with Bash available.
- **Linux:** use a terminal with Bash and standard Unix tools installed.
- **Windows:** install [Git for Windows](https://gitforwindows.org/) and use its **Git Bash** terminal, with the Windows Node.js and .NET SDK installations available on PATH. The scripts require Bash and Unix tools; do not run them directly in PowerShell or Command Prompt. This route has not yet been tested on Windows.

**Windows — Git Bash**

```bash
git clone https://github.com/bryan-sampica/Client-Website-Demo.git Client-Website-Example
cd Client-Website-Example
bash scripts/build.sh
bash scripts/run.sh
```

**Linux / macOS — Terminal (Bash)**

```bash
git clone https://github.com/bryan-sampica/Client-Website-Demo.git Client-Website-Example
cd Client-Website-Example
bash scripts/build.sh
bash scripts/run.sh
```

Open **http://localhost:5080**. `build.sh` runs `npm ci --prefix client` to install locked npm dependencies and `dotnet build server`, which automatically restores NuGet packages. No separate `npm install` or `dotnet restore` is needed. It also builds Angular and copies the output into the .NET host. Run creates and seeds SQLite automatically; Ctrl+C stops it. Rebuild after code changes. Initial install needs internet access.

## Try the demo

- Register a fictional customer, sign in, and open **Support → Open support chat**.
- In a separate browser profile/private window, sign in with the locally generated details in `server/App_Data/staff-credentials.txt`. Open **Your workshop → staff support desk**, refresh the inbox, select the customer and reply.
- In **Your workshop**, send a live toast or track exchange requests. Staff can read contact submissions and create/publish news drafts.
- Password recovery writes the latest reset link to `server/App_Data/latest-recovery.txt`; open that relative link on the local site. No email is sent. Registration simulates email verification.

Local-only: startup requires Development/demo mode (set by `run.sh`), and requests from non-loopback addresses are rejected. Runtime data, credentials and protection keys are ignored by Git. Keep `server/App_Data` private; it contains real local account data. This first slice uses `EnsureCreated`, not schema migrations. The first slice has no production deployment mode or schema-upgrade workflow.

## Tests

Backend tests use [xUnit with `dotnet test`](https://learn.microsoft.com/en-us/dotnet/core/testing/unit-testing-csharp-with-xunit). Angular/TypeScript unit tests use [Vitest through Angular CLI](https://angular.dev/guide/testing), and browser E2E tests use [Playwright Test](https://playwright.dev/docs/test-cli). Both JavaScript test frameworks are npm dev dependencies installed by `npm ci`; no global test runner is needed.

Start in the project root. Run the unit-test block first to install dependencies. `dotnet test` automatically restores and builds the backend test project.

**Windows — Command Prompt: unit tests (no Bash required)**

```bat
npm ci --prefix client
dotnet test tests\WidgetWorks.Tests
npm test --prefix client
```

**Windows — Command Prompt: E2E tests (no Bash required)**

```bat
npm run build --prefix client
if exist server\wwwroot rmdir /s /q server\wwwroot
mkdir server\wwwroot
xcopy client\dist\client\browser server\wwwroot /E /I /Y
cd client
npx playwright install chromium
npm run e2e
cd ..
```

**Linux / macOS — Terminal: unit tests**

```bash
npm ci --prefix client
dotnet test tests/WidgetWorks.Tests
npm test --prefix client
```

**Linux / macOS — Terminal: E2E tests**

```bash
npm run build --prefix client
rm -rf server/wwwroot
mkdir -p server/wwwroot
cp -R client/dist/client/browser/. server/wwwroot/
cd client
npx playwright install chromium
# On Linux, install browser system dependencies when needed:
# npx playwright install --with-deps chromium
npm run e2e
cd ..
```

The E2E preparation replaces only generated frontend assets in `server/wwwroot`; runtime data is elsewhere. Playwright starts/stops the .NET test server automatically on port 5081 and uses a separate SQLite database under ignored `server/App_Data`. Leave that port free; no running demo is required. Browser installation is needed initially and after Playwright browser-version updates. Failure traces/screenshots: `client/test-results`; HTML report: `client/playwright-report`. On Linux/macOS, `bash scripts/test.sh` also builds and runs all three suites after browser installation.

Coverage: 10 backend cases check conversation ownership/support roles and chat-message boundaries; 9 Angular tests check form states, authentication errors, inert CMS text, unsent-message preservation, antiforgery headers and HTTP failures; 6 Chromium E2E flows cover navigation/responsive layout, accounts/exchanges/toasts, password recovery, two-session chat/reconnect/isolation, contact/CMS persistence and publication, and CSRF/input rejection. These counts are test cases, not a measured code-coverage percentage; persistence checks do not include a server restart.

Verified on macOS ARM64 with Node 24.22.2, npm 11.19.1 and .NET SDK 10.0.402. Native Windows CMD, Linux, Firefox/WebKit and optional live-development mode have not been exercised. Windows commands were checked against the scripts and configuration, not executed on Windows.

For live frontend development: run `bash scripts/run.sh` in one terminal, then `npm start --prefix client` in another; open http://localhost:4200.
