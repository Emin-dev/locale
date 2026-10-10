# Locale verification record

## Executed and passed

- Rust 1.99.0 native tests: **21/21** (`cargo test --locked`). Covers declared coverage; approval/rejection/comment sequences; changed bytes, metadata and target invalidation; hash mismatch; absent bytes/identity; duplicate slots/images; unsafe paths; input/count limits; stale project revision; idempotent repeated decisions; unknown fields; required change-request notes; invalid calendar dates; complete/partial export.
- Strict Clippy: `cargo clippy --offline --all-targets -- -D warnings` passed.
- `cargo fmt --check` passed.
- Release WebAssembly compilation for `wasm32-unknown-unknown` passed. Built core: **224,375 bytes** at this revision.
- Node executes the actual compiled WASM ABI: **10 assertion groups** passed. Includes the 12-slot sample oracle, 9 capture records, stale/unverified counts, decision sequence, changed-byte invalidation, stale-revision denial, truthful export, 250 repeat calls, input allocation bound, PNG header inspection and malformed/oversized image-header negatives.
- Node syntax checks passed for `web/app.js` and `web/files.js`.
- Native CLI read a fixture from stdin and returned expected 2-slot / 1-missing audit.
- All imported strings are rendered via text nodes / textContent. App code contains no innerHTML, eval, remote-image fetch, localStorage, cookies or third-party scripts. User image acquisition is through explicit file inputs.

Exact source and WASM hashes: `source-sha256.txt`. Rust dependencies: `Cargo.lock`. Node evidence: `wasm-results.json`. These are local source hashes, not invented repository commit hashes.

## Browser verification: not yet executed

A complete Playwright test script is supplied at `scripts/browser-tests.py`. The initial source version’s attempted local launch did **not** reach the application. Browser setup is now explicitly pinned in requirements-browser.lock and supports its bundled Chromium; the revised browser suite has not been run in this restricted environment. Chromium terminated on a sandbox-denied Unix socket; a second launch encountered the same restriction. A separate browser environment could not connect to the local server (`ERR_CONNECTION_REFUSED`). No workaround was attempted after that was confirmed.

Therefore **no passing browser result, visual inspection, screenshot, real-device result or deployment verification is claimed** here. Checks against an accessible preview are still required before claiming browser acceptance. Browser QA is a release gate. The provided test must run against final source before its assertions are considered verified.

## Required browser acceptance checklist

Desktop (1440×1050), narrow desktop/tablet, 390×844 mobile viewport, plus keyboard-only:

1. Initial sample reaches 12 required views, 9 captured records, 2 approved, 6 attention items. No uncaught errors, external requests or CSP violations. All images decode; no broken thumbnails.
2. Open a pending capture. Reference and selected locale labels match actual displayed images and metadata. Actual-size mode scrolls within each pane.
3. Approve, click approve again, require a single duplicate-idempotent event. Request changes without a note must fail; then add a note and save. Comment does not overwrite the decision. User-controlled HTML-like text remains literal.
4. Replace image bytes on a reviewed capture. The previous decision is visibly invalidated and retained as previous-evidence history. Reattach identical bytes and verify evidence identity semantics.
5. Missing capture, old-build capture and missing-catalog capture each disable approval. A manifest-only import remains unverified until local image bytes and reviewer name are supplied.
6. Filters combine correctly: all / attention / approved; locale; screen/state search. No-results view is useful and clear reset restores results. Matrices with many locales scroll inside the matrix, not the page.
7. Export downloads valid JSON containing current/old review binding, incomplete blockers, no image bytes and the unauthenticated-review/provenance caveat. Inspect filename/name/comment warnings.
8. Import: no manifest, malformed JSON, unknown fields, unsafe path/URL, duplicate slot/image, unexpected file, incorrect image bytes, large dimensions, individual/total file size and total pixel limits all fail without losing the current project.
9. Cancel or Escape during file processing; close and reopen import; reject stale asynchronous results. No late import replaces current data. Replacement must be discarded if the review closes or changes while decoding.
10. Dialogs have headings, trapped tab focus, Escape/Close/Cancel, focus restoration after updates and no keyboard-obscured irreversible action. All required controls are reachable on phone. No page-wide horizontal overflow.
11. Reload explicitly resets tab-memory work to the synthetic sample. Export-first warning before sample reset is clear; cancelling reset retains work. Browser back/forward restoration does not revoke still-visible image URLs.
12. Inspect desktop and phone screenshots for readable contrast, text truncation, overflow, malformed Arabic fixture glyphs, empty/error/loading/success states and usable target sizes. Viewport emulation is not real iOS/Android/Safari testing; record those separately if performed.

