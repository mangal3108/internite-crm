# Internite CRM — REST API Reference

**Base URL:** `http://localhost:8080/api`  
**Authentication:** Bearer JWT (include `Authorization: Bearer <token>` on all protected routes)  
**Content-Type:** `application/json`  
**API Docs (Swagger UI):** `http://localhost:8080/swagger-ui/index.html`

---

## Authentication

### POST `/auth/login`
Login and receive access + refresh tokens.

**Request:**
```json
{ "email": "user@company.com", "password": "yourpassword" }
```
**Response:**
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "tokenType": "Bearer",
  "expiresIn": 86400000,
  "user": {
    "id": 1, "name": "Saurabh Kumar",
    "email": "companyadmin@internite.com", "role": "COMPANY_ADMIN"
  }
}
```

### POST `/auth/refresh`
Get a new access token.
```json
{ "refreshToken": "eyJ..." }
```

### GET `/auth/me`
Returns the currently authenticated user's profile.

### POST `/auth/logout`
Revokes the refresh token. Pass `Authorization: Bearer <token>`.

---

## Leads

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/leads` | List leads (paginated + filtered) | All |
| GET | `/leads/{id}` | Get lead by ID | All |
| POST | `/leads` | Create a lead | All |
| PUT | `/leads/{id}` | Update a lead | All |
| DELETE | `/leads/{id}` | Soft-delete a lead | ADMIN, MANAGER |
| POST | `/leads/bulk-delete` | Bulk delete | ADMIN, MANAGER |
| POST | `/leads/import` | Import CSV/Excel | ADMIN, MANAGER |
| GET | `/leads/export` | Export CSV/Excel | All |
| POST | `/leads/{id}/score` | AI score this lead | All |
| POST | `/leads/{id}/convert` | Convert to customer + deal | All |
| POST | `/leads/{id}/call` | Trigger outbound call via voice call agent | All |

**Query params for GET `/leads`:**
- `search` — name, email, company substring
- `status` — NEW | CONTACTED | QUALIFIED | PROPOSAL | NEGOTIATION | WON | LOST
- `score` — HOT | WARM | COLD
- `source` — FACEBOOK | INSTAGRAM | LINKEDIN | WEBSITE | WHATSAPP | GOOGLE_ADS | REFERRAL | EMAIL | OTHER
- `assignedTo` — user ID
- `page`, `size`, `sort` — pagination

**Example:**
```
GET /api/leads?status=NEW&score=HOT&page=0&size=20&sort=createdAt,desc
```

---

## Deals / Pipeline

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/deals` | List deals (paginated) |
| GET | `/deals/board` | Kanban board view grouped by stage |
| GET | `/deals/{id}` | Get deal by ID |
| POST | `/deals` | Create deal |
| PUT | `/deals/{id}` | Update deal |
| PATCH | `/deals/{id}/stage` | Move deal to a stage |
| DELETE | `/deals/{id}` | Delete deal |
| GET | `/deals/{id}/activities` | Get deal activity log |
| POST | `/deals/{id}/activities` | Log an activity |

**Move stage request:**
```json
{ "stage": "PROPOSAL" }
```

**Board response (GET /deals/board):**
```json
{
  "NEW": [...],
  "CONTACTED": [...],
  "QUALIFIED": [...],
  "PROPOSAL": [...],
  "NEGOTIATION": [...],
  "WON": [...],
  "LOST": [...]
}
```

---

## AI Engine

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/ai/chat` | Chat with Internite AI assistant |
| POST | `/ai/score/{leadId}` | AI lead scoring (Hot/Warm/Cold) |
| POST | `/ai/predict/{dealId}` | Win probability prediction |
| POST | `/ai/generate-email` | AI email draft |
| GET | `/ai/insights` | Dashboard AI insights |
| GET | `/ai/next-actions/{leadId}` | Suggested next actions |
| POST | `/ai/summarize/{type}/{id}` | Summarize entity |

**Chat request:**
```json
{
  "messages": [
    { "role": "user", "content": "Which leads should I prioritize today?" }
  ]
}
```

**Score response:**
```json
{
  "leadId": 1,
  "score": "HOT",
  "scoreValue": 87,
  "reasoning": "High engagement, enterprise company, budget confirmed, decision-maker contact",
  "nextAction": "Schedule a closing call within 48 hours"
}
```

---

## Customers

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/customers` | List customers |
| GET | `/customers/{id}` | Get customer |
| POST | `/customers` | Create customer |
| PUT | `/customers/{id}` | Update customer |
| DELETE | `/customers/{id}` | Delete customer |

---

## Invoices

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/invoices` | List invoices |
| GET | `/invoices/{id}` | Get invoice |
| POST | `/invoices` | Create invoice |
| PUT | `/invoices/{id}` | Update invoice |
| DELETE | `/invoices/{id}` | Delete invoice |
| PATCH | `/invoices/{id}/mark-paid` | Mark as paid |
| GET | `/invoices/{id}/pdf` | Download PDF |
| POST | `/invoices/{id}/reminder` | Send payment reminder |

---

