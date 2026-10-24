# e-KOFI — School Canteen Cashless Payments (Phase 1)

Phase 1 is the internal ledger: student accounts, NFC card assignment, wallets, canteen accounts, and auditable purchases. External payment providers (MoMo, banks) are intentionally not integrated.

## Stack

- **Admin UI:** Next.js, TypeScript, Tailwind CSS (`frontend/`)
- **Mobile app:** Flutter (Android + iOS) in `mobile/`
- **API:** NestJS, TypeScript, REST (`backend/`)
- **Database:** PostgreSQL + Prisma
- **NFC registrar:** Android Kotlin app (`android/`) — the Flutter app now covers the same NFC + staff flows

The repository already contained a NestJS starter in `backend/`. This phase builds on that app.

## Features

- Register, search, edit, and deactivate students with unique IDs, school, and class
- Register NFC cards from an Android scan, assign one active card per student, block lost cards, and issue replacements
- Secure card authentication with a token written to the tag (UID alone is rejected for payment)
- One wallet per student, balances in integer RWF
- Administrator **test credits** for development only, posted to the ledger
- Canteen accounts with earnings history (no withdrawals)
- Purchase flow: select student or scan card → optional PIN → amount → atomic debit/credit
- Double-entry ledger, idempotent purchases, no silent edits/deletes of posted entries

## Setup

### 1. PostgreSQL

```bash
docker compose up -d
```

Or, without Docker, start an embedded Postgres from the backend folder:

```bash
cd backend
npm run db:up
```

Or create a local database named `ekofi` with a system PostgreSQL install.

### 2. Backend

```bash
cd backend
copy .env.example .env   # PowerShell: Copy-Item .env.example .env
npm install
npx prisma generate
npx prisma migrate deploy
npx prisma db seed
npm run start:dev
```

API: `http://localhost:3001/api`  
Health: `http://localhost:3001/api/health`

Seed logins:

| Role    | Email                 | Password     |
|---------|-----------------------|--------------|
| Admin   | `admin@ekofi.local`   | `Admin123!`  |
| Cashier | `cashier@ekofi.local` | `Cashier123!` |

Demo student **Aime Uwase** (`STU-000001`) PIN: `2468`  
Demo card UID: `04A1B2C3D4E5F6` token: `EKOFI-DEMO-CARD-TOKEN-AIME`

### 3. Admin UI

```bash
cd frontend
copy .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000` and sign in as admin.

### 4. Flutter mobile app (Android + iOS)

```bash
cd mobile
flutter pub get
flutter run
```

On an **Android emulator**, the default API URL is `http://10.0.2.2:3001/api`.  
On the **iOS simulator**, it is `http://127.0.0.1:3001/api`.  
On a **physical phone**, open More → API server and set your computer’s LAN address, for example `http://192.168.1.10:3001/api`. Keep the NestJS API running.

NFC scan, register, token write, and purchase-by-card work on NFC-capable Android phones. iOS can read/write NDEF tokens; UID capture is most reliable on Android.

### 5. Android NFC app (legacy Kotlin registrar)

Open `android/` in Android Studio, set `API_URL` in `app/build.gradle.kts` to your machine (use the LAN IP, not `localhost`, from a physical phone). Sign in as admin, scan a tag, paste the student UUID from the admin UI, and register. If the tag has no token, tap it again to write the issued `EKOFI:` NDEF text record.

## Testing

```bash
cd backend
npm test
npm run test:e2e
```

Unit tests cover purchases, insufficient balance, duplicate idempotency keys, blocked cards, PIN lockout, test credits, and balanced ledger reversals. They do not require PostgreSQL.

## Definition of done (Phase 1)

An administrator can register a student, assign an NFC card, issue a test credit, register a canteen, and process a purchase that debits the student wallet and credits the canteen. All records persist in PostgreSQL.

## Out of scope

MTN MoMo, Airtel Money, parent apps, real-money top-ups, payouts, inventory, and notifications.
