# Booking, partner and driver updates

Deploy the backend, admin app and customer website together. No data migration is required. MongoDB creates the new `notifications` collection when it is first used.

## Configuration

Backend environment:

```text
WEBSITE_URL=https://zalt.uk
JWT_SECRET=<keep your existing strong secret>
SMTP_HOST=<your SMTP host>
SMTP_PORT=587
SMTP_USER=<your SMTP username>
SMTP_PASS=<your SMTP password>
MAIL_FROM=<your verified sender address>
```

Use port 465 for SMTP providers requiring implicit TLS. Existing MongoDB and Stripe settings remain required. Set `VITE_API_BASE` to the live backend origin when building **both** frontend apps; the local files currently default to `http://localhost:5000`.

Run the backend with `npm start`. Its email delivery worker starts with the server and checks the durable queue every 30 seconds. Booking creation, assignment and completion persist notification intent with the booking itself, allowing the worker to recover interrupted queue inserts after a restart. Only explicitly pending events are recovered; historical rides are not bulk-emailed. Keep this process running; a request-only/serverless runtime requires a separately scheduled delivery worker. Delivery failures retry up to eight times with increasing delays. Inspect the `notifications` collection for `PENDING`, `SENDING`, `SENT` or `FAILED` records. `SENT` means SMTP accepted the message, not that the recipient opened it or that it avoided spam filtering. For a failed message, correct SMTP configuration and reset its `status` to `PENDING`, `attempts` to `0`, and `nextAttemptAt` to the current time to retry it.

## Behavior

- A paid referral booking queues confirmation for the customer, Zalt and the referring approved partner. Partners receive a private dashboard link in approval, booking and completion emails. They can request a new link at `/partner/dashboard`. Links expire after seven days and stop working if the partner is suspended or their email changes. The dashboard exposes their earnings and ride statuses without customer details or fares.
- Customers can enter a partner referral code on the passenger-details page, or arrive through the partner's referral link. Referral attribution does not replace discount vouchers.
- Admin **Bookings → Assign / Edit assignment** accepts an optional **Driver amount (£)**. Blank hides the amount; zero explicitly displays £0. Reassigning also emails a fresh completion link and invalidates the previous link. The driver link expires after 90 days and allows access only to that assigned ride.
- Driver booking screens, email links and emails omit customer fares, partner commissions and payment secrets. The job-end code remains in the customer's confirmation email. The driver must obtain it at drop-off; five failed attempts require the office to complete the ride.
- When an amount is entered, internal accounting uses that agreed driver amount. For historical/unpriced bookings, existing internal 80% accounting is preserved, while driver-facing views omit those automatic earnings. Driver balances show “To be confirmed” when some completed rides have no agreed amount. Check existing payout records when introducing manual amounts.
- Completion queues emails for the customer, assigned driver, referring approved partner (if present), `booking@zalt.uk`, and `myairporttaxi86@gmail.com`. Event/recipient keys prevent routine duplicate queue entries. Delivery is at least once: a crash after SMTP acceptance but before recording success may cause a retry.
- Customer completion emails promote completing two more rides to unlock a discount in pounds. No discount amount is stated. Reward approval/redemption is handled by support; this update does not automatically issue a voucher.

## Validation before launch

Run `npm test` in the backend and `npm run build` in each frontend. After deployment, make a test paid referral booking and verify the real SMTP deliveries, partner dashboard, driver link and job-end completion. Automated tests use mocks and do not charge Stripe, send live emails, or connect to the production database. Existing bookings are not automatically sent new emails; use **Edit assignment / resend link** for an assigned driver or **Resend link** on the partner administration page.
