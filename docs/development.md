# Development notes

## Structure

- `client/src/app`: standalone Angular routes/components and a typed HTTP/SignalR service; hand-built CSS widget illustrations need no external assets.
- `server/Program.cs`: ASP.NET Core endpoints, Identity/EF Core models, authorization checks and SignalR hub.
- `server/App_Data`: SQLite database, Data Protection keys and local-only credential/recovery files (never committed).
- `tests/WidgetWorks.Tests`: xUnit message boundary tests and authorization tests against in-memory SQLite, not EF's non-relational in-memory provider.
- `client/src/app/*.spec.ts`: Vitest component/service behavior tests using Angular TestBed.
- `client/e2e`: Playwright user flows with isolated browser contexts for customer and support roles.

## Security and persistence

Identity hashes passwords and issues HTTP-only SameSite cookies. API mutations require antiforgery tokens; SignalR checks the browser origin and authenticates hub connections. Conversation ownership and support role are checked server-side for joins, sends and history reads. CMS writes require the Editor role; public reads exclude drafts. Article/chat text is escaped by Angular rather than rendered as arbitrary HTML. Recovery returns a generic response and uses Identity's expiring, single-use-after-reset tokens.

The normal demo uses a single SQLite file and a single backend process. Chat messages are saved before broadcasting. On reconnect the client rejoins its authorized room and reloads history, deduplicating live events. Toasts are transient and not replayed after a disconnected period. Chat history currently loads the latest 200 messages. The staff inbox refreshes manually.

HTTP loopback is intentional for this local demonstration. There is no production mode, SMTP service, payment flow, shipment, real exchange approval, multi-instance SignalR backplane, durable notification outbox, upload system, or rich-text CMS. Registration marks email confirmed only within the enforced local demo. Staff credentials are random and generated once. Recovery mail is a private local file, not an HTTP endpoint. Account roles cannot be assigned through registration.

`EnsureCreated` is suitable for this disposable initial schema; add reviewed EF migrations before changing a database that must be preserved. SQLite supports one writer at a time. PostgreSQL is a later option requiring provider-specific migration and integration testing. Move from plain article text to sanitized Markdown only if needed.

## Testing approach

Component tests focus on pending/success/failure form states, preserving unsent content, authentication errors, inert CMS text, CSRF headers and HTTP failures. Backend tests verify ownership, staff-only conversation access and chat payload boundaries. Browser tests exercise actual .NET endpoints and SQLite, including recovery, authorization failures, two-session SignalR messages, reconnect history, toasts, CMS publishing and contact persistence.

Tests use role/label locators and web-first assertions. No fixed sleeps or mocked successful backend responses are used in E2E. Chromium is the configured browser; Firefox/WebKit and Linux execution need separate validation. The current suite does not claim exhaustive coverage or a coverage percentage.

## Live development

The Angular dev server proxies `/api` and `/hubs` to port 5080, preserving the browser origin. Production frontend assets are served by .NET on one origin. Scripts use Bash, Node/npm and .NET without macOS-only path assumptions. Dependencies are pinned by `package-lock.json` and explicit NuGet versions; `global.json` accepts installed .NET 10 feature bands.
