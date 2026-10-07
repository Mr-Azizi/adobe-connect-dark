# Offline Visual Regression Test Lab Report (`experiment/darkreader`)

**Generated:** 2026-10-06  
**Branch:** `experiment/darkreader`  
**Viewports Tested:** `1440x900` (Standard Desktop) and `900x700` (Narrow Responsive)  
**Harness Entry:** `tests/visual/adobe-fixture.html`  
**Automated Runner:** `tests/visual/run-visual-tests.mjs`  
**Raw Computed Styles & Assertions:** `tests/visual/computed-styles-report.json`

---

## 1. Mode Summaries

### A. Native Light (`?engine=none&dark=0&rtl=0&twoRow=0&sendRtl=0`)
- **Description:** Unmodified Adobe Connect 11.2 light theme rendered using the 280 native stylesheets extracted from `recording-inner-styles.json` (`tests/visual/fixtures/adobe-native-styles.css`) and real captured DOM hierarchies from `recording-inner-dom.html`.
- **Key Surface Metrics:**
  - Toolbar (`#test-toolbar`): `background-color: rgb(245, 245, 245)`, `color: rgb(75, 75, 75)`
  - Pod Header (`.podPrimaryBar--2Vw6SaEid6wE12N5XtMSBR`): `background-color: rgb(245, 245, 245)`, `color: rgb(112, 112, 112)`
  - Default Chat Bubble (`#bubble-color-default`): `background-color: rgb(245, 245, 245)`, `color: rgb(75, 75, 75)`, `display: inline-block`, `direction: ltr`
  - Composer (`#chatTypingArea`): `background-color: rgb(255, 255, 255)`, `color: rgb(44, 44, 44)`
  - Popover (`#test-popover`): `background-color: rgb(255, 255, 255)`, `border-color: rgb(202, 202, 202)`
  - Modal (`#test-modal`): `background-color: rgb(245, 245, 245)`, `border-color: rgb(210, 210, 210)`

### B. Legacy v1.8.5 (`?engine=legacy&dark=1&rtl=1&twoRow=1&sendRtl=1`)
- **Description:** Hand-crafted CSS dark theme (`variables.css`, `base.css`, `adobe-connect.css`, `components.css`, `connect-central.css`) + `chat-functional.css` + JS luminance surface classifier (`evaluateElement()`) and semantic chat bubble color mapper (`classifyChatBubbleLightColor()`).
- **Key Surface Metrics:**
  - Toolbar (`#test-toolbar`): `background-color: rgb(28, 34, 43)`, `color: rgb(240, 243, 246)`
  - Pod Header: `background-color: rgb(28, 34, 43)`, `color: rgb(240, 243, 246)`
  - Default Chat Bubble: `background-color: rgb(30, 36, 45)`, `color: rgb(240, 243, 246)`, `border-color: rgba(255, 255, 255, 0.07)`, `display: inline-grid`
  - Sender (`#test-chat-sender`): `color: rgb(110, 168, 254)` (distinct accent blue)
  - Popover / Modal / Toast: `background-color: rgb(34, 42, 52)`, `color: rgb(240, 243, 246)`, `border-color: rgb(41, 50, 61)`

### C. Dark Reader + Semantic Chat Color Mapping (`?engine=darkreader&dark=1&rtl=1&twoRow=1&sendRtl=1`)
- **Description:** Official bundled `darkreader@4.9.123` engine (`darkSchemeBackgroundColor: '#14181e'`, `darkSchemeTextColor: '#e6edf3'`, media `invert: []` / `css` protection) + dedicated `styles/chat-colors.css` semantic chat bubble palette (`ignoreCSSUrl` + `ignoreInlineStyle` protected) + preserved `styles/chat-functional.css` + preserved RTL/BiDi/Two-Row/Shadow DOM logic, while keeping all legacy generic CSS and JS surface/text classification strictly bypassed (`acdSurfaceCount = 0`, `acdTextCount = 0`).
- **Key Surface Metrics:**
  - Toolbar (`#test-toolbar`): `background-color: rgb(24, 30, 38)`, `color: rgb(208, 216, 224)`
  - Pod Header: `background-color: rgb(24, 30, 38)`, `color: rgb(127, 152, 176)`
  - Default Chat Bubble: `background-color: rgb(30, 36, 45)` (`#1E242D`), `color: rgb(240, 243, 246)` (`#F0F3F6`), `border-color: rgba(255, 255, 255, 0.07)`, `display: inline-grid`
  - Sender (`#test-chat-sender`): `color: rgb(110, 168, 254)` (`#6EA8FE` on Default, plus family-specific pastel accents on colored bubbles)
  - Composer (`#chatTypingArea`): `background-color: rgb(20, 24, 30)`, `color: rgb(193, 205, 215)`
  - Popover / Connection Status: `background-color: rgb(20, 24, 30)`, `color: rgb(163, 181, 198)`, `border-color: rgb(52, 68, 87)`
  - Modal (`#test-modal`): `background-color: rgb(24, 30, 38)`, `color: rgb(163, 181, 198)`, `border-color: rgb(50, 66, 84)`

