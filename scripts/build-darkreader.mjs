/**
 * Reproducible Manifest V3 Builder for Dark Reader (`vendor/darkreader.js`)
 *
 * Background:
 *   The official `darkreader@4.9.133` npm package ships only pre-bundled UMD/ESM
 *   builds (`darkreader.js`, `darkreader.mjs`) compiled by upstream's
 *   `tasks/bundle-api.js` with `@rollup/plugin-replace` set to:
 *     `__CHROMIUM_MV3__: false`
 *
 *   In upstream `src/inject/dynamic-theme/index.ts`, `__CHROMIUM_MV3__` controls
 *   whether `createStaticStyleOverrides()` injects an inline `<script class="darkreader darkreader--proxy">`
 *   into `document.head` (the MV2 branch) or dispatches the MV3 custom event
 *   `__darkreader__stylesheetProxy__arg` without creating any `<script>` element:
 *
 *   Upstream `src/inject/dynamic-theme/index.ts` (v4.9.133, lines 241-249):
 *   ```ts
 *   document.dispatchEvent(new CustomEvent('__darkreader__cleanUp'));
 *   if (__CHROMIUM_MV3__) {
 *       // Notify the dedicated injector of the data.
 *       document.dispatchEvent(new CustomEvent('__darkreader__stylesheetProxy__arg', {detail: {enableStyleSheetsProxy, enableCustomElementRegistryProxy}}));
 *   } else {
 *       const proxyScript = createOrUpdateScript('darkreader--proxy');
 *       proxyScript.append(`(${injectProxy})(${enableStyleSheetsProxy}, ${enableCustomElementRegistryProxy})`);
 *       document.head.insertBefore(proxyScript, rootVarsStyle.nextSibling);
 *       proxyScript.remove();
 *   }
 *   ```
 *
 *   Because the npm tarball does not include `src/` or `tasks/`, this script
 *   deterministically transforms the pinned `node_modules/darkreader/darkreader.js`
 *   bundle (`darkreader@4.9.133`) from the `__CHROMIUM_MV3__ = false` branch into
 *   upstream's exact `__CHROMIUM_MV3__ = true` branch and removes the MV2-only
 *   `createOrUpdateScript()` helper (`src/inject/dynamic-theme/index.ts:78-86`).
 *
 *   No other lines in `darkreader@4.9.133` are modified.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const PROJECT_ROOT = path.resolve(__dirname, '..');
export const EXPECTED_DARKREADER_VERSION = '4.9.133';
export const EXPECTED_UPSTREAM_SHA256 =
  '82619e7a0bcabbea15a91488bc74fd0f9ba8f8f2a1cc67527f78166037cce166';

export const UPSTREAM_PKG_PATH = path.join(
  PROJECT_ROOT,
  'node_modules',
  'darkreader',
  'package.json'
);
export const UPSTREAM_BUNDLE_PATH = path.join(
  PROJECT_ROOT,
  'node_modules',
  'darkreader',
  'darkreader.js'
);
export const OUTPUT_VENDOR_PATH = path.join(
  PROJECT_ROOT,
  'vendor',
  'darkreader.js'
);

/**
 * Exact MV2-only helper in `node_modules/darkreader/darkreader.js` (lines 8175-8183)
 * corresponding to `src/inject/dynamic-theme/index.ts` lines 78-86:
 * `Note: This function is used only with MV2.`
 */
const MV2_CREATE_OR_UPDATE_SCRIPT_BLOCK = [
  '    function createOrUpdateScript(className, root = document.head || document) {',
  '        let element = root.querySelector(`.${className}`);',
  '        if (!element) {',
  '            element = document.createElement("script");',
  '            element.classList.add("darkreader");',
  '            element.classList.add(className);',
  '        }',
  '        return element;',
  '    }'
].join('\n');

/**
 * Exact `__CHROMIUM_MV3__: false` block in `createStaticStyleOverrides()`
 * in `node_modules/darkreader/darkreader.js` (lines 8380-8388)
 * corresponding to `src/inject/dynamic-theme/index.ts` lines 241-249.
 */
const MV2_PROXY_INJECTION_BLOCK = [
  '        document.dispatchEvent(new CustomEvent("__darkreader__cleanUp"));',
  '        {',
  '            const proxyScript = createOrUpdateScript("darkreader--proxy");',
  '            proxyScript.append(',
  '                `(${injectProxy})(${enableStyleSheetsProxy}, ${enableCustomElementRegistryProxy})`',
  '            );',
  '            document.head.insertBefore(proxyScript, rootVarsStyle.nextSibling);',
  '            proxyScript.remove();',
  '        }'
].join('\n');

/**
 * Exact `__CHROMIUM_MV3__: true` block from upstream `src/inject/dynamic-theme/index.ts`
 * lines 241-244.
 */
const MV3_PROXY_ARG_DISPATCH_BLOCK = [
  '        document.dispatchEvent(new CustomEvent("__darkreader__cleanUp"));',
  '        {',
  '            document.dispatchEvent(',
  '                new CustomEvent("__darkreader__stylesheetProxy__arg", {',
  '                    detail: {',
  '                        enableStyleSheetsProxy,',
  '                        enableCustomElementRegistryProxy',
  '                    }',
  '                })',
  '            );',
  '        }'
].join('\n');

export function sha256(bufferOrString) {
  return crypto.createHash('sha256').update(bufferOrString).digest('hex');
}

