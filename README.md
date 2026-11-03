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

```bash
# One-time browser installation; on Linux use: npx playwright install --with-deps chromium
(cd client && npx playwright install chromium)
bash scripts/test.sh
```

Runs the build, xUnit authorization/message checks, Angular/Vitest component tests and Playwright Chromium flows. E2E uses port 5081 and a separate database under ignored `server/App_Data`; no running demo is required. Failure traces/screenshots: `client/test-results`; HTML report: `client/playwright-report`.

Verified on macOS ARM64 with Node 24.22.2, npm 11.19.1 and .NET SDK 10.0.402: build, normal run, 10 backend tests, 9 Angular tests and 6 Chromium E2E flows. Windows, Linux and the optional live-development command below have not yet been exercised; platform instructions are based on inspection of the Bash scripts.

For live frontend development: run `bash scripts/run.sh` in one terminal, then `npm start --prefix client` in another; open http://localhost:4200.
