# Full tRPC Decorators App

A complete example app using the class/decorator API for tRPC.

## Setup

```bash
cd examples/full-app
npm i
```

## Scripts

- `npm run dev` – start the dev server with tsx.
- `npm run build` – compile to `dist/` (ESM).
- `npm run start` – run the compiled build.
- `npm run test` – run tests with Vitest.
- `npm run test:ci` – run tests in CI mode.
- `npm run typecheck` – typecheck without emitting files.
- `npm run caller` – run the sample client using `createCaller`.

The server exposes the tRPC API at `http://localhost:3000/trpc`.

## Architecture

Controllers use decorators from the `trpc-controllers` package (installed via `file:../..`) to define routes, validation, middleware, and guards. `createClassRouter` builds the router from controller instances, and `createCaller` enables typed calls on both server and client. For the best type inference, controllers are registered as an object rather than an array.
