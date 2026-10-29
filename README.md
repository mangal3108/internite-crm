# Internite CRM 🚀

> **Production-ready, AI-powered CRM platform** — Lead capture · Kanban pipeline · AI scoring · Automation · Real-time notifications

Built with **React + Vite** (frontend) and **Spring Boot** (backend), powered by **OpenAI GPT-4**, with **MongoDB Atlas** as the primary database and native integrations for Facebook, Instagram, LinkedIn, Reddit, WhatsApp, Gmail, and Google Calendar.

---

## ✨ Features

| Module | Highlights |
|--------|-----------|
| 📊 **Dashboard** | KPI cards, revenue charts, sales funnel, AI insights, activity feed |
| 👥 **Lead Management** | Capture from 9+ sources, UTM tracking, bulk import/export, deduplication |
| 🎯 **Kanban Pipeline** | Drag-and-drop board, 7 stages, multi-pipeline, deal cards with value & priority |
| 🤖 **AI Engine** | GPT-4 chat assistant, lead scoring (Hot/Warm/Cold), deal win prediction, email writer |
| ⚡ **Automation** | IF–THEN workflow builder, auto-assign, follow-up reminders, payment alerts |
| 📞 **AI Calling Agent** | Auto-call new leads via Bolna or webhook provider, transcript capture, hot-lead auto-assignment |
| 💬 **Communication Hub** | Unified inbox — Email, WhatsApp, Instagram, LinkedIn, AI reply suggestions |
| 🏢 **Customer 360** | Full profile, activity timeline, health score, notes, documents |
| 🧾 **Invoices** | Generate, track, send reminders, GST support, Tally integration |
| 📈 **Analytics** | Revenue trends, team leaderboard, campaign ROI, radar charts |
| 👤 **Team & RBAC** | Admin / Manager / Sales Exec roles, leaderboard, gamification |
| 🔔 **Notifications** | Real-time WebSocket, email, WhatsApp, push |
| 🔒 **Security** | JWT auth, role-based access, audit logs, optional 2FA |
| 🏗️ **Multi-tenant** | Complete data isolation per company, subscription plans |

---

## 🚀 Quick Start

```bash
# 1. Setup environment
cp .env.example .env
# Set MONGODB_URI in .env (MongoDB Atlas connection string)

# 2. Backend
cd backend && mvn spring-boot:run

# 3. Frontend
cd frontend && npm install && npm run dev

# 4. (Optional) Configure Bolna webhook
# In your Bolna agent Analytics tab, set webhook URL:
# http://localhost:8080/api/calls/webhook
```

Open **http://localhost:5173** → login with `saurabhke4@gmail.com` / `demo1234`

---

## 📁 Project Structure

```
Internite CRM/
├── frontend/          # React + Vite + Tailwind + Framer Motion
├── backend/           # Spring Boot + JWT + WebSocket + MongoDB
├── docs/              # API reference + Setup guide
└── .env.example       # Environment template
```

---

## 🛠️ Tech Stack

**Frontend:** React 18 · Vite · Tailwind CSS · Framer Motion · dnd-kit · Recharts · Zustand  
**Backend:** Spring Boot 3.2 · Spring Security · Spring Data MongoDB · WebSocket/STOMP  
**Database:** MongoDB Atlas  
**AI:** OpenAI GPT-4 Turbo  
**Integrations:** Meta Graph API · WhatsApp Business API · LinkedIn · Gmail · Google Calendar · Tally  
**Storage:** AWS S3 · Cloudinary  

---

## 📖 Documentation

- [Setup Guide](docs/SETUP.md) — Full installation & deployment instructions
- [API Reference](docs/API.md) — REST endpoints, request/response examples
- [Swagger UI](http://localhost:8080/swagger-ui/index.html) — Interactive API explorer (when backend is running)

---

## 🔑 Demo Credentials

| Email | Password | Role |
|-------|----------|------|
| platformadmin@nexacrm.com | demo1234 | Platform Admin |
| companyadmin@nexacrm.com | demo1234 | Company Admin |
| saurabhke4@gmail.com | demo1234 | Admin |
| priya@nexacrm.com | demo1234 | Manager |
| rahul@nexacrm.com | demo1234 | Sales Exec |
| amit@nexacrm.com | demo1234 | Sales Exec |
| normaluser@nexacrm.com | demo1234 | Normal User |

---

## 📸 Module Overview

- **Dashboard** — Live KPIs, revenue area chart, lead source pie chart, sales funnel, AI insights panel, activity feed
- **Kanban** — 7-column drag-and-drop board with deal cards showing value, owner, due date, AI score badge
- **Leads** — Sortable/filterable table with hot/warm/cold badges, bulk actions, modal add form
- **AI Engine** — Embedded GPT-4 chat, lead scoring bar chart, AI email generator with tone selection
- **Automation** — IF-THEN workflow cards, enable/pause toggle, execution run counter
- **Communication** — Unified inbox sidebar + message thread with AI reply suggestion button
- **Invoices** — Invoice table with GST breakdown, PDF download, one-click payment reminder
- **Analytics** — Bar/line/radar charts, campaign ROI table, team leaderboard with progress bars
- **Team** — Member table with role badges, permission matrix, monthly leaderboard with emoji badges
- **Settings** — General, notifications, security (2FA toggle), appearance (dark/light), integrations status, billing plan

---

*Built with ❤️ using AI-first architecture. Inspired by HubSpot, Zoho CRM, and Salesforce — enhanced for the AI era.*