## Automation

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/workflows` | List all workflows |
| POST | `/workflows` | Create workflow |
| PUT | `/workflows/{id}` | Update workflow |
| DELETE | `/workflows/{id}` | Delete workflow |
| PATCH | `/workflows/{id}/toggle` | Enable / pause workflow |
| GET | `/workflows/{id}/logs` | Execution logs |

Workflow action text supports `send_call:<phone>|<script>` for outbound voice calls via the `voice_call_agent` integration.

---

## Communications

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/communications` | Unified inbox |
| GET | `/communications/lead/{leadId}` | Conversation with a lead |
| POST | `/communications/send` | Send message |
| POST | `/communications/send-channel` | Send over channel (`email`, `whatsapp`, `facebook`, `instagram`, `linkedin`, `reddit`, `call`) |
| POST | `/communications/email/send` | Send email |
| GET | `/communications/whatsapp/conversations` | WhatsApp conversation summaries |
| GET | `/communications/whatsapp/messages?contact={number}` | WhatsApp messages by contact |
| GET | `/communications/facebook/conversations` | Facebook Messenger conversation summaries |
| GET | `/communications/facebook/messages?psid={pageScopedUserId}` | Facebook Messenger messages by PSID |
| GET | `/communications/instagram/conversations` | Instagram DM conversation summaries |
| GET | `/communications/instagram/messages?igsid={instagramScopedUserId}` | Instagram DMs by IGSID |
| POST | `/communications/ai-suggest` | AI reply suggestion |

---

## Calls (AI Calling Agent)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/calls/trigger/{leadId}` | Trigger AI outbound call for a lead (alias flow to lead call) |
| GET | `/calls/{leadId}` | Fetch latest AI call logs for one lead |
| POST | `/calls/retry/{callId}` | Retry a previous call by call-log ID |
| POST | `/calls/webhook` | Public provider callback endpoint for call status/outcome updates |

**Webhook security (optional):**
- If `voice_call_agent.webhookSecret` is configured in integration settings, provide it in one of:
  - Header `X-Call-Agent-Secret`
  - Header `Authorization: Bearer <secret>`
  - Body field `secret`

### Bolna/WebRTC Call Webhook Contract (Recommended)

Use this payload shape when your Bolna agent (or any call provider) posts call updates to `POST /api/calls/webhook`.

**Minimum fields:**
- `externalId` (or `callId` / `sip_call_id`) — stable call identifier
- `leadId` — Internite CRM lead ID
- `status` — call lifecycle state (`queued`, `ringing`, `in_progress`, `completed`, `failed`, etc.)
- `outcome` — business result (`connected`, `no_answer`, `busy`, `not_interested`, etc.)
- `summary` — short summary string
- `transcript` or `transcripts` — full call transcript

**Transcript options supported by Internite CRM:**
1. Single text field:
```json
{
  "transcript": "[agent] Hello ...\n[user] Hi ..."
}
```
2. Speaker-separated array:
```json
{
  "transcripts": [
    { "speaker": "agent", "text": "Hello, this is Internite CRM." },
    { "speaker": "user", "text": "Yes, speaking." }
  ]
}
```

**Example: in-progress update**
```json
{
  "externalId": "123e4567-e89b-12d3-a456-426614174000",
  "leadId": "lead_12345",
  "status": "in_progress",
  "outcome": "connected",
  "summary": "Lead answered, discovery questions started",
  "metadata": {
    "provider": "bolna",
    "executionStatus": "in-progress"
  }
}
```

**Example: completed update with transcript**
```json
{
  "externalId": "123e4567-e89b-12d3-a456-426614174000",
  "leadId": "lead_12345",
  "status": "completed",
  "outcome": "callback requested",
  "summary": "Lead requested a callback tomorrow 11:00 AM",
  "transcripts": [
    { "speaker": "agent", "text": "Is this a good time to discuss your requirement?" },
    { "speaker": "user", "text": "Can we do tomorrow at 11?" },
    { "speaker": "agent", "text": "Sure, I will arrange a callback." }
  ],
  "metadata": {
    "provider": "bolna",
    "recordingUrl": "https://your-recording-url",
    "durationSec": 184
  }
}
```

Internite CRM stores this payload in call `rawPayload`, updates call status/outcome, and attaches transcript + summary to lead activity.

### Node/TypeScript Helper (Bolna/Any Worker)

