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
- Add detail-page visible semantic content module.
- Add weekly report cron or manual routine.
- Expand query clustering and page recommendation logic.
