/**
 * Reproducible Release Packaging Script for Adobe Connect Dark Mode
 *
 * Usage:
 *   npm run package:release
 *
 * Responsibilities:
 *   1. Reads extension version dynamically from `manifest.json` (never hardcoded).
 *   2. Verifies `vendor/darkreader.js` byte-for-byte reproducibility & MV3 CSP compliance.
 *   3. Automatically validates all manifest and runtime-referenced files (service worker,
 *      popup assets, icons, web_accessible_resources, content scripts, stylesheets, fonts).
 *   4. Stages runtime files into `dist/staging/Adobe-Connect-Dark-v<version>/`, audits
 *      staged files for version accuracy, stale strings, and CSP safety, builds a
 *      deterministic ZIP archive at `dist/Adobe-Connect-Dark-v<version>.zip` with a single
 *      root folder `Adobe-Connect-Dark-v<version>/`, and removes `dist/staging/`.
 *   5. Programmatically inspects the final ZIP Central Directory to guarantee all required
 *      runtime files are included and all development/test/build files are excluded.
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import {
  OUTPUT_VENDOR_PATH,
  PROJECT_ROOT,
  buildDarkReaderBundle,
  sha256,
  validateGeneratedMv3Bundle
} from './build-darkreader.mjs';

const __filename = fileURLToPath(import.meta.url);

const RUNTIME_DIRECTORIES = [
  'content',
  'popup',
  'styles',
  'vendor',
  'assets/fonts',
  'icons'
];

const ROOT_RUNTIME_FILES = [
  'manifest.json',
  'background.js',
  'README.md',
  'README.fa.md'
];

const FORBIDDEN_ZIP_PATTERNS = [
  { label: 'node_modules', re: /(^|\/)node_modules(\/|$)/i },
  { label: '.git', re: /(^|\/)\.git(\/|$)/i },
  { label: '.github', re: /(^|\/)\.github(\/|$)/i },
  { label: '.gitignore', re: /(^|\/)\.gitignore$/i },
  { label: 'tests', re: /(^|\/)tests(\/|$)/i },
  { label: 'scripts', re: /(^|\/)scripts(\/|$)/i },
  { label: 'dist', re: /(^|\/)dist(\/|$)/i },
  { label: 'docs / development screenshots', re: /(^|\/)docs(\/|$)/i },
  { label: 'package.json', re: /(^|\/)package\.json$/i },
  { label: 'package-lock.json', re: /(^|\/)package-lock\.json$/i },
  { label: 'BUILDING.md', re: /(^|\/)BUILDING\.md$/i },
  { label: 'computed test report', re: /computed-styles-report\.json$/i },
  { label: '.DS_Store', re: /(^|\/)\.DS_Store$/i },
  { label: 'Thumbs.db', re: /(^|\/)Thumbs\.db$/i },
  { label: '*.tmp', re: /\.tmp$/i },
  { label: '*.log', re: /\.log$/i },
  { label: '*.har', re: /\.har$/i },
  { label: '*.map', re: /\.map$/i },
  { label: 'nested *.zip', re: /\.zip$/i }
];

const STALE_TEXT_PATTERNS = [
  { label: 'stale version 1.8.6', re: /\b1\.8\.6\b/ },
  { label: 'stale PoC label ("DarkReader Themes PoC")', re: /DarkReader\s+Themes\s+PoC/i },
  { label: 'PoC wording', re: /\bPoC\b/ }
];

const FORBIDDEN_CODE_CSP_PATTERNS = [
  { label: 'unsafe-inline', re: /unsafe-inline/i },
  { label: 'unsafe-eval', re: /unsafe-eval/i },
  { label: 'eval()', re: /\beval\s*\(/ },
  { label: 'new Function()', re: /\bnew\s+Function\s*\(/ }
];

// Precomputed CRC-32 lookup table for standard ZIP archive creation and verification
const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
})();

export function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) {
    crc = CRC32_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function toPosixPath(p) {
  return p.replace(/\\/g, '/');
}

function listFilesRecursive(dirPath) {
  const results = [];
  if (!fs.existsSync(dirPath)) return results;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...listFilesRecursive(fullPath));
    } else if (entry.isFile()) {
      results.push(fullPath);
    }
  }
  return results;
}

function expandSimpleGlob(pattern, rootDir) {
  const normalized = toPosixPath(pattern);
  const slashIdx = normalized.lastIndexOf('/');
  const dirPart = slashIdx >= 0 ? normalized.slice(0, slashIdx) : '';
  const filePattern = slashIdx >= 0 ? normalized.slice(slashIdx + 1) : normalized;
  const targetDir = path.join(rootDir, dirPart);

  if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
    return [];
  }

  const regexStr =
    '^' +
    filePattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*') +
    '$';
  const fileRe = new RegExp(regexStr);

  return fs
    .readdirSync(targetDir, { withFileTypes: true })
    .filter((d) => d.isFile() && fileRe.test(d.name))
    .map((d) => toPosixPath(path.join(dirPart, d.name)));
}

function verifyDarkReaderReproducibility() {
  if (!fs.existsSync(OUTPUT_VENDOR_PATH)) {
    throw new Error(
      '[package-release] Missing vendor/darkreader.js. Run "npm run build:darkreader" first.'
    );
  }

  const diskBytes = fs.readFileSync(OUTPUT_VENDOR_PATH);
  const diskSha256 = sha256(diskBytes);
  const diskCode = diskBytes.toString('utf8');

  validateGeneratedMv3Bundle(diskCode);

  const built = buildDarkReaderBundle({ write: false });
  if (diskSha256 !== built.outputSha256 || !diskBytes.equals(built.outputBuffer)) {
    throw new Error(
      `[package-release] vendor/darkreader.js is out of sync with darkreader@${built.version}.\n` +
        `  Expected SHA-256: ${built.outputSha256}\n` +
        `  Actual SHA-256:   ${diskSha256}`
    );
  }

  return {
    version: built.version,
    bytes: diskBytes.byteLength,
    sha256: diskSha256
  };
}

function extractStringArrayConst(code, constName) {
  const re = new RegExp(`const\\s+${constName}\\s*=\\s*\\[([\\s\\S]*?)\\];`);
  const match = code.match(re);
  if (!match) return [];
  const items = [];
  const strRe = /['"]([^'"]+)['"]/g;
  let m;
  while ((m = strRe.exec(match[1])) !== null) {
    items.push(m[1]);
  }
  return items;
}

function validateManifestAndRuntimeReferences() {
  const manifestPath = path.join(PROJECT_ROOT, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error('[package-release] manifest.json is missing at repository root.');
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.manifest_version !== 3) {
    throw new Error(
      `[package-release] Expected manifest_version 3, found ${manifest.manifest_version}`
    );
  }

  const version = typeof manifest.version === 'string' ? manifest.version.trim() : '';
  const versionName = typeof manifest.version_name === 'string' ? manifest.version_name.trim() : '';

  if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`[package-release] Invalid manifest.version: "${manifest.version}"`);
  }
  if (!versionName || versionName !== version) {
    throw new Error(
      `[package-release] manifest.version_name ("${versionName}") must match manifest.version ("${version}")`
    );
  }

  const pkgJsonPath = path.join(PROJECT_ROOT, 'package.json');
  if (fs.existsSync(pkgJsonPath)) {
    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    if (pkgJson.version !== version) {
      throw new Error(
        `[package-release] package.json version ("${pkgJson.version}") does not match manifest.json version ("${version}")`
      );
    }
  }

  const requiredFiles = new Set(['manifest.json']);

  // 1. Background service worker
  const serviceWorker = manifest.background && manifest.background.service_worker;
  if (!serviceWorker) {
    throw new Error('[package-release] manifest.background.service_worker is missing.');
  }
  requiredFiles.add(toPosixPath(serviceWorker));

  // 2. Action default_popup & icons
  const defaultPopup = manifest.action && manifest.action.default_popup;
  if (!defaultPopup) {
    throw new Error('[package-release] manifest.action.default_popup is missing.');
  }
  requiredFiles.add(toPosixPath(defaultPopup));

  const iconMaps = [manifest.icons || {}, (manifest.action && manifest.action.default_icon) || {}];
  for (const iconMap of iconMaps) {
    for (const iconPath of Object.values(iconMap)) {
      requiredFiles.add(toPosixPath(iconPath));
    }
  }

  // 3. web_accessible_resources globs
  const warEntries = Array.isArray(manifest.web_accessible_resources)
    ? manifest.web_accessible_resources
    : [];
  for (const entry of warEntries) {
    for (const pattern of entry.resources || []) {
      if (pattern.includes('*')) {
        const matched = expandSimpleGlob(pattern, PROJECT_ROOT);
        if (matched.length === 0) {
          throw new Error(
            `[package-release] web_accessible_resources pattern "${pattern}" matched 0 files!`
          );
        }
        matched.forEach((f) => requiredFiles.add(f));
      } else {
        requiredFiles.add(toPosixPath(pattern));
      }
    }
  }

  // 4. Parse popup.html references (<link href="..."> and <script src="...">)
  const popupFullPath = path.join(PROJECT_ROOT, defaultPopup);
  if (!fs.existsSync(popupFullPath)) {
    throw new Error(`[package-release] Missing popup HTML file: ${defaultPopup}`);
  }
  const popupDir = path.dirname(popupFullPath);
  const popupHtml = fs.readFileSync(popupFullPath, 'utf8');
  const assetAttrRe = /<(?:link|script)\b[^>]*(?:href|src)=["']([^"']+)["']/gi;
  let attrMatch;
  while ((attrMatch = assetAttrRe.exec(popupHtml)) !== null) {
    const resolved = path.resolve(popupDir, attrMatch[1]);
    const rel = toPosixPath(path.relative(PROJECT_ROOT, resolved));
    requiredFiles.add(rel);
  }

  // 5. Parse background.js and popup.js dynamic script registrations
  const bgPath = path.join(PROJECT_ROOT, serviceWorker);
  if (!fs.existsSync(bgPath)) {
    throw new Error(`[package-release] Missing background service worker: ${serviceWorker}`);
  }
  const bgCode = fs.readFileSync(bgPath, 'utf8');
  const popupJsPath = path.join(PROJECT_ROOT, 'popup/popup.js');
  if (!fs.existsSync(popupJsPath)) {
    throw new Error('[package-release] Missing popup/popup.js');
  }
  const popupJsCode = fs.readFileSync(popupJsPath, 'utf8');

  const bgIsolatedScripts = extractStringArrayConst(bgCode, 'ISOLATED_CONTENT_SCRIPTS');
  const popupIsolatedScripts = extractStringArrayConst(popupJsCode, 'ISOLATED_CONTENT_SCRIPTS');

  if (bgIsolatedScripts.length === 0) {
    throw new Error('[package-release] Could not parse ISOLATED_CONTENT_SCRIPTS from background.js');
  }
  if (JSON.stringify(bgIsolatedScripts) !== JSON.stringify(popupIsolatedScripts)) {
    throw new Error(
      '[package-release] ISOLATED_CONTENT_SCRIPTS mismatch between background.js and popup/popup.js'
    );
  }
  bgIsolatedScripts.forEach((f) => requiredFiles.add(toPosixPath(f)));

  // Parse importScripts(...) in background.js
  const importScriptsRe = /importScripts\(\s*['"]([^'"]+)['"]\s*\)/g;
  let impMatch;
  while ((impMatch = importScriptsRe.exec(bgCode)) !== null) {
    requiredFiles.add(toPosixPath(impMatch[1]));
  }

  // Require MAIN-world content script
  requiredFiles.add('content/chat-rtl-main.js');

  // 6. Parse theme-engine.js stylesheet paths
  const themeEnginePath = path.join(PROJECT_ROOT, 'content/theme-engine.js');
  if (!fs.existsSync(themeEnginePath)) {
    throw new Error('[package-release] Missing content/theme-engine.js');
  }
  const themeEngineCode = fs.readFileSync(themeEnginePath, 'utf8');
  for (const constName of [
    'FUNCTIONAL_STYLESHEET_PATHS',
    'CHAT_COLOR_STYLESHEET_PATHS',
    'LEGACY_DARK_STYLESHEET_PATHS'
  ]) {
    const paths = extractStringArrayConst(themeEngineCode, constName);
    if (paths.length === 0) {
      throw new Error(`[package-release] Could not parse ${constName} in content/theme-engine.js`);
    }
    paths.forEach((p) => requiredFiles.add(toPosixPath(p)));
  }

  const shadowCssMatch = themeEngineCode.match(
    /const\s+SHADOW_STYLESHEET_PATH\s*=\s*['"]([^'"]+)['"]/
  );
  if (!shadowCssMatch) {
    throw new Error('[package-release] Could not parse SHADOW_STYLESHEET_PATH in content/theme-engine.js');
  }
  requiredFiles.add(toPosixPath(shadowCssMatch[1]));

  // 7. Parse font references in styles/chat-functional.css
  const chatFuncCssPath = path.join(PROJECT_ROOT, 'styles/chat-functional.css');
  if (!fs.existsSync(chatFuncCssPath)) {
    throw new Error('[package-release] Missing styles/chat-functional.css');
  }
  const chatFuncCss = fs.readFileSync(chatFuncCssPath, 'utf8');
  const fontUrlRe = /__MSG_@@extension_id__\/([^'")\s]+)/g;
  let fontMatch;
  while ((fontMatch = fontUrlRe.exec(chatFuncCss)) !== null) {
    requiredFiles.add(toPosixPath(fontMatch[1]));
  }

  // 8. Collect all files from runtime directories & root runtime files
  for (const rootFile of ROOT_RUNTIME_FILES) {
    requiredFiles.add(toPosixPath(rootFile));
  }
  for (const runtimeDir of RUNTIME_DIRECTORIES) {
    const absDir = path.join(PROJECT_ROOT, runtimeDir);
    if (!fs.existsSync(absDir)) {
      throw new Error(`[package-release] Missing runtime directory: ${runtimeDir}`);
    }
    const files = listFilesRecursive(absDir);
    if (files.length === 0) {
      throw new Error(`[package-release] Runtime directory is empty: ${runtimeDir}`);
    }
    for (const absFile of files) {
      const rel = toPosixPath(path.relative(PROJECT_ROOT, absFile));
      requiredFiles.add(rel);
    }
  }

  // 9. Verify every required file exists on disk and is non-empty
  const sortedFiles = Array.from(requiredFiles).sort();
  for (const relPath of sortedFiles) {
    for (const forbidden of FORBIDDEN_ZIP_PATTERNS) {
      if (forbidden.re.test(relPath)) {
        throw new Error(
          `[package-release] Forbidden file matched for inclusion (${forbidden.label}): ${relPath}`
        );
      }
    }

    const absPath = path.join(PROJECT_ROOT, relPath);
    if (!fs.existsSync(absPath) || !fs.statSync(absPath).isFile()) {
      throw new Error(`[package-release] Required runtime file is missing: ${relPath}`);
    }
    const stat = fs.statSync(absPath);
    if (stat.size === 0) {
      throw new Error(`[package-release] Required runtime file is empty (0 bytes): ${relPath}`);
    }
  }

  return {
    manifest,
    version,
    versionName,
    files: sortedFiles
  };
}

function auditStagedRelease(stagingRootDir, expectedVersion, relativeFiles) {
  const stagedManifestPath = path.join(stagingRootDir, 'manifest.json');
  if (!fs.existsSync(stagedManifestPath)) {
    throw new Error('[package-release] Staged manifest.json is missing!');
  }

  const stagedManifest = JSON.parse(fs.readFileSync(stagedManifestPath, 'utf8'));
  if (stagedManifest.version !== expectedVersion) {
    throw new Error(
      `[package-release] Staged manifest.version ("${stagedManifest.version}") !== "${expectedVersion}"`
    );
  }
  if (stagedManifest.version_name !== expectedVersion) {
    throw new Error(
      `[package-release] Staged manifest.version_name ("${stagedManifest.version_name}") !== "${expectedVersion}"`
    );
  }

  for (const relPath of relativeFiles) {
    const absPath = path.join(stagingRootDir, relPath);
    const ext = path.extname(relPath).toLowerCase();
    const isTextFile = ['.json', '.js', '.css', '.html', '.md', '.txt'].includes(ext);
    if (!isTextFile) continue;

    const content = fs.readFileSync(absPath, 'utf8');

    for (const { label, re } of STALE_TEXT_PATTERNS) {
      if (re.test(content)) {
        throw new Error(
          `[package-release] Staged file "${relPath}" contains forbidden ${label}!`
        );
      }
    }

    const isCodeOrManifest = ['.json', '.js', '.css', '.html'].includes(ext);
    if (isCodeOrManifest) {
      for (const { label, re } of FORBIDDEN_CODE_CSP_PATTERNS) {
        if (re.test(content)) {
          throw new Error(
            `[package-release] Staged runtime file "${relPath}" contains forbidden CSP pattern (${label})!`
          );
        }
      }
    }
  }
}

/**
 * Create a deterministic standard ZIP archive with a single root folder `<rootFolderName>/`.
 * Uses fixed DOS timestamp (2026-01-01 00:00:00) and sorted POSIX paths for byte-reproducibility.
 */
