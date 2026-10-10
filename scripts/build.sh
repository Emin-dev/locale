#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# The compiler and WASM target are pinned in rust-toolchain.toml.
# Keep checkout, registry cache and toolchain locations out of shipped binaries.
project_dir="$(pwd)"
cargo_dir="${CARGO_HOME:-$HOME/.cargo}"
rustup_dir="${RUSTUP_HOME:-$HOME/.rustup}"
export RUSTFLAGS="${RUSTFLAGS:-} --remap-path-prefix=$project_dir=. --remap-path-prefix=$cargo_dir=cargo --remap-path-prefix=$rustup_dir=rustup"
cargo test --locked
cargo build --locked --release --target wasm32-unknown-unknown
cp target/wasm32-unknown-unknown/release/locale_review.wasm web/locale_review.wasm
printf 'Built web/locale_review.wasm (%s bytes)\n' "$(wc -c < web/locale_review.wasm)"
