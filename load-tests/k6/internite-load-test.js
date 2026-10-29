import http from 'k6/http'
import { check, group, sleep, Trend, Rate } from 'k6'

const baseUrl = (__ENV.INTERNITE_BASE_URL || 'https://internite-frontend.onrender.com').replace(/\/$/, '')

const companyEmail = __ENV.INTERNITE_COMPANY_EMAIL || 'demo@gmail.com'
const companyPassword = __ENV.INTERNITE_COMPANY_PASSWORD || 'demo1234'
const companyTenantId = normalizeTenantId(__ENV.INTERNITE_COMPANY_TENANT_ID)

const platformEmail = __ENV.INTERNITE_PLATFORM_EMAIL || 'companyadmin@internite.com'
const platformPassword = __ENV.INTERNITE_PLATFORM_PASSWORD || 'demo1234'
const platformTenantId = normalizeTenantId(__ENV.INTERNITE_PLATFORM_TENANT_ID)

const includeAiCalls = String(__ENV.INTERNITE_INCLUDE_AI || 'false').toLowerCase() === 'true'

const companyLoginDuration = __ENV.INTERNITE_COMPANY_LOGIN_DURATION || '2m'
const companyReadDuration = __ENV.INTERNITE_COMPANY_READ_DURATION || '5m'
const platformReadDuration = __ENV.INTERNITE_PLATFORM_READ_DURATION || '5m'

const companyReadRps = parsePositiveInt(__ENV.INTERNITE_COMPANY_READ_RPS, 8)
const platformReadRps = parsePositiveInt(__ENV.INTERNITE_PLATFORM_READ_RPS, 2)
const loginRps = parsePositiveInt(__ENV.INTERNITE_LOGIN_RPS, 1)

const companyReadPreAllocatedVUs = parsePositiveInt(__ENV.INTERNITE_COMPANY_READ_PREALLOCATED_VUS, Math.max(4, companyReadRps))
const companyReadMaxVUs = parsePositiveInt(__ENV.INTERNITE_COMPANY_READ_MAX_VUS, Math.max(companyReadPreAllocatedVUs * 2, companyReadRps * 2))
const platformReadPreAllocatedVUs = parsePositiveInt(__ENV.INTERNITE_PLATFORM_READ_PREALLOCATED_VUS, Math.max(2, platformReadRps))
const platformReadMaxVUs = parsePositiveInt(__ENV.INTERNITE_PLATFORM_READ_MAX_VUS, Math.max(platformReadPreAllocatedVUs * 2, platformReadRps * 2))
const loginPreAllocatedVUs = parsePositiveInt(__ENV.INTERNITE_LOGIN_PREALLOCATED_VUS, 2)
const loginMaxVUs = parsePositiveInt(__ENV.INTERNITE_LOGIN_MAX_VUS, 4)

const loginDurationTrend = new Trend('login_duration_ms')
const companyJourneyDurationTrend = new Trend('company_journey_duration_ms')
const platformJourneyDurationTrend = new Trend('platform_journey_duration_ms')
const companyJourneyErrorRate = new Rate('company_journey_error_rate')
const platformJourneyErrorRate = new Rate('platform_journey_error_rate')

export const options = {
  scenarios: {
    auth_login_smoke: {
      executor: 'constant-arrival-rate',
      rate: loginRps,
      timeUnit: '1s',
      duration: companyLoginDuration,
      preAllocatedVUs: loginPreAllocatedVUs,
      maxVUs: loginMaxVUs,
      exec: 'loginSmoke',
      tags: { scenario_type: 'auth' },
    },
    company_read_mix: {
      executor: 'constant-arrival-rate',
      rate: companyReadRps,
      timeUnit: '1s',
      duration: companyReadDuration,
      preAllocatedVUs: companyReadPreAllocatedVUs,
      maxVUs: companyReadMaxVUs,
      exec: 'companyReadMix',
      tags: { scenario_type: 'company' },
    },
    platform_admin_read_mix: {
      executor: 'constant-arrival-rate',
      rate: platformReadRps,
      timeUnit: '1s',
      duration: platformReadDuration,
      preAllocatedVUs: platformReadPreAllocatedVUs,
      maxVUs: platformReadMaxVUs,
      exec: 'platformReadMix',
      tags: { scenario_type: 'platform' },
    },
  },
  thresholds: {
    checks: ['rate>0.99'],
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1500', 'p(99)<3000'],
    login_duration_ms: ['p(95)<2000'],
    company_journey_duration_ms: ['p(95)<1800'],
    platform_journey_duration_ms: ['p(95)<1500'],
    company_journey_error_rate: ['rate<0.01'],
    platform_journey_error_rate: ['rate<0.01'],
  },
  userAgent: 'InterniteCRM-k6-load-test/1.0',
  noConnectionReuse: false,
}

export function setup() {
  const companySession = login(companyEmail, companyPassword, companyTenantId, 'company')
  const platformSession = login(platformEmail, platformPassword, platformTenantId, 'platform')

  return {
    companySession,
    platformSession,
    includeAiCalls,
  }
}

export function loginSmoke(data) {
  const startedAt = Date.now()
  const session = login(companyEmail, companyPassword, companyTenantId, 'company')
  loginDurationTrend.add(Date.now() - startedAt)

  check(session, {
    'company session has access token': (value) => Boolean(value.accessToken),
    'company session has user': (value) => Boolean(value.user),
  })

  sleep(0.5)
  return data
}