function buildDeterministicZip(stagingRootDir, rootFolderName, relativeFiles) {
  // DOS date/time for 2026-01-01 00:00:00:
  // Year = 2026 - 1980 = 46; Month = 1; Day = 1 -> (46 << 9) | (1 << 5) | 1 = 0x5c21
  const DOS_TIME = 0x0000;
  const DOS_DATE = 0x5c21;
  const VERSION_MADE_BY = 20; // 2.0
  const VERSION_NEEDED = 20;  // 2.0
  const GP_FLAG_UTF8 = 0x0800; // Bit 11: UTF-8 filename encoding

  // Collect directory entries + file entries in deterministic sorted order
  const dirSet = new Set([`${rootFolderName}/`]);
  for (const rel of relativeFiles) {
    const parts = toPosixPath(rel).split('/');
    let current = rootFolderName;
    for (let i = 0; i < parts.length - 1; i++) {
      current += '/' + parts[i];
      dirSet.add(current + '/');
    }
  }

  const allEntries = [
    ...Array.from(dirSet)
      .sort()
      .map((dirEntry) => ({ zipPath: dirEntry, isDirectory: true, relPath: null })),
    ...[...relativeFiles]
      .sort()
      .map((rel) => ({
        zipPath: `${rootFolderName}/${toPosixPath(rel)}`,
        isDirectory: false,
        relPath: rel
      }))
  ];

  const localChunks = [];
  const centralChunks = [];
  let localOffset = 0;

  for (const entry of allEntries) {
    const nameBuf = Buffer.from(entry.zipPath, 'utf8');
    let rawData = Buffer.alloc(0);
    let compressedData = Buffer.alloc(0);
    let compressionMethod = 0; // 0 = STORE, 8 = DEFLATE
    let crc = 0;

    if (!entry.isDirectory) {
      const fullPath = path.join(stagingRootDir, entry.relPath);
      rawData = fs.readFileSync(fullPath);
      crc = crc32(rawData);
      const deflated = zlib.deflateRawSync(rawData, { level: 9 });
      if (deflated.length < rawData.length) {
        compressionMethod = 8;
        compressedData = deflated;
      } else {
        compressionMethod = 0;
        compressedData = rawData;
      }
    }

    // Local File Header (30 bytes + filename)
    const localHeader = Buffer.alloc(30 + nameBuf.length);
    localHeader.writeUInt32LE(0x04034b50, 0); // Local file header signature
    localHeader.writeUInt16LE(VERSION_NEEDED, 4);
    localHeader.writeUInt16LE(GP_FLAG_UTF8, 6);
    localHeader.writeUInt16LE(compressionMethod, 8);
    localHeader.writeUInt16LE(DOS_TIME, 10);
    localHeader.writeUInt16LE(DOS_DATE, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressedData.length, 18);
    localHeader.writeUInt32LE(rawData.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28); // Extra field length
    nameBuf.copy(localHeader, 30);

    localChunks.push(localHeader, compressedData);

    // Central Directory File Header (46 bytes + filename)
    const centralHeader = Buffer.alloc(46 + nameBuf.length);
    centralHeader.writeUInt32LE(0x02014b50, 0); // Central directory signature
    centralHeader.writeUInt16LE(VERSION_MADE_BY, 4);
    centralHeader.writeUInt16LE(VERSION_NEEDED, 6);
    centralHeader.writeUInt16LE(GP_FLAG_UTF8, 8);
    centralHeader.writeUInt16LE(compressionMethod, 10);
    centralHeader.writeUInt16LE(DOS_TIME, 12);
    centralHeader.writeUInt16LE(DOS_DATE, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressedData.length, 20);
    centralHeader.writeUInt32LE(rawData.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30); // Extra field length
    centralHeader.writeUInt16LE(0, 32); // File comment length
    centralHeader.writeUInt16LE(0, 34); // Disk number start
    centralHeader.writeUInt16LE(0, 36); // Internal file attributes
    centralHeader.writeUInt32LE(entry.isDirectory ? 0x10 : 0x00, 38); // External file attributes
    centralHeader.writeUInt32LE(localOffset, 42);
    nameBuf.copy(centralHeader, 46);

    centralChunks.push(centralHeader);
    localOffset += localHeader.length + compressedData.length;
  }

  const centralDirBuffer = Buffer.concat(centralChunks);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // End of central directory signature
  eocd.writeUInt16LE(0, 4); // Number of this disk
  eocd.writeUInt16LE(0, 6); // Disk where central directory starts
  eocd.writeUInt16LE(allEntries.length, 8); // Total entries on this disk
  eocd.writeUInt16LE(allEntries.length, 10); // Total entries in central directory
  eocd.writeUInt32LE(centralDirBuffer.length, 12); // Size of central directory
  eocd.writeUInt32LE(localOffset, 16); // Offset of central directory
  eocd.writeUInt16LE(0, 20); // Comment length

  return Buffer.concat([...localChunks, centralDirBuffer, eocd]);
}

