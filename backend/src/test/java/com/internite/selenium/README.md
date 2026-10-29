# Internite CRM Selenium UI Tests

## Prerequisites

1. **Google Chrome** installed on your machine
2. **Java 21** and **Maven** available
3. Both the **backend** (Spring Boot on port 8080) and **frontend** (Vite on port 5173) running

## Quick Start

### 1. Start the backend
```bash
cd backend
mvn spring-boot:run
```

### 2. Start the frontend
```bash
cd frontend
npm run dev
```

### 3. Run the Selenium tests

**Option A — via Maven profile:**
```bash
cd backend
mvn test -Pselenium
```

**Option B — via Failsafe (integration-test phase):**
```bash
cd backend
mvn verify
```

**Option C — run a single test class:**
```bash
cd backend
mvn test -Pselenium -Dtest=LoginPageTest
```

## Configuration

Set via environment variables or `-D` system properties:

| Variable               | Default                  | Description              |
|------------------------|--------------------------|--------------------------|
| `INTERNITE_BASE_URL`    | `http://localhost:5173` | Frontend URL             |
| `INTERNITE_HEADLESS`    | `true`                   | Run Chrome headless      |
| `INTERNITE_TEST_EMAIL`  | `companyadmin@internite.com`  | Login email for tests    |
| `INTERNITE_TEST_PASSWORD`| `demo1234`              | Login password for tests |

### Run with browser visible (non-headless):
```bash
mvn test -Pselenium -DINTERNITE_HEADLESS=false
```

### Run against a deployed instance:
```bash
mvn test -Pselenium -DINTERNITE_BASE_URL=https://crm.example.com
```

## Test Classes

| Class              | What it tests                                      |
|--------------------|----------------------------------------------------|
| `LoginPageTest`    | Login form elements, HTML5 validation, forgot-password toast, links, pwd toggle |
| `AuthFlowTest`     | Login success/failure, redirects, session handling, app shell readiness |
| `NavigationTest`   | Protected CRM routes, redirect-backed routes, access-denied/loading guards |
| `ResponsiveTest`   | Login layout on mobile, tablet, and desktop with horizontal overflow checks |

## Notes

- WebDriverManager auto-downloads the correct ChromeDriver — no manual install needed.
- Selenium tests are **excluded** from `mvn test` by default (they only run with `-Pselenium` or `mvn verify`).
- For CI/CD, use `INTERNITE_HEADLESS=true` (the default).
