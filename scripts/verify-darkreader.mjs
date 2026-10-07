/**
 * Verification Script for Reproducible MV3 Dark Reader Bundle (`vendor/darkreader.js`)
 *
 * Verifies:
 *   1. `vendor/darkreader.js` exists and is committed/present on disk.
 *   2. Freshly building from `node_modules/darkreader/darkreader.js` (`darkreader@4.9.133`)
 *      produces the exact same byte-for-byte SHA-256 as `vendor/darkreader.js`.
 *   3. `vendor/darkreader.js` satisfies all Manifest V3 CSP compliance checks
 *      (valid syntax, no inline `<script>` / `createElement("script")`, no `eval` / `new Function`).
 */

import fs from 'node:fs';
import {
  OUTPUT_VENDOR_PATH,
  buildDarkReaderBundle,
  sha256,
  validateGeneratedMv3Bundle
} from './build-darkreader.mjs';

function main() {
  if (!fs.existsSync(OUTPUT_VENDOR_PATH)) {
    throw new Error(
      '[verify-darkreader] vendor/darkreader.js does not exist. Run "npm run build:darkreader".'
    );
  }

  const diskBytes = fs.readFileSync(OUTPUT_VENDOR_PATH);
  const diskSha256 = sha256(diskBytes);
  const diskCode = diskBytes.toString('utf8');

  validateGeneratedMv3Bundle(diskCode);

  const built = buildDarkReaderBundle({ write: false });

  if (diskSha256 !== built.outputSha256 || !diskBytes.equals(built.outputBuffer)) {
    throw new Error(
      `[verify-darkreader] vendor/darkreader.js is out of sync with build pipeline!\n` +
        `  Expected SHA-256: ${built.outputSha256}\n` +
        `  Actual SHA-256:   ${diskSha256}\n` +
        `  Run "npm run build:darkreader" to regenerate.`
    );
  }

  console.log('[verify-darkreader] OK — vendor/darkreader.js is byte-reproducible and MV3 CSP-compliant.');
  console.log(`  Version: darkreader@${built.version}`);
  console.log(`  Size:    ${diskBytes.byteLength} bytes`);
  console.log(`  SHA-256: ${diskSha256}`);
}

main();
