# Widget Works frontend

Standalone Angular application generated with Angular CLI 22.2.5. See the root [README](../README.md) for complete setup and platform-specific commands, [developer guide](../developer.md) for architecture, and [AI development digest](../digest.ai) for repository context.

From this directory, after installing dependencies with `npm ci`:

```text
npm start
npm run build
npm test
npm run e2e
```

`npm start` serves port 4200 and proxies API/SignalR requests to the backend on 5080; start the backend separately. This optional live-development mode is not yet verified. `npm test` runs Angular/Vitest once. `npm run e2e` runs Playwright, not `ng e2e`: first build and copy frontend assets to the backend and install Chromium as documented in the root README. Playwright owns an isolated backend on 5081.

Dependencies are recorded in `package.json` and resolved in `package-lock.json`. Generated `dist`, `node_modules`, caches and browser test outputs are not source files.
