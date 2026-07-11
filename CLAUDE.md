# Testing

The primary/main test suite for this API is the **`api-tests/` folder** (Postman collection), not the Jest suites under `src/**/__tests__`. Jest covers unit-level service logic; `api-tests/generate-postman.js` is the source of truth for full endpoint request/response contracts.

Whenever an endpoint's request/response shape changes, update `api-tests/generate-postman.js` and regenerate in the same change:

```bash
node api-tests/generate-postman.js
```

This rewrites `mayalu-wears.postman_collection.json`. Don't let it drift out of sync with the actual API.
