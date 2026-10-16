# CampusConnect — Two-Sided Campus & Local Service Marketplace

CampusConnect is a full-stack, responsive two-sided service marketplace web application built with **Node.js, Express, EJS, Bootstrap 5, Socket.IO, and JSON file-based persistence**. It connects students, staff, and local service providers with customers for service discovery, appointment bookings, real-time messaging, and notifications.

---

## Architecture Overview

- **Frontend**: EJS Server-Side Rendered Templates, Bootstrap 5, Inter Typography, Custom WhatsApp-style Chat UI, Fetch API, Socket.IO Client.
- **Backend**: Node.js & Express.js REST API Architecture, `express-session` for session handling, `bcrypt` for password hashing, `nodemailer` for transactional emails & OTPs, `multer` for secure image uploads, `socket.io` for real-time messaging & notifications.
- **Storage Layer**: Centralized JSON storage (`src/storage/jsonStorage.js`) with atomic writes for local prototyping.
  - Collections: `users.json`, `services.json`, `appointments.json`, `messages.json`, `notifications.json`, `otps.json`.
- **Image & Proof Uploads**: Handled securely via Multer with MIME verification and size limits into `uploads/services/` (service banners) and `uploads/payments/` (customer payment screenshots).
- **Payment & Commission Model**: Instant UPI QR Code scan & pay gateway with screenshot verification; automated 85% net earnings payout tracking for providers and 15% platform commission.

---

## Setup & Execution Instructions

### Prerequisites
- [Node.js](https://nodejs.org/) (v16+ recommended)
- `npm` (bundled with Node.js)

### 1. Clone & Install Dependencies
Open your terminal (PowerShell, Command Prompt, or Bash) and navigate to the project directory:

```bash
cd "c:\COLLEGE\SEM 5\HS3108 Entrepreneurship and Innovation\Webapp\ServiceHub"
npm install
```

### 2. Environment Variables (.env)
Copy the `.env.example` file to `.env`:

#### On Windows (PowerShell):
```powershell
Copy-Item .env.example .env
```

#### On Linux / macOS:
```bash
cp .env.example .env
```

Configure your `.env` variables:
```env
PORT=3000
NODE_ENV=development
SESSION_SECRET=a_long_random_cryptographic_secret_string_32chars!
APP_BASE_URL=http://localhost:3000

# Email Delivery Configuration (Option A or Option B)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_16_digit_google_app_password
MAIL_FROM="CampusConnect" <your_email@gmail.com>
```

---

## Email Configuration (Nodemailer)

### Option A: Gmail SMTP (Real Inboxes)
1. Turn on **2-Step Verification** on your Google Account.
2. Go to [Google App Passwords](https://myaccount.google.com/apppasswords).
3. Generate a new App Password (name it "CampusConnect").
4. Copy the generated **16-character password** (remove spaces) into `SMTP_PASS` in `.env`.
5. Set `SMTP_USER` and `MAIL_FROM` to your Gmail address.

### Option B: Ethereal Email (Testing / Sandboxed Mode)
1. Go to [Ethereal.email](https://ethereal.email/) and click **Create Ethereal Account**.
2. Copy the credentials provided into your `.env`:
   ```env
   SMTP_HOST=smtp.ethereal.email
   SMTP_PORT=587
   SMTP_USER=your_ethereal_user@ethereal.email
   SMTP_PASS=your_ethereal_password
   ```
3. Whenever an email or OTP is sent, the terminal will log a test preview link:
   `Preview URL: https://ethereal.email/message/...`

---

## Running the Application

### Development Mode (with Auto-Reload):
```bash
npm run dev
```

### Production Mode:
```bash
npm start
```

Once running, visit **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## Running Automated Tests

Run the test suite using Jest and Supertest:
```bash
npm test
```

---

## Manual Test Checklist

### 1. Provider Workflow
- [ ] Visit `/auth/register` and select **"I want to work (Provider)"**.
- [ ] Receive OTP via email (or check terminal for Ethereal URL), verify, and log in.
- [ ] Access the Provider Dashboard.
- [ ] Click **"+ Add Service"** or navigate to "My Services".
- [ ] Create a service with title, description, category, price, pricing unit, and an image preview.
- [ ] Edit, unpublish, and publish the listing.

### 2. Customer Workflow (Booking & QR Payment)
- [ ] In a new or incognito browser window, visit `/auth/register` and select **"I want to hire (Customer)"**.
- [ ] Verify email via OTP and log in.
- [ ] Browse the Marketplace at `/marketplace` and click on a service.
- [ ] Select an appointment date and time.
- [ ] Under the **Payment Gateway (Scan & Pay)** section, view the generated UPI QR Code and amount to pay.
- [ ] Upload a payment screenshot (proof of transaction) and enter an optional UTR / Transaction ID.
- [ ] Click **"Confirm & Submit Booking"**.

### 3. Provider Payment Verification, Earnings & Real-Time Chat
- [ ] Provider sees the incoming request on the Dashboard with **85% Net Earning** calculated automatically.
- [ ] Provider navigates to "View Appointments & Proofs" or Booking Details.
- [ ] Provider inspects the uploaded payment screenshot thumbnail / high-res modal.
- [ ] Provider clicks **"Verify Payment"** (updates payment status to `Verified` and notifies customer).
- [ ] Provider clicks **Accept Booking**.
- [ ] Customer's appointment status updates to `Accepted` with `Payment Verified ✓`.
- [ ] Both parties navigate to the booking details page to chat live using the WhatsApp-style real-time panel.
- [ ] Provider's dashboard reflects **Total Net Earnings (85%)** and **Gross Volume**.

---

## JSON Storage Limitations & Database Migration

### Current Limitations of JSON Storage
1. **Single-Process Concurrency**: File-based storage is suitable for single-node local execution and testing. High concurrent writes can cause race conditions or file locks.
2. **Memory Footprint**: `jsonStorage.js` loads entire JSON arrays into memory for queries. Large datasets will lead to memory bloat.
3. **No Indexing**: Search, filter, and primary key lookups run in $O(N)$ linear time without indexing.

### Migration Path to MongoDB or PostgreSQL
Because all storage operations are decoupled into the centralized `src/storage/jsonStorage.js` layer with standard CRUD interfaces (`findAll`, `findById`, `findOne`, `insert`, `updateById`, `deleteById`, `filter`):
1. **MongoDB**: Replace `jsonStorage.js` with Mongoose models (`User`, `Service`, `Appointment`, `Message`, `Notification`, `Otp`). The method signatures can remain identical or map directly to `Model.find()`, `Model.findById()`, and `Model.create()`.
2. **PostgreSQL**: Map collections to relational tables using Sequelize, Prisma, or Knex. Add schema migrations with foreign keys (`appointments.service_id -> services.id`, `appointments.customer_id -> users.id`).
3. Controllers and services (`authService`, `serviceService`, `appointmentService`, `chatService`) do not need business logic changes, ensuring zero disruption to route and UI layers.
