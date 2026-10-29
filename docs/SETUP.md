# Internite CRM — Complete Setup Guide

> **Stack:** React 18 + Vite · Spring Boot 3.2 · MongoDB Atlas · OpenAI GPT-4

---

## Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| Node.js | ≥ 18.x | `node -v` |
| npm | ≥ 9.x | `npm -v` |
| Java (JDK) | 21 | `java -version` |
| Maven | 3.9+ | `mvn -v` |
| MongoDB Atlas | cloud | Atlas cluster access |
| Git | any | `git --version` |

---

## 1. Clone & Configure Environment

```bash
# Navigate to your project folder
cd "Internite CRM"

# Copy and edit environment variables
cp .env.example .env
# Open .env and fill in your API keys (OpenAI, Meta, WhatsApp, etc.)
```

---

## 2. Database Setup

```bash
# Use a MongoDB Atlas connection string in .env
# Example:
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster-url>/?appName=<appName>
```

---

## 3. Backend (Spring Boot)

```bash
cd backend

# Copy backend environment config
# (Values already set via application.properties reading from env vars)

# Build & run
mvn clean package -DskipTests
mvn spring-boot:run

# Or run the JAR directly:
java -jar target/internite-crm-backend-1.0.0.jar
```

The backend starts at **http://localhost:8080**  
Swagger UI: **http://localhost:8080/swagger-ui/index.html**

### Backend Environment Variables
Set these before running (or update `application.properties`):

```bash
export MONGODB_URI="mongodb+srv://<user>:<password>@<cluster-url>/?appName=<appName>"
export JWT_SECRET=your-secret-key-min-64-chars
export OPENAI_API_KEY=sk-your-openai-key
export SMTP_HOST=smtp.gmail.com
export SMTP_USER=your-email@gmail.com
export SMTP_PASSWORD=your-app-password
```

PowerShell (Windows):

```powershell
$env:MONGODB_URI="mongodb+srv://<user>:<password>@<cluster-url>/?appName=<appName>"
$env:JWT_SECRET="your-secret-key-min-64-chars"
$env:OPENAI_API_KEY="sk-your-openai-key"
$env:SMTP_HOST="smtp.gmail.com"
$env:SMTP_USER="your-email@gmail.com"
$env:SMTP_PASSWORD="your-16-char-gmail-app-password"
```

For Gmail SMTP, `SMTP_PASSWORD` must be a Google App Password (with 2-Step Verification enabled), not your normal Gmail login password.

---

## 4. Frontend (React + Vite)

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend runs at **http://localhost:5173**

### Build for Production

```bash
npm run build
# Output in frontend/dist/
```

---

## 5. First Login

Open **http://localhost:5173** and sign in with:

| Field | Value |
|-------|-------|
| Email | `superadmin@internite.com` |
| Password | `demo1234` |
| Role | Super Admin |

> All demo users share the password `demo1234`.  
> Other accounts: `companyadmin@internite.com`, `priya@internite.com`, `rahul@internite.com`, `amit@internite.com`, `neha@internite.com`, `normaluser@internite.com`

---

## 6. Integrations Setup

### OpenAI (AI Engine)
1. Sign up at https://platform.openai.com
2. Generate an API key
3. Set `OPENAI_API_KEY` in your `.env`

### Meta (Facebook & Instagram Lead Ads)
1. Create a Meta App at https://developers.facebook.com
2. Enable **Leads Retrieval** and **Webhooks**
3. Set Lead Ads webhook URL to: `https://yourdomain.com/api/webhooks/facebook/leads`
4. For Messenger incoming events, use: `https://yourdomain.com/api/webhooks/facebook/messages` (alias: `/api/webhooks/facebook/messenger`)
5. For Instagram DM incoming events, use: `https://yourdomain.com/api/webhooks/instagram/messages`
6. If you still use old setup, legacy combined URL remains: `https://yourdomain.com/api/webhooks/meta`
7. Use the same verify token value (`META_WEBHOOK_TOKEN`) for all Meta webhook verification requests
8. Copy App ID, App Secret, and Webhook Verify Token to `.env`

