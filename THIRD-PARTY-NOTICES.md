# Third-party notices

Locale's original code and synthetic artwork are MIT licensed (see LICENSE).

All pinned Cargo dependencies' packaged LICENSE, COPYING, NOTICE and UNLICENSE texts are retained verbatim under `licenses/<name>-<version>/`. The complete set is concatenated in **web/third-party-licenses.txt**, which is shipped and linked in the static application. `licenses/manifest.json` records exact package versions, registry checksums, declared SPDX expressions and each retained text's SHA-256. This includes build-time dependencies; not every listed crate contributes runtime code.

Regenerate after changing Cargo.lock by running `python scripts/collect-licenses.py` with the locked dependency sources available. `node scripts/verify-build.mjs` fails if any locked dependency or retained text is missing, altered or absent from the served bundle. This packaging check is not a comprehensive legal or security audit. Rust 1.99.0 standard-library notices are retained unchanged in `licenses/rust-1.99.0/COPYRIGHT-library.html` and served as `web/RUST-STANDARD-LIBRARY-NOTICES.html`; `licenses/rust-standard-library.json` binds both to the exact upstream SHA-256. These cover the standard-library code linked into the WASM. The compiler executable and external test-runner tools are not redistributed; consult their own distributions if redistributing those tools.

Fixture screenshots contain rasterized glyphs from the system DejaVu Sans font, not redistributed font files. Original fixture artwork and all first-party content are synthetic.
