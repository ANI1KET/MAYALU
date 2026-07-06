# Testing Guide — Mayalu Wears API

## Philosophy

- **Unit tests first**: All services are tested in isolation with mocked database.
- **No integration tests required at startup**: mocking the Drizzle DB is sufficient.
- **TDD workflow**: Write the test, watch it fail, write the code, watch it pass.
- **Coverage thresholds**: lines 70%, functions 70%, branches 60%.

## Running Tests

```bash
npm test              # Run all 13 test suites once
npm run test:watch    # TDD mode — re-runs on file change
npm run test:cov      # Generate coverage report → coverage/index.html
```

## Test Suites (13 total)

| File | Tests | Purpose |
|------|-------|---------|
| `jwt.service.spec.ts` | 7 | Sign/verify, tamper detection, expiry, secret length |
| `token.service.spec.ts` | 10 | Issuance, rotation, reuse detection, revocation |
| `plan-gate.service.spec.ts` | 6 | Limit checking, unlimited plan, missing usage row |
| `auth.service.spec.ts` | 10 | OTP cooldown, max attempts, suspended accounts |
| `shops.service.spec.ts` | 7 | Phone verification, slug uniqueness, transaction |
| `products.service.spec.ts` | 9 | Plan gate, publish validation, delete rules |
| `cart.service.spec.ts` | 7 | Stock checks, merge behaviour, clear cart |
| `orders.service.spec.ts` | 7 | Address, empty cart, stock, atomic tx, SMS |
| `inventory.service.spec.ts` | 6 | Warehouse scope, negative stock prevention |
| `coupons.service.spec.ts` | 10 | All validation rules, discount calculation |
| `reviews.service.spec.ts` | 5 | Delivered order check, duplicate prevention |
| `categories.service.spec.ts` | 5 | Tree building, ltree subtree, breadcrumb |
| `attributes.service.spec.ts` | 6 | Category mapping, variant flag |

## Mock Pattern

All tests use the same DB mock shape that mirrors the Drizzle query API:

```typescript
const mockDb = {
  query: {
    tableName: {
      findFirst: jest.fn().mockResolvedValue(mockRecord),
      findMany: jest.fn().mockResolvedValue([mockRecord]),
    },
  },
  insert: jest.fn().mockReturnValue({
    values: jest.fn().mockReturnValue({
      returning: jest.fn().mockResolvedValue([mockRecord]),
    }),
  }),
  update: jest.fn().mockReturnValue({
    set: jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue([mockRecord]),
    }),
  }),
  delete: jest.fn().mockReturnValue({
    where: jest.fn().mockResolvedValue([]),
  }),
  transaction: jest.fn().mockImplementation(async (fn) => fn(mockDb)),
  execute: jest.fn().mockResolvedValue({ rows: [] }),
};
```

## Writing a New Test

```typescript
// src/modules/mymodule/__tests__/my.service.spec.ts
import { MyService } from '../my.service';
import { NotFoundException } from '@nestjs/common';

const mockRecord = { id: 'rec1', name: 'Test' };

const makeDb = () => ({
  query: {
    myTable: { findFirst: jest.fn().mockResolvedValue(mockRecord) },
  },
  insert: jest.fn().mockReturnValue({
    values: jest.fn().mockReturnValue({
      returning: jest.fn().mockResolvedValue([mockRecord]),
    }),
  }),
});

describe('MyService', () => {
  let service: MyService;
  let db: ReturnType<typeof makeDb>;

  beforeEach(() => {
    db = makeDb();
    service = new MyService(db as never);
    jest.clearAllMocks();
  });

  it('findOne: returns record when found', async () => {
    const result = await service.findOne('rec1');
    expect(result.id).toBe('rec1');
  });

  it('findOne: throws NotFoundException when not found', async () => {
    db.query.myTable.findFirst.mockResolvedValue(null);
    await expect(service.findOne('bad-id')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'NOT_FOUND' }),
    });
  });
});
```

## Coverage Report

After running `npm run test:cov`:
```
coverage/
  index.html      ← Open in browser for visual report
  lcov.info       ← For CI integrations (SonarQube, Codecov)
```

## CI Integration (GitHub Actions example)

```yaml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run test:cov
      - uses: codecov/codecov-action@v4
```