### WhatsApp Business Cloud API
1. Set up WhatsApp in your Meta Business Account
2. Get your Phone Number ID and permanent Access Token
3. Set webhook URL to: `https://yourdomain.com/api/webhooks/whatsapp`
4. Set `WHATSAPP_PHONE_NUMBER_ID` and `WHATSAPP_ACCESS_TOKEN`

### Bolna (AI Calling Agent)
1. Create a Bolna account, generate an API key, and create a Bolna voice agent.
2. In Internite CRM Integrations, open **Voice Call Agent** and set:
   - `provider=bolna`
   - `bolnaApiUrl` (usually `https://api.bolna.ai`)
   - `bolnaApiKey`
   - `bolnaAgentId`
3. Optional:
   - `fromNumber` for caller ID (`from_phone_number` in Bolna call API)
   - `bolnaVoiceId` to override agent voice per call
   - `callbackWebhookUrl` (defaults to `http://localhost:8080/api/calls/webhook` if omitted)
   - `webhookSecret` (recommended for callback verification)
4. In Bolna agent settings (Analytics/Webhook), point outbound execution updates to `POST /api/calls/webhook`.
5. Keep webhook endpoint `POST /api/calls/webhook` reachable from the Bolna runtime (use ngrok or Cloudflare Tunnel for local testing).

### Gmail / Google Calendar
1. Create a project in Google Cloud Console
2. Enable Gmail API and Google Calendar API
3. Create OAuth 2.0 credentials
4. Set redirect URI: `http://localhost:8080/api/integrations/google/callback`
5. Copy Client ID and Secret to `.env`

### AWS S3 (File Storage)
1. Create an S3 bucket in `ap-south-1` (or your preferred region)
2. Create an IAM user with S3 permissions
3. Set `AWS_ACCESS_KEY`, `AWS_SECRET_KEY`, and `AWS_BUCKET`

### Cloudinary (Image Storage)
1. Sign up at https://cloudinary.com
2. Copy Cloud Name, API Key, and API Secret from dashboard
3. Set in `.env`

---

## 7. Production Deployment

### Docker (Recommended)

```bash
# Build images
docker build -t internite-backend ./backend
docker build -t internite-frontend ./frontend

# Run with Docker Compose
docker-compose up -d
```

### Environment Checklist for Production

- [ ] Set `APP_ENV=production`
- [ ] Use a strong, unique `JWT_SECRET` (min 64 chars, base64 encoded)
- [ ] Set `CORS_ORIGINS` to your actual domain only
- [ ] Use SSL/HTTPS (configure reverse proxy like Nginx)
- [ ] Verify `MONGODB_URI` points to your production Atlas cluster
- [ ] Enable database backups
- [ ] Set up monitoring (Spring Actuator + Prometheus/Grafana)
- [ ] Configure email SPF/DKIM records