---

## 2. 17-Area Visual & Functional Comparison Matrix

| # | Area | Legacy v1.8.5 | Dark Reader + Chat Colors | Detailed Comparison & Findings |
|---|---|---|---|---|
| 1 | **Overall contrast** | **PASS** | **PASS** | Chat bubbles now use crisp `#F0F3F6` (`rgb(240, 243, 246)`) message text and family-matched sender accents via `styles/chat-colors.css`, while general Adobe Connect surfaces use Dark Reader's balanced `#14181e` / `rgb(163, 181, 198)` palette (~6.8:1 WCAG AA). |
| 2 | **Surface hierarchy** | **PASS** | **PASS** | Default chat bubbles (`rgb(30, 36, 45)` with `rgba(255, 255, 255, 0.07)` border) now stand out clearly from the Dark Reader chat pod container (`rgb(20, 24, 30)`). |
| 3 | **Toolbar** | **PASS** | **PASS** | Both engines darken `.actionBar--121SkHJEFxiY_i3EE-0DFP` cleanly (`rgb(28, 34, 43)` in Legacy vs `rgb(24, 30, 38)` in Dark Reader) and preserve semantic green (`rgb(51, 171, 132)`) and red (`rgb(236, 91, 98)`) microphone SVG fills. |
| 4 | **Pod headers** | **PASS** | **PASS** | `.podPrimaryBar--2Vw6SaEid6wE12N5XtMSBR` is darkened to `rgb(28, 34, 43)` in Legacy and `rgb(24, 30, 38)` in Dark Reader. Pod titles and action buttons remain legible in both viewports (`1440x900` and `900x700`). |
| 5 | **Chat readability** | **PASS** | **PASS** | Vazirmatn font and line-height (`1.65`) load via `styles/chat-functional.css`, and `styles/chat-colors.css` restores distinct sender name accents (`#6EA8FE` default, `#93C5FD` blue, `#6EE7B7` green, etc.), high-contrast `#F0F3F6` message body text, and `#7F8A96` / `#B8C0CA` timestamps. |
| 6 | **RTL alignment** | **PASS** | **PASS** | Pure RTL message (`سلام خوبی؟`, `#msg-rtl`) receives `data-acd-bidi-dir="rtl"`, `direction: rtl`, `unicode-bidi: isolate`, and right alignment in both Legacy and Dark Reader. |
| 7 | **Mixed BiDi messages** | **PASS** | **PASS** | Mixed messages (`linux چیه ؟` `#msg-mixed-1` and `سلام alireza چطوری؟` `#msg-mixed-2`) receive `data-acd-bidi-dir="rtl"` via the percentage-based script detector in `theme-engine.js`, while pure LTR (`hello world` `#msg-ltr`) receives `data-acd-bidi-dir="ltr"`. Punctuation (`؟`) stays on the left side of RTL lines without jumping. |
| 8 | **Two-Row layout** | **PASS** | **PASS** | With `twoRow=1`, `.chatIndividualMessageContentWrapperDiv--3_-ljsHfbddoYb57h1tELa` computes `display: inline-grid` with sender + timestamp on row 1 and message body on row 2 (`display: block`). With `twoRow=0` (`darkreaderSingleRow`), it cleanly reverts to `display: inline-block` / `display: inline`. Open Shadow DOM chat fixture (`#test-shadow-host`) also computes `display: inline-grid` with `twoRow=1` and `display: block` with `twoRow=0`. |
| 9 | **Chat bubble colors** | **PASS** | **PASS** | Restored via `shouldRunChatColorMapping()` + `styles/chat-colors.css` + Dark Reader `ignoreCSSUrl` & `ignoreInlineStyle`. All 9 inline pastel colors (`default`, `red`, `orange`, `green`, `brown`, `purple`, `pink`, `blue`, `grey`) map identically to the v1.8.4/v1.8.5 dark palette (`#1E242D`, `#311C21`, `#312318`, `#192E26`, `#2A221D`, `#261E34`, `#311D2B`, `#19273A`, `#262C36`) with zero Dark Reader re-transformation and clean Light Mode restoration (`darkreaderLightToggleOff`). |
| 10 | **Composer and send button** | **PASS** | **PASS** | `#chatTypingArea` (`textarea`) is darkened cleanly in both Legacy (`rgba(0,0,0,0)` over `#161b22` container, `color: rgb(240, 243, 246)`) and Dark Reader (`rgb(20, 24, 30)`, `color: rgb(193, 205, 215)`), with `direction: rtl`, `unicode-bidi: plaintext`, and Vazirmatn font active. `#sendButton` icon remains clearly visible. |
| 11 | **Menus and submenus** | **PASS** | **PASS** | `.spectrum-Popover`, `.spectrum-Menu`, nested submenus (`Chat Color ▸`), and color swatch dots (`.chatMenuItemColorCode--2saTHurO6A1ZArICHC1QOB`) render cleanly in Dark Reader (`background-color: rgb(20, 24, 30)`, `border-color: rgb(52, 68, 87)`). |
| 12 | **Switch to Application modal** | **PASS** | **PASS** | `#confirmationDialog` → `.spectrum-Dialog` → `.spectrum-Dialog-header` → `.promotionDialog--14tIxjnOTZJ165BAqu7L5t` → `.stepDiv--3vFpC9lhdTf1xYFiSRqLxk` → `.spectrum-Dialog-footer` renders cleanly in Dark Reader (`background-color: rgb(24, 30, 38)`, `border-color: rgb(50, 66, 84)`), with readable links (`Download Adobe Connect`) and primary CTA button (`Launch Adobe Connect`). |
| 13 | **Connection Status popup** | **PASS** | **PASS** | `.connectionDetail--2sFDPJbKDvPI3ifG6eTyBi` (`#test-connection-status`) renders cleanly in Dark Reader (`background-color: rgb(20, 24, 30)`, `color: rgb(163, 181, 198)`, `border-color: rgb(20, 82, 157)`), preserving Adobe's blue accent border. |
| 14 | **Toast notifications** | **PASS** | **MINOR ISSUE** | Status/positive toast (`#test-toast-status`) looks good in Dark Reader (`background-color: rgb(22, 48, 40)`, `color: rgb(131, 234, 200)`). Neutral Spectrum toast (`#test-toast-neutral`, native `rgb(116, 116, 116)`) is transformed by Dark Reader into `rgb(70, 92, 118)` with `rgb(123, 149, 174)` container text. |
| 15 | **Media protection** | **PASS** | **PASS** | All 6 media regions (`#test-video`, `#test-canvas`, `#test-image`, `#test-pdf-canvas`, `#test-share-content`, `#test-screenshare-canvas`, `#test-whiteboard`) pass automated assertions with `filter: none`, `opacity: 1`, `mix-blend-mode: normal`. RGB reference bars and whiteboard shapes remain 100% unaltered. |
| 16 | **Dynamic mutation handling** | **PASS** | **PASS** | Dynamically inserted chat messages (`#dynamic-chat-bubble`, `acdChatColor: "default"`, `rgb(30, 36, 45)`), inline bubble color changes (`#bubble-color-default` → `acdChatColor: "purple"`, `rgb(38, 30, 52)`), dynamically opened popovers (`#dynamic-popover`), toasts (`#dynamic-toast`), and modals (`#dynamic-modal`) are automatically styled by Dark Reader and `ACDObserver` (`bidiDir: "rtl"`) without page reload. |
| 17 | **100-message stress behavior** | **PASS** | **PASS** | Rapidly appending 120 chat messages completed in `1.7ms` DOM append (`455.7ms` total including 450ms settle window) in Dark Reader vs `1.3ms` DOM append (`476.9ms` total) in Legacy, with `mutationLoopDetected: false` and `0` console errors in both engines. |

