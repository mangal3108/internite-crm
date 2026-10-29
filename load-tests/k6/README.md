# Internite CRM k6 Load Tests

This folder contains a Grafana k6 script that exercises real Internite CRM routes:

- company-admin auth
- dashboard and analytics reads
- leads, deals, customers, tasks, and notifications reads
- platform-admin console reads

## Script

- [internite-load-test.js](./internite-load-test.js)

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
  -e INTERNITE_BASE_URL=https://internite-frontend.onrender.com ^
  -e INTERNITE_COMPANY_EMAIL=demo@gmail.com ^
  -e INTERNITE_COMPANY_PASSWORD=demo1234 ^
  -e INTERNITE_PLATFORM_EMAIL=companyadmin@internite.com ^
  -e INTERNITE_PLATFORM_PASSWORD=demo1234 ^
  load-tests/k6/internite-load-test.js
```

## Useful overrides

- `INTERNITE_COMPANY_READ_RPS`
- `INTERNITE_PLATFORM_READ_RPS`
- `INTERNITE_LOGIN_RPS`
- `INTERNITE_COMPANY_READ_DURATION`
- `INTERNITE_PLATFORM_READ_DURATION`
- `INTERNITE_COMPANY_LOGIN_DURATION`
- `INTERNITE_COMPANY_TENANT_ID`
- `INTERNITE_PLATFORM_TENANT_ID`
- `INTERNITE_INCLUDE_AI=true`

Example soak run:

```bash
k6 run ^
  -e INTERNITE_BASE_URL=https://internite-frontend.onrender.com ^
  -e INTERNITE_COMPANY_EMAIL=demo@gmail.com ^
  -e INTERNITE_COMPANY_PASSWORD=demo1234 ^
  -e INTERNITE_PLATFORM_EMAIL=companyadmin@internite.com ^
  -e INTERNITE_PLATFORM_PASSWORD=demo1234 ^
  -e INTERNITE_COMPANY_READ_RPS=15 ^
  -e INTERNITE_PLATFORM_READ_RPS=3 ^
  -e INTERNITE_COMPANY_READ_DURATION=15m ^
  -e INTERNITE_PLATFORM_READ_DURATION=15m ^
  -e INTERNITE_LOGIN_DURATION=3m ^
  load-tests/k6/internite-load-test.js
```

## Notes

- The script defaults to the demo credentials already used in this Internite CRM workspace.
- The test is read-heavy on purpose so it is safe to run repeatedly against staging or a demo environment.
- k6 was not installed in this workspace, so the script was added and syntax-checked in repo only. Install k6 or use the Grafana k6 Docker image to execute it.
