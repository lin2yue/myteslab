# SEO Changes Log

## 2026-04-05

### Changes
- Added `scripts/seo-fetch-report.js` to pull GA4 + Search Console data and generate SEO opportunity reports.
- Added npm script: `npm run seo:report`
- Strengthened homepage SEO-visible content blocks:
  - visible H1 rewritten around 核心词
  - added semantic intro for 下载 / 喷漆车间 / 车机皮肤 / AI 生成 / 3D 预览
  - added homepage FAQ-style content block
- Strengthened model page SEO-visible content:
  - added model-specific semantic intro
  - added model-specific FAQ content block
- Removed `sitemap-test.xml` from robots sitemap declarations.

### Intent
- Improve homepage relevance for core Chinese Tesla wrap / Paint Shop keywords.
- Improve model pages' ability to rank for model-specific mid-frequency queries.
- Establish a repeatable reporting mechanism for weekly SEO iteration.

### Validation to run
- `npm run seo:report`
- `npm run build`
- manually inspect `/`, `/models/model-y`, `/robots.txt`, `/sitemap.xml`

### Follow-up
- Add weekly report cron or manual routine.
- Expand query clustering and page recommendation logic.

## 2026-04-05 (round 2)

### Changes
- Reverted homepage visible H1/UI SEO changes; kept homepage SEO low-interference.
- Added low-interference semantic content block to wrap detail pages under the description area.
- Upgraded `scripts/seo-fetch-report.js`:
  - page type classification
  - query clustering (home core / model intent / wrap long-tail / tutorial intent)
  - richer markdown report output

### Intent
- Keep homepage UI stable while continuing SEO improvement in lower-risk areas.
- Strengthen wrap detail pages for long-tail query intent without damaging core experience.
- Make weekly SEO analysis more actionable by clustering queries into page strategy buckets.

### Validation to run
- `npm run seo:report`
- `npm run build`
- inspect a wrap detail page for content density changes

### Follow-up
- Add tutorial / how-to landing pages for import/download intent.
- Add page recommendation scoring into SEO report output.
- Decide whether to schedule weekly report generation via cron.