```ts
type TranscriptRow = {
  speaker: 'agent' | 'user' | string
  text: string
}

type CallWebhookUpdate = {
  externalId?: string
  callId?: string
  sip_call_id?: string
  leadId: string
  status: string
  outcome?: string
  summary?: string
  transcript?: string
  transcripts?: TranscriptRow[]
  metadata?: Record<string, unknown>
}

export async function sendCallWebhookUpdate(
  update: CallWebhookUpdate,
  config?: {
    baseUrl?: string
    secret?: string
    timeoutMs?: number
  }
) {
  const baseUrl = (config?.baseUrl ?? process.env.INTERNITE_BASE_URL ?? 'http://localhost:8080').replace(/\/+$/, '')
  const secret = config?.secret ?? process.env.INTERNITE_CALL_WEBHOOK_SECRET ?? ''
  const timeoutMs = config?.timeoutMs ?? 10000

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(`${baseUrl}/api/calls/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(secret ? { 'X-Call-Agent-Secret': secret } : {}),
      },
      body: JSON.stringify(update),
      signal: controller.signal,
    })

    const text = await res.text()
    if (!res.ok) {
      throw new Error(`Webhook failed (${res.status}): ${text}`)
    }

    return text ? JSON.parse(text) : { ok: true }
  } finally {
    clearTimeout(timer)
  }
}
```

**Example usage:**

```ts
await sendCallWebhookUpdate({
  externalId: '123e4567-e89b-12d3-a456-426614174000',
  leadId: 'lead_12345',
  status: 'completed',
  outcome: 'callback requested',
  summary: 'Lead requested a callback tomorrow 11:00 AM',
  transcripts: [
    { speaker: 'agent', text: 'Is this a good time to discuss your requirement?' },
    { speaker: 'user', text: 'Can we do tomorrow at 11?' },
  ],
  metadata: {
    provider: 'bolna',
    durationSec: 184,
  },
})
```

---

## Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/analytics/dashboard` | KPI summary |
| GET | `/analytics/revenue` | Revenue over time |
| GET | `/analytics/conversion` | Funnel conversion rates |
| GET | `/analytics/team` | Team performance |
| GET | `/analytics/campaigns` | Campaign ROI |
| GET | `/analytics/export` | Export report PDF/Excel |

All analytics endpoints accept `?from=YYYY-MM-DD&to=YYYY-MM-DD&granularity=daily|weekly|monthly`.

---

## Team / Users

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/users` | List team members | ADMIN, MANAGER |
| GET | `/users/{id}` | Get user | ADMIN, MANAGER |
| POST | `/users/invite` | Invite new member | ADMIN |
| PUT | `/users/{id}` | Update user | ADMIN |
| DELETE | `/users/{id}` | Delete user | ADMIN |
| GET | `/roles` | List roles & permissions | ADMIN |

---

## Notifications

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/notifications` | Get user notifications |
| PATCH | `/notifications/{id}/read` | Mark single as read |
| PATCH | `/notifications/mark-all-read` | Mark all as read |
| DELETE | `/notifications/{id}` | Delete notification |

---

## WebSocket (Real-time)

**Endpoint:** `ws://localhost:8080/ws` (SockJS + STOMP)

**Connect:**
```js
const socket = new SockJS('http://localhost:8080/ws')
const stomp = Stomp.over(socket)
stomp.connect({ Authorization: `Bearer ${token}` }, () => {
  stomp.subscribe('/user/queue/notifications', msg => {
    console.log(JSON.parse(msg.body))
  })
})
```

**Subscriptions:**
- `/user/queue/notifications` — personal notifications
- `/topic/notifications` — broadcast notifications

**Notification payload:**
```json
{
  "type": "LEAD",
  "title": "New hot lead",
  "message": "Amit Shah scored Hot",
  "actionUrl": "/leads/10",
  "timestamp": 1714300000000
}
```

---

## Webhooks

### Facebook Lead Ads
`POST /api/webhooks/facebook/leads`  
`GET /api/webhooks/facebook/leads` — for webhook verification

### Facebook Messenger (Incoming)
`POST /api/webhooks/facebook/messages` (alias: `/api/webhooks/facebook/messenger`)  
`GET /api/webhooks/facebook/messages` (alias: `/api/webhooks/facebook/messenger`) — for webhook verification

### Instagram Messaging (Incoming)
`POST /api/webhooks/instagram/messages`  
`GET /api/webhooks/instagram/messages` — for webhook verification

### Facebook Legacy Combined Webhook
`POST /api/webhooks/meta`  
`GET /api/webhooks/meta` — for webhook verification  
Legacy endpoint auto-routes payloads to lead handler (`leadgen`) and message handlers (`messaging`) for Facebook/Instagram.

### WhatsApp Business
`POST /api/webhooks/whatsapp`

### AI Call Agent Callback
`POST /api/calls/webhook`

Webhook verification challenge uses `META_WEBHOOK_TOKEN`, while `X-Hub-Signature-256` payload validation uses `META_APP_SECRET`.

---

## Error Responses

All errors follow this format:
```json
{
  "timestamp": "2026-04-29T10:30:00Z",
  "status": 400,
  "error": "Bad Request",
  "message": "Name is required",
  "path": "/api/leads"
}
```

| Code | Meaning |
|------|---------|
| 400 | Validation error |
| 401 | Unauthorized — invalid or expired token |
| 403 | Forbidden — insufficient role |
| 404 | Resource not found |
| 409 | Conflict — duplicate record |
| 422 | Business logic error |
| 500 | Internal server error |

---

## Pagination

All list endpoints return a `PageResponse`:
```json
{
  "content": [...],
  "page": 0,
  "size": 20,
  "total": 1247,
  "totalPages": 63,
  "first": true,
  "last": false
}
```
