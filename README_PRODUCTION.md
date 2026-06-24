# MPS Staff Portal - Production & Operations Guide

This document contains guidelines, configuration, and operation instructions for running the **MPS Staff Portal** in production.

---

## 1. Rate Limiting Policy
To prevent abuse and distributed denial of service, role-based rate limits are enforced automatically on all Server Actions and API endpoints (via the global `withErrorHandling` wrapper and IP/User tracking):

*   **Anonymous / Unauthenticated Requests:** 30 requests / minute
*   **Staff Members & Principals:** 60 requests / minute
*   **Superadmins:** 120 requests / minute

When a limit is reached, the application returns a `429 Too Many Requests` status. In-memory sliding window cache handles cleanup automatically.

---

## 2. Input Validation & Error Handling
All inputs MUST be strictly validated before processing.
*   **Utility:** `validate<T>(schema, data)` in `lib/validation.ts` uses **Zod** to validate parameters.
*   **Error Catching:** All Server Actions are wrapped with `withErrorHandling(actionName, fn)` in `lib/errors.ts`.
*   **Unified Responses:** Uncaught errors generate a unique `requestId` (UUID) logged to stdout for tracking, returning a sanitised `{ success: false, error: "Internal Server Error", code: 500, requestId }` back to the client. Specific user-facing errors (validation, auth, permission) are propagated with their corresponding code and message.

---

## 3. Structured Logging
The application uses structured JSON logging via `lib/logger.ts` in production mode.
*   Logs are output directly to `stdout` as single-line JSON items.
*   Sinks like **Supabase Logflare** or **AWS CloudWatch** ingest and index these JSON blocks.
*   Standard log schema:
    ```json
    {
      "level": "error",
      "timestamp": "2026-06-11T14:00:00.000Z",
      "msg": "Error in server action: createAnnouncement",
      "requestId": "488f7b...",
      "code": 400,
      "error": { "message": "Validation failed..." }
    }
    ```

---

## 4. Security Headers
The following headers are configured globally in `next.config.ts`:
*   `Content-Security-Policy`: Standard self-origin, restricts script, style, and font loading, limits frames, and permits connections to Supabase.
*   `X-Content-Type-Options: nosniff`: Prevents MIME type sniffing.
*   `X-Frame-Options: DENY`: Prevents clickjacking attacks.
*   `Referrer-Policy: strict-origin-when-cross-origin`: Controls referrer data transmission.
*   `Permissions-Policy`: Restricts browser camera, geolocation, and microphone usage to self.
*   `Strict-Transport-Security (HSTS)`: Forces secure HTTPS connections (`max-age=2 years`).

---

## 5. Database Backup & Retention
*   **Daily Backups:** Handled automatically via **Supabase Database Backups** (retained for 30 days).
*   **Audit Retention:** A cron job should export `audit_logs` weekly to a cold storage S3 bucket (with a 90-day retention lifecycle policy).

### Backup Restoration Steps
If you need to recover the database state:
1.  **Stop all traffic:** Put the Next.js portal into maintenance mode or pause the Supabase project.
2.  **Download Backup:** Access the Supabase dashboard, navigate to `Database` -> `Backups`, and download the desired SQL dump.
3.  **Restore Schema & Data:**
    ```bash
    psql -h db.your-project.supabase.co -U postgres -d postgres -f backup_file.sql
    ```
4.  **Verify Integrity:** Run the following checksum checks:
    ```sql
    SELECT count(*) FROM public.staff;
    SELECT count(*) FROM public.attendance;
    ```
5.  **Restart Traffic:** Redeploy/resume the portal.
