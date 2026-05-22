# Remote Repository Audit — MCT9050/Conferly

Date: 2026-05-22

## Objective
Inspect the remote GitHub repository state without modifying history, branches, or pushing changes.

## Methodology
- Created a temporary bare mirror clone of `https://github.com/MCT9050/Conferly` at `/tmp/conferly-remote-audit`
- Queried remote branch heads and tags directly from GitHub
- Inspected `origin/main` tree and key root files
- Searched history for legacy Vite/SP A artifacts
- Analyzed repo object size and large blobs

## Branch Audit
- Remote branch heads: only `main`
- No remote tags found
- No additional visible branches in `refs/heads`
- The mirror also exposed GitHub PR refs (`refs/pull/1/head`, `refs/pull/2/head`), but these are not active branch heads

## Current `origin/main` Assessment
- Current `main` commit: `1358c6b6f2fe367480b088fe86882a740851adc1`
- Commit date: `2026-05-19 23:41:06 +0200`
- Commit message: `Fresh clean rebuild of Conferly`
- Top-level repository state includes legacy SPA/Vite artifacts:
  - `index.html`
  - `src/main.tsx`
  - `vite.config.ts`
  - `package.json` with `vite`, `@vitejs/plugin-react`, `@tailwindcss/vite`, `vite-plugin-singlefile`
  - `vercel.json` configured for Vite deployment
  - `docker-compose.yml`, `netlify.toml`, `nginx.conf`, `server/`, `supabase/`

## Commit History & Bloat Audit
- Remote history contains significant legacy or generated artifacts, including:
  - `supabase.tar.gz`
  - `dist/index.html`
  - `dist/assets/*.js`
  - multiple `test-results/.../trace.zip`
- Repository object pack size: `41.24 MiB`
- Largest historical blobs include:
  - `supabase.tar.gz` (~30 MiB)
  - `dist/index.html` (~1.3 MiB)
  - `dist/assets/*` vendor/editor JS bundles
  - test trace ZIP artifacts

## Repository Size & Structure
- Remote repo is not large by GitHub standards, but it contains historical bloat from generated/dist artifacts and packaged test outputs
- The current main tree does not include tracked `node_modules/`, `.next/`, or `coverage/` directories, but it does still include legacy structural files

## Key Findings
1. **Remote `main` is a legacy Vite app**, not the finalized Next.js App Router workspace present locally.
2. **There is only one active remote branch** (`main`), so branch-level preservation is minimal.
3. **The remote history contains build artifact bloat** and large binaries that should be cleaned before production use.
4. **No remote tags or additional branches** were found, meaning the remote repo state is effectively controlled by `main`.

## Recommendation
- **Recommend a controlled clean reset strategy** rather than preserving the current remote history.
- The safest path is to preserve the existing remote `main` state as a backup snapshot, then replace it with the finalized Next.js production baseline.
- Because the remote repository currently represents an obsolete Vite-era architecture, incremental cleanup is not sufficient for a clean production deployment.

## Risk Assessment
- **Preserving existing history** leaves legacy Vite files and artifact-heavy commits in the repository, which is undesirable for a clean deployment baseline.
- **Force-push/history rewrite** is likely required to replace `origin/main` with the new Next.js architecture.
- **Safer approach**: create a backup branch or remote mirror of the current `main` before any rewrite, then push the clean baseline to `origin/main`.

## Evidence Summary
- `git ls-remote --heads https://github.com/MCT9050/Conferly` → only `refs/heads/main`
- `git ls-tree --name-only refs/heads/main | egrep 'vite\.config|index\.html|src/main\.tsx'` → confirmed legacy SPA files
- `package.json` on remote main references `vite` and Vite plugins
- `vercel.json` on remote main is configured with `framework: "vite"`
- Large bad objects found in history include `supabase.tar.gz`, `dist/*`, and `test-results/*`
