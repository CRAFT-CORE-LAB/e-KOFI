# e-KOFI Flutter app

Cross-platform staff app (Android + iOS) for Phase 1: login, students, NFC cards, wallets, canteens, purchases, and the transaction ledger. It talks to the existing NestJS API.

## Run

Start PostgreSQL and the backend first (`backend`: `npm run db:up`, then `npm run start:dev`).

```bash
cd mobile
flutter pub get
flutter run
```

Default API URL: `https://api-production-240da.up.railway.app/api`

Override it from Login → Server or More → API server.

Sign in with `admin@ekofi.local` / `Admin123!`.

## NFC

Android phones can scan UID + `EKOFI:` NDEF token, register a card, write a replacement token, and pay by tapping. iOS supports NDEF read/write; enable the NFC capability in Xcode for a physical iPhone.
