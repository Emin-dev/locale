"""Rebuild distributable dependency notices from Cargo.lock's installed sources."""
import hashlib,json,pathlib,subprocess
root=pathlib.Path(__file__).resolve().parents[1]
meta=json.loads(subprocess.check_output(['cargo','metadata','--locked','--offline','--format-version','1'],cwd=root))
locked=__import__('tomllib').loads((root/'Cargo.lock').read_text())['package']
checksums={(p['name'],p['version']):p.get('checksum') for p in locked}
entries=[];bundle=['Locale: pinned third-party dependency license texts\nGenerated from Cargo.lock package sources. Includes build-time crates as well as runtime dependencies.\n']
for package in sorted(meta['packages'],key=lambda p:(p['name'],p['version'])):
 if package['source'] is None:continue
 name=f"{package['name']}-{package['version']}";source=pathlib.Path(package['manifest_path']).parent;dest=root/'licenses'/name;dest.mkdir(parents=True,exist_ok=True)
 files=[p for p in sorted(source.iterdir()) if p.is_file() and p.name.upper().startswith(('LICENSE','COPYING','NOTICE','UNLICENSE'))]
 if not files:raise RuntimeError(f'Missing license texts for {name}')
 for file in files:
  raw=file.read_bytes();(dest/file.name).write_bytes(raw)
  entries.append(dict(crate=package['name'],version=package['version'],registry_checksum=checksums[(package['name'],package['version'])],spdx=package['license'],file=str((dest/file.name).relative_to(root)),sha256=hashlib.sha256(raw).hexdigest()))
  bundle.append(f'\n\n===== {name} / {file.name} =====\n{raw.decode("utf-8")}')
(root/'web/third-party-licenses.txt').write_text(''.join(bundle))
(root/'licenses/manifest.json').write_text(json.dumps(entries,indent=2)+'\n')
print(f'Copied {len(entries)} license/notice files for {len(set((e["crate"],e["version"]) for e in entries))} pinned crates.')

# Rust's standard library is linked into the WASM even though it is not a Cargo
# dependency. Preserve the exact notices distributed by the pinned toolchain.
sysroot=pathlib.Path(subprocess.check_output(['rustc','--print','sysroot'],cwd=root,text=True).strip())
compiler=subprocess.check_output(['rustc','--version'],cwd=root,text=True).strip()
if not compiler.startswith('rustc 1.99.0 '):raise RuntimeError('Expected the pinned Rust 1.99.0 compiler.')
standard=(sysroot/'share/doc/rust/COPYRIGHT-library.html').read_bytes()
standard_hash=hashlib.sha256(standard).hexdigest()
if standard_hash!='5647be074c8edf7339fd863055923a8fc80bc5610a8d4661ec3b767b9d392c27':raise RuntimeError('Unexpected Rust standard-library notice revision.')
(root/'licenses/rust-1.99.0').mkdir(exist_ok=True)
(root/'licenses/rust-1.99.0/COPYRIGHT-library.html').write_bytes(standard)
(root/'web/RUST-STANDARD-LIBRARY-NOTICES.html').write_bytes(standard)
(root/'licenses/rust-standard-library.json').write_text(json.dumps(dict(compiler=compiler,source='licenses/rust-1.99.0/COPYRIGHT-library.html',served='web/RUST-STANDARD-LIBRARY-NOTICES.html',sha256=standard_hash),indent=2)+'\n')
print('Copied pinned Rust 1.99.0 standard-library notices unchanged.')
