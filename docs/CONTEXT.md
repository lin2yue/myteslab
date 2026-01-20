# AI Context & Project State

> **For AI Agents:** Read this file FIRST to understand the current project status, constraints, and architecture history.

## 1. Project Identity
- **Name:** Tesla Studio Monorepo
- **Core Value:** Real-time 3D visualization and file download platform for Tesla car wraps (Model 3/Y/Cybertruck).
- **Architecture:** Monorepo (Turbo) containing:
    - `apps/web`: Next.js 16 (International version, Primary focus)
    - `apps/miniprogram`: uni-app (China WeChat Mini Program, Shared resources only)

## 2. Current Status (As of Jan 2026)
- **Phase:** **Post-MVP / Optimization**
- **Web App:** ✅ Feature complete (MVP 100%). Supports i18n (En/Zh), 3D preview, Downloads.
- **Miniprogram:** ⏸️ Maintenance mode.
- **Documentation:** ✅ Reorganized into `docs/`.

## 3. Tech Stack Constraints
- **Framework:** Next.js 16 (App Router), React Server Components.
- **Database:** Supabase (PostgreSQL). Schema shared conceptually but managed via `apps/web/database/schema.sql`.
- **3D Engine:** `<model-viewer>` (Google).
- **Styling:** Tailwind CSS.
- **Assets:** Aliyun OSS (proxied via `cdn.tewan.club`).

## 4. Key Architectural Decisions (ADRs)
- **No Shared Code Package:** We deliberately kept `packages/shared` empty. Code sharing is done via copy-paste or parallel implementation until duplication becomes critical (Rule of 3).
- **Direct Asset References:** Assets live in `assets/` but are uploaded to OSS. Web uses CDN URLs.
- **i18n Strategy:** URL-based routing (`/en`, `/zh`) using `next-intl`.

## 5. Active Context & Next Steps
- **Immediate Goal:** Maintenance and Documentation.
- **Pending Tasks:**
    - [x] Add language switcher UI (Frontend).
    - [x] Add SEO meta tags (Frontend).
    - [x] Setup Google Analytics.
    - [ ] Generate Sitemap.xml.
    - [ ] Setup Sentry for error tracking.
    - [ ] Setup Vercel Analytics.
    - [ ] **User System**:
        - [ ] Database Schema (Profiles, Credits, Assets).
        - [ ] Supabase Auth Integration.
        - [ ] User Profile & Assets UI.

## 6. Where to Find Knowledge
- **Architecture Analysis:** `docs/architecture/monorepo_analysis.md`
- **DB Schema:** `apps/web/database/schema.sql`
- **Deployment Status:** `docs/reports/mvp_status_report.md`

## 7. Workflow Protocol (How to work here)
1. **Check this file** for high-level context.
2. **Update this file** if you complete a major milestone (e.g., "Language Switcher Added").
3. **Respect constraints:** Do not add `packages/` unless approved. Do not add heavy libraries without check.
