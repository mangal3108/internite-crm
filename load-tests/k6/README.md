# Internite CRM k6 Load Tests

This folder contains a Grafana k6 script that exercises real Internite CRM routes:

- company-admin auth
- dashboard and analytics reads
- leads, deals, customers, tasks, and notifications reads
- platform-admin console reads

## Script

- [nexacrm-load-test.js](./nexacrm-load-test.js)

## What it tests

The default run logs in with the demo company admin and platform admin credentials, then sends read-heavy traffic to the same API paths the app uses in production.

Company flow:

- `/api/auth/login`
- `/api/analytics/dashboard`
- `/api/analytics/dashboard/widgets`
- `/api/leads?page=0&size=20`
- `/api/deals/board?pipelineId=1`
- `/api/customers?page=0&size=20`
- `/api/tasks/due-today`
- `/api/notifications/unread-count`
- optional `/api/ai/insights`

Platform flow:

- `/api/auth/login`
- `/api/admin/saas/overview`
- `/api/admin/saas/tenants`
- `/api/admin/saas/users`
- `/api/admin/saas/plans`
- `/api/admin/saas/billing`
- `/api/admin/saas/feature-flags`
- `/api/admin/saas/security`
- `/api/subscription/current`

## Run locally

```bash
k6 run ^
  -e NEXACRM_BASE_URL=https://nexacrmai.com ^
  -e NEXACRM_COMPANY_EMAIL=demo@gmail.com ^
  -e NEXACRM_COMPANY_PASSWORD=demo1234 ^
  -e NEXACRM_PLATFORM_EMAIL=saurabhke4@gmail.com ^
  -e NEXACRM_PLATFORM_PASSWORD=demo1234 ^
  load-tests/k6/nexacrm-load-test.js
```

## Useful overrides

- `NEXACRM_COMPANY_READ_RPS`
- `NEXACRM_PLATFORM_READ_RPS`
- `NEXACRM_LOGIN_RPS`
- `NEXACRM_COMPANY_READ_DURATION`
- `NEXACRM_PLATFORM_READ_DURATION`
- `NEXACRM_COMPANY_LOGIN_DURATION`
- `NEXACRM_COMPANY_TENANT_ID`
- `NEXACRM_PLATFORM_TENANT_ID`
- `NEXACRM_INCLUDE_AI=true`

Example soak run:

```bash
k6 run ^
  -e NEXACRM_BASE_URL=https://nexacrmai.com ^
  -e NEXACRM_COMPANY_EMAIL=demo@gmail.com ^
  -e NEXACRM_COMPANY_PASSWORD=demo1234 ^
  -e NEXACRM_PLATFORM_EMAIL=saurabhke4@gmail.com ^
  -e NEXACRM_PLATFORM_PASSWORD=demo1234 ^
  -e NEXACRM_COMPANY_READ_RPS=15 ^
  -e NEXACRM_PLATFORM_READ_RPS=3 ^
  -e NEXACRM_COMPANY_READ_DURATION=15m ^
  -e NEXACRM_PLATFORM_READ_DURATION=15m ^
  -e NEXACRM_LOGIN_DURATION=3m ^
  load-tests/k6/nexacrm-load-test.js
```

## Notes

- The script defaults to the demo credentials already used in this Internite CRM workspace.
- The test is read-heavy on purpose so it is safe to run repeatedly against staging or a demo environment.
- k6 was not installed in this workspace, so the script was added and syntax-checked in repo only. Install k6 or use the Grafana k6 Docker image to execute it.
