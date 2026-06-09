# Tally Order Tracker

Internal web app for tracking order delivery deadlines and automatically notifying salesmen via email and in-app alerts. Integrates with Tally software via XML API, with a mock mode for running without a Tally connection.

---

## Prerequisites

- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- **npm 9+** (bundled with Node.js)
- Gmail account with App Password (only needed for email notifications)

---

## Installation

### 1. Clone / download the project

```bash
cd tally-order-tracker
```

### 2. Install backend dependencies

```bash
cd backend
npm install
```

### 3. Install frontend dependencies

```bash
cd ../frontend
npm install
```

---

## Configuration

Edit `backend/.env`:

```env
PORT=5000
GMAIL_USER=your@gmail.com
GMAIL_PASS=your-app-password
TALLY_URL=http://localhost:9000
MOCK_MODE=true
```

| Variable | Description |
|---|---|
| `PORT` | Backend port (default 5000) |
| `GMAIL_USER` | Your Gmail address for sending reminders |
| `GMAIL_PASS` | Gmail App Password (NOT your regular password) |
| `TALLY_URL` | Tally XML server URL |
| `MOCK_MODE` | `true` = use built-in mock data, `false` = connect to real Tally |

---

## Gmail App Password Setup

Gmail requires an App Password for SMTP access (your normal password won't work).

1. Go to **myaccount.google.com** → **Security**
2. Enable **2-Step Verification** (required before App Passwords work)
3. Go to **Security → App Passwords** (or search "App passwords")
4. Select **Mail** as the app, **Windows Computer** as the device
5. Click **Generate** — copy the 16-character password shown
6. Paste it as `GMAIL_PASS` in `backend/.env`

> The app will warn in the console if credentials aren't configured and continue without sending emails.

---

## Tally XML Server Setup

To connect to a real Tally installation:

1. Open **Tally Prime** on the same machine
2. Press **F12** (Configuration) → **Advanced Configuration**
3. Enable **"Enable ODBC / XML Server"** and set port to **9000**
4. Click **Accept**
5. Set `MOCK_MODE=false` and `TALLY_URL=http://localhost:9000` in `.env`

> If Tally is unreachable, the app automatically falls back to mock data so it never crashes.

---

## Running the App

Open **two terminal windows**:

### Terminal 1 — Backend

```bash
cd tally-order-tracker/backend
npm run dev
```

The backend starts on **http://localhost:5000**

### Terminal 2 — Frontend

```bash
cd tally-order-tracker/frontend
npm run dev
```

The frontend opens at **http://localhost:5173**

---

## Switching from Mock to Live Tally Data

1. Ensure Tally Prime is running with XML server enabled (see above)
2. In `backend/.env`, change:
   ```
   MOCK_MODE=false
   ```
3. Restart the backend
4. Click **"Sync from Tally"** on the Dashboard

---

## Folder Structure

```
tally-order-tracker/
├── backend/
│   ├── server.js          # Express app + startup
│   ├── db.js              # SQLite init + connection
│   ├── tally.js           # Tally XML fetch + mock data
│   ├── scheduler.js       # node-cron hourly jobs
│   ├── mailer.js          # Nodemailer HTML email templates
│   ├── routes/
│   │   ├── orders.js      # GET/POST/PATCH order endpoints
│   │   ├── notifications.js # Notification CRUD
│   │   └── salesmen.js    # Salesman CRUD
│   ├── orders.db          # SQLite database (auto-created)
│   └── .env               # Environment variables
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx        # Router setup
│   │   ├── main.jsx       # React entry point
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx    # Stats + urgency table
│   │   │   ├── Orders.jsx       # Full orders + filters
│   │   │   ├── Salesmen.jsx     # Salesman management
│   │   │   └── Notifications.jsx # Notification log
│   │   ├── components/
│   │   │   ├── Navbar.jsx           # Top nav + settings
│   │   │   ├── NotificationBell.jsx # Live unread count badge
│   │   │   ├── DeadlineBadge.jsx    # Color-coded pill
│   │   │   ├── ReminderConfig.jsx   # Settings modal
│   │   │   └── OrderCard.jsx        # Order detail modal
│   │   └── api/
│   │       └── client.js  # Axios base instance
│   └── index.html
│
└── README.md
```

---

## Features

- **Dashboard** — urgency-sorted table with colour-coded rows (red/orange/yellow), stats bar, manual Tally sync
- **Orders** — filterable by status + salesman, click any row for full details + status change
- **Salesmen** — add/edit/delete with active order counts
- **Notifications** — full log of email and in-app reminders, mark read/unread
- **Settings** — configurable reminder days (e.g. `7,3,1`), toggle email/in-app per type
- **Auto-scheduler** — runs every hour, sends reminders at configured thresholds, deduplicates sends
- **Graceful fallback** — works fully without Tally (mock mode) and without Gmail configured
