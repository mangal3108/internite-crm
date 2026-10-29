# Daily lead activity report

The Task route (`/task-followup`) opens Daily analytics. Manage follow-ups retains the existing operational page. Both report endpoints return a fresh server snapshot; the PDF exporter displays that exact snapshot before exporting all matching timeline records, independently of pagination.

## Access and dates

- `GET /api/reports/daily-lead-activity`: `tasks.read` or `reports.read`.
- `GET /api/reports/daily-lead-activity/export`: additionally requires `reports.export`.
- An active tenant user is required. Admin-like roles and managers see tenant leads; other users see only leads assigned to them. Deleted leads are excluded.
- The tenant timezone defines yesterday's half-open calendar interval. An unset timezone defaults to Asia/Kolkata. Mongo BSON dates are compared as instants; browser timestamps carry UTC offsets explicitly.

## Source and calculation rules

- Lead creation uses original `createdAt`. Scoring uses the current stored HOT/WARM/COLD value for that creation cohort; missing or invalid values stay Unclassified.
- Pipeline uses persisted NEW, CONTACTED, QUALIFIED, PROPOSAL, NEGOTIATION, WON and LOST statuses. It is a current distribution, never a historical conversion-rate estimate.
- Activity 01 counts Connected/Completed/Answered/Success. Activity 02 counts saved Follow Up, Allowed Person for Meeting and Lost outcomes, or explicit Completed/Connected/Answered outcomes. These are the existing workflow's recorded follow-up outcomes. Activity 03 counts Won/Lost/Negotiation or explicit Completed/Conducted/Attended outcomes. Scheduling a meeting in Activity 02 does not count as conducting a meeting.
- Activity KPIs prefer `values.completedAt`, then actual `saved_at`, then creation time when necessary. Generic task KPIs require explicit `completed_at`, COMPLETED status and an unambiguous WELCOME_CALL/FOLLOW_UP/MEETING type. No lead `updatedAt` or scheduled date proves completion.
- The feed includes lead activities, tasks logged/completed during the day, lead-linked communications and lead audit records. It does not read the duplicate `lead_timeline_events` mirror. Stable record IDs deduplicate repeated rows. Provider call IDs deduplicate completed calls repeated by webhooks, and identical provider updates are collapsed.
- Status, score and notes changes are captured when lead services and call-agent services save changes. Older unlogged changes cannot be reconstructed. Direct database changes bypass application auditing.

## Export and validation

PDFs use A4 portrait, current pipeline snapshot time, reporting date, generation time and page numbers. Search and activity-type filters apply to all exported timeline rows; summary metrics remain the full day. Normal records stay together. A single record longer than a physical page necessarily continues onto subsequent pages. Browser shaping preserves Unicode messages as compressed images where built-in PDF fonts lack glyphs.

Targeted backend tests cover timezone boundaries including DST, completion exclusions, older leads, repeated follow-ups, unclassified leads, audit messages, scope restrictions and export permissions. Browser fixture verification exercises 1,000 records, search, pagination, activity filtering, desktop/dark/mobile layouts and automatic PDF download. The resulting 78-page test PDF contains all records. These fixtures are used only in test tooling, never as application data.

Live database counts and deployment must be verified against an authenticated running environment; local fixture checks do not establish production totals.