export function companyReadMix(data) {
  const startedAt = Date.now()
  const { accessToken } = data.companySession
  const headers = authHeaders(accessToken)
  let allOk = true

  group('Company admin dashboard read mix', () => {
    const requests = [
      ['GET', `${baseUrl}/api/analytics/dashboard`, null, params(headers, 'analytics_dashboard')],
      ['GET', `${baseUrl}/api/analytics/dashboard/widgets`, null, params(headers, 'analytics_widgets')],
      ['GET', `${baseUrl}/api/leads?page=0&size=20`, null, params(headers, 'leads_list')],
      ['GET', `${baseUrl}/api/deals/board?pipelineId=1`, null, params(headers, 'deals_board')],
      ['GET', `${baseUrl}/api/customers?page=0&size=20`, null, params(headers, 'customers_list')],
      ['GET', `${baseUrl}/api/tasks/due-today`, null, params(headers, 'tasks_due_today')],
      ['GET', `${baseUrl}/api/notifications/unread-count`, null, params(headers, 'unread_count')],
      ['GET', `${baseUrl}/api/ai/insights`, null, params(headers, 'ai_insights')],
    ]

    const responses = http.batch(includeAiCalls ? requests : requests.slice(0, 7))

    allOk = assertOk(responses[0], 200, 'analytics dashboard') && allOk
    allOk = assertOk(responses[1], 200, 'analytics widgets') && allOk
    allOk = assertOk(responses[2], 200, 'leads list') && allOk
    allOk = assertOk(responses[3], 200, 'deals board') && allOk
    allOk = assertOk(responses[4], 200, 'customers list') && allOk
    allOk = assertOk(responses[5], 200, 'tasks due today') && allOk
    allOk = assertOk(responses[6], 200, 'unread count') && allOk
    if (includeAiCalls) {
      allOk = assertOk(responses[7], 200, 'ai insights') && allOk
    }
  })

  companyJourneyDurationTrend.add(Date.now() - startedAt)
  companyJourneyErrorRate.add(!allOk)
  sleep(0.35)
}

export function platformReadMix(data) {
  const startedAt = Date.now()
  const { accessToken } = data.platformSession
  const headers = authHeaders(accessToken)
  let allOk = true

  group('Platform admin console read mix', () => {
    const responses = http.batch([
      ['GET', `${baseUrl}/api/admin/saas/overview`, null, params(headers, 'saas_overview')],
      ['GET', `${baseUrl}/api/admin/saas/tenants`, null, params(headers, 'saas_tenants')],
      ['GET', `${baseUrl}/api/admin/saas/users`, null, params(headers, 'saas_users')],
      ['GET', `${baseUrl}/api/admin/saas/plans`, null, params(headers, 'saas_plans')],
      ['GET', `${baseUrl}/api/admin/saas/billing`, null, params(headers, 'saas_billing')],
      ['GET', `${baseUrl}/api/admin/saas/feature-flags`, null, params(headers, 'saas_flags')],
      ['GET', `${baseUrl}/api/admin/saas/security`, null, params(headers, 'saas_security')],
      ['GET', `${baseUrl}/api/subscription/current`, null, params(headers, 'current_subscription')],
    ])

    allOk = assertOk(responses[0], 200, 'saas overview') && allOk
    allOk = assertOk(responses[1], 200, 'saas tenants') && allOk
    allOk = assertOk(responses[2], 200, 'saas users') && allOk
    allOk = assertOk(responses[3], 200, 'saas plans') && allOk
    allOk = assertOk(responses[4], 200, 'saas billing') && allOk
    allOk = assertOk(responses[5], 200, 'saas feature flags') && allOk
    allOk = assertOk(responses[6], 200, 'saas security') && allOk
    allOk = assertOk(responses[7], 200, 'current subscription') && allOk
  })

  platformJourneyDurationTrend.add(Date.now() - startedAt)
  platformJourneyErrorRate.add(!allOk)
  sleep(0.4)
}

function login(email, password, tenantId, label) {
  const payload = { email, password }
  const headers = { 'Content-Type': 'application/json' }
  if (tenantId != null) {
    payload.tenantId = tenantId
    headers['X-Tenant-ID'] = String(tenantId)
  }

  const res = http.post(`${baseUrl}/api/auth/login`, JSON.stringify(payload), {
    headers,
    tags: { endpoint: `auth_login_${label}` },
  })

  check(res, {
    [`${label} login returned 200`]: (r) => r.status === 200,
    [`${label} login returned token`]: (r) => Boolean(readAccessToken(r)),
    [`${label} login returned user`]: (r) => Boolean(r.json('user')),
  })

  const body = res.json()
  const accessToken = readAccessToken(res)
  if (res.status !== 200 || !accessToken || !body?.user) {
    throw new Error(`${label} login failed: ${res.status} ${res.body}`)
  }

  return {
    accessToken,
    refreshToken: body?.refreshToken || null,
    user: body?.user || null,
  }
}

function readAccessToken(response) {
  const body = response.json()
  const token = body?.accessToken || body?.token || body?.access_token || body?.jwt || null
  if (typeof token !== 'string') return null
  const trimmed = token.trim()
  if (!trimmed) return null
  return trimmed.toLowerCase().startsWith('bearer ') ? trimmed.slice(7).trim() : trimmed
}

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

function params(headers, endpoint) {
  return {
    headers,
    tags: { endpoint },
  }
}

function assertOk(response, expectedStatus, label) {
  return check(response, {
    [`${label} status is ${expectedStatus}`]: (res) => res.status === expectedStatus,
    [`${label} body is not empty`]: (res) => {
      if (!res || !res.body) return false
      return String(res.body).length > 0
    },
  })
}

function normalizeTenantId(value) {
  if (value == null) return null
  const text = String(value).trim()
  if (!text) return null
  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : null
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}
