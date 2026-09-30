# افزونه حالت تاریک ادوبی کانکت | Adobe Connect Dark Mode Extension

یک افزونه پیشرفته و مستقل مبتنی بر **Manifest V3** برای مرورگرهای Chrome و Edge جهت ایجاد حالت تاریک (Dark Mode) استاندارد و باکیفیت در نسخه وب Adobe Connect، بدون آسیب رساندن یا اینورت کردن محتوای حساس جلسه (وبکم، اشتراک صفحه، اسلایدها و وایت‌برد).

---

## فهرست مطالب (Table of Contents)
- [ویژگی‌های کلیدی (Key Features)](#ویژگیهای-کلیدی-key-features)
- [معماری دسترسی و مجوزها (Permission-on-Demand Architecture)](#معماری-دسترسی-و-مجوزها-permission-on-demand-architecture)
- [پالت رنگی (Color Palette)](#پالت-رنگی-color-palette)
- [معماری افزونه (Extension Architecture)](#معماری-افزونه-extension-architecture)
- [ساختار فایل‌ها (Project Structure)](#ساختار-فایلها-project-structure)
- [راهنمای نصب (Installation Guide)](#راهنمای-نصب-installation-guide)
  - [نصب در گوگل کروم (Google Chrome)](#نصب-در-گوگل-کروم-google-chrome)
  - [نصب در مایکروسافت اج (Microsoft Edge)](#نصب-در-مایکروسافت-اج-microsoft-edge)
- [نحوه استفاده و فعال‌سازی (Usage Guide)](#نحوه-استفاده-و-فعالسازی-usage-guide)
- [نحوه دیباگ و بررسی خطاها (Debugging Guide)](#نحوه-دیباگ-و-بررسی-خطاها-debugging-guide)
- [محدودیت‌های نسخه اولیه (V1 Limitations)](#محدودیتهای-نسخه-اولیه-v1-limitations)
- [راهنمای توسعه به V2: نحوه ارسال DOM و اسکرین‌شات](#راهنمای-توسعه-به-v2-نحوه-ارسال-dom-و-اسکرینشات)

---

## ویژگی‌های کلیدی (Key Features)

1. **تفکیک کامل پروتکل‌ها با کلید یکتای سایت (SiteKey Architecture):**
   - ذخیره‌سازی وضعیت فعال بودن بر اساس پروتکل و دامنه (`siteKey = `${protocol}//${hostname}``) در `acd_enabled_sites`.
   - عدم تداخل بین نسخه امن و ناامن (`https://...` فعال ≠ `http://...` فعال) و تولید شناسه‌های یکتا برای اسکریپت‌ها.
2. **معماری مجوز بر اساس تقاضا و ثبت اتمیک (Atomic Permission-on-Demand):**
   - هیچ‌گونه دسترسی سراسری یا اسکریپت استاتیک روی همه سایت‌ها وجود ندارد (`optional_host_permissions`).
   - جریان اتمیک در پاپ‌آپ: درخواست مجوز -> ثبت داینامیک اسکریپت -> ذخیره در استوریج. در صورت بروز خطا در ثبت، وضعیت بلافاصله Rollback شده و به حالت Off برمی‌گردد.
3. **همگام‌سازی خودترمیم‌شونده در پس‌زمینه (Self-Healing Background Sync):**
   - سرویس‌ورکر در زمان استارتاپ و نصب، وضعیت استوریج، مجوزها و اسکریپت‌های ثبت‌شده را اعتبارسنجی می‌کند. اگر مجوزی لغو شده باشد از استوریج حذف می‌شود و اگر اسکریپتی ثبت نشده باشد مجدداً ثبت (Repair) می‌گردد.
4. **ناظر اختصاصی برای جهش‌های درون شادودام (Shadow DOM MutationObservers):**
   - ایجاد یک `MutationObserver` سبک و مستقل برای هر Open ShadowRoot با نگاشت `Map<ShadowRoot, MutationObserver>`. المان‌هایی که بعداً داخل شادودام اضافه می‌شوند نیز استایل می‌گیرند و در زمان خاموشی، تمام لیسنرها Disconnect می‌شوند.
5. **اسکن تضمین‌شده DOM اولیه (Guaranteed Initial DOM Scan):**
   - اعمال زودهنگام تم و اجرای اسکن اولیه به محض آماده شدن `document.body` بدون وابستگی صرف به رویدادهای رندوم.
6. **حفاظت غیرمخرب از مدیا و تفکیک هوشمند SVGها:**
   - عدم اعمال استایل‌های اجباری روی ویدیو، وبکم و بوم اسلاید/وایت‌برد. آیکون‌های UI با `currentColor` هماهنگ شده و SVGهای محتوایی دست‌نخورده می‌مانند.

---

## معماری دسترسی و مجوزها (Permission-on-Demand Architecture)

در این نسخه، معماری امنیتی و چرخه‌حیات به صورت کامل بازمهندسی شده است:

1. مانیفست فاقد هرگونه `host_permissions: ["*://*/*"]` سراسری است.
2. مانیفست فاقد اسکریپت محتوای استاتیک سراسری است.
3. در زمان کلیک کاربر روی سوییچ **Dark Mode** در پاپ‌آپ:
   - مقدار `siteKey` (مثلاً `https://connect.example.com`) و الگوی مبدا (`https://connect.example.com/*`) تعیین می‌شود.
   - تابع `chrome.permissions.request({ origins: [originPattern] })` فراخوانی می‌شود تا کاربر فقط مجوز همان پروتکل و دامنه خاص را تأیید کند.
   - اسکریپت محتوا با شناسه بدون برخورد (مانند `acd_cs_https_connect_example_com`) به صورت داینامیک ثبت می‌شود.
   - تنها در صورت موفقیت کامل ثبت، وضعیت در `acd_enabled_sites` ذخیره می‌شود.
   - بعد از رفرش صفحه (F5)، مرورگر اسکریپت را در `document_start` اجرا می‌کند.
   - با کلیک روی **Reset Site**، اسکریپت لغو ثبت، مقدار از استوریج حذف و مجوز مبدا با `chrome.permissions.remove` آزاد می‌شود.

---

## پالت رنگی (Color Palette)

تم تاریک دقیقاً مطابق با استانداردهای مدرن کنتراست و پالت تعیین‌شده طراحی شده است:

| المان UI | متغیر CSS | مقدار هگز (Hex) |
| :--- | :--- | :--- |
| **Main Background** | `--acd-bg-main` | `#111418` |
| **Secondary Background** | `--acd-bg-secondary` | `#181C21` |
| **Panel / Pod Background** | `--acd-bg-panel` | `#1D2228` |
| **Header & Toolbars** | `--acd-bg-toolbar` | `#20252B` |
| **Hover State** | `--acd-bg-hover` | `#292F36` |
| **Active / Pressed** | `--acd-bg-active` | `#323942` |
| **Input Background** | `--acd-bg-input` | `#15191E` |
| **Primary Text** | `--acd-text-primary` | `#EDF1F5` |
| **Secondary Text** | `--acd-text-secondary` | `#B7C0CA` |
| **Muted / Metadata Text** | `--acd-text-muted` | `#8B949E` |
| **Border / Divider** | `--acd-border` | `#30363D` |
| **Brand Accent** | `--acd-accent` | `#6E9BFF` |
| **Accent Hover** | `--acd-accent-hover` | `#86ACFF` |

---

## معماری افزونه (Extension Architecture)

معماری افزونه به صورت ماژولار و تفکیک‌شده طراحی شده است:

```
┌────────────────────────────────────────────────────────┐
│                        Popup UI                        │
│   (popup.html / popup.css / popup.js)                  │
│   - Domain Detection & Switch State                    │
│   - chrome.permissions.request(origin)                 │
│   - chrome.scripting.registerContentScripts()          │
│   - Toggle ON / OFF & Reset Site Settings              │
└───────────┬────────────────────────────────────────────┘
            │ chrome.storage.local & chrome.tabs.sendMessage
            ▼
┌────────────────────────────────────────────────────────┐
│             Background Service Worker                  │
│   (background.js - Manifest V3)                        │
│   - Lifecycle Management & Default State               │
│   - Sync Registered Scripts on Startup                 │
│   - Dynamic Action Badge (displays 'ON' when active)   │
└────────────────────────────────────────────────────────┘
            │
            ▼ Dynamic Content Script (Per-Origin Only)
┌────────────────────────────────────────────────────────┐
│                     Content Layer                      │
│                                                        │
│  ┌────────────────┐  ┌───────────────┐  ┌────────────┐ │
│  │   content.js   │  │theme-engine.js│  │observer.js │ │
│  │ (Domain check, │◄─┼─(Injects CSS, ┼─►│(Debounced  │ │
│  │ Storage & Msg) │  │ Layer 1 & 2,  │  │DOM & Shadow│ │
│  │                │  │ Shadow DOM)   │  │ watcher)   │ │
│  └────────────────┘  └───────┬───────┘  └────────────┘ │
└──────────────────────────────┼─────────────────────────┘
                               ▼
┌────────────────────────────────────────────────────────┐
│                     Styles Layer                       │
│  - variables.css      : Design tokens & CSS vars       │
│  - base.css           : Root, scrollbars, media safety │
│  - shadow-dom.css     : Encapsulation-safe Shadow DOM  │
│  - adobe-connect.css  : Layer 2 specific selectors     │
│  - components.css     : Menus, modals, popovers, tabs  │
└────────────────────────────────────────────────────────┘
```

---

## ساختار فایل‌ها (Project Structure)

```text
d:/Alirezas-project/Adobe Connect Dark Mod Ext/
│
├── manifest.json              # مانیفست MV3 با دسترسی اختیاری (optional_host_permissions)
├── background.js              # سرویس‌ورکر پس‌زمینه برای مدیریت چرخه حیات و سینک اسکریپت‌ها
│
├── content/
│   ├── content.js             # نقطه ورود Content Script، بررسی وضعیت دامنه و مدیریت پیام‌ها
│   ├── observer.js            # ناظر بهینه‌سازی‌شده برای DOM پویا و Open Shadow DOM
│   └── theme-engine.js        # موتور تم، اسکن اولیه قطعی، چرخه حیات شادودام و لایه ۱
│
├── styles/
│   ├── variables.css          # توکن‌ها و متغیرهای رنگی تم
│   ├── base.css               # استایل‌های پایه روت، اسکرول‌بارها و محافظت از مدیا
│   ├── shadow-dom.css         # استایل‌های اختصاصی برای داخل Open Shadow Roots
│   ├── adobe-connect.css      # سلکتورهای اختصاصی پادها، نوار ابزار، چت و کاربران
│   └── components.css         # سلکتورهای منوها، دیالوگ‌ها، پاپ‌اورها و دکمه‌ها
│
├── popup/
│   ├── popup.html             # رابط کاربری پنجره تنظیمات افزونه
│   ├── popup.css              # استایل مدرن و تاریک پاپ‌آپ
│   └── popup.js               # منطق کنترل پاپ‌آپ، درخواست مجوز پویا و ثبت داینامیک اسکریپت
│
├── icons/
│   ├── icon16.png             # آیکون ۱۶ پیکسل برای تولبار
│   ├── icon32.png             # آیکون ۳۲ پیکسل برای صفحات نمایش رتینا
│   ├── icon48.png             # آیکون ۴۸ پیکسل برای صفحه افزونه‌ها
│   └── icon128.png            # آیکون ۱۲۸ پیکسل با کیفیت بالا
│
└── README.md                  # راهنمای کامل فارسی و انگلیسی پروژه
```

---

## راهنمای نصب (Installation Guide)

### نصب در گوگل کروم (Google Chrome)

1. مرورگر **Chrome** را باز کنید.
2. به آدرس زیر بروید:
   ```text
   chrome://extensions/
   ```
3. در گوشه بالا سمت راست، گزینه **Developer mode** را فعال کنید.
4. روی دکمه **Load unpacked** (بارگیری بازنشده) در بالا سمت چپ کلیک کنید.
5. پوشه پروژه را انتخاب کنید:
   ```text
   d:\Alirezas-project\Adobe Connect Dark Mod Ext
   ```
6. افزونه با نام **Adobe Connect Dark Mode** به لیست افزونه‌های شما اضافه خواهد شد.
7. آیکون پین (Pin) کنار نام افزونه را بزنید تا در نوار ابزار مرورگر همیشه در دسترس باشد.

### نصب در مایکروسافت اج (Microsoft Edge)

1. مرورگر **Edge** را باز کنید.
2. به آدرس زیر بروید:
   ```text
   edge://extensions/
   ```
3. از منوی سمت چپ، گزینه **Developer mode** (حالت توسعه‌دهنده) را فعال کنید.
4. روی دکمه **Load unpacked** کلیک کنید.
5. پوشه افزونه را انتخاب کنید:
   ```text
   d:\Alirezas-project\Adobe Connect Dark Mod Ext
   ```
6. افزونه با موفقیت لود شده و آماده استفاده است.

---

## نحوه استفاده و فعال‌سازی (Usage Guide)

1. وارد کلاس یا جلسه وب **Adobe Connect** خود شوید (روی هر دامنه دلخواه).
2. روی آیکون ماه افزونه در نوار ابزار کلیک کنید.
3. در پنجره پاپ‌آپ، سوییچ **Dark Mode** را در حالت **ON** قرار دهید.
4. یک اعلان ساده مرورگر برای تأیید دسترسی به همان دامنه خاص نمایش داده می‌شود. دکمه **Allow / تأیید** را بزنید.
5. تم تاریک بلافاصله روی جلسه فعال می‌شود و اسکریپت برای این دامنه ثبت می‌شود.
6. حتی پس از بستن مرورگر یا Refresh صفحه، تم تاریک بدون هیچ کار اضافه‌ای به صورت خودکار فعال باقی می‌ماند.
7. برای لغو کامل و حذف دسترسی دامنه، کافی است دکمه **Reset Site** را در پاپ‌آپ بزنید.

---

## نحوه دیباگ و بررسی خطاها (Debugging Guide)

### ۱. دیباگ پاپ‌آپ (Popup UI):
- روی آیکون افزونه در تولبار راست‌کلیک کرده و گزینه **Inspect popup** را انتخاب کنید.
- وضعیت درخواست مجوز و ثبت اسکریپت‌ها در کنسول قابل مشاهده است.

### ۲. دیباگ کدهای داخل صفحه (Content Scripts):
- در تب Adobe Connect، کلید `F12` را فشار دهید تا DevTools باز شود.
- با نوشتن دستور زیر در Console وضعیت فعال بودن تم را بررسی کنید:
  ```javascript
  document.documentElement.getAttribute('data-acd-theme'); // خروجی: "dark"
  ```

### ۳. بررسی اسکریپت‌های ثبت‌شده داینامیک:
- در کنسول سرویس‌ورکر افزونه بنویسید:
  ```javascript
  chrome.scripting.getRegisteredContentScripts().then(console.log);
  ```
  لیست تمام دامنه‌های فعال همراه با شناسه اسکریپت را مشاهده خواهید کرد.

---

## محدودیت‌های نسخه اولیه (V1 Limitations)

1. **تنوع نسخه‌های سرور Adobe Connect:** نسخه‌های مختلف سازمانی ممکن است نام کلاس‌های کمی متفاوتی داشته باشند که در نسخه ۲ دقیق‌تر خواهند شد.
2. **پادهای داخل iframe با دامنه ثالث:** اگر پادی از یک دامنه کاملاً متفرقه با پروتکل cross-origin بارگذاری شود، طبق استانداردهای امنیتی مرورگر، نیاز به تأیید دامنه آن مبدا جداگانه دارد.
3. **وایت‌برد و ارائه‌ها:** رنگ رسم‌های بوم وایت‌برد و اسلایدهای آموزشی به صورت غیرمخرب حفظ می‌شوند تا رنگ خطوط استاد تغییری نکند.

---

## راهنمای توسعه به V2: نحوه ارسال DOM و اسکرین‌شات

برای تبدیل این فونداسیون به نسخه ۲ با سلکتورهای فوق‌العاده اختصاصی:
1. **اسکرین‌شات:** یک تصویر از نمای کامل کلاس که در آن بخش‌های مورد نیاز دیده شود.
2. **کدهای DOM از DevTools:**
   - روی بخش مورد نظر کلیک‌راست > **Inspect**.
   - راست‌کلیک روی تگ در تب Elements > **Copy > Copy outerHTML**.
   - مشاهده ویژگی‌های `background-color` و `color` در تب Styles و ارسال نام کلاس‌ها.