/**
 * Parse the Central Directory of a ZIP buffer and return all entries for security/integrity inspection.
 */
export function inspectZipBuffer(zipBuffer) {
  // Locate End of Central Directory (EOCD) record (signature 0x06054b50)
  let eocdOffset = -1;
  for (let i = zipBuffer.length - 22; i >= Math.max(0, zipBuffer.length - 65557); i--) {
    if (zipBuffer.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) {
    throw new Error('[package-release] Invalid ZIP archive: EOCD signature not found.');
  }

  const totalEntries = zipBuffer.readUInt16LE(eocdOffset + 10);
  const centralDirSize = zipBuffer.readUInt32LE(eocdOffset + 12);
  const centralDirOffset = zipBuffer.readUInt32LE(eocdOffset + 16);

  const entries = [];
  let ptr = centralDirOffset;
  for (let i = 0; i < totalEntries; i++) {
    if (zipBuffer.readUInt32LE(ptr) !== 0x02014b50) {
      throw new Error(`[package-release] Invalid Central Directory header at offset ${ptr}`);
    }
    const compressionMethod = zipBuffer.readUInt16LE(ptr + 10);
    const crc = zipBuffer.readUInt32LE(ptr + 16);
    const compressedSize = zipBuffer.readUInt32LE(ptr + 20);
    const uncompressedSize = zipBuffer.readUInt32LE(ptr + 24);
    const fileNameLen = zipBuffer.readUInt16LE(ptr + 28);
    const extraLen = zipBuffer.readUInt16LE(ptr + 30);
    const commentLen = zipBuffer.readUInt16LE(ptr + 32);
    const localHeaderOffset = zipBuffer.readUInt32LE(ptr + 42);
    const fileName = zipBuffer.subarray(ptr + 46, ptr + 46 + fileNameLen).toString('utf8');

    // Verify corresponding Local File Header and decompress payload to confirm CRC32 integrity
    if (zipBuffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
      throw new Error(`[package-release] Invalid Local File Header for "${fileName}"`);
    }
    const localNameLen = zipBuffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLen = zipBuffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    const compressedSlice = zipBuffer.subarray(dataStart, dataStart + compressedSize);

    const isDirectory = fileName.endsWith('/');
    if (!isDirectory) {
      const uncompressedBuf =
        compressionMethod === 8
          ? zlib.inflateRawSync(compressedSlice)
          : Buffer.from(compressedSlice);
      if (uncompressedBuf.length !== uncompressedSize) {
        throw new Error(`[package-release] Uncompressed size mismatch in ZIP for "${fileName}"`);
      }
      if (crc32(uncompressedBuf) !== crc) {
        throw new Error(`[package-release] CRC-32 mismatch in ZIP for "${fileName}"`);
      }
    }

    entries.push({
      fileName,
      isDirectory,
      compressionMethod,
      crc,
      compressedSize,
      uncompressedSize
    });

    ptr += 46 + fileNameLen + extraLen + commentLen;
  }

  if (ptr !== centralDirOffset + centralDirSize) {
    throw new Error('[package-release] Central Directory size mismatch.');
  }

  return entries;
}

function verifyZipSecurityAndCompleteness(zipPath, rootFolderName, expectedRelativeFiles) {
  const zipBytes = fs.readFileSync(zipPath);
  const entries = inspectZipBuffer(zipBytes);
  const fileEntries = entries.filter((e) => !e.isDirectory);
  const fileSet = new Set(fileEntries.map((e) => e.fileName));

  // 1. Every entry must reside inside `<rootFolderName>/` and must not match any forbidden pattern
  for (const entry of entries) {
    if (!entry.fileName.startsWith(`${rootFolderName}/`)) {
      throw new Error(
        `[package-release] ZIP entry "${entry.fileName}" is outside root folder "${rootFolderName}/"`
      );
    }
    if (entry.fileName.includes('\\')) {
      throw new Error(
        `[package-release] ZIP entry "${entry.fileName}" contains backslash path separator!`
      );
    }
    const innerPath = entry.fileName.slice(rootFolderName.length + 1);
    for (const forbidden of FORBIDDEN_ZIP_PATTERNS) {
      if (forbidden.re.test(innerPath)) {
        throw new Error(
          `[package-release] Security check failed: ZIP contains forbidden path (${forbidden.label}): ${entry.fileName}`
        );
      }
    }
  }

  // 2. Confirm critical runtime files exist at exact expected paths
  const expectedManifestZipPath = `${rootFolderName}/manifest.json`;
  const expectedVendorZipPath = `${rootFolderName}/vendor/darkreader.js`;

  if (!fileSet.has(expectedManifestZipPath)) {
    throw new Error(
      `[package-release] ZIP is missing manifest at root: ${expectedManifestZipPath}`
    );
  }
  if (!fileSet.has(expectedVendorZipPath)) {
    throw new Error(
      `[package-release] ZIP is missing Dark Reader runtime bundle: ${expectedVendorZipPath}`
    );
  }

  // 3. Confirm exact 1-to-1 match with validated runtime file list
  for (const rel of expectedRelativeFiles) {
    const expectedZipEntry = `${rootFolderName}/${toPosixPath(rel)}`;
    if (!fileSet.has(expectedZipEntry)) {
      throw new Error(`[package-release] ZIP is missing required file: ${expectedZipEntry}`);
    }
  }

  if (fileEntries.length !== expectedRelativeFiles.length) {
    throw new Error(
      `[package-release] Unexpected file count in ZIP: expected ${expectedRelativeFiles.length}, found ${fileEntries.length}`
    );
  }

  return {
    totalEntries: entries.length,
    totalFiles: fileEntries.length,
    zipBytes: zipBytes.byteLength,
    zipSha256: sha256(zipBytes)
  };
}

export function packageRelease() {
  // Step 1: Verify Dark Reader bundle reproducibility & MV3 CSP compliance
  const drCheck = verifyDarkReaderReproducibility();

  // Step 2: Validate manifest.json and all runtime-referenced resources
  const { version, files } = validateManifestAndRuntimeReferences();

  const rootFolderName = `Adobe-Connect-Dark-v${version}`;
  const distDir = path.join(PROJECT_ROOT, 'dist');
  const stagingBaseDir = path.join(distDir, 'staging');
  const stagingRootDir = path.join(stagingBaseDir, rootFolderName);
  const zipFileName = `${rootFolderName}.zip`;
  const zipFilePath = path.join(distDir, zipFileName);

  // Clean any leftover staging directory and prepare fresh staging tree
  fs.rmSync(stagingBaseDir, { recursive: true, force: true });
  fs.mkdirSync(stagingRootDir, { recursive: true });

  try {
    // Copy validated runtime files to staging
    for (const relPath of files) {
      const srcPath = path.join(PROJECT_ROOT, relPath);
      const destPath = path.join(stagingRootDir, relPath);
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(srcPath, destPath);
    }

    // Step 3: Audit staged files (version, stale strings, CSP invariants)
    auditStagedRelease(stagingRootDir, version, files);

    // Step 4: Build deterministic ZIP archive
    const zipBuffer = buildDeterministicZip(stagingRootDir, rootFolderName, files);
    fs.mkdirSync(distDir, { recursive: true });
    fs.writeFileSync(zipFilePath, zipBuffer);
  } finally {
    // Always remove temporary staging directory after ZIP creation
    fs.rmSync(stagingBaseDir, { recursive: true, force: true });
  }

  // Step 5: Programmatically inspect final ZIP archive for security & completeness
  const zipInspection = verifyZipSecurityAndCompleteness(zipFilePath, rootFolderName, files);

  return {
    version,
    rootFolderName,
    zipFileName,
    zipFilePath: toPosixPath(path.relative(PROJECT_ROOT, zipFilePath)),
    zipBytes: zipInspection.zipBytes,
    zipSha256: zipInspection.zipSha256,
    totalFiles: zipInspection.totalFiles,
    darkReader: drCheck,
    files
  };
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(__filename);

if (isMain) {
  const result = packageRelease();
  console.log(`[package-release] Successfully packaged ${result.zipFileName}`);
  console.log(`  Version:        v${result.version}`);
  console.log(`  Archive Path:   ${result.zipFilePath}`);
  console.log(`  Root Folder:    ${result.rootFolderName}/`);
  console.log(`  Files Included: ${result.totalFiles}`);
  console.log(`  ZIP Size:       ${result.zipBytes} bytes`);
  console.log(`  ZIP SHA-256:    ${result.zipSha256}`);
  console.log(
    `  Dark Reader:    darkreader@${result.darkReader.version} (${result.darkReader.bytes} bytes, CSP-verified)`
  );
}
