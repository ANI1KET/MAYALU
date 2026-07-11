# Testing

The **only** testing approach for this API is **data-driven testing via the `api-tests/` folder** (Postman collection) at the repo root — there are no Jest/unit test suites in this repo (removed deliberately: they relied on mocked DB calls, which doesn't reflect real behavior against the actual database). Do not add `src/**/__tests__` Jest specs back; validate changes against real seeded data via `api-tests/` instead. `api-tests/generate-postman.js` is the source of truth for full endpoint request/response contracts.

**Whenever any API is changed (new endpoint, changed request/response shape, changed auth/cookie behavior, etc.), the `api-tests/` folder is the main way to test and validate that API — update and regenerate it in the same change, and use it to verify the change actually works end-to-end.**

The `api-tests/` collection runs against **seeded data** (`src/database/seed/index.ts`) — accounts, orders, coupons, etc. If an API change affects the shape, state, or invariants of that seeded data (e.g. new required fields, changed enums/status values, new relations), update `src/database/seed/index.ts` and re-seed in the same change, otherwise the Postman tests will run against stale/mismatched data.

Whenever an endpoint's request/response shape changes, update `api-tests/generate-postman.js` and regenerate in the same change:

```bash
node api-tests/generate-postman.js
```

This rewrites `mayalu-wears.postman_collection.json`. Don't let it drift out of sync with the actual API.

# Module structure

Every module under `src/modules/<name>/` must split concerns into separate files — never put controller, service, and DB logic together in one file (including `<name>.module.ts`, which should contain only Nest module wiring). This is the **baseline** every module needs, not an exhaustive list — add whatever additional files a module actually needs to stay clean and organized:

- `<name>.module.ts` — `@Module()` wiring only (controllers/providers/exports)
- `<name>.controller.ts` — routes, Swagger decorators, request/response mapping — delegates to the service
- `<name>.service.ts` — business logic only — calls the repository, never the DB client directly
- `<name>.repository.ts` — all DB access (Drizzle queries) for the module, nothing else
- `dto/<name>.dto.ts` — request/response DTOs with `class-validator`/`@nestjs/swagger` decorators

Beyond this baseline, split out additional files whenever a module has a distinct concern that doesn't belong in the files above — don't force unrelated logic into `service.ts`/`controller.ts` just to avoid a new file. Examples (non-exhaustive, use judgment):

- `<name>.constants.ts` — module-local constants/enums
- `<name>.config.ts` — module-local configuration
- `<name>.grpc-controller.ts` (or similar) — a gRPC/other-transport entry point alongside the REST controller
- `<name>.mapper.ts` / `<name>.serializer.ts` — response-shaping logic if it grows beyond a couple of lines in the controller
- any other clearly-scoped concern (e.g. a queue processor, a scheduled job, an event listener) as its own file

The goal is clean, structured, easy-to-navigate code — the 5-file baseline is the minimum, not a ceiling. Apply this to every new module/endpoint, and split up older modules that still bundle concerns together as part of any change that touches them.
