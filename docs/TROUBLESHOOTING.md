# Troubleshooting

## `ENOENT: process.cwd failed ... uv_cwd` during `pnpm install`

**Full error:**
```
node:internal/bootstrap/switches/does_own_process_state:142
    cachedCwd = rawMethods.cwd();
Error: ENOENT: process.cwd failed with error no such file or directory,
the current working directory was likely removed without changing the
working directory, uv_cwd
    at .../tinyglobby/.../index.mjs
    at .../workspace/projects-reader/lib/findPackages.js
    at .../workspace/projects-filter/lib/index.js
```

### Cause

This is **not** a problem with this project. It is a known interaction between:

- **Node.js v24's** new internal `process.cwd()` caching (`does_own_process_state.js`), and
- **pnpm v10's** `tinyglobby`-based workspace project scanner, which calls `process.cwd()`
  unconditionally on every `install` — even for single-package (non-monorepo) projects.

If anything makes the cached cwd handle stale (most commonly: re-extracting/replacing the
project folder while a terminal session is `cd`'d into it, or running inside a
cloud-synced folder such as iCloud Drive `~/Desktop` / `~/Documents` on macOS), this
combination throws `ENOENT` before pnpm even reads `package.json`.

We confirmed this project has **zero** workspace config (`pnpm-workspace.yaml`,
`workspaces` field, `lerna.json`, `nx.json`, `turbo.json` — none present), so there is
nothing in this codebase that triggers or fixes this.

### Fix — Option A (fastest, no environment changes)

This project has no pnpm-specific syntax (no `workspace:` protocol deps, no catalogs),
so `npm` is a drop-in replacement:

```bash
rm -rf node_modules dist pnpm-lock.yaml
npm install
npm run build
npm run start:dev
```

### Fix — Option B (keep using pnpm)

Downgrade to Node 22 LTS, which does not have the new cwd-caching behavior:

```bash
nvm install 22
nvm use 22
rm -rf node_modules dist pnpm-lock.yaml
pnpm install
```

### Fix — Option C (diagnose a stale cwd directly)

```bash
pwd           # logical path
pwd -P        # physical path, resolves symlinks
cd "$(pwd -P)"
pnpm install
```

If `pwd -P` differs from `pwd`, your shell is inside a symlinked directory
(common with iCloud Drive). `cd` into the physical path and retry.

If the project folder lives under `~/Desktop` or `~/Documents` on macOS, move it
to a non-iCloud path (e.g. `~/dev/`) — both folders are iCloud-synced by default
since macOS Ventura, which can cause exactly this kind of transient inode issue.

---

## `This expression is not callable` for `cookieParser` / `compression`

Fixed in `tsconfig.json` via `"esModuleInterop": true` + default imports in `main.ts`.
If you see this for a *different* package, the fix is the same pattern:
```ts
// ❌ Before (only works without esModuleInterop, and only for some type defs)
import * as foo from 'foo';

// ✅ After
import foo from 'foo';
```

---

## `[ERR_PNPM_IGNORED_BUILDS]`

Fixed via `.npmrc` → `ignore-scripts=false`. This allows native build steps
(argon2, esbuild, @nestjs/core) to run their postinstall scripts.