## Remaining scope limits

No synchronized server, accounts, trusted identities, signed approvals, screenshot capture runner, automatic visual/translation/accessibility analysis, real-team validation, external publication or real-device verification. No external publication is established by these local checks.

## Regression fixes, 2026-10-09

- Capacity: reproduced the exact 1,048,576-byte `decide` request from the boundary regression fixture. It now fails atomically with a capacity message; the original 499-event project is unchanged and still exports. Evidence: `capacity-results.json`; regression: `scripts/capacity-tests.mjs`. Rust validation requires every accepted snapshot to fit an export request.
- Accessibility: all reported evidence labels now calculate at least 6.285:1, and reported body/supporting text at least 5.777:1. The app explicitly uses a light palette under both OS preferences; no dark theme is claimed. Configuration, text size and appearance are visible and included in capture accessible names. The modal has its own polite live status region. `100% (CSS pixels)` displays intrinsic image width rather than forcing 390px, with focusable scroll regions and explicit scaling semantics. Evidence: `accessibility-static-results.json`. Calculations/source assertions are not computed-browser or screen-reader tests.
- Image resource lifetime: local reads and decoding use one shared queue, maximum one active worker plus one pending job. Cancel aborts FileReader and terminates the active worker context; closed or changed sessions cannot commit late previews. Eight injected-worker regression groups pass, max active workers 1 and live workers at test end 0. Evidence: `image-pipeline-results.json`. These are unit tests, not actual image decoder or OS memory verification.
- Packaging: exact license/notice texts for 21 pinned Rust dependencies (43 files) are retained under licenses/ and verbatim in the served third-party-licenses.txt bundle. Static build smoke checks lockfile coverage, notice hashes, served texts, real WASM and all nine sample captures.
- Deployment: explicit `framework: null`, empty install command and Node-only static verification build; no automatic Rust build or test dependency installation.
- Reproduction: Rust compiler 1.99.0 / target / components pinned; Python 3.12 browser-runner packages pinned with setup instructions. Browser script now includes a 1920×1080 image-scale check and in-dialog status assertion. Browser execution remains pending.
- Multiline comments are now valid and preserved; other unexpected control characters remain rejected.

Updated counts and source hashes supersede earlier test results. These are local verification results, not deployment evidence.

## Reproducible-path rebuild

The artifact was rebuilt with portable checkout/cache/toolchain path prefixes; the Rust domain source is unchanged. Previous WASM SHA-256: `ade6b8f4a33b72ef7a8ca0cd8aa99b1bbffd1f6df23d2c2081b13cf8c2670923`. Current WASM SHA-256: `bce0a534f399a2f123398fa851e3b3beb2bf6a6fcf68b22924ca863cd07f03bf`. All native, WASM, capacity, image-queue, accessibility-source and static-packaging suites passed again. The static gate rejects embedded absolute user/build path prefixes. Browser verification remains pending.

Public command logs normalize machine-specific checkout paths to `<project>`; their test outcomes and counts are unchanged.

## Standard-library distribution notices

The exact Rust 1.99.0 `COPYRIGHT-library.html` is retained in source and served unchanged, SHA-256 `5647be074c8edf7339fd863055923a8fc80bc5610a8d4661ec3b767b9d392c27`. The static packaging assertion checks source and served copies against that pinned hash. This addition does not change the compiled WASM or domain code.
