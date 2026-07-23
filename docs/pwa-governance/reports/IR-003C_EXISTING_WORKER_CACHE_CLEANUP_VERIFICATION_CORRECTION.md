# IR-003C — Existing Worker Cache Cleanup Verification Correction

- **Document ID:** `IR-003C`
- **Implementation date:** 2026-07-23 (Africa/Johannesburg)
- **Authorizing decision:** `ER-003C` accepted
- **Defect location:** Playwright existing-worker upgrade verification procedure
- **Product worker change:** None
- **Authorized implementation files:** `tests/e2e/offline-fallback.spec.ts` and this report
- **Implementation status:** **PASS**
- **Release status:** Pending isolated release preparation and owner review
- **Merge/deployment status:** Not authorized and not performed

## 1. Executive result

The existing-worker Chromium regression now waits for the exact reviewed v3 worker to complete activation and control the client before inspecting Cache Storage. The correction does not rely on `navigator.serviceWorker.ready`, an unqualified `active.state`, or a generic controller-presence check.

The deterministic local fixture serves:

- an older worker at `/sw-v2.js`, with v2 cache identity;
- the byte-for-byte repository `public/sw.js` at `/sw-v3.js`; and
- distinct script URLs as deterministic worker identities.

The test first proves v2 controls the client, fully awaits creation of the historical and unrelated sentinel caches, requests v3 for the same root scope, and then applies a two-stage browser lifecycle barrier:

1. wait for exact v3 activation completion; and
2. reload and prove exact v3 control while rechecking the complete registration state.

Cache Storage is inspected only after the final barrier passes. Three consecutive clean existing-worker executions passed with retries disabled.

## 2. Corrected activation and control contract

The first identity-aware barrier requires all of the following simultaneously:

- exactly one root-scope registration;
- `registration.active.scriptURL === <origin>/sw-v3.js`;
- `registration.active.state === 'activated'`;
- `registration.installing === null`; and
- `registration.waiting === null`.

The exact active worker's `activated` state is the browser lifecycle guarantee that the v3 activation event and all work attached through `event.waitUntil(...)`, including the cache-deletion aggregate, have completed.

Because the reviewed worker calls `clients.claim()` separately from its activation `waitUntil(...)` chain, the test then reloads the document and applies a final pre-inspection barrier requiring all activation conditions above plus:

- `navigator.serviceWorker.controller` is present;
- `navigator.serviceWorker.controller.scriptURL === <origin>/sw-v3.js`; and
- `navigator.serviceWorker.controller.state === 'activated'`.

This sequence prevents the already-active v2 worker from satisfying the gate and prevents cache inspection during v3's parallel cleanup work.

## 3. Existing-worker regression procedure

The new dedicated test in `tests/e2e/offline-fallback.spec.ts` performs the following:

1. starts from a clean browser-origin state;
2. registers deterministic `/sw-v2.js` at root scope;
3. proves the exact v2 worker is activated and controls the client;
4. fully awaits seeding of `conferly-v1` and `unrelated-sentinel-cache`;
5. proves the complete pre-upgrade cache set contains:
   - `conferly-v1`;
   - `conferly-v2`;
   - `conferly-runtime-v2`; and
   - `unrelated-sentinel-cache`;
6. registers the exact reviewed repository worker as `/sw-v3.js` at the same scope;
7. waits for exact v3 activation completion;
8. reloads and waits for the complete exact-v3 activation/control condition;
9. makes an eligible static request and proves `conferly-runtime-v3` is populated;
10. inspects Cache Storage and verifies the required cleanup outcome; and
11. samples Cache Storage for at least 5,000 ms and proves `conferly-v1` is never recreated.

The external `BASE_URL` mode skips this local artifact-transition regression because an arbitrary external server cannot be assumed to expose the deterministic `/sw-v2.js` and `/sw-v3.js` fixtures. The existing clean-install/deployed-environment assertions remain available in that mode.

## 4. Required cleanup assertions

After the complete exact-v3 barrier passes, the browser test proves:

| Cache | Required result | Assertion result |
|---|---|---|
| `conferly-v1` | Absent | PASS |
| `conferly-v2` | Absent | PASS |
| `conferly-runtime-v2` | Absent | PASS |
| `conferly-v3` | Present | PASS |
| `conferly-runtime-v3` | Present after eligible runtime request | PASS |
| `unrelated-sentinel-cache` | Preserved | PASS |