### Items Classified as `NOT TESTABLE OFFLINE`
1. **Cross-Origin Live WebRTC Video & Screen-Share Streams (`MediaStream` / `RTCPeerConnection`)**: Offline fixtures verify `<video>` and `<canvas>` CSS properties (`filter: none`, `opacity: 1`, `mix-blend-mode: normal`), but live decoded WebRTC hardware overlays and dynamic Adobe screen-share iframe/canvas pipelines require a live meeting.
2. **Real-Time Outgoing WebSocket Chat Payload Interception (`chat-rtl-main.js`)**: In-page composer hooks (`\u200F` RLM prefixing on `Enter` / `#sendButton` click) can be triggered synthetically, but end-to-end verification that remote Adobe Connect participants receive and render the RLM-prefixed message requires a live meeting server.
3. **Closed Shadow Roots & Dynamic Authenticated Typekit/Icon Fetching**: Open Shadow DOM is verified offline, but any closed shadow roots or authenticated runtime assets served by a live Adobe Connect cluster cannot be tested offline.

---

## 3. Chat Bubble Color Transformation Table (Native Light vs Legacy vs Dark Reader + `chat-colors.css`)

| Bubble Color | Origin | Native Light `background-color` | Legacy v1.8.5 `background-color` | Dark Reader PoC (Before Fix) | Dark Reader + `chat-colors.css` `background-color` | Dark Reader + `chat-colors.css` `border-color` | Sender Color (`chat-colors.css`) | Light Mode Toggle-Off (`removeDarkTheme()`) |
|---|---|---|---|---|---|---|---|---|
| **Default** | Real (`recording-inner-dom.html`) | `rgb(245, 245, 245)` | `rgb(30, 36, 45)` | `rgb(24, 30, 38)` | `rgb(30, 36, 45)` (`#1E242D`) | `rgba(255, 255, 255, 0.07)` | `rgb(110, 168, 254)` (`#6EA8FE`) | `rgb(245, 245, 245)` |
| **Green** | Real (`rgb(215, 235, 218)`) | `rgb(215, 235, 218)` | `rgb(25, 46, 38)` | `rgb(30, 56, 40)` | `rgb(25, 46, 38)` (`#192E26`) | `rgba(63, 185, 80, 0.28)` | `rgb(110, 231, 183)` (`#6EE7B7`) | `rgb(215, 235, 218)` |
| **Red** | Documented Adobe Pastel | `rgb(245, 215, 215)` | `rgb(49, 28, 33)` | `rgb(61, 20, 20)` | `rgb(49, 28, 33)` (`#311C21`) | `rgba(248, 81, 73, 0.28)` | `rgb(252, 165, 165)` (`#FCA5A5`) | `rgb(245, 215, 215)` |
| **Blue** | Documented Adobe Pastel | `rgb(212, 229, 247)` | `rgb(25, 39, 58)` | `rgb(31, 40, 50)` | `rgb(25, 39, 58)` (`#19273A`) | `rgba(110, 168, 254, 0.28)` | `rgb(147, 197, 253)` (`#93C5FD`) | `rgb(212, 229, 247)` |
| **Purple** | Documented Adobe Pastel | `rgb(228, 215, 242)` | `rgb(38, 30, 52)` | `rgb(31, 41, 50)` | `rgb(38, 30, 52)` (`#261E34`) | `rgba(163, 113, 247, 0.28)` | `rgb(196, 181, 253)` (`#C4B5FD`) | `rgb(228, 215, 242)` |
| **Pink** | Documented Adobe Pastel | `rgb(247, 215, 232)` | `rgb(49, 29, 43)` | `rgb(63, 17, 41)` | `rgb(49, 29, 43)` (`#311D2B`) | `rgba(236, 108, 180, 0.28)` | `rgb(249, 168, 212)` (`#F9A8D4`) | `rgb(247, 215, 232)` |
| **Grey** | Documented Adobe Pastel | `rgb(228, 228, 228)` | `rgb(38, 44, 54)` | `rgb(32, 41, 51)` | `rgb(38, 44, 54)` (`#262C36`) | `rgba(184, 192, 202, 0.18)` | `rgb(203, 213, 225)` (`#CBD5E1`) | `rgb(228, 228, 228)` |
| **Orange** | Synthetic (`synthetic-classifier`) | `rgb(252, 226, 196)` | `rgb(49, 35, 24)` | `rgb(79, 46, 9)` | `rgb(49, 35, 24)` (`#312318`) | `rgba(230, 145, 56, 0.28)` | `rgb(253, 186, 116)` (`#FDBA74`) | `rgb(252, 226, 196)` |
| **Brown** | Synthetic (`synthetic-classifier`) | `rgb(232, 218, 202)` | `rgb(42, 34, 29)` | `rgb(65, 49, 31)` | `rgb(42, 34, 29)` (`#2A221D`) | `rgba(186, 146, 112, 0.26)` | `rgb(226, 194, 162)` (`#E2C2A2`) | `rgb(232, 218, 202)` |

