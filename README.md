# Snack Index

Progressive Web App for location-based snack recommendations in Seattle. Built with React, TypeScript, Vite, Firebase, and Playwright/Vitest for testing.

## Prerequisites
- Node 20+
- Firebase project (Auth + Firestore; optional emulators)
- Google Places API key (Places API - New)

## Environment
Create `.env.local` with:
```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_GOOGLE_PLACES_API_KEY=...
# Use emulators locally
VITE_USE_FIREBASE_EMULATORS=true
```

## Install & Run
```
npm install
npm run dev
```

## Tests
- Unit/component: `npm test` or `npm run test:run`
- Coverage: `npm run test:coverage`
- E2E (Playwright): `npm run test:e2e`

## Firebase
- Emulators: set `VITE_USE_FIREBASE_EMULATORS=true` and run your local emulators.
- Seed sample data (dev only): visit `/dev-setup` in the app to set admin + sample places.

## Build
```
npm run build
npm run preview
```

## Notes
- App uses mock Google Places data when `VITE_GOOGLE_PLACES_API_KEY` is missing; use a real key for production accuracy.
- Notifications/FCM token capture is scaffolded; integrate Firebase Messaging + service worker for production push/local notifications.