The unrelated cache entry `/sentinel` is also read back and its body is asserted to remain exactly `preserve me`.

The recreation monitor records multiple Cache Storage samples, proves its final elapsed time is at least 5,000 ms, and requires every sample to report `conferly-v1` absent.

## 5. Validation results

### 5.1 Required final matrix

| Command | Exit code | Result |
|---|---:|---|
| `node --test tests/service-worker.test.mjs` | `0` | PASS — 15/15 tests passed. |
| `npx playwright test tests/e2e/offline-fallback.spec.ts --retries=0 --workers=1` | `0` | PASS — 2/2 Chromium tests passed in 19.6s. |
| `npm run type-check` | `0` | PASS — `tsc --noEmit`, no diagnostics. |
| `npm run lint` | `0` | PASS — 0 errors; two unrelated pre-existing warnings in `components/meet/MeetLiveSession.tsx` at lines 949 and 976. |
| `npm run build` | `0` | PASS — Next.js 16.2.6 production build completed; 32/32 static pages generated and `/offline` remained static. |

### 5.2 Repeated existing-worker verification

All repetitions used `--retries=0 --workers=1`.

| Run | Command/disposition | Exit code | Result |
|---|---|---:|---|
| Clean pass 1 | Focused existing-worker test | `0` | PASS — 1/1 passed in 59.5s. |
| Clean passes 2–3 | Focused test with `--repeat-each=2` | `0` | PASS — 2/2 passed in 39.2s. |

Result: **three consecutive clean passes** after the final correction, with no retry masking.

### 5.3 Non-passing implementation attempts

No failed or timed-out attempt is represented as a pass:

| Attempt | Exit/disposition | Finding and correction |
|---|---|---|
| Initial focused attempt | `1` | Timed out while Playwright created the `page` fixture under the 60-second configuration. File-level timeout was moved before fixture setup; assertions were unchanged. |
| Combined activation/control poll | `1` | Exact v3 activation completed, but controller takeover was not a reliable same-step signal because `clients.claim()` is separate from activation `waitUntil`. The test now waits for exact activation completion, reloads, and then applies the complete activation/control gate. |
| First five-second monitor assertion | `1` | Monitoring completed, but Cache Storage timing produced 20 rather than an assumed 21 samples. The assertion now measures the actual final elapsed duration (`>= 5,000 ms`) and requires every sample to show v1 absent. Monitoring duration and cleanup outcome were not weakened. |

## 6. Scope and product-worker integrity

No test-support file was required. No application, service-worker, deployment, registration, offline-policy, or cache-eligibility source was changed.

Scoped integrity evidence before the corrective commit:

- `git diff --name-only -- public/sw.js` returned no path;
- working-tree `public/sw.js` Git blob: `17618feba6451674028181f983ee9b348b8ccc4f`;
- reviewed `HEAD:public/sw.js` Git blob: `17618feba6451674028181f983ee9b348b8ccc4f`;
- the two blob IDs are identical; and
- `git diff --check -- tests/e2e/offline-fallback.spec.ts` exited `0`.

The only implementation source changed by IR-003C is `tests/e2e/offline-fallback.spec.ts`; this report is the only documentation addition.

## 7. Self-review

- **Readability:** Lifecycle phases are explicit: v2 control, awaited seed, v3 activation completion, v3 control, cache verification, and non-recreation monitoring.
- **Identity safety:** Distinct deterministic script URLs prevent v2 from satisfying the v3 gate.
- **Lifecycle safety:** Cache inspection cannot occur until the exact v3 active worker is activated with no installing/waiting worker and the exact v3 controller is present.
- **Test isolation:** Origin registrations and caches are removed before setup; one root registration is required.
- **Policy preservation:** No cleanup expectation, cache eligibility rule, protected-path rule, or offline behavior was weakened.
- **Diagnostics:** Poll return objects expose registration count, scope, script identity, lifecycle state, and installing/waiting presence on failure.

## 8. Release disposition

The corrective implementation and validation matrix pass. Release preparation must still preserve the complete reviewed IR-003 + IR-003B worker and apply this test-only IR-003C correction on a clean branch from current `origin/main`.

No merge or deployment is authorized by this report. A superseding pull request requires owner review and explicit approval. No subsequent BTD-001 item may begin as part of this work.

**Implementation status: PASS.**
