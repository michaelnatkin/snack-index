# 🍜 Snack Index

**Find your next snack.** A location-based PWA that notifies you when you're near an open spot serving food you'll love.

Snack Index is laser-focused on one thing: helping adventurous eaters discover great food trucks, hole-in-the-wall restaurants, and unique local eateries—without the endless scrolling and decision fatigue of traditional review apps.

> Open the app → see one recommendation → decide → move on.

![React](https://img.shields.io/badge/React-19-blue?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)
![Firebase](https://img.shields.io/badge/Firebase-12-orange?logo=firebase)
![Vite](https://img.shields.io/badge/Vite-7-purple?logo=vite)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-cyan?logo=tailwindcss)

---

## ✨ Features

### Core Experience
- **One recommendation at a time** — No endless lists. See the nearest open spot, decide, repeat.
- **Swipe gestures** — Swipe left (skip), right (save), or up (go there now)
- **Real-time hours** — Only shows places that are actually open right now
- **Dietary filtering** — Vegetarian, vegan, and gluten-free filters
- **Distance-aware** — Recommendations based on your current location

### Discovery & Delight
- **"The Move"** — Each place highlights its signature dish (⭐)
- **Celebration moments** — Confetti when you visit a new spot
- **My Snacks** — Track your saved and visited places
- **"Surprise Me"** — Random pick from your open favorites

### Social
- **Share places** — Native share sheet integration
- **Deep links** — Shared links open directly to places/dishes

### Admin Tools
- **Google Places integration** — Search and add real places
- **Dish management** — Add dishes with dietary tags and hero designation
- **Curated content** — Admin-only place/dish management

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, TypeScript 5.9 |
| **Styling** | Tailwind CSS 4 |
| **Build** | Vite 7 |
| **State** | Zustand |
| **Backend** | Firebase (Auth, Firestore, Hosting) |
| **Maps/Places** | Google Places API (New) |
| **Unit Testing** | Vitest, React Testing Library |
| **E2E Testing** | Playwright |
| **Linting** | ESLint 9, Husky |

---

## 📋 Prerequisites

- **Node.js** 20+ (LTS recommended)
- **npm** 10+ (or pnpm/yarn)
- **Firebase CLI** (`npm install -g firebase-tools`)
- **Firebase project** with Auth + Firestore enabled
- **Google Cloud project** with Places API (New) enabled

---

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/yourusername/snack-index.git
cd snack-index
npm install
```

### 2. Environment Setup

Create `.env.local` in the project root:

```bash
# Firebase Configuration
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef

# Google Places API (New)
VITE_GOOGLE_PLACES_API_KEY=your_google_places_api_key

# Optional: Use Firebase Emulators locally
VITE_USE_FIREBASE_EMULATORS=true
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### 4. Seed Development Data

Navigate to `/dev-setup` in your browser to:
- Set yourself as admin
- Create sample places and dishes

---

## 🧪 Testing

### Unit & Component Tests (Vitest)

```bash
# Run tests in watch mode
npm test

# Run tests once
npm run test:run

# Run with coverage
npm run test:coverage
```

### E2E Tests (Playwright)

```bash
# Run all E2E tests
npm run test:e2e

# Run with UI mode (interactive)
npm run test:e2e:ui
```

---

## 📁 Project Structure

```
snack-index/
├── src/
│   ├── components/           # React components
│   │   ├── admin/           # Admin dashboard screens
│   │   ├── auth/            # Auth & welcome screens
│   │   ├── dev/             # Development utilities
│   │   ├── home/            # Main recommendation screen
│   │   ├── layout/          # App layout & navigation
│   │   ├── mysnacks/        # Favorites & visited places
│   │   ├── onboarding/      # Permissions & dietary prefs
│   │   ├── place/           # Place detail screen
│   │   ├── settings/        # User settings
│   │   ├── share/           # Share landing page
│   │   └── ui/              # Reusable UI components
│   ├── hooks/               # Custom React hooks
│   ├── lib/                 # Core business logic
│   │   ├── auth.ts          # Authentication utilities
│   │   ├── cache.ts         # Google Places caching
│   │   ├── firebase.ts      # Firebase initialization
│   │   ├── googlePlaces.ts  # Places API integration
│   │   ├── interactions.ts  # User-place interactions
│   │   ├── location.ts      # Geolocation utilities
│   │   ├── places.ts        # Place/dish Firestore ops
│   │   ├── recommendations.ts # Recommendation algorithm
│   │   └── share.ts         # Sharing utilities
│   ├── stores/              # Zustand state stores
│   ├── test/                # Test setup & utilities
│   └── types/               # TypeScript type definitions
├── e2e/                     # Playwright E2E tests
├── public/                  # Static assets & PWA manifest
├── scripts/                 # Utility scripts
└── firestore/              # Firestore emulator data
```

---

## 🔥 Firebase Setup

### Local Development (Emulators)

1. **Start Firebase emulators:**
   ```bash
   firebase emulators:start
   ```

2. **Enable emulator mode** in `.env.local`:
   ```bash
   VITE_USE_FIREBASE_EMULATORS=true
   ```

3. **Seed data** by visiting `/dev-setup` in your browser.

### Production Setup

1. **Create Firebase project** at [console.firebase.google.com](https://console.firebase.google.com)

2. **Enable services:**
   - Authentication → Google provider (and Apple for iOS)
   - Firestore Database
   - Hosting

3. **Deploy Firestore rules:**
   ```bash
   firebase deploy --only firestore:rules
   ```

4. **Deploy indexes:**
   ```bash
   firebase deploy --only firestore:indexes
   ```

5. **Set admin user:**
   - Sign in with your email
   - Manually set `isAdmin: true` in your user document, or use `/dev-setup`

---

## 🗺 Google Places API Setup

This app uses the **Google Places API (New)**, not the legacy Places API.

### Required APIs

Enable these in [Google Cloud Console](https://console.cloud.google.com/apis/library):

1. **Places API (New)** — For place search, autocomplete, and details
2. **Geocoding API** — For address/coordinate conversion (optional)

### API Key Restrictions

For production, restrict your API key:

1. **Application restrictions:** HTTP referrers
2. **API restrictions:** Places API (New), Geocoding API
3. **Website restrictions:** Add your production domains

See [Google's App Check documentation](https://developers.google.com/maps/documentation/javascript/places-app-check) for additional security.

---

## 📜 Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server (port 5173) |
| `npm run build` | TypeScript check + production build |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |
| `npm test` | Run Vitest in watch mode |
| `npm run test:run` | Run Vitest once |
| `npm run test:coverage` | Run Vitest with coverage report |
| `npm run test:e2e` | Run Playwright E2E tests |
| `npm run test:e2e:ui` | Run Playwright in UI mode |
| `npm run import:csv` | Import places from CSV file |
| `npm run backfill:geohash` | Backfill geohash for existing places |

---

## 📊 Data Models

### User
```typescript
interface User {
  id: string;
  email: string;
  displayName: string;
  preferences: {
    notificationDistance: number;  // miles
    dietaryFilters: { vegetarian, vegan, glutenFree };
    emailUpdates: boolean;
  };
  stats: { totalVisits, totalFavorites };
  onboarding: { completed, hasSeenDietarySheet, ... };
  isAdmin: boolean;
}
```

### Place
```typescript
interface Place {
  id: string;
  googlePlaceId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  geohash?: string;
  isActive: boolean;
}
```

### Dish
```typescript
interface Dish {
  id: string;
  placeId: string;
  name: string;
  dietary: { vegetarian, vegan, glutenFree };
  isHero: boolean;  // "The Move" - signature dish
  isActive: boolean;
}
```

See [`src/types/models.ts`](src/types/models.ts) for complete type definitions.

---

## 🔐 Security

### Firestore Rules

- **Users:** Can only read/write their own document (except `isAdmin`)
- **Places/Dishes:** Authenticated read, admin-only write
- **Interactions:** Users can only manage their own interactions
- **Waitlist:** Public create, admin-only read

See [`firestore.rules`](firestore.rules) for full rules.

### API Key Security

- Never commit API keys to version control
- Use environment variables for all secrets
- Restrict API keys by referrer in production
- Consider Firebase App Check for additional protection

---

## 🚢 Deployment

### Firebase Hosting

```bash
# Build and deploy
npm run build
firebase deploy --only hosting
```

### GitHub Actions CI/CD

The project includes GitHub Actions workflows for:
- Running tests on PR
- Deploying to Firebase on merge to main

Add these secrets to your repository:
- `FIREBASE_TOKEN` — From `firebase login:ci`
- All `VITE_*` environment variables

---

## 🗺 Roadmap

### Current (MVP)
- [x] Social authentication (Google, Apple, Email)
- [x] Location-based recommendations
- [x] Real-time open/closed status
- [x] Swipe gestures with discovery tutorial
- [x] Save/dismiss/visit interactions
- [x] Dietary filtering
- [x] Sharing with deep links
- [x] Admin place/dish management

### Planned
- [ ] Push notifications (requires Capacitor wrapper)
- [ ] User-submitted places (with admin approval)
- [ ] Photo uploads for places/dishes
- [ ] Achievement badges
- [ ] Expansion beyond Seattle

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Write unit tests for all business logic
- Write E2E tests for user flows
- Follow existing code style and patterns
- Use TypeScript strictly (no `any` without justification)
- Keep components small and focused

---

## 📄 License

This project is private and not currently open for redistribution.

---

## 👨‍🍳 Author

**Michael Natkin**

---

## 🙏 Acknowledgments

- [Vite](https://vitejs.dev/) — Lightning fast build tool
- [Tailwind CSS](https://tailwindcss.com/) — Utility-first CSS
- [Firebase](https://firebase.google.com/) — Backend as a service
- [Playwright](https://playwright.dev/) — E2E testing
- [Vitest](https://vitest.dev/) — Unit testing
