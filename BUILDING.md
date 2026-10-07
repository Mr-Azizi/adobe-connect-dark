# Building & Reproducing the Dark Reader MV3 Bundle

## End-User Installation (No Build Required)

**End users do NOT need Node.js, `npm`, `npm ci`, or `npm run build`.**

The generated Manifest V3 runtime bundle (`vendor/darkreader.js`) is intentionally committed to the repository and included in release ZIP archives so that anyone downloading the repository or a GitHub Release ZIP can immediately load the extension via `chrome://extensions` → **Load unpacked** (and run it completely offline).

---

## Developer & Maintainer Build Workflow

Only developers or maintainers who want to regenerate or verify `vendor/darkreader.js` from the pinned upstream `darkreader@4.9.133` package need Node.js and `npm`.

### 1. Install Pinned Dependencies

```bash
npm ci
```

### 2. Build the MV3 Dark Reader Bundle

```bash
npm run build:darkreader
```

*(or `npm run build`)*

This executes `scripts/build-darkreader.mjs`, which:
1. Reads the pinned `node_modules/darkreader/darkreader.js` (`darkreader@4.9.133`) and verifies its version and upstream SHA-256 checksum (`82619e7a0bcabbea15a91488bc74fd0f9ba8f8f2a1cc67527f78166037cce166`).
2. Applies the deterministic Manifest V3 transformation from upstream `src/inject/dynamic-theme/index.ts`:
   - Removes the MV2-only `createOrUpdateScript()` helper (`src/inject/dynamic-theme/index.ts:78-86`).
   - Replaces the `__CHROMIUM_MV3__ = false` inline `<script class="darkreader darkreader--proxy">` injection in `createStaticStyleOverrides()` (`src/inject/dynamic-theme/index.ts:245-249`) with the exact upstream `__CHROMIUM_MV3__ = true` branch (`document.dispatchEvent(new CustomEvent("__darkreader__stylesheetProxy__arg", { detail: { enableStyleSheetsProxy, enableCustomElementRegistryProxy } }))`).
3. Validates syntax and MV3 Content Security Policy (`script-src 'self'`) invariants before writing `vendor/darkreader.js` (`354,983` bytes, SHA-256: `7df6fd685baadd667b5d080bffbb21f7768673607ceee3a5e06cef29fc114183`).

### 3. Verify Bundle Reproducibility & CSP Compliance

```bash
npm run verify:darkreader
```

This executes `scripts/verify-darkreader.mjs` to confirm that `vendor/darkreader.js` on disk is byte-for-byte identical to a fresh build from `darkreader@4.9.133` and passes all MV3 CSP safety checks.

### 4. Load Unpacked in Chromium

After building, open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**, and click **Load unpacked** on the repository root (or click **Reload** if already loaded).

---

## Release Packaging Workflow

Maintainers can generate a clean, deterministic release ZIP archive from `manifest.json`:

```bash
npm ci
npm run verify:darkreader
npm run package:release
```

This executes `scripts/package-release.mjs`, which:
1. Reads the version dynamically from `manifest.json`.
2. Verifies that `vendor/darkreader.js` is byte-reproducible and MV3 CSP-compliant.
3. Validates all manifest and runtime-referenced files (`background.js`, `content/`, `popup/`, `styles/`, `vendor/`, `assets/fonts/`, `icons/`).
4. Stages runtime files temporarily under `dist/staging/Adobe-Connect-Dark-vX.Y.Z/`, audits version metadata and CSP invariants, generates the release artifact at:
   ```text
   dist/Adobe-Connect-Dark-vX.Y.Z.zip
   ```
   with a single root folder (`Adobe-Connect-Dark-vX.Y.Z/manifest.json`), and removes the staging directory.
5. Programmatically inspects the final ZIP archive to ensure development-only files (`node_modules/`, `.git/`, `tests/`, `scripts/`, `package.json`, `package-lock.json`, `BUILDING.md`, etc.) are excluded.

**End users still require NO `npm` or build step**—the release ZIP (`dist/Adobe-Connect-Dark-vX.Y.Z.zip`) contains all runtime files (including `vendor/darkreader.js`) ready to extract and load via `chrome://extensions` → **Load unpacked**.

---

## Generated File Policy

- `vendor/darkreader.js` is a **generated runtime artifact** produced from `darkreader@4.9.133` via `npm run build:darkreader`.
- **Never edit `vendor/darkreader.js` by hand.** Any change to the bundle generation must be made in `scripts/build-darkreader.mjs` and verified with `npm run verify:darkreader`.
- `vendor/darkreader.js` **must remain tracked in Git** and included in release ZIPs; `node_modules/` and `dist/` must remain excluded via `.gitignore`.

