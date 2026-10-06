<a id="top"></a>
<div align="center">

<img src="icons/icon128.png" alt="Adobe Connect Dark icon" width="96" height="96">

# Adobe Connect Dark

### Advanced Dark Mode, Intelligent RTL Chat & Two-Row Layout for Adobe Connect Web

A source-driven Chromium extension (Manifest V3) that modernizes the Adobe Connect web interface while strictly preserving shared slides, PDFs, whiteboards, video streams, and screen sharing.

[![Version](https://img.shields.io/badge/version-1.8.5-6EA8FE?style=flat-square)](#v185)
[![Manifest](https://img.shields.io/badge/Manifest-V3-4285F4?style=flat-square&logo=googlechrome&logoColor=white)](#technical-architecture)
[![Chrome](https://img.shields.io/badge/Chrome-supported-4285F4?style=flat-square&logo=googlechrome&logoColor=white)](#browser-compatibility)
[![Edge](https://img.shields.io/badge/Edge-supported-0C59A4?style=flat-square&logo=microsoftedge&logoColor=white)](#browser-compatibility)
[![Adobe Connect](https://img.shields.io/badge/Adobe%20Connect-Web%20UI-FF0000?style=flat-square&logo=adobe&logoColor=white)](#adobe-connect-compatibility)

<br>

<p align="center">
  <img src="docs/screenshots/popup-comparison.png" width="850" alt="Adobe Connect Dark extension popup comparison – inactive and active states">
</p>

<br>

**Dark Mode · RTL Chat Text · Send RTL Formatting · Two-Row Chat Layout · Media Preservation · Permission on Demand**

</div>

<div align="center">

**English** | [فارسی](README.fa.md)

</div>

<div align="center">

<a href="#overview"><strong>Overview</strong></a> ·
<a href="#problems-this-extension-solves"><strong>Problems Solved</strong></a> ·
<a href="#features"><strong>Features</strong></a> ·
<a href="#feature-architecture"><strong>Architecture</strong></a> ·
<a href="#rtl-chat-text"><strong>RTL Chat</strong></a> ·
<a href="#installation"><strong>Install</strong></a> ·
<a href="#usage"><strong>Usage</strong></a> ·
<a href="#screenshots"><strong>Screenshots</strong></a> ·
<a href="#release-notes"><strong>Release Notes</strong></a>

</div>

---

## Quick Navigation

### Getting Started
- [Overview](#overview)
- [Problems This Extension Solves](#problems-this-extension-solves)
- [Screenshots](#screenshots)
- [Features Overview](#features)
- [Feature Architecture](#feature-architecture)
- [Core Features](#core-features)
  - [1. Dark Mode & Media Preservation](#1-dark-mode)
  - [2. RTL Chat Text](#2-rtl-chat-text)
  - [3. Send RTL Formatting](#3-send-rtl-formatting)
  - [4. Two-Row Chat Layout](#4-two-row-chat-layout)
- [Popup Controls & UI](#popup-controls)
- [Installation](#installation)
- [Usage Guide](#usage)

### Technical Architecture & Deep Dive
- [Per-Site Settings & Storage Model](#per-site-behavior)
- [Permission-on-Demand Model](#permission-on-demand)
- [Dynamic Runtime Registration](#dynamic-runtime-registration)
- [Open Shadow DOM Support](#shadow-dom-support)
- [Media & Content Preservation Architecture](#media-preservation)
- [Root State Attributes](#root-state-attributes)
- [Project Structure](#project-structure)
- [Adobe Connect Interface Coverage](#coverage)

### Compatibility & Governance
- [Browser Compatibility](#browser-compatibility)
- [Adobe Connect Compatibility](#adobe-connect-compatibility)
- [Privacy & Security](#privacy-security)
- [Known Limitations](#known-limitations)
- [Troubleshooting](#troubleshooting)
- [Development & Contributing](#development)
- [Manual QA Checklist](#qa-checklist)
- [Release Notes (v1.8.5)](#release-notes)
- [License & Disclaimer](#license)
- [راهنمای سریع فارسی](#persian-guide)

---

<a id="overview"></a>

## Overview

Adobe Connect is widely used for live virtual classrooms, webinars, meetings, and recorded session playback. However, spending long hours in its default bright white interface can lead to severe eye fatigue—particularly when the user's operating system, browser, and neighboring applications are already dark.

**Adobe Connect Dark** provides a carefully engineered, layered dark interface tailored to the HTML5 web client of Adobe Connect without interfering with shared meeting content.

It is deliberately **not** a blanket full-page inversion filter or CSS `invert()` overlay. The extension applies source-derived component styling for known Adobe Connect and Adobe Spectrum components alongside an automated conservative fallback scanner for unmapped containers.

In addition to visual theming, it provides an independent **RTL Chat Text** engine with intelligent bidirectional language classification for Persian, Arabic, and mixed-language chat, an optional **Send RTL Formatting** utility that embeds Unicode BiDi controls for other participants, and an independent **Two-Row Chat Layout** that stacks sender names above message bodies.

---

<a id="problems-this-extension-solves"></a>

## Problems This Extension Solves

| Problem | Root Cause | Solution in Adobe Connect Dark |
| :--- | :--- | :--- |
| **Bright Adobe Connect interface** | Long class sessions, webinars, and meeting replays in a stark white UI cause visual fatigue and eye strain. | **Independent Dark Mode**: Applies deep, consistent dark palettes to pods, toolbars, sidebars, forms, and dialogs. |
| **Destroyed slides, PDFs, and video** | Naive dark mode extensions invert everything, rendering presentations, webcams, PDFs, and whiteboards illegible. | **Protected Content-Aware Theming**: Explicitly excludes shared stages, video streams, slides, PDFs, canvases, and content SVGs. |
| **Mixed Persian/English chat direction** | Typing mixed Persian and English text (e.g., technical terms or questions) results in flipped punctuation and reversed word order. | **Intelligent RTL Chat Text**: Accurately classifies direction, isolates inline math, handles English question markers, and adjusts alignment. |
| **Outgoing messages broken for other users** | When a user sends mixed RTL/LTR text, participants on default Adobe Connect clients often see inverted words and misplaced punctuation. | **Send RTL Formatting**: Optionally embeds standard Unicode BiDi formatting (`RLE`/`LRE`/`PDF`) into outgoing messages at send time. |
| **Visually crowded chat stream** | Adobe Connect places the sender name and message body on the same line, causing long Persian/Arabic names and messages to collide. | **Two-Row Chat Layout**: Automatically splits the chat item into Row 1 (Sender Name + Timestamp) and Row 2 (Message Body). |
| **Excessive extension permissions** | Many extensions require access to "all websites" at all times, raising privacy and compliance concerns. | **Permission-on-Demand Architecture**: Host permissions are requested strictly per-origin when you activate a feature for that specific site. |

---

<a id="screenshots"></a>

## Screenshots

### Popup Controls

<p align="center">
  <img src="docs/screenshots/popup-comparison.png" width="850" alt="Extension Popup comparison showing Inactive and Active states">
</p>

### Meeting Interface (Light vs. Dark Mode)

<p align="center">
  <img src="docs/screenshots/light-mode.png" width="49%" alt="Adobe Connect Native Light Mode">
  <img src="docs/screenshots/dark-mode.png" width="49%" alt="Adobe Connect Dark Mode with protected shared content">
</p>

### Chat Presentation Modes

<p align="center">
  <img src="docs/screenshots/chat-default.png" width="32%" alt="Default Chat Layout">
  <img src="docs/screenshots/chat-rtl.png" width="32%" alt="RTL Chat Text with right alignment">
  <img src="docs/screenshots/chat-two-row.png" width="32%" alt="Two-Row Chat Layout with sender above message">
</p>

---

<a id="features"></a>

## Features Overview

| Feature | Type | Responsibility |
| :--- | :---: | :--- |
| **Dark Mode** | Top-level | Themes Adobe Connect Central, live meeting rooms, recording playback, pods, sidebars, and dialogs while protecting shared media. |
| **RTL Chat Text** | Top-level | Implements intelligent bidirectional text classification, right alignment, and Vazirmatn typography for Persian and Arabic chat. |
| **Send RTL Formatting** | Sub-feature | Applies standard Unicode BiDi embedding controls to outgoing chat messages so other attendees view proper ordering. |
| **Two-Row Chat Layout** | Top-level | Restructures chat messages into a clean two-row grid layout: Row 1 displays the sender and timestamp; Row 2 displays the message text. |
| **Per-Site Settings** | Core | Stores preferences independently per `protocol://hostname` origin. |
| **Permission on Demand** | Core | Requests origin permissions only when a feature is activated for that specific site. |
| **Dynamic SPA & MutationObserver** | Engine | Detects and themes dynamically mounted pods, dialogs, and chat items with debounced DOM observers. |
| **Open Shadow DOM Styling** | Engine | Injects stylesheets and attaches observers to accessible Open Shadow DOM roots across the page. |
| **Media Preservation** | Core | Ensures webcam streams, screen sharing, PDFs, slides, whiteboard canvases, and session media remain completely uncolored. |
| **Self-Healing Reconciliation** | Service Worker | Reconciles stored preferences, active permissions, and registered content scripts upon startup and updates. |
| **Zero Telemetry** | Privacy | Fully local execution with zero network tracking, external APIs, or analytics SDKs. |

---

<a id="feature-architecture"></a>

## Feature Architecture

The extension features are structured as independent top-level modules, with the exception of outgoing formatting, which operates as a sub-feature under RTL Chat Text:

```text
Adobe Connect Dark (v1.8.2)
│
├── Dark Mode (Top-level)
│   └── Independent activation
│
├── RTL Chat Text (Top-level)
│   ├── Incoming message BiDi direction classification (data-acd-bidi-dir)
│   ├── Live composer BiDi formatting & caret preservation
│   └── Send RTL Formatting (Sub-feature)
│           └── Depends strictly on RTL Chat Text being active
│
└── Two-Row Chat Layout (Top-level)
    └── Independent activation
```

### Feature State Matrix

Because Dark Mode, RTL Chat Text, and Two-Row Chat Layout are decoupled, you can enable any combination that fits your workflow:

| Dark Mode | RTL Chat Text | Send RTL Formatting | Two-Row Layout | Effective Result |
| :---: | :---: | :---: | :---: | :--- |
| **Off** | **Off** | Disabled | **Off** | Native Adobe Connect interface and default single-line chat. |
| **Off** | **Off** | Disabled | **On** | Native light theme with two-row chat layout. |
| **On** | **Off** | Disabled | **Off** | Dark theme across all pods with default native chat layout. |
| **Off** | **On** | Off | **Off** | Native light theme + local RTL chat display (outgoing text sent raw). |
| **Off** | **On** | On | **Off** | Native light theme + local RTL chat + outgoing BiDi formatting for other participants. |
| **Off** | **On** | On | **On** | Native light theme + RTL chat + outgoing formatting + two-row layout. |
| **On** | **On** | Off | **On** | Full dark theme + local RTL chat + two-row layout (outgoing text sent raw). |
| **On** | **On** | On | **On** | Full dark theme + RTL chat + outgoing formatting + two-row layout. |

> [!NOTE]
> The extension status badge in the popup indicates **Active** whenever **Dark Mode**, **RTL Chat Text**, or **Two-Row Chat Layout** is enabled.

---

<a id="core-features"></a>

## Core Features

<a id="1-dark-mode"></a>

### 1. Dark Mode

Dark Mode is an independent top-level feature built specifically for the Adobe Connect Web architecture.

- **Non-Invasive Theming**: Rather than applying a global CSS `invert()` filter that washes out colors and distorts images, the theme engine injects semantic CSS rules targeting Adobe Connect pods, toolbars, sidebars, menus, dialogs, and inputs.
- **Experimental Dark Reader Engine & Theme Presets (`1.8.5 DarkReader Themes PoC`)**:
  - Powered by a single Dark Reader dynamic engine (`darkreader@4.9.133`) paired with a central preset registry (`content/darkreader-presets.js`) and shared Adobe Connect media-protection fixes (`content/darkreader-engine.js`).
  - **Initial Theme Presets**:
    - **`Dark` (Default)** — Balanced dark theme (`brightness: 100`, `contrast: 96`, `sepia: 0`, `darkSchemeBackgroundColor: #0F141A`, `darkSchemeTextColor: #F0F3F6`).
    - **`AMOLED`** — Deep black / OLED-friendly surfaces (`brightness: 96`, `contrast: 100`, `sepia: 0`, `darkSchemeBackgroundColor: #000000`, `darkSchemeTextColor: #F2F5F8`).
    - **`Dim`** — Softer dark theme with reduced visual intensity for long sessions (`brightness: 93`, `contrast: 88`, `sepia: 0`, `darkSchemeBackgroundColor: #18202A`, `darkSchemeTextColor: #DCE3EA`).
    - **`Warm`** — Warmer night theme with a subtle warm tone (`brightness: 97`, `contrast: 94`, `sepia: 16`, `darkSchemeBackgroundColor: #161311`, `darkSchemeTextColor: #EFEAE2`).
  - **Live Theme Switching**: Switching between `Dark`, `AMOLED`, `Dim`, and `Warm` updates the active Adobe Connect session in-place without page reload or white flash, while keeping semantic Chat Color mapping (`[data-acd-chat-color]`), RTL Chat, Send RTL Formatting, Two-Row Layout, and media protection completely independent.
- **Media Preservation Guard**: Guarantees that presentation materials, video cameras, and shared documents remain untouched (see [Media Preservation](#media-preservation)).

---

<a id="2-rtl-chat-text"></a>

### 2. RTL Chat Text

RTL Chat Text provides dedicated right-to-left layout and intelligent bidirectional text handling for Persian and Arabic users.

- **Scoped to Chat Content**: It intentionally avoids mirroring the pod structure, tabs, send buttons, pod headers, or scrollbars, ensuring that the meeting layout remains familiar and stable.
- **Shared Bidirectional Classifier**: Both incoming message rendering and composer processing share the project's lexical classifier (`classifyLineDirection`). Direction is decided by strong directional letters rather than digits or punctuation:
  - Digits (`0-9`, `۰-۹`, `٠-٩`) and neutral punctuation do not turn a line RTL on their own.
  - **Inline Math Isolation**: Expressions like `22 - 2` or `۲۲ - ۲ = ۲۰` are detected and preserved as LTR islands inside RTL text.
  - **English Lead Grammar Detection**: Lines beginning with Latin text are evaluated for English sentence starters (`what`, `who`, `is`, `are`, `can`, `how`, etc.). If an English grammatical frame is detected, the line remains LTR. If a Latin technical term is merely introducing a Persian phrase, the classifier conservatively defaults to RTL.
- **Classification Examples**:
  - `سلام alireza چطوری؟` → **RTL** (begins with strong Persian text; punctuation aligned right).
  - `linux چیه ؟` → **RTL** (technical English term followed by Persian question; classified RTL).
  - `who is علیرضا ؟` → **LTR** (detected English interrogative lead frame; retains LTR direction).
  - `hello world` → **LTR** (pure English; left-aligned).
- **Incoming Messages**: Observed via `MutationObserver`. The message element is tagged with `data-acd-bidi-dir="rtl"` or `data-acd-bidi-dir="ltr"`, triggering CSS isolation (`unicode-bidi: isolate; direction: rtl; text-align: right;`). The underlying `textContent` is never altered.
- **Live Composer & React State**: In the typing area (`#chatTypingArea`), the extension formats the text in real time so the user sees the actual BiDi layout while typing. Caret and selection positions are mapped between raw and formatted coordinates, and React's internal `_valueTracker` is updated to prevent input synchronization conflicts.

---

<a id="3-send-rtl-formatting"></a>

### 3. Send RTL Formatting

Send RTL Formatting is a specialized sub-feature of RTL Chat Text.

- **Architecture Dependency**:
  ```text
  RTL Chat Text
  └── Send RTL Formatting (optional sub-toggle)
  ```
- **Purpose**: By default, standard Adobe Connect clients do not have bidirectional line classification. When an RTL message is sent with mixed English tokens, other attendees on default web clients might see jumbled words or reversed punctuation.
- **Implementation via Unicode BiDi Controls**: When enabled, the extension wraps outgoing lines at send time using standard Unicode bidirectional embeddings:
  - `RLE` (`\u202B` - Right-to-Left Embedding) for RTL lines.
  - `LRE` (`\u202A` - Left-to-Right Embedding) for inline math and embedded LTR lines.
  - `PDF` (`\u202C` - Pop Directional Formatting) to close the directional boundary.
  - Normalizes trailing English question marks (`?`) to Persian/Arabic question marks (`؟`) on RTL lines.
- **Optional & Controllable**:
  - If **Send RTL Formatting is ON**: Outgoing messages sent over the wire contain Unicode BiDi controls so that all participants see proper ordering.
  - If **Send RTL Formatting is OFF**: Outgoing messages are sent as raw plain text without BiDi controls. Local RTL styling, incoming message classification, and live typing alignment remain fully functional.
  - If **RTL Chat Text is OFF**: Send RTL Formatting is automatically disabled and dimmed in the popup.

---

<a id="4-two-row-chat-layout"></a>

### 4. Two-Row Chat Layout

Two-Row Chat Layout is an independent top-level feature designed to eliminate visual crowding in active chat sessions.

- **Layout Structure**:
  - **Row 1**: Displays the **Sender Name** on the left and the **Timestamp** on the right.
  - **Row 2**: Displays the **Message Body** spanning the full width of the container.
- **Example Comparison**:
  - *Standard Single-Row Layout*:
    ```text
    Alireza: سلام alireza چطوری؟                          10:45 AM
    ```
  - *Two-Row Layout*:
    ```text
    Alireza                                              10:45 AM
    سلام alireza چطوری؟
    ```
- **Grid-Based Styling**: Implemented via CSS Grid (`display: inline-grid !important; grid-template-columns: minmax(0, 1fr) auto !important; grid-template-rows: auto auto !important;`), preventing long names from truncating or bumping message text unpredictably.
- **Decoupled**: Operates independently of both Dark Mode and RTL Chat Text.

---

<a id="popup-controls"></a>

## Popup Controls & UI

The extension popup provides clear, per-site toggles with real-time state feedback:

| UI Control | Element ID | Function |
| :--- | :--- | :--- |
| **Current Domain** | `#current-domain` | Displays the detected origin protocol and host (e.g., `connect.example.com (HTTPS)`). |
| **Status Badge** | `#status-badge` | Indicates `Active` (blue) if any top-level feature is enabled, or `Inactive` (gray). |
| **Dark Mode Toggle** | `#theme-toggle` | Toggles the dark theme for the current site. |
| **Theme Selector** | `#theme-preset-select` | Selects the per-site Dark Reader theme preset (`Dark`, `AMOLED`, `Dim`, `Warm`) with live switching without page reload. |
| **RTL Chat Text Toggle** | `#rtl-toggle` | Toggles right-to-left chat handling for the current site. |
| **Send RTL Formatting** | `#send-rtl-toggle` | Nested sub-toggle; formats outgoing messages with Unicode BiDi controls. Disabled if RTL Chat is off. |
| **Two-Row Chat Layout** | `#chat-two-row-toggle` | Toggles the two-row sender/message layout for the current site. |
| **Reset Site Button** | `#reset-btn` | Clears all stored settings for the origin (resetting `themePreset` to `dark`), unregisters content scripts, and revokes host permission. |
| **Protected Content Note** | `.safety-badge` | Displays safety notice: *"Webcam, screen share & slides protected"*. |
| **Version Indicator** | `#extension-version` | Automatically displays the version read from `manifest.json` (`v1.8.5 DarkReader Themes PoC`). |

---

<a id="installation"></a>

## Installation

Adobe Connect Dark is distributed as an unpacked Manifest V3 browser extension for Chromium-based browsers.

### Compatible Browsers
- **Google Chrome**
- **Microsoft Edge**
- **Brave Browser**
- **Opera / Opera GX**
- Other Chromium-based browsers

### Installation Steps

1. **Obtain the Extension**:
   - Clone this repository:
     ```bash
     git clone https://github.com/Mr-Azizi/adobe-connect-dark.git
     ```
   - *Or* download the repository as a ZIP archive and extract it to a local folder.
2. **Open Extensions Page**:
   - In Chrome / Brave / Opera: Navigate to `chrome://extensions`
   - In Microsoft Edge: Navigate to `edge://extensions`
3. **Enable Developer Mode**:
   - Toggle the **Developer mode** switch (usually located in the top-right or left sidebar).
4. **Load Unpacked**:
   - Click the **Load unpacked** button.
   - Select the root project directory (the folder containing `manifest.json`).
5. **Verify**:
   - **Adobe Connect Dark Mode** will appear in your installed extensions list.
   - Pin the extension icon to your browser toolbar for quick access.

> [!NOTE]
> No build step, Node.js compile, or bundler is required. The extension runs directly from its source files.

---

<a id="usage"></a>

## Usage Guide

1. **Navigate to Adobe Connect**:
   - Open your organization's Adobe Connect room, webinar, or recording URL (e.g., `https://connect.example.com/room-name`).
2. **Open the Popup**:
   - Click the **Adobe Connect Dark** icon in the browser toolbar.
3. **Enable Desired Features**:
   - Switch on **Dark Mode** to darken the application UI, and choose your preferred **Theme** (`Dark`, `AMOLED`, `Dim`, or `Warm`).
   - Switch on **RTL Chat Text** to enable right-to-left Persian/Arabic chat text.
   - *(Optional)* Adjust **Send RTL Formatting** if you want outgoing messages formatted for other participants.
   - Switch on **Two-Row Chat Layout** if you prefer sender names stacked above messages.
4. **Grant Origin Permission**:
   - On first activation for a new domain, your browser will prompt you to allow access to that specific origin. Click **Allow**.
5. **Persistent Storage**:
   - Your preferences are automatically saved for that origin. When you revisit the room, your settings are applied immediately at `document_start`.
6. **Resetting a Site**:
   - Click **Reset Site / بازنشانی دامنه** in the popup to return the site to default native behavior (`themePreset` → `dark`) and revoke origin permissions.

---

<a id="per-site-behavior"></a>

## Per-Site Settings & Storage Model

All configuration is strictly scoped to the site's origin (`protocol + hostname`). Separate records are maintained for HTTP and HTTPS variants.

### Storage Keys

The extension uses `chrome.storage.local` with the following schema:

| Storage Key | Value Type | Purpose | Scope |
| :--- | :--- | :--- | :--- |
| `acd_enabled_sites` | `Record<string, boolean>` | Stores per-site Dark Mode state (`true` = active). | Origin key (e.g., `https://connect.example.com`) |
| `acd_theme_preset_sites` | `Record<string, string>` | Stores per-site Dark Reader theme preset (`"dark"`, `"amoled"`, `"dim"`, `"warm"`). Invalid or missing values safely fall back to `"dark"`. | Origin key (defaults to `"dark"`) |
| `acd_rtl_chat_sites` | `Record<string, boolean>` | Stores per-site RTL Chat Text state (`true` = active). | Origin key |
| `acd_send_rtl_formatting_sites` | `Record<string, boolean>` | Stores per-site outgoing Send RTL Formatting preference (`true`/`false`). | Origin key (defaults to `true` when RTL Chat is enabled) |
| `acd_chat_two_row_sites` | `Record<string, boolean>` | Stores per-site Two-Row Chat Layout state (`true` = active). | Origin key |
| `acd_enabled_domains` | `Record<string, boolean>` | *Legacy key*. Automatically migrated to `acd_enabled_sites` on startup. | Legacy hostname key |

### Example Stored State

```json
{
  "acd_enabled_sites": {
    "https://connect.example.com": true
  },
  "acd_theme_preset_sites": {
    "https://connect.example.com": "amoled"
  },
  "acd_rtl_chat_sites": {
    "https://connect.example.com": true
  },
  "acd_send_rtl_formatting_sites": {
    "https://connect.example.com": true
  },
  "acd_chat_two_row_sites": {
    "https://connect.example.com": true
  }
}
```

---

<a id="permission-on-demand"></a>

## Permission-on-Demand Model

To ensure optimal privacy, security, and performance, Adobe Connect Dark adheres to a strict permission-on-demand model:

### Declared Manifest Permissions
- `storage`: Required to persist user preferences in `chrome.storage.local`.
- `activeTab`: Grants temporary access to the active tab when the popup is opened.
- `scripting`: Required to register dynamic content scripts for enabled sites.

### Optional Host Permissions
```json
"optional_host_permissions": [
  "http://*/*",
  "https://*/*"
]
```

### How Permissions Are Managed
- The extension does **not** possess blanket access to all websites upon installation.
- When you enable a feature for a domain, the extension invokes `chrome.permissions.request({ origins: ["https://domain.com/*"] })`.
- If the permission is granted, the dynamic content script is registered.
- Dynamic script registration is maintained only as long as at least one top-level feature remains enabled:
  ```javascript
  const siteNeedsExtension = isDarkEnabled || isRtlEnabled || isTwoRowEnabled;
  ```
- If all features are turned off or if **Reset Site** is clicked, the registration is removed, and `chrome.permissions.remove` revokes origin host access.

---

<a id="dynamic-runtime-registration"></a>

## Dynamic Runtime Registration

To eliminate white flashes and interact seamlessly with Adobe Connect's single-page React client, scripts are registered dynamically rather than statically declared across all pages:

```mermaid
flowchart TD
    A[User toggles feature in Popup] --> B[Request Optional Host Permission]
    B -->|Granted| C[Register Dynamic Content Scripts]
    C --> D[ISOLATED World Script: acd_cs_*]
    C --> E[MAIN World Script: acd_main_*]
    D --> F[Theme Engine & Fallback Scanner]
    D --> G[DOM MutationObserver]
    E --> H[React Composer Interceptor & Outgoing Bridge]
    E --> I[Incoming BiDi Classifier & Two-Row DOM Tagger]
    F --> J[Apply Dark Stylesheet & Root Attributes]
    H --> K[Cooperate with React controlled inputs]
    I --> L[Tag data-acd-bidi-dir on messages]
```

### Execution Worlds

1. **ISOLATED World** (`acd_cs_<protocol>_<host>`):
   - **Files**: `vendor/darkreader.js`, `content/darkreader-presets.js`, `content/darkreader-engine.js`, `content/theme-engine.js`, `content/observer.js`, `content/content.js`
   - **Configuration**: `runAt: "document_start"`, `allFrames: true`, `world: "ISOLATED"`
   - **Responsibilities**:
     - Synchronizes storage settings with `documentElement`.
     - Applies Dark Reader dynamic theme with the selected preset (`dark`, `amoled`, `dim`, `warm`) and shared Adobe Connect protection fixes.
     - Injects functional stylesheets (`styles/chat-functional.css`, `styles/chat-colors.css`).
     - Inspects and styles accessible Open Shadow DOM roots.
2. **MAIN World** (`acd_main_<protocol>_<host>`):
   - **Files**: `content/chat-rtl-main.js`
   - **Configuration**: `runAt: "document_start"`, `allFrames: true`, `world: "MAIN"`
   - **Responsibilities**:
     - Executes in the page's execution context to cooperate directly with Adobe Connect's React state.
     - Intercepts Chat typing and Send events without triggering input desynchronization.
     - Intercepts `Element.prototype.attachShadow` to capture dynamically mounted open shadow trees.
     - Performs line classification and tags incoming chat message elements.

### Self-Healing Synchronization
On browser startup (`runtime.onStartup`) and extension installation/update (`runtime.onInstalled`), the background service worker executes `syncRegisteredScripts()`:
- Verifies stored active sites against actual granted permissions via `chrome.permissions.contains`.
- Purges stale records if host access was revoked externally.
- Automatically re-registers content scripts if permissions exist but registration was cleared by the browser.

---

<a id="shadow-dom-support"></a>

## Open Shadow DOM Support

Adobe Connect Web components frequently employ Shadow DOM encapsulation for pod controls, menus, and custom elements.

- **Open Shadow Roots**:
  - The extension hooks `Element.prototype.attachShadow` in the MAIN world to discover newly created open shadow roots.
  - In the ISOLATED world, `themeEngine.scanForShadowRoots()` traverses the DOM tree to locate existing shadow roots.
  - Dedicated stylesheets (`styles/shadow-dom.css`) and layout styles are injected directly into each open root.
  - A lightweight `MutationObserver` is attached to each shadow root to process dynamically added shadow elements.
- **Closed Shadow Roots Limitation**:
  - Web platform security prevents browser extensions from traversing or styling closed shadow roots (`mode: "closed"`). Elements encapsulated within closed shadow roots cannot be directly restyled.

---

<a id="media-preservation"></a>

## Media & Content Preservation Architecture

The foundational rule of Adobe Connect Dark is:

> **Theme the application shell, never the user's presentation content.**

### Protected Elements & Containers

The following elements and selector patterns are explicitly protected from color filtering, inversion, or forced background changes:

- **Webcam & Video Streams**: `video`, `.video-stream-element`, `[class*="streamPlayerLoaderScreen--"]`
- **Presentation Slides**: `.presentation-content`, `.slide-container`, `[data-ac-role="presentation"]`
- **PDF Viewer & Renderers**: `#pdf-viewer`, `.canvasHTMLPDF`, `.canvasSingleHTMLPDF`, `[class^="pdfLoaderScreen--"]`
- **Screen Sharing Surfaces**: `[class^="screenShareLoader--"]`, `[data-ac-role="screenshare"]`
- **Whiteboard & Canvas**: `canvas`, `.whiteboard-canvas`, `[class*="whiteboardWrapper--"]`, `[class*="wbShapesWrapper--"]`
- **Embedded Images & Pictures**: `img`, `picture`
- **Preserved Containers**: Elements tagged with `[data-acd-preserve="true"]` or `.acd-preserve`

### SVG Differentiation

- **Content SVGs**: SVGs inside slide containers, presentation viewports, or whiteboard canvases are treated as sensitive content and preserved with `filter: none !important; mix-blend-mode: normal !important;`.
- **UI SVGs**: Toolbar icons, pod menu glyphs, and button icons inherit theme colors via `currentColor`, ensuring high contrast against dark backgrounds.

---

<a id="root-state-attributes"></a>

## Root State Attributes

The extension communicates runtime state using attributes on the `<html>` (`documentElement`) element and individual message wrappers:

| Attribute | Location | Possible Values | Meaning |
| :--- | :--- | :--- | :--- |
| `data-acd-theme` | `<html>` | `"dark"` | Legacy dark theme is active for this site. |
| `data-acd-theme-preset` | `<html>` | `"dark"`, `"amoled"`, `"dim"`, `"warm"` | Active Dark Reader theme preset when Dark Mode is enabled. |
| `data-acd-chat-rtl` | `<html>` | `"true"` | RTL Chat Text is active for this site. |
| `data-acd-send-rtl-formatting` | `<html>` | `"true"`, `"false"` | Outgoing Send RTL Formatting state (effective when RTL Chat is on). |
| `data-acd-chat-two-row` | `<html>` | `"true"` | Two-Row Chat Layout is active for this site. |
| `data-acd-chat-color` | Chat Message Bubble | `"default"`, `"red"`, `"orange"`, `"green"`, `"brown"`, `"purple"`, `"pink"`, `"blue"`, `"grey"` | Semantic Adobe Chat Color identity preserved across all Dark Reader presets. |
| `data-acd-bidi-dir` | Chat Message Body | `"rtl"`, `"ltr"` | Dynamically applied direction computed by the BiDi classifier. |
| `data-acd-chat-two-line` | Message Wrapper | `"true"` | Marks message container for two-row grid styling. |
| `data-acd-preserve` | Any Container | `"true"` | Explicitly exempts element and its subtree from theming. |

---

<a id="project-structure"></a>

## Project Structure

```text
adobe-connect-dark/
├── manifest.json                 # Manifest V3 metadata, permissions & resource declarations
├── background.js                 # Service worker: self-healing script sync & badge management
├── vendor/
│   └── darkreader.js             # Local Dark Reader v4.9.133 bundle
├── content/
│   ├── darkreader-presets.js     # Central extensible registry of Dark Reader theme presets
│   ├── darkreader-engine.js      # Dark Reader adapter & shared Adobe Connect dynamic fixes
│   ├── content.js                # Content script entry point & storage-to-DOM synchronizer
│   ├── observer.js               # Debounced MutationObserver for SPA DOM additions
│   ├── theme-engine.js           # Theme lifecycle, Chat Color tagger & Shadow DOM manager
│   └── chat-rtl-main.js          # MAIN-world bridge: React composer interceptor & BiDi engine
├── popup/
│   ├── popup.html                # Extension popup markup (including Theme Preset selector)
│   ├── popup.css                 # Popup user interface styling
│   └── popup.js                  # Popup controls, permission requester & storage controller
├── styles/
│   ├── chat-functional.css       # Independent RTL Chat & Two-Row Chat Layout rules
│   ├── chat-colors.css           # Semantic dark-palette overrides for Adobe Chat Colors
│   ├── variables.css             # Legacy CSS custom properties & color tokens
│   ├── base.css                  # Legacy document root, scrollbars & media preservation guards
│   ├── components.css            # Legacy common menus, dialogs, forms & Spectrum controls
│   ├── connect-central.css       # Legacy Adobe Connect Central views (Calendar, Reports, etc.)
│   ├── adobe-connect.css         # Legacy live meeting pods, recording player & chat rules
│   └── shadow-dom.css            # Encapsulation-safe rules for Open Shadow DOM roots
├── assets/
│   └── fonts/
│       ├── OFL.txt               # Open Font License for Vazirmatn
│       └── Vazirmatn-Regular.woff2# Bundled local Persian/Arabic font
├── icons/
│   ├── icon16.png                # Toolbar icon (16x16)
│   ├── icon32.png                # Toolbar icon (32x32)
│   ├── icon48.png                # Extensions management icon (48x48)
│   └── icon128.png               # Web store & display icon (128x128)
├── docs/
│   └── screenshots/              # Repository screenshots & comparison assets
│       ├── popup-comparison.png  # Popup inactive/active side-by-side
│       ├── light-mode.png        # Native Adobe Connect Web client
│       ├── dark-mode.png         # Themed Adobe Connect Web client
│       ├── chat-default.png      # Default single-row chat pod
│       ├── chat-rtl.png          # RTL-aligned chat pod
│       └── chat-two-row.png      # Two-row sender/message chat pod
└── README.md                     # Comprehensive project documentation
```

---

<a id="coverage"></a>

## Adobe Connect Interface Coverage

The extension provides comprehensive component coverage across the web application:

### Adobe Connect Central
- **Navigation**: Legacy top header bar, primary navigation tabs, breadcrumbs, and user menu.
- **Search & Filter**: Global search fields, dropdown filters, and result lists.
- **Calendar**: Week view, Month view, Activity view, day headers, current/past/future day badges, and event popovers.
- **Reports & Administration**: Reporting cards, summary tables, participant logs, and download dialogs.
- **Forms & Dialogs**: Spectrum dialog overlays, modal windows, textboxes, dropdowns, and checkboxes.

### Live Meeting & Recording Playback
- **Pod Shells**: Pod titles, headers, borders, pod menus, and minimize/maximize buttons.
- **Chat Pod**: Message list, sender names, timestamps, message content, compose textarea, and send button.
- **Attendees Pod**: Hosts, Presenters, and Participants accordion sections, user rows, status icons, and search filter.
- **Video Pod**: Video chrome, speaker label overlays, multi-camera grid frames, and empty state placeholders.
- **Share Pod Chrome**: Surrounding control bar, layout switcher, zoom controls, and page navigation (inner shared content preserved).
- **Recording Player**: Timeline scrubber, play/pause controls, progress rail, elapsed/total time, volume slider, and event index sidebar.
- **Other Pods**: Notes Pod, Polls Pod (questions/answers), Files Pod, and Web Links Pod chrome.

---

<a id="browser-compatibility"></a>

## Browser Compatibility

| Browser | Support Level | Engine | Notes |
| :--- | :---: | :--- | :--- |
| **Google Chrome** | Full | Chromium (V8 / Blink) | Primary development and validation target. |
| **Microsoft Edge** | Full | Chromium (V8 / Blink) | Fully supported; identical Manifest V3 behavior. |
| **Brave** | Full | Chromium (V8 / Blink) | Verified compatible with Shields enabled. |
| **Opera / Opera GX** | Full | Chromium (V8 / Blink) | Supported via Chromium extensions management. |
| **Mozilla Firefox** | Not Targeted | Gecko / SpiderMonkey | Manifest V3 background script differences not implemented. |
| **Apple Safari** | Not Targeted | WebKit | Requires separate WebExtension packaging. |

---

<a id="adobe-connect-compatibility"></a>

## Adobe Connect Compatibility

- **Target Interface**: Adobe Connect HTML5 Web Client and Recording UI.
- **Tested Environment**: Validated against current Adobe Connect Web UI deployments (including Adobe Connect 11.2.x and subsequent HTML5 web releases).
- **Resilient Selectors**: The extension strictly avoids hardcoded CSS-module hash suffixes (e.g., `chatMessageSender--abc123xyz`), relying instead on resilient prefix selectors (`[class^="chatMessageSender--"]`) and semantic container hierarchies.

---

<a id="privacy-security"></a>

## Privacy & Security

Adobe Connect Dark is designed with a strict local-first privacy posture:

- **No Analytics & No Telemetry**: The codebase contains zero analytics libraries, tracking pixels, or telemetry calls.
- **No External Network Calls**: The extension makes no `fetch()` or `XMLHttpRequest` calls to remote endpoints.
- **No Remote Code Execution**: All stylesheets, scripts, and fonts (`Vazirmatn`) are bundled directly within the extension package, adhering to Manifest V3 security requirements.
- **Origin Isolation**: Host permissions and stored configuration are strictly scoped to the specific Adobe Connect domain authorized by the user.

---

<a id="known-limitations"></a>

## Known Limitations

- **Chromium Target**: The extension is built and tested specifically for Chromium-based browsers; Firefox and Safari are not currently supported.
- **Closed Shadow DOM**: Adobe Connect components rendered inside closed shadow roots cannot be styled by browser extensions due to browser security boundaries.
- **Future Adobe Connect DOM Updates**: If Adobe makes structural architectural changes to HTML5 client class names or pod DOM trees, selectors may require updates.
- **Complex Multilingual Edge Cases**: While the bidirectional classifier handles mixed English/Persian sentences, inline math, and punctuation, unusual multilingual mixed sentences (e.g., three languages intermingled in one line) may rely on browser default BiDi resolution.

---

<a id="troubleshooting"></a>

## Troubleshooting

### Dark Mode does not appear after enabling
1. Verify that the popup status badge indicates **Active**.
2. Ensure you clicked **Allow** on the browser's permission prompt for the domain.
3. Refresh the Adobe Connect page (`F5` or `Ctrl+R`).
4. Inspect the page HTML in DevTools: verify that `<html data-acd-theme="dark">` is present.

### RTL Chat is enabled but the Chat Pod layout did not mirror
- This is expected and intentional. The extension specifically adjusts text direction, message flow, and typing alignment without mirroring pod headers, tabs, or buttons.

### Shared slides or PDF documents remain white
- This is an intentional feature. The extension protects all shared lesson content, presentations, whiteboard drawings, and video streams from discoloration or inversion.

### Two-Row Chat Layout is not displaying on two lines
1. Confirm that **Two-Row Chat Layout** is toggled ON in the popup.
2. Verify that `<html data-acd-chat-two-row="true">` is present on the root element.
3. If Adobe Connect loaded in an unexpected iframe, verify that the extension has permission for that iframe origin.

### Outgoing messages look correct locally but unformatted for other participants
- Ensure the nested sub-toggle **Send RTL Formatting** is enabled in the popup. If disabled, outgoing text is transmitted in raw form.

---

<a id="development"></a>

## Development & Contributing

### Local Development Loop

1. Clone or edit the repository locally.
2. Open `chrome://extensions` and click the **Reload** icon on the Adobe Connect Dark card.
3. Refresh your Adobe Connect tab.
4. Open Chrome DevTools (`F12`) to inspect DOM attributes:
   ```javascript
   // Check theme state
   document.documentElement.getAttribute('data-acd-theme'); // "dark"
   
   // Check RTL state
   document.documentElement.getAttribute('data-acd-chat-rtl'); // "true"
   
   // Check Two-Row state
   document.documentElement.getAttribute('data-acd-chat-two-row'); // "true"
   ```
5. To inspect registered content scripts from the background service worker console:
   ```javascript
   chrome.scripting.getRegisteredContentScripts().then(console.log);
   ```

### Code Style Guidelines
- **No Generated Hashes**: Never hardcode build hashes like `class="pod--a8f9d"`. Use prefix matching (`[class^="pod--"]`).
- **Media Safety First**: Always verify that new CSS rules do not bleed into shared presentation canvases, screen sharing, or video tags.
- **Idempotency**: All activation functions (`applyDarkTheme`, `applyChatRtl`, `applyChatTwoRow`) must be safe to call repeatedly without duplicating styles or listeners.

---

<a id="qa-checklist"></a>

## Manual QA Checklist

Before committing or releasing updates, verify the following checklist in a real browser session:

### Feature Combinations
- [ ] Dark Mode OFF, RTL OFF, Two-Row OFF (native appearance)
- [ ] Dark Mode ON, RTL OFF, Two-Row OFF
- [ ] Dark Mode OFF, RTL ON, Two-Row OFF
- [ ] Dark Mode OFF, RTL ON, Two-Row ON
- [ ] Dark Mode ON, RTL ON, Two-Row ON
- [ ] Toggle features off without page reload
- [ ] Reload page with all features active
- [ ] Reset Site cleans up storage, removes script registrations, and revokes host permissions

### Chat Pod Verification
- [ ] Pure Persian message: `سلام چطوری؟` (RTL, right-aligned)
- [ ] Pure English message: `hello world` (LTR, left-aligned)
- [ ] Latin-led mixed sentence: `linux چیه ؟` (classified RTL)
- [ ] English grammar lead: `who is علیرضا ؟` (classified LTR)
- [ ] Math expressions: `۲۲ - ۲ = ۲۰` or `15 + 5` (math preserved LTR inside RTL)
- [ ] Two-Row layout displays sender name on row 1, message body on row 2
- [ ] Shift+Enter multiline messages classified per line

### Content Preservation Verification
- [ ] Shared PowerPoint / PDF slide colors remain intact
- [ ] Webcam video stream colors remain normal
- [ ] Screen sharing area is uncolored
- [ ] Whiteboard drawings and canvas elements remain intact

---

<a id="release-notes"></a>

## Release Notes

<a id="v185"></a>

### v1.8.5 — Modal Visual Polish

- **Restored True Modal Separation & Underlay Dimming**: Separated the full-screen modal overlay/underlay (`#confirmationDialog`, `#notificationDialog`, `.spectrumModalDialog--...`, `.spectrum-Underlay`) from the dialog card root, applying a darker translucent backdrop (`--acd-backdrop-modal: rgba(0, 0, 0, 0.56)`) with zero border or shadow so the background workspace visually recedes.
- **Single Elevated Modal Card Surface**: Styled only the true modal root (`#confirmationDialog .spectrum-Dialog`, `.spectrum-Dialog.react-spectrum-Dialog`, `#openPOAFromPodsMenuDialog`) with `--acd-bg-elevated` (`#222A34`), `1px solid var(--acd-border)`, `8px` border radius, and a deep elevated shadow (`--acd-shadow-modal`) so the modal stands out above `--acd-bg-main` and `--acd-bg-panel`.
- **Removed "Textarea Look" from Modal Description**: Removed `[class*="promotionDialog--"]` from the card-surface selector group, eliminating the inner rectangular border, background, radius, and shadow around the `"If you have the Adobe Connect application installed..."` description block.
- **Clean Header, Body & Footer Hierarchy and Spacing**: Hid the duplicate native `.spectrum-Dialog-header::after` divider, removed redundant footer borders, balanced vertical spacing across header (`12px` padding / `14px` margin), body (`1.55` line-height), and footer (`22px` top spacing), and refined Primary CTA (`Launch Adobe Connect`) and Secondary (`Cancel`, `Download Adobe Connect`) buttons without pill distortion or double `::after` borders.

---

<a id="v184"></a>

### v1.8.4 — Dark Chat Color Mapping Fix

- **Fixed Light/Default Adobe Chat Bubbles Leaking into Dark Mode**: Resolved the v1.8.3 regression where normal/default Adobe Connect chat messages (which also carry inline `background` styles such as `rgb(245, 245, 245)` or `#ffffff`) were treated as custom Chat Colors and rendered as bright white/light-grey cards inside Dark Mode.
- **Replaced Broad Inline-Background Detection with Semantic Chat Color Mapping**: Removed the `[style*="background"]` assumption and introduced an isolated, non-destructive semantic classifier (`classifyChatBubbleColor`) that maps native inline bubble RGB values to `data-acd-chat-color="default | red | orange | green | brown | purple | pink | blue | grey"`.
- **Added Dark-Compatible Variants for Adobe Chat Colors**: Designed subtle, non-fluorescent dark-tinted bubble surfaces (`--acd-chat-bubble-red`, `orange`, `green`, `brown`, `purple`, `pink`, `blue`, `grey`), hue-aware light sender accents, subtle borders, and crisp light primary text (`#F0F3F6`) so selected Chat Colors remain visually distinguishable without breaking Dark Mode aesthetics.
- **Preserved RTL, Two-Row & Native Chat State**: Maintained 100% independence of RTL/LTR line classification (`data-acd-bidi-dir`), Send RTL Formatting, Two-Row layout (`data-acd-chat-two-row`), self-message alignment (`margin-left: auto`), and full native appearance restoration when Dark Mode is turned off.

---

<a id="v183"></a>

### v1.8.3 — Chat Color & Bubble Fix

- **User-Selected Chat Color Bubble Preservation**: Fixed the root cause where Adobe Connect applies user-selected Chat Colors (`Green`, `Red`, `Blue`, `Grey`, etc.) as an inline `background` / `background-color` directly on `chatIndividualMessageContentWrapperDiv` (e.g., `style="background: rgb(215, 235, 218); ..."`). Default dark bubble backgrounds (`var(--acd-chat-bubble-default)`) are now strictly scoped with `:not([style*="background" i])` so Adobe's inline colored bubble backgrounds win unconditionally.
- **High-Contrast Typography on Pastel Colored Bubbles**: Added dedicated high-contrast dark foreground tokens (`--acd-chat-colored-sender: #1F242B`, `--acd-chat-colored-text: #2C2C2C`, `--acd-chat-colored-time: #4B4B4B`) for sender names, message bodies, timestamps, and links when rendered inside a user-colored pastel chat bubble, preventing low-contrast white-on-pastel text while keeping default dark bubbles styled with light foregrounds.
- **Non-Destructive Inline Style & Layout Coexistence**: Preserved all native inline layout declarations (`padding`, `margin-left: auto`) on `chatIndividualMessageContentWrapperDiv` alongside `data-acd-chat-two-line="true"`, RTL/LTR line classification (`data-acd-bidi-dir`), and Send RTL Formatting in both Normal DOM and Open Shadow DOM.

---

<a id="v182"></a>

### v1.8.2

- **Spectrum Substring Selector Refactoring**: Replaced broad substring selectors (`[class*="spectrum-Dialog"]`, `[class*="spectrum-Toast"]`, `[class*="spectrum-Popover"]`, `[class*="spectrum-Menu"]`, `[class*="spectrum-Picker"]`, `[class*="spectrum-Dropdown"]`) across all stylesheets with exact token and root component selectors (`.spectrum-Dialog, [class~="spectrum-Dialog"], [class^="spectrum-Dialog--"]`). Child elements (`header`, `content`, `footer`, `typeIcon`) are now styled strictly as layout/typography containers rather than independent nested cards.
- **Normal DOM & Shadow DOM Menu Parity**: Unified Open Shadow DOM menus with Normal DOM hierarchy. The Popover container now functions as the single unified card surface (`--acd-bg-elevated`, subtle border, 6px radius, soft shadow), while inner menus are fully flat and transparent with subtle hover/selection highlights and thin dividers.
- **Preserved Chat Colors & Swatches**: Prevented Layer 1 dynamic luminance detection (`data-acd-text="dark"`, `data-acd-surface="bright"`) from touching chat messages, message wrappers, or color palette swatches. User-selected chat text colors (Red, Green, Blue, Grey) and color dots in the palette now strictly preserve their native inline styles while coexisting smoothly with RTL/LTR classification and Two-Row layout.
- **Dialog & Toast Root-vs-Child Architecture**: Cleanly separated root elevation from child elements in all Dialogs (Connection Status, Switch to Application, Alerts, Manage Pods) and Toasts. Header and footer elements render with clean divider borders only, while body content remains transparent without nested borders or conflicting box shadows.
- **Single Chat Tab Active Indicator**: Solved duplicate underlines on active chat tabs by isolating the native selected text element (`.chatTabDisplayNameSelected`) and eliminating inherited underlines from generic tab buttons and tab wrappers.
- **Semantic Icon Preservation in Shadow DOM**: Harmonized Shadow DOM icon handling with Normal DOM, explicitly excluding semantic SVG icons (active audio green `#33ab84`, muted red `#ec5b62`, connection status, and toast type icons) from monochrome overrides.

---

<a id="v181"></a>

### v1.8.1

- **Top Navigation & Toolbar Consistency**: Unified all toolbar icons, meeting title, dropdown arrows, and user status controls using a coherent foreground token system (`--acd-text-secondary`, `--acd-icon-primary`, `--acd-control-hover`, `--acd-icon-hover`, `--acd-accent`), while strictly preserving native semantic status indicators (active audio green `#33ab84`, muted audio red `#ec5b62`, and network connection states).
- **Refined Menu & Dropdown Visual Hierarchy**: Overhauled context and dropdown menus (Raise Hand, Pod options, Meeting settings) to render as single, clean elevated cards (`--acd-bg-elevated`, subtle 1px border, 6px border radius, soft drop shadow). Stripped button-like bevels and standalone backgrounds from menu items, implementing subtle flat hover and selection highlights with low-contrast section dividers.
- **Zero-Flash Connection Status Dialog**: Applied explicit, high-priority dark theme rules to `[class*="connectionDetail--"]` at `document_start`, completely eliminating the brief white flash (FOUC) when clicking the connection status indicator.
- **Immediate Transient UI Theming**: Unified instant dark styling for toasts, alerts, and temporary notifiers (`.spectrum-Toast`, `.react-spectrum-ToastContainer`, `centerNotifiers--...`, `rightNotifiers--...`, `.spectrum-Alert`), ensuring zero-flash presentation while protecting semantic alert type icons.
- **"Switch to Desktop Application" Dialog Theming**: Overrode high-specificity native ID rules (`#confirmationDialog`, `#notificationDialog`, `.promotionDialog--...`), rendering the modal dialog, header, body, steps, and footer with consistent dark styling, readable typography, and accessible action buttons.
- **Native Chat Color Swatches & Custom Message Colors**: Preserved native Adobe Connect color dots in the Chat Color menu palette without theme flattening. Message bodies with custom user-selected colors now strictly preserve their native inline color while maintaining full RTL/LTR bidirectional classification.
- **Clean Chat Composer Focus Ring**: Eliminated stacked borders, double outlines, and bottom-border asymmetry on `#chatChildContainerWrapper` and `.childContainerDiv`, standardizing on a single, focused accent ring.
- **Unfocused / Blurred Chat Composer Contrast**: Fixed low-contrast black-on-dark text regression when blurring the chat input field, guaranteeing that typed draft text remains crisp and readable (`--acd-text-primary`) whether focused or blurred.
- **Streamlined Chat Active Tab Indicator**: Removed duplicate underline borders and misaligned offsets on active chat tabs and private chat tabs with close buttons, enforcing a single, precise 2px accent underline.

---

<a id="v180"></a>

### v1.8.0

- **Independent Two-Row Chat Layout**: Decoupled Two-Row Chat Layout into an independent top-level feature with its own popup toggle, per-site storage key (`acd_chat_two_row_sites`), and root attribute (`data-acd-chat-two-line`).
- **Refined RTL Chat & Classifier**: Unified bidirectional line classifier (`classifyLineDirection`) across incoming and outgoing chat processing. Added lexical English lead grammar detection and inline arithmetic preservation.
- **Send RTL Formatting Sub-Feature**: Introduced explicit sub-toggle control for outgoing Unicode BiDi formatting (`acd_send_rtl_formatting_sites`), giving users full control over whether outgoing messages include directional controls.
- **Dynamic Incoming Message Styling**: Implemented non-destructive direction tagging (`data-acd-bidi-dir="rtl"` / `"ltr"`) for incoming messages without altering received message text content.
- **Live Composer Synchronization**: Added real-time composer BiDi formatting with caret/selection tracking that cooperates seamlessly with Adobe Connect's React-controlled state.
- **Open Shadow DOM Architecture**: Intercepts `Element.prototype.attachShadow` and injects encapsulated styles and observers into accessible open shadow trees.
- **Self-Healing Runtime Sync**: Background service worker automatically validates stored sites against granted permissions, cleaning up orphan registrations and restoring missing scripts.
- **Documentation & Screenshot Synchronization**: Fully audited README aligned with Manifest V3 permissions, real storage keys, anonymized domain references, and actual v1.8.0 codebase behavior.

---

<a id="license"></a>

## License

This project is currently distributed as an open-source extension project. An official license (such as MIT) may be added by the repository owner in a subsequent release.

---

<a id="disclaimer"></a>

## Disclaimer

Adobe and Adobe Connect are registered trademarks of Adobe Systems Incorporated.

**Adobe Connect Dark** is an independent, community-driven browser extension and is **not** affiliated with, endorsed by, sponsored by, or officially associated with Adobe Systems Incorporated.

Compatibility is maintained on a best-effort basis and may be affected by updates to the Adobe Connect Web client.

---

<a id="persian-guide"></a>

<details>
<summary><strong>راهنمای سریع به زبان فارسی (Persian Quick Guide)</strong></summary>

<br>

### معرفی افزونه

**Adobe Connect Dark** یک افزونه مدرن بر پایه Manifest V3 برای مرورگرهای کرومیوم (Chrome، Edge، Brave، Opera و ...) است که برای بهبود تجربه کاربری در وب‌کلاینت ادوبی کانکت طراحی شده است.

### قابلیت‌های اصلی

1. **حالت تاریک (Dark Mode)**:
   - رابط کاربری ادوبی کانکت (پادها، نوار ابزار، منوها، فرم‌ها و پنجره‌ها) را تاریک می‌کند.
   - از فیلتر Invert استفاده **نمی‌کند** و فایل‌های اشتراکی، اسلایدها، PDF، ویدیوها، اسکرین‌شیر و وایت‌برد را کاملاً دست‌نخورده نگه می‌دارد.
2. **متن چت راست‌به‌چپ (RTL Chat Text)**:
   - پیام‌های فارسی و عربی را با فونت بهینه‌شده وزیرمتن (Vazirmatn) و چیدمان راست‌به‌چپ نمایش می‌دهد.
   - دارای تشخیص‌دهنده هوشمند جهت خطوط برای عبارات ترکیبی (مانند `linux چیه ؟` یا `who is علیرضا ؟`) و محافظت از فرمول‌های ریاضی (`۲۲ - ۲`).
3. **فرمت‌بندی ارسالی (Send RTL Formatting)**:
   - زیرگزینه‌ای برای چت RTL است که با اعمال کدهای یونیکد BiDi باعث می‌شود پیام‌های ارسالی برای سایر کاربران حاضر در جلسه نیز با چیدمان صحیح نمایش داده شوند.
4. **چیدمان دو سطری چت (Two-Row Chat Layout)**:
   - نام فرستنده و ساعت پیام را در سطر اول و متن پیام را در سطر دوم نمایش می‌دهد تا از شلوغی متن چت جلوگیری شود. این قابلیت کاملاً مستقل از دارک مود و RTL است.

### استقلال تنظیمات

```text
Dark Mode (مستقل)
RTL Chat Text (مستقل)
└── Send RTL Formatting (وابسته به RTL Chat Text)
Two-Row Chat Layout (مستقل)
```

### راهنمای نصب

1. پروژه را دانلود یا Clone کنید (در صورت دانلود فایل ZIP، آن را Extract نمایید).
2. در مرورگر به صفحه افزونه‌ها بروید:
   - کروم: `chrome://extensions`
   - اج: `edge://extensions`
3. گزینه **Developer mode** را در بالای صفحه فعال کنید.
4. روی دکمه **Load unpacked** کلیک کرده و پوشه حاوی فایل `manifest.json` را انتخاب کنید.
5. وارد صفحه ادوبی کانکت شوید، روی آیکون افزونه کلیک کرده و قابلیت‌های مورد نظر خود را فعال کنید.

### نکته امنیتی و حریم خصوصی

این افزونه کاملاً به‌صورت محلی (Local) اجرا می‌شود و فاقد هرگونه ابزار تحلیلی، تبلیغاتی، جمع‌آوری داده یا ارسال درخواست به سرورهای خارجی است.

</details>

<br>

<div align="center">

Made with care for students, educators, and professionals using Adobe Connect Web.

<p align="right"><a href="#top">↑ بازگشت به بالا / Back to top</a></p>

</div>
