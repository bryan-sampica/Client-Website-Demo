# Developer guide

Verified against the local implementation on November 3, 2026. Widget Works is a fictional Framework Theory portfolio demo. This describes implemented behavior, not a planned production architecture. See [README.md](README.md) for setup and platform-specific test commands.

## AI-assisted development

[digest.ai](digest.ai) is the Markdown companion for AI-assisted developers. It provides a practical source map, commands, current behavior and security/data guardrails so an agent can work from repository facts instead of guessing. Ask your agent to read it explicitly; the `.ai` extension is not executable configuration and does not guarantee automatic loading. This guide explains the technical architecture for people; the digest focuses on how to change it safely. Keep both aligned with actual source and the current task.

## Layers and source map

| Layer | Implementation | Source |
| --- | --- | --- |
| Browser UI | Standalone Angular components, router, template-driven forms, signals and custom CSS; no SSR | [pages.ts](client/src/app/pages.ts), [routes](client/src/app/app.routes.ts), [styles](client/src/styles.css) |
| Application shell | Navigation, account state, global errors and SignalR toast display | [app.ts](client/src/app/app.ts), [app.html](client/src/app/app.html) |
| Browser service | Injectable `Api` service; native `fetch` for JSON requests, shared signals and SignalR connection management | [api.ts](client/src/app/api.ts) |
| HTTP API and realtime | ASP.NET Core minimal endpoints, middleware, Identity integration and `LiveHub` | [Program.cs](server/Program.cs) |
| Persistence | EF Core `Store : IdentityDbContext<User>`, SQLite, entity classes and startup seeding | [Program.cs](server/Program.cs) |

These are logical responsibilities, not separate service deployments. Backend startup, endpoints, models and hub currently share one file. There is no separate repository/business-service layer. Angular routes have no authorization guards; backend policies enforce access. Signed-out chat renders account links instead of chat controls.

## Versions and tooling

JavaScript versions below are resolved in [package-lock.json](client/package-lock.json), not merely the ranges in [package.json](client/package.json). `npm ci` reproduces that lockfile.

| Component | Recorded version / constraint |
| --- | --- |
| Node.js | `.nvmrc`: 24; package engines: `>=24.15.0 <25`; locally checked: 24.22.2 |
| npm | Manifest `packageManager` and local executable: 11.19.1 |
| Angular core | 22.2.4 |
| Angular CLI / build tooling | 22.2.5 / 22.2.5 |
| TypeScript / RxJS | 6.0.3 / 7.8.2 |
| SignalR JavaScript client | 10.0.11 |
| Vitest / jsdom | 5.1.0 / 30.1.3 |
| Playwright Test | 1.64.1 |
| .NET target | `net10.0` for API and tests |
| .NET SDK | [global.json](global.json): 10.0.100 with `rollForward: latestFeature`; locally selected: 10.0.402 |
| Identity EF Core / EF Core SQLite | Explicit NuGet references: 10.0.13 / 10.0.13 |
| SQLite native bundle package | `SQLitePCLRaw.bundle_e_sqlite3` 3.0.5 (package version, not SQLite engine version) |
| xUnit / Visual Studio runner | 2.9.3 / 3.1.4 |
| Microsoft.NET.Test.Sdk / coverlet collector | 17.14.1 / 6.0.4 |

NuGet references are in the [API project](server/WidgetWorks.Api.csproj) and [test project](tests/WidgetWorks.Tests/WidgetWorks.Tests.csproj). Frontend build/test settings are in [angular.json](client/angular.json).

## Connections and build flow

```text
Browser :5080 ── static Angular assets ── ASP.NET Core
             ├─ /api/* JSON + session cookie ── endpoints ── EF Core ── SQLite
             └─ /hubs/live ── SignalR LiveHub ── persisted chat + live events

Optional Angular dev server :4200 ── proxy /api and /hubs ── backend :5080
Playwright browser ── isolated test backend :5081 ── separate SQLite directory
```

- [build.sh](scripts/build.sh) installs locked npm packages, builds Angular, replaces generated `server/wwwroot` contents from `client/dist/client/browser`, and runs `dotnet build server` with implicit NuGet restore.
- [run.sh](scripts/run.sh) sets Development/demo mode and starts the backend on `http://localhost:5080`. It builds frontend assets only if `server/wwwroot/index.html` is missing; rebuild explicitly after source edits.
- ASP.NET Core serves static files and falls back to `index.html` for client routes. `/api/health` reports local-demo status.
- `npm start --prefix client` uses the [proxy configuration](client/proxy.conf.json), including WebSocket proxying. Browser service URLs are relative, so API calls and hub connections use the browser's origin.
- These helper scripts require Bash. README includes native Windows CMD test commands. No Docker, external database server, SMTP or external application API is required.

## HTTP services and data flows

All paths below are relative to `/api`. Mutation endpoints also require antiforgery validation.