### Nginx Reverse Proxy Config

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name yourdomain.com;

    # Frontend
    location / {
        root /var/www/internite/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:8080/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Native WebSocket
    # Spring Boot registers the STOMP endpoint at /ws (without trailing slash).
    location = /ws {
        proxy_pass http://localhost:8080/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Origin $http_origin;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }

    # SockJS fallback for older/cached clients that request /ws/info and /ws/{server}/{session}/...
    location /ws/ {
        proxy_pass http://localhost:8080/ws-sockjs/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Origin $http_origin;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}
```

---

## 8. Folder Structure

```
Internite CRM/
├── frontend/                        # React + Vite application
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/              # Sidebar, Topbar, Notifications
│   │   │   ├── dashboard/           # Dashboard widgets
│   │   │   ├── kanban/              # Kanban board components
│   │   │   ├── leads/               # Lead components
│   │   │   ├── ai/                  # AI chatbot, scoring
│   │   │   └── ui/                  # Shared UI primitives
│   │   ├── pages/                   # Route-level pages
│   │   │   ├── DashboardPage.jsx
│   │   │   ├── LeadsPage.jsx
│   │   │   ├── KanbanPage.jsx
│   │   │   ├── AIEnginePage.jsx
│   │   │   ├── AutomationPage.jsx
│   │   │   ├── CommunicationPage.jsx
│   │   │   ├── CustomersPage.jsx
│   │   │   ├── InvoicesPage.jsx
│   │   │   ├── AnalyticsPage.jsx
│   │   │   ├── TeamPage.jsx
│   │   │   ├── SettingsPage.jsx
│   │   │   └── LoginPage.jsx
│   │   ├── store/                   # Zustand state management
│   │   │   ├── authStore.js
│   │   │   ├── themeStore.js
│   │   │   ├── leadsStore.js
│   │   │   ├── dealsStore.js
│   │   │   └── notificationStore.js
│   │   ├── services/                # API & WebSocket clients
│   │   │   ├── api.js
│   │   │   └── websocket.js
│   │   └── utils/
│   │       └── mockData.js          # Demo data
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── .env
│
├── backend/                         # Spring Boot application
│   └── src/main/java/com/internite/
│       ├── InterniteCrmApplication.java  # Entry point
│       ├── model/                   # JPA entities
│       │   ├── BaseEntity.java
│       │   ├── User.java
│       │   ├── Lead.java
│       │   ├── Deal.java
│       │   ├── Customer.java
│       │   ├── Invoice.java
│       │   └── Notification.java
│       ├── dto/                     # Data Transfer Objects
│       ├── controller/              # REST controllers
│       │   ├── AuthController.java
│       │   ├── LeadController.java
│       │   ├── DealController.java
│       │   └── AIController.java
│       ├── service/                 # Business logic
│       ├── repository/              # Spring Data MongoDB repos
│       │   ├── LeadRepository.java
│       │   └── DealRepository.java
│       ├── security/                # JWT + Spring Security
│       │   ├── JwtService.java
│       │   ├── JwtAuthFilter.java
│       │   └── SecurityConfig.java
│       ├── websocket/               # Real-time notifications
│       │   ├── WebSocketConfig.java
│       │   └── NotificationPublisher.java
│       ├── automation/              # Workflow engine
│       │   └── WorkflowEngine.java
│       └── config/
│   └── src/main/resources/
│       └── application.properties
│
├── docs/
│   ├── API.md                       # REST API reference
│   └── SETUP.md                     # This file
│
├── .env.example                     # Environment template
└── README.md
```

---

## 9. Tech Stack Summary

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 18 + Vite | SPA framework |
| UI | Tailwind CSS + Framer Motion | Styling + animations |
| Drag & Drop | dnd-kit | Kanban board |
| Charts | Recharts | Analytics & dashboard |
| State | Zustand | Global state management |
| HTTP | Axios | API requests |
| Backend | Spring Boot 3.2 (Java 21) | REST API server |
| Security | Spring Security + JWT (JJWT) | Auth & authorization |
| ORM | Spring Data MongoDB | Database access |
| Real-time | WebSocket + STOMP + SockJS | Live notifications |
| Scheduler | Spring @Scheduled | Automation cron jobs |
| Database | MongoDB Atlas | Primary data store |
| Schema Evolution | Mongo document model + indexes | Data model versioning |
| AI | OpenAI GPT-4 Turbo | Lead scoring, emails, chat |
| Storage | AWS S3 / Cloudinary | File & image uploads |
| API Docs | SpringDoc + Swagger UI | Interactive API reference |

---

## 10. Troubleshooting

**Backend won't start — DB connection refused**  
→ Verify Atlas cluster is reachable from your IP/network  
→ Verify `MONGODB_URI` in `.env`

**Frontend proxy error (ECONNREFUSED)**  
→ Backend must be running on port 8080 before starting Vite

**JWT invalid errors**  
→ Ensure `JWT_SECRET` is the same in both `.env` and `application.properties`  
→ Clear browser localStorage and log in again

**OpenAI API 401**  
→ Check `OPENAI_API_KEY` is set correctly and has billing enabled

**Meta webhook verification fails**  
→ Make sure `META_WEBHOOK_TOKEN` matches what you entered in the Meta Developer Console  
→ Your server must be publicly accessible (use ngrok for local dev)

**WhatsApp messages not received**  
→ Verify webhook URL is correct and SSL is enabled (WhatsApp requires HTTPS)
