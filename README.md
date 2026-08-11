# ⚙️ AI Marketing Platform — Backend API Server

Welcome to the backend API repository for the **AI Marketing Automation Platform**. This server provides secure, production-grade endpoints for launching marketing campaigns, managing leads, tracking subscriptions, processing payments, executing AI prompts, and handling background tasks.

---

## 🛠️ Tech Stack

* **Runtime Environment:** Node.js (ESM Modules style)
* **Framework:** Express.js
* **Database:** MongoDB & Mongoose ODM
* **Security:** Helmet, CORS, Express Rate Limit, bcrypt (password hashing)
* **Authentication:** JSON Web Tokens (JWT) & HTTP-Only Secure Cookies
* **AI Integration:** DeepSeek via OpenRouter API (provider-agnostic design)
* **Payment Gateway:** Razorpay SDK & Webhooks
* **Storage:** Cloudinary SDK (for image/video creative assets)
* **Task Scheduling:** Node-cron (for queue processing)

---

## 🧠 Core Architecture Highlights

The server follows a decoupled **MVC & Service-Layer** architecture:
* **Routes Layer:** Declares endpoints and connects validator middlewares. Contains zero business logic.
* **Controllers Layer:** Orchestrates requests, coordinates payload validations, and returns standardized API responses.
* **Services Layer:** House of business logic (API keys, Meta API integrations, Google Ads operations, Razorpay subscription state updates).
* **Models Layer:** Mongoose schemas representing database collections.
* **Middlewares:** Implements global error handler, rate limits, JWT auth, and role-based restrict rules.

---

## 🔑 Advanced Features

### 🛡️ Role-Based Access Control (RBAC) & Client Impersonation
The server enforces distinct roles: `super_admin`, `admin`, and `client`.
* **Impersonation Middleware (`x-impersonate-user`):** When an Admin or Super Admin needs to view or edit campaigns on behalf of a client, they pass the client's database ID in the `x-impersonate-user` HTTP header. 
* The auth middleware ([auth.js](file:///d:/diintech/server/src/middleware/auth.js)) validates that the admin has access to the client, records the admin session in `req.adminUser`, and swaps `req.user` with the client user model. All downstream database queries, credit calculations, and API integrations run in the client's context.

### 🔌 Extension Support API
Provides public endpoints for the ScoutPilot Chrome Extension:
* Saves leads harvested by the extension (`/api/leads/extension`).
* Validates if a pincode/category combo was scraped recently (`/api/leads/history/check`).
* Delivers lists of leads lacking website urls for search engine lookup (`/api/leads/missing-websites`).

### 💳 Dual-Mode Ad Deployments (`adMode`)
* **PERSONAL:** Campaigns are deployed using the client's own connected Meta/Google Developer accounts.
* **PLATFORM:** Campaigns are deployed using the platform's corporate agency accounts, deducting ad spend directly from the client's pre-funded `walletBalance`.

---

## 🚀 Getting Started

### Prerequisites

* **Node.js** (v18 or higher)
* **MongoDB** (Local instance or MongoDB Atlas URI)

### Installation

1. Navigate to the server directory:
   ```bash
   cd server
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

### Configuration

Create a `.env` file in the root of the `server` directory (you can copy `.env.example` as a template):
```bash
cp .env.example .env
```

Configure your environment variables:
```env
PORT=5000
NODE_ENV=development

# MongoDB
MONGO_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/adplifai

# JWT Secrets
JWT_ACCESS_SECRET=your_jwt_access_secret_key
JWT_REFRESH_SECRET=your_jwt_refresh_secret_key

# OpenRouter / AI Settings
OPENROUTER_API_KEY=your_openrouter_api_key
PRIMARY_AI_PROVIDER=deepseek

# Meta Marketing API
META_CLIENT_ID=your_meta_client_id
META_CLIENT_SECRET=your_meta_client_secret

# Google Ads Developer Details
GOOGLE_ADS_CLIENT_ID=your_google_client_id
GOOGLE_ADS_CLIENT_SECRET=your_google_client_secret
GOOGLE_ADS_DEVELOPER_TOKEN=your_developer_token

# Cloudinary Storage
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Razorpay Subscriptions
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_signature_secret
```

### Run Server

To launch the server locally:
```bash
# Production Mode
npm start

# Development Mode (uses nodemon)
npm run dev
```
The server will boot on [http://localhost:5000](http://localhost:5000).

---

## 📁 Project Structure

```
server/src/
├── config/          # DB connections and external clients
├── constants/       # App-wide constants (Roles, Plans, Plan limits, Credits)
├── controllers/     # Route request handlers
├── cron/            # Scheduled cron tasks (e.g., email queue processing)
├── helpers/         # JWT generators, token verifiers
├── middleware/      # Auth, CORS, and Credit validations
├── models/          # Mongoose database models
├── routes/          # Express route definitions
├── services/        # Third-party integrations (Google Ads, Meta API, Razorpay)
├── utils/           # Shared utility classes (errors, standard responses)
└── validators/      # Payload validators using custom validation structures
```

---

## 🛣️ API Routes Summary

| Context | Base Route | Key Operations |
|---|---|---|
| **Authentication** | `/api/auth` | Login, Register, Google OAuth, Reset Password, Refresh Token |
| **Campaigns** | `/api/campaigns` | Create Draft, Publish, Pause, Resume, Update Budgets, Sync Insights |
| **Admin Panel** | `/api/admin` | Fetch pending approvals, Approve/Reject clients, Recharge wallets, Create Admins |
| **Leads & CRM** | `/api/leads` | Query leads, Generate via AI, Extension ingestion, Website Hunter endpoints |
| **Payments** | `/api/payments` | Subscriptions checkout, Payment history, Webhook triggers |
| **Dashboard** | `/api/dashboard` | Fetch aggregated user campaign metrics and remaining credits |