| Service | Routes | Access / effect |
| --- | --- | --- |
| Accounts | `/auth/csrf`, `/auth/register`, `/auth/login`, `/auth/forgot`, `/auth/reset`, `/auth/me`, `/auth/logout` | Identity registration/login/recovery; `me` and logout require authentication |
| Catalog | `/widgets` | Public, returns static `Catalog.Items`; products are not database records |
| Public news | `/news`, `/news/{slug}` | Published articles only |
| CMS | `/staff/news`, `/staff/news/{id}/publish` | Editor role; list/create articles and publish; publication emits a toast |
| Contact | `/contact`, `/staff/contacts` | Public submission saved to SQLite; Support role reads latest 100 contacts |
| Exchanges | `/exchanges` | Authenticated creation/listing scoped to current user; creation emits a personal toast |
| Chat | `/conversations`, `/conversations/{id}/messages` | Create/reuse own conversation; Support can list/access all; history checks ownership or Support role |
| Demo notification | `/notifications/demo` | Authenticated; sends a toast to the current user |

News bodies are plain text displayed through Angular interpolation, not arbitrary HTML or Markdown. The UI creates drafts and publishes them; there is no article editing/deletion, revision history, upload service or rich-text editor. Exchanges store a request with an initial assessment status; there is no approval/shipping/payment workflow.

## Authentication and request boundaries

Identity stores accounts and password hashes in SQLite. The `WidgetWorks.Session` cookie is HTTP-only, SameSite Strict, uses `SameAsRequest` secure policy and a configured two-hour expiry. Local HTTP therefore does not produce an HTTPS-only cookie. Unauthorized/forbidden API access returns 401/403 rather than login redirects.

The client obtains a token from `/api/auth/csrf` and sends `X-XSRF-TOKEN` on POST requests. Middleware validates non-GET/non-HEAD `/api` requests. Registration never grants staff roles; seeded staff receives Support and Editor. There is no explicit Customer role.

Startup requires both Development and `Demo:Enabled=true`; non-loopback remote addresses are rejected. Hub requests carrying an Origin header must match the host origin. API/hub HTTP requests have a 120-per-minute limiter partitioned by authenticated user or fallback IP; this is not a per-message SignalR throttle. Static files are exempt. Security headers include CSP, nosniff and same-origin referrer policy; API responses use `no-store`.

Registration simulates email confirmation. Recovery uses Identity reset tokens and overwrites a private local mailbox file; it does not send email or expose that file through HTTP. The response is generic regardless of whether an account exists. Keep runtime files private; no credential values belong in source or documentation.

## SignalR lifecycle

`/hubs/live` requires authentication and closes connections on authentication expiration. `Join(conversationId)` checks owner/Support access before joining `chat:{id}`. `Send` repeats that check, rejects blank or over-2,000-character text, derives sender identity server-side, saves the message, then broadcasts `Message` to the group. Maximum incoming hub message size is 16 KiB.

Staff replies emit a personal `Toast` to the customer. Exchange/demo toasts target the requesting user; publication broadcasts to all connected authenticated hub clients. Toasts are transient, with no durable queue or replay.

The client automatically reconnects, rejoins the selected conversation and reloads the latest 200 messages over HTTP. It merges history/live messages by ID to avoid duplicates. The staff inbox refreshes manually. No multi-instance backplane is configured.

## Storage and configuration

The default data root is `server/App_Data`; `DataDirectory` can override it. It contains `widgets.db`, persisted Data Protection keys under `keys`, generated staff credentials and the latest recovery message. These are ignored by [.gitignore](.gitignore) and outside the static web root. Unix permissions are tightened by startup code; equivalent explicit Windows ACL changes are not implemented.

`Store` contains Identity tables plus Articles, Contacts, Exchanges, Conversations and Messages. Unique indexes enforce article slugs and one conversation per customer. Startup uses `EnsureCreatedAsync`, seeds two published articles if none exist, and creates staff roles/account when missing. There is no migration-based schema upgrade workflow; preserving existing databases across schema changes requires additional work.

[appsettings.json](server/appsettings.json) supplies logging/host configuration; [appsettings.Development.json](server/appsettings.Development.json) enables demo mode. `run.sh` explicitly sets `ASPNETCORE_ENVIRONMENT=Development` and `Demo__Enabled=true`. This is a single-process local SQLite application, not a production deployment configuration.

## Test architecture and verified scope

- [Backend tests](tests/WidgetWorks.Tests/AuthorizationTests.cs): 10 xUnit cases run via `dotnet test`. Authorization uses real in-memory SQLite, not EF's non-relational in-memory provider; remaining cases check chat text boundaries.
- Angular tests use Angular TestBed, Vitest and jsdom: [API tests](client/src/app/api.spec.ts), [page tests](client/src/app/pages.spec.ts), [shell test](client/src/app/app.spec.ts). The 11 tests cover form behavior, errors, CSRF headers, inert content, unsent messages, signed-out chat and the external attribution link.
- [Browser tests](client/e2e/workshop.spec.ts): 7 Playwright Chromium flows exercise real backend/SQLite, separate customer/staff contexts, recovery, chat/reconnect/isolation, CMS/contact persistence, notifications, invalid requests and signed-out account links.
- [Playwright configuration](client/playwright.config.ts) starts/stops its own backend on 5081, refuses server reuse, runs one worker and creates a unique ignored data directory unless `WIDGET_TEST_DATA` is supplied. Failure traces/screenshots and an HTML report remain under the client test output directories.

Latest completed local run: build succeeded with zero .NET warnings/errors; 10 backend, 11 Angular and 7 Chromium tests passed on macOS ARM64. No measured coverage percentage, server-restart persistence test, Linux execution, native Windows execution or Firefox/WebKit validation is claimed. The optional Angular live-development mode has not been exercised. See [README](README.md) for commands and [development notes](docs/development.md) for additional implementation context.
