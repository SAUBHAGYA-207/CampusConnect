-- ==============================================================================
-- CAMPUSCONNECT SUPABASE DATABASE SCHEMA
-- Run this in your Supabase Project -> SQL Editor -> Run
-- ==============================================================================

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS "users" (
    "id" TEXT PRIMARY KEY,
    "email" TEXT UNIQUE NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'customer',
    "isVerified" BOOLEAN DEFAULT false,
    "otp" TEXT,
    "otpExpires" BIGINT,
    "partnerUpiId" TEXT,
    "partnerQrImage" TEXT,
    "createdAt" BIGINT
);

-- 2. SERVICES TABLE
CREATE TABLE IF NOT EXISTS "services" (
    "id" TEXT PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "price" NUMERIC NOT NULL,
    "category" TEXT,
    "image" TEXT,
    "providerId" TEXT,
    "status" TEXT DEFAULT 'published',
    "createdAt" BIGINT
);
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'published';


-- 3. APPOINTMENTS TABLE
CREATE TABLE IF NOT EXISTS "appointments" (
    "id" TEXT PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "date" TEXT,
    "time" TEXT,
    "notes" TEXT,
    "status" TEXT DEFAULT 'pending',
    "paymentAmount" NUMERIC,
    "providerEarnings" NUMERIC,
    "platformFee" NUMERIC,
    "paymentScreenshot" TEXT,
    "transactionId" TEXT,
    "paymentStatus" TEXT DEFAULT 'pending',
    "createdAt" BIGINT,
    "paymentVerifiedAt" BIGINT
);

-- 4. PAYOUTS TABLE
CREATE TABLE IF NOT EXISTS "payouts" (
    "id" TEXT PRIMARY KEY,
    "partnerId" TEXT NOT NULL,
    "partnerEmail" TEXT,
    "amount" NUMERIC NOT NULL,
    "status" TEXT DEFAULT 'pending',
    "partnerUpiId" TEXT,
    "partnerQrImage" TEXT,
    "notes" TEXT,
    "adminPaymentProof" TEXT,
    "adminTransactionId" TEXT,
    "clearedAt" BIGINT,
    "createdAt" BIGINT
);

-- 5. MESSAGES TABLE (Booking Chat)
CREATE TABLE IF NOT EXISTS "messages" (
    "id" TEXT PRIMARY KEY,
    "appointmentId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "senderRole" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "timestamp" BIGINT
);

-- 6. ADMIN_MESSAGES TABLE (Partner Support Chat)
CREATE TABLE IF NOT EXISTS "admin_messages" (
    "id" TEXT PRIMARY KEY,
    "partnerId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "senderRole" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "timestamp" BIGINT
);

-- 7. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS "notifications" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "read" BOOLEAN DEFAULT false,
    "createdAt" BIGINT
);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Service Hub backend uses server-side Node.js Supabase client.
-- Disable RLS or allow full service access for API calls:
-- ==============================================================================
ALTER TABLE "users" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "services" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "appointments" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "payouts" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "messages" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "admin_messages" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications" DISABLE ROW LEVEL SECURITY;
