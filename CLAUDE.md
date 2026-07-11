# Testing

The primary/main testing approach for this API is **data-driven testing via the `api-tests/` folder** (Postman collection) at the repo root, not the Jest suites under `src/**/__tests__`. Jest covers unit-level service logic; `api-tests/generate-postman.js` is the source of truth for full endpoint request/response contracts.

**Whenever any API is changed (new endpoint, changed request/response shape, changed auth/cookie behavior, etc.), the `api-tests/` folder is the main way to test and validate that API — update and regenerate it in the same change, and use it to verify the change actually works end-to-end.**

The `api-tests/` collection runs against **seeded data** (`src/database/seed/index.ts`) — accounts, orders, coupons, etc. If an API change affects the shape, state, or invariants of that seeded data (e.g. new required fields, changed enums/status values, new relations), update `src/database/seed/index.ts` and re-seed in the same change, otherwise the Postman tests will run against stale/mismatched data.

Whenever an endpoint's request/response shape changes, update `api-tests/generate-postman.js` and regenerate in the same change:

```bash
node api-tests/generate-postman.js
```

This rewrites `mayalu-wears.postman_collection.json`. Don't let it drift out of sync with the actual API.

# Module structure

Every module under `src/modules/<name>/` must split concerns into separate files — never put controller, service, and DB logic together in one file (including `<name>.module.ts`, which should contain only Nest module wiring):

- `<name>.module.ts` — `@Module()` wiring only (controllers/providers/exports)
- `<name>.controller.ts` — routes, Swagger decorators, request/response mapping — delegates to the service
- `<name>.service.ts` — business logic only — calls the repository, never the DB client directly
- `<name>.repository.ts` — all DB access (Drizzle queries) for the module, nothing else
- `dto/<name>.dto.ts` — request/response DTOs with `class-validator`/`@nestjs/swagger` decorators

Apply this structure to every new module and every new endpoint you add to an existing module. When touching an older module that still bundles these into one file, split it out into this structure as part of that change.
