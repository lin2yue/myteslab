#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' })
require('dotenv').config({ path: '.env.prod', override: false })

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { URLSearchParams } = require('url')

const REPORT_DIR = path.join(process.cwd(), 'reports', 'seo')
const DEFAULT_PROPERTY_ID = process.env.GA4_PROPERTY_ID || '526086791'
const DEFAULT_SITE_URL = process.env.GSC_SITE_URL || 'sc-domain:tewan.club'
const KEY_PATH = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '/Users/linpengfei/.openclaw.backup.20260327_161720/secrets/ga4-sa.json'

function readServiceAccount() {
  return JSON.parse(fs.readFileSync(KEY_PATH, 'utf8'))
}

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

async function getAccessToken(scope) {
  const sa = readServiceAccount()
  const now = Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claim = base64url(JSON.stringify({
    iss: sa.client_email,
    scope,
    aud: sa.token_uri,
    iat: now,
    exp: now + 3600,
  }))
  const unsigned = `${header}.${claim}`
  const signer = crypto.createSign('RSA-SHA256')
  signer.update(unsigned)
  signer.end()
  const signature = signer.sign(sa.private_key, 'base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const assertion = `${unsigned}.${signature}`

  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  })

  const res = await fetch(sa.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  if (!res.ok) throw new Error(`Token request failed: ${res.status} ${await res.text()}`)
  const json = await res.json()
  return json.access_token
}

async function fetchGA4Report(accessToken, propertyId) {
  const body = {
    dateRanges: [{ startDate: '28daysAgo', endDate: 'yesterday' }],
    dimensions: [
      { name: 'landingPagePlusQueryString' },
      { name: 'sessionDefaultChannelGroup' }
    ],
    metrics: [
      { name: 'sessions' },
      { name: 'activeUsers' },
      { name: 'engagedSessions' },
      { name: 'userEngagementDuration' }
    ],
    dimensionFilter: {
      filter: {
        fieldName: 'sessionDefaultChannelGroup',
        stringFilter: { matchType: 'EXACT', value: 'Organic Search' }
      }
    },
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 50,
  }

  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) throw new Error(`GA4 request failed: ${res.status} ${await res.text()}`)
  return res.json()
}

async function fetchGSCReport(accessToken, siteUrl) {
  const body = {
    startDate: new Date(Date.now() - 28 * 86400000).toISOString().slice(0, 10),
    endDate: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
    dimensions: ['page', 'query'],
    rowLimit: 200,
  }

  const res = await fetch(`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) throw new Error(`GSC request failed: ${res.status} ${await res.text()}`)
  return res.json()
}

function buildOpportunities(ga4, gsc) {
  const gaRows = (ga4.rows || []).map((row) => ({
    page: row.dimensionValues?.[0]?.value || '',
    channel: row.dimensionValues?.[1]?.value || '',
    sessions: Number(row.metricValues?.[0]?.value || 0),
    activeUsers: Number(row.metricValues?.[1]?.value || 0),
    engagedSessions: Number(row.metricValues?.[2]?.value || 0),
    engagementDuration: Number(row.metricValues?.[3]?.value || 0),
  }))

  const gscRows = (gsc.rows || []).map((row) => ({
    page: row.keys?.[0] || '',
    query: row.keys?.[1] || '',
    clicks: Number(row.clicks || 0),
    impressions: Number(row.impressions || 0),
    ctr: Number(row.ctr || 0),
    position: Number(row.position || 0),
  }))

  const lowCtr = gscRows
    .filter((row) => row.impressions >= 10 && row.position >= 2 && row.position <= 10)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 20)

  const nearPageOne = gscRows
    .filter((row) => row.impressions >= 5 && row.position > 8 && row.position <= 20)
    .sort((a, b) => a.position - b.position)
    .slice(0, 20)

  const landingPages = gaRows.slice(0, 20)

  return { lowCtr, nearPageOne, landingPages }
}

function writeOutputs(payload) {
  fs.mkdirSync(REPORT_DIR, { recursive: true })
  const stamp = new Date().toISOString().slice(0, 10)
  const jsonPath = path.join(REPORT_DIR, `seo-report-${stamp}.json`)
  const mdPath = path.join(REPORT_DIR, `seo-report-${stamp}.md`)
  fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2))

  const md = [
    `# SEO Weekly Snapshot (${stamp})`,
    '',
    '## Top landing pages (Organic Search)',
    ...payload.opportunities.landingPages.map((row) => `- ${row.page}: ${row.sessions} sessions / ${row.activeUsers} users / ${row.engagedSessions} engaged`),
    '',
    '## High-impression low-CTR queries',
    ...payload.opportunities.lowCtr.map((row) => `- ${row.query} | ${row.page} | ${row.clicks} clicks / ${row.impressions} impressions / CTR ${(row.ctr * 100).toFixed(1)}% / pos ${row.position.toFixed(1)}`),
    '',
    '## Near page-one opportunities',
    ...payload.opportunities.nearPageOne.map((row) => `- ${row.query} | ${row.page} | ${row.impressions} impressions / pos ${row.position.toFixed(1)}`),
    '',
  ].join('\n')
  fs.writeFileSync(mdPath, md)
  return { jsonPath, mdPath }
}

async function main() {
  const gaToken = await getAccessToken('https://www.googleapis.com/auth/analytics.readonly')
  const gscToken = await getAccessToken('https://www.googleapis.com/auth/webmasters.readonly')
  const [ga4, gsc] = await Promise.all([
    fetchGA4Report(gaToken, DEFAULT_PROPERTY_ID),
    fetchGSCReport(gscToken, DEFAULT_SITE_URL),
  ])

  const opportunities = buildOpportunities(ga4, gsc)
  const payload = {
    generatedAt: new Date().toISOString(),
    ga4PropertyId: DEFAULT_PROPERTY_ID,
    gscSiteUrl: DEFAULT_SITE_URL,
    ga4,
    gsc,
    opportunities,
  }
  const outputs = writeOutputs(payload)
  console.log(JSON.stringify({ ok: true, ...outputs }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