function replaceExactOnce(source, target, replacement, description) {
  const firstIndex = source.indexOf(target);
  if (firstIndex === -1) {
    throw new Error(
      `[build-darkreader] Expected upstream block not found: ${description}`
    );
  }
  const secondIndex = source.indexOf(target, firstIndex + target.length);
  if (secondIndex !== -1) {
    throw new Error(
      `[build-darkreader] Expected upstream block matched multiple times: ${description}`
    );
  }
  return (
    source.slice(0, firstIndex) +
    replacement +
    source.slice(firstIndex + target.length)
  );
}

export function validateGeneratedMv3Bundle(code) {
  // 1. Syntax check via V8 vm.Script compilation
  new vm.Script(code, { filename: 'vendor/darkreader.js' });

  // 2. MV3 CSP compliance invariants
  const forbiddenPatterns = [
    {
      name: 'MV2 createOrUpdateScript helper',
      re: /\bcreateOrUpdateScript\b/
    },
    {
      name: 'document.createElement("script")',
      re: /createElement\s*\(\s*['"]script['"]\s*\)/i
    },
    {
      name: 'eval()',
      re: /\beval\s*\(/
    },
    {
      name: 'new Function()',
      re: /\bnew\s+Function\s*\(/
    }
  ];

  for (const { name, re } of forbiddenPatterns) {
    if (re.test(code)) {
      throw new Error(
        `[build-darkreader] Validation failed: generated bundle contains forbidden pattern (${name})`
      );
    }
  }

  if (!code.includes('__darkreader__stylesheetProxy__arg')) {
    throw new Error(
      '[build-darkreader] Validation failed: generated bundle is missing MV3 __darkreader__stylesheetProxy__arg dispatch'
    );
  }
}

export function buildDarkReaderBundle({ write = true } = {}) {
  if (!fs.existsSync(UPSTREAM_PKG_PATH) || !fs.existsSync(UPSTREAM_BUNDLE_PATH)) {
    throw new Error(
      '[build-darkreader] Missing node_modules/darkreader. Run "npm ci" first.'
    );
  }

  const pkg = JSON.parse(fs.readFileSync(UPSTREAM_PKG_PATH, 'utf8'));
  if (pkg.version !== EXPECTED_DARKREADER_VERSION) {
    throw new Error(
      `[build-darkreader] Version mismatch: expected darkreader@${EXPECTED_DARKREADER_VERSION}, found darkreader@${pkg.version}`
    );
  }

  const rawBytes = fs.readFileSync(UPSTREAM_BUNDLE_PATH);
  const upstreamHash = sha256(rawBytes);
  if (upstreamHash !== EXPECTED_UPSTREAM_SHA256) {
    throw new Error(
      `[build-darkreader] Upstream checksum mismatch for node_modules/darkreader/darkreader.js.\n` +
        `  Expected: ${EXPECTED_UPSTREAM_SHA256}\n` +
        `  Actual:   ${upstreamHash}`
    );
  }

  // Normalize to LF internally for deterministic transformation
  const normalizedLf = rawBytes.toString('utf8').replace(/\r\n/g, '\n');

  // 1. Remove unused MV2-only createOrUpdateScript() function
  const withoutMv2ScriptHelper = replaceExactOnce(
    normalizedLf,
    MV2_CREATE_OR_UPDATE_SCRIPT_BLOCK + '\n',
    '',
    'MV2 createOrUpdateScript() helper'
  );

  // 2. Replace MV2 inline proxy <script> block with upstream's __CHROMIUM_MV3__ CustomEvent dispatch
  const mv3Lf = replaceExactOnce(
    withoutMv2ScriptHelper,
    MV2_PROXY_INJECTION_BLOCK,
    MV3_PROXY_ARG_DISPATCH_BLOCK,
    'createStaticStyleOverrides() MV2 proxy script injection block'
  );

  // Preserve upstream CRLF line endings for minimal diff against node_modules/darkreader/darkreader.js
  const outputCode = mv3Lf.replace(/\n/g, '\r\n');
  const outputBuffer = Buffer.from(outputCode, 'utf8');

  validateGeneratedMv3Bundle(outputCode);

  if (write) {
    fs.mkdirSync(path.dirname(OUTPUT_VENDOR_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_VENDOR_PATH, outputBuffer);
  }

  return {
    version: pkg.version,
    sourcePath: path.relative(PROJECT_ROOT, UPSTREAM_BUNDLE_PATH).replace(/\\/g, '/'),
    outputPath: path.relative(PROJECT_ROOT, OUTPUT_VENDOR_PATH).replace(/\\/g, '/'),
    upstreamSha256: upstreamHash,
    outputSha256: sha256(outputBuffer),
    outputBytes: outputBuffer.byteLength,
    outputBuffer
  };
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(__filename);

if (isMain) {
  const result = buildDarkReaderBundle({ write: true });
  console.log('[build-darkreader] Successfully generated MV3 Dark Reader bundle:');
  console.log(`  Version:      darkreader@${result.version}`);
  console.log(`  Source:       ${result.sourcePath} (sha256: ${result.upstreamSha256})`);
  console.log(`  Output:       ${result.outputPath}`);
  console.log(`  Size:         ${result.outputBytes} bytes`);
  console.log(`  SHA-256:      ${result.outputSha256}`);
}
