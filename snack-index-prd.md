# Snack Index — Product Requirements Document

**Version:** 1.0  
**Last Updated:** December 27, 2024  
**Author:** Michael Natkin  
**Status:** Ready for Development

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Product Vision](#3-product-vision)
4. [User Personas](#4-user-personas)
5. [Technical Architecture](#5-technical-architecture)
6. [Data Models](#6-data-models)
7. [External APIs](#7-external-apis)
8. [Screen Specifications](#8-screen-specifications)
9. [Feature Specifications](#9-feature-specifications)
10. [Push Notification System](#10-push-notification-system)
11. [Admin System](#11-admin-system)
12. [Analytics Requirements](#12-analytics-requirements)
13. [MVP Development Phases](#13-mvp-development-phases)
14. [Future Features](#14-future-features)
15. [Appendix: Screen Wireframes](#15-appendix-screen-wireframes)

---

## 1. Executive Summary

**Snack Index** is a location-based mobile app that notifies users when they're near an open establishment serving snacks they'd enjoy. The app focuses on food trucks, small restaurants, and non-chain eateries offering quick, takeaway-friendly items.

### Key Value Proposition
- **For snack enthusiasts:** Never miss a great nearby snack again
- **Laser-focused UX:** Open the app, see one recommendation, decide, move on
- **Smart notifications:** Only alerts when something is nearby, open, and matches your preferences

### Business Model
- 1-week free trial
- Subscription (price TBD, managed via App Store/Play Store)

### Initial Scope
- Seattle metro area only
- Admin-curated places and dishes
- Progressive Web App (PWA) with future native app wrapper

---

## 2. Problem Statement

Enthusiastic snackers who love discovering food trucks, hole-in-the-wall restaurants, and unique local eateries face several challenges:

1. **Discovery is hard** — Great snack spots aren't always on mainstream apps or are buried in noise
2. **Timing is everything** — Food trucks move, small places have irregular hours, you miss opportunities
3. **Decision fatigue** — Too many options in apps like Yelp; users want curation, not endless scrolling
4. **No proactive alerts** — Existing apps require you to open them and search; they don't come to you

---

## 3. Product Vision

### Design Principles

1. **Extreme simplicity** — The primary screen shows ONE recommendation. That's it.
2. **Delight in discovery** — Finding a snack should feel like unwrapping a present, not searching a database
3. **Proactive, not reactive** — Push notifications bring snacks to you
4. **Curated quality** — Every place and dish is hand-selected (initially by admin)
5. **Respect user attention** — Max 3 notifications/day, smart frequency limits
6. **Personality throughout** — Copy should be warm and playful, not clinical
7. **Clean, minimalist aesthetic** — Visual design should feel calm and premium

### Core User Flow

```
User is walking around Seattle
        ↓
Push notification: "Marination Station is 0.3mi away and open!"
        ↓
User taps notification → App opens to that place
        ↓
User sees the hero dish, swipes up → Opens Maps
        ↓
User enjoys snack, marks visited → 🎉 Celebration moment
```

---

## 4. User Personas

### Primary Persona: The Adventurous Snacker

- **Demographics:** 25-45, urban, disposable income for casual food spending
- **Behavior:** Walks/bikes around the city, enjoys spontaneous food discoveries
- **Pain points:** Misses great spots because they didn't know they existed or were open
- **Goal:** Effortless discovery of great snacks without research

### Secondary Persona: The Dietary-Conscious Foodie

- Same as above, but with dietary restrictions (vegetarian, vegan, gluten-free)
- Needs filtering to avoid irrelevant recommendations
- Extra value: Knowing which dishes at a place actually work for them

---

## 5. Technical Architecture

### Platform
- **MVP:** Progressive Web App (PWA)
  - Installable on iOS and Android home screens
  - Service worker for offline capability and push notifications
  - Responsive design optimized for mobile
- **Future:** Wrap in Capacitor/similar for App Store distribution, then potentially React Native

### Recommended Tech Stack

| Layer | Recommended Technology | Notes |
|-------|----------------------|-------|
| Frontend | React + TypeScript | Or Vue/Svelte if preferred |
| Styling | Tailwind CSS | Clean, utility-first |
| State Management | Zustand or React Context | Keep it simple |
| Backend | Firebase | Auth, Firestore, Cloud Functions, FCM |
| Hosting | Firebase Hosting | Built-in PWA support |
| Maps/Places | Google Places API | Autocomplete, hours, location data |
| Push Notifications | Firebase Cloud Messaging (FCM) | Cross-platform push |

### Why Firebase?
- Social login (Google, Apple) built-in
- Real-time database perfect for this use case
- Cloud Functions for notification scheduling
- FCM handles push across platforms
- Generous free tier for MVP

---

## 6. Data Models

### 6.1 User

```typescript
interface User {
  id: string;                    // Firebase Auth UID
  email: string;                 // From social login
  displayName: string;           // From social login
  photoURL?: string;             // From social login
  createdAt: Timestamp;
  lastActiveAt: Timestamp;
  
  // Preferences
  preferences: {
    notificationDistance: number;  // In miles, default 0.5
    dietaryFilters: {
      vegetarian: boolean;         // Default false (show all)
      vegan: boolean;
      glutenFree: boolean;
    };
    emailUpdates: boolean;         // Default true
  };
  
  // Subscription
  subscription: {
    status: 'trial' | 'active' | 'expired' | 'cancelled';
    trialStartDate: Timestamp;
    trialEndDate: Timestamp;       // trialStartDate + 7 days
    subscriptionEndDate?: Timestamp;
  };
  
  // Location (updated periodically)
  lastKnownLocation?: {
    latitude: number;
    longitude: number;
    updatedAt: Timestamp;
  };
  
  // Stats (for celebrations and progress)
  stats: {
    totalVisits: number;           // Count of unique places visited
    totalFavorites: number;        // Count of saved places
  };
  
  // Onboarding state
  onboarding: {
    completed: boolean;
    hasSeenDietarySheet: boolean;  // For first-load dietary bottom sheet
    hasSeenSwipeTutorial: boolean; // For first-load swipe gesture tutorial
    hasSeenSwipeNudge: boolean;    // For button-user nudge toast
  };
  
  // Interaction tracking (for swipe discovery)
  interactions: {
    totalSwipes: number;           // Count of swipe gestures used
    totalButtonTaps: number;       // Count of button taps used
  };
  
  // Admin flag
  isAdmin: boolean;               // True only for admin emails
}
```

### 6.2 Place

```typescript
interface Place {
  id: string;                     // Auto-generated
  
  // From Google Places API
  googlePlaceId: string;          // For fetching hours, linking to Maps
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  
  // Admin-provided
  description?: string;           // Optional short description
  imageURL?: string;              // Optional hero image
  
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;              // Admin user ID
  
  // Status
  isActive: boolean;              // Can be disabled without deleting
}
```

### 6.3 Dish

```typescript
interface Dish {
  id: string;                     // Auto-generated
  placeId: string;                // Foreign key to Place
  
  name: string;
  description?: string;           // Optional
  imageURL?: string;              // Optional
  
  // Dietary tags
  dietary: {
    vegetarian: boolean;
    vegan: boolean;
    glutenFree: boolean;
  };
  
  // Hero dish flag
  isHero: boolean;                // "The Move" - signature dish for this place
                                  // Only one dish per place should be marked hero
  
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  
  // Status
  isActive: boolean;
}
```

### 6.4 UserPlaceInteraction

```typescript
interface UserPlaceInteraction {
  id: string;                     // `${userId}_${placeId}`
  userId: string;
  placeId: string;
  
  // Interaction states (all optional, only set when user takes action)
  favorited?: boolean;
  favoritedAt?: Timestamp;
  
  dismissed?: boolean;            // "Never show again"
  dismissedAt?: Timestamp;
  
  visited?: boolean;
  visitedAt?: Timestamp;
  
  // For notification throttling
  lastNotifiedAt?: Timestamp;
  lastShownInAppAt?: Timestamp;
}
```

### 6.5 WaitlistEntry

```typescript
interface WaitlistEntry {
  id: string;
  email: string;
  location?: {                    // Approximate location when they signed up
    latitude: number;
    longitude: number;
    city?: string;
  };
  createdAt: Timestamp;
  notified: boolean;              // Set true when we expand to their area
}
```

### 6.6 NotificationLog

```typescript
interface NotificationLog {
  id: string;
  userId: string;
  placeId: string;
  sentAt: Timestamp;
  
  // For analytics
  opened: boolean;
  openedAt?: Timestamp;
  
  // Context
  distanceAtSend: number;         // Miles
  userLatitude: number;
  userLongitude: number;
}
```

---

## 7. External APIs

### 7.1 Google Places API

**Purpose:** Place autocomplete, hours, location data, Maps links

**Required Endpoints:**

| Endpoint | Use Case |
|----------|----------|
| Place Autocomplete | Admin types place name → get suggestions |
| Place Details | Get address, lat/lng, hours, place_id |
| Place Hours | Real-time open/closed status |

**Implementation Notes:**
- Store `googlePlaceId` with each Place
- Fetch hours in real-time when checking if place is open (they can change)
- Cache hours for ~15 minutes to reduce API calls
- Use Places API "fields" parameter to only request what we need (reduces cost)

**Key Fields to Fetch:**
```
name, formatted_address, geometry, place_id, 
opening_hours, current_opening_hours, business_status
```

**Opening Maps:**
```
https://www.google.com/maps/place/?q=place_id:{googlePlaceId}
```

### 7.2 Firebase Authentication

**Supported Providers:**
- Google Sign-In
- Apple Sign-In

**Implementation Notes:**
- Use Firebase Auth SDK
- On successful auth, create/update User document in Firestore
- Check if email matches admin email → set `isAdmin: true`

### 7.3 Firebase Cloud Messaging (FCM)

**Purpose:** Push notifications

**Implementation Notes:**
- Request notification permission during onboarding
- Store FCM token in User document
- Cloud Function runs periodically (every 5-15 minutes) to check and send notifications
- Track notification delivery in NotificationLog

---

## 8. Screen Specifications

### 8.1 Screen Inventory

| Screen | Type | Access |
|--------|------|--------|
| Welcome | Onboarding | Unauthenticated only |
| Permissions | Onboarding | Post-auth, first launch |
| Home | Core | Authenticated |
| Place Detail | Core | Authenticated |
| Dismiss Modal | Modal | From Home |
| Dietary Preferences Sheet | Bottom Sheet | First Home load (dismissible) |
| Visited Celebration | Modal/Toast | After marking visited |
| Nothing Open | Empty State | Authenticated |
| Not In Area | Empty State | Authenticated |
| My Snacks | Secondary | Authenticated |
| Settings | Secondary | Authenticated |
| Admin Home | Admin | Admin only |
| Add/Edit Place | Admin | Admin only |
| Add/Edit Dish | Admin | Admin only |

### 8.2 Detailed Screen Specifications

---

#### SCREEN: Welcome

**Purpose:** Social login entry point

**Layout:**
- Centered logo/brand mark (consider a playful snack-related icon)
- App name "Snack Index"
- Tagline "Find your next snack"
- "Sign in with Google" button (primary)
- "Sign in with Apple" button (secondary)

**Behavior:**
- On successful auth:
  - If new user → proceed to Permissions screen
  - If returning user with completed onboarding → go to Home
  - If returning user with incomplete onboarding → resume at Permissions

**Technical Notes:**
- Use Firebase Auth UI or custom implementation
- Store onboarding completion state in User document

---

#### SCREEN: Permissions

**Purpose:** Request location and notification permissions in ONE screen

**Design Goal:** Get to the first snack in under 30 seconds. Don't make permissions feel like bureaucracy.

**Layout:**
```
┌─────────────────────────────┐
│                             │
│      To find snacks         │
│      near you, we need      │
│      a couple things...     │
│                             │
│  ┌───────────────────────┐  │
│  │  📍 Your location     │  │
│  │  So we know what's    │  │
│  │  nearby               │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │  🔔 Notifications     │  │
│  │  So we can tell you   │  │
│  │  when you're close    │  │
│  └───────────────────────┘  │
│                             │
│      [ Let's Go ]           │
│                             │
└─────────────────────────────┘
```

**Behavior:**
- Single "Let's Go" button triggers both permission requests sequentially:
  1. First, location permission prompt appears
  2. On location allow/deny, notification permission prompt appears
  3. Proceed to Home regardless of outcomes
- If location denied → show inline message explaining the app needs it, with "Try Again" option
- If notifications denied → proceed anyway (user can enable later)
- On completion → go directly to Home (dietary prefs come later)

**Technical Notes:**
- Store permission states in User document
- If location denied, app is essentially unusable — persist in asking or show limited mode

---

#### BOTTOM SHEET: Dietary Preferences

**Purpose:** Set dietary filters (shown on first Home load, not during onboarding)

**Design Goal:** Don't block the user from seeing their first snack. This is optional.

**Trigger:** First time Home screen loads after onboarding

**Layout:**
```
┌─────────────────────────────┐
│  ─────                      │  ← Drag handle
│                             │
│  What can you eat?          │
│                             │
│  ☐ Vegetarian only          │
│  ☐ Vegan only               │
│  ☐ Gluten-free only         │
│                             │
│  Leave unchecked to see     │
│  everything                 │
│                             │
│  [ Got It ]                 │
│                             │
└─────────────────────────────┘
```

**Behavior:**
- Appears as dismissible bottom sheet over the Home screen
- User can see their first recommendation behind the sheet (teaser)
- All unchecked by default = show all
- Tap "Got It" or drag down to dismiss
- Can be accessed later in Settings
- If dismissed without selection, defaults to "show all"

**Technical Notes:**
- Track `hasSeenDietarySheet` in User document
- Only show once

---

#### SCREEN: Home

**Purpose:** Primary recommendation screen — THE core experience

**Design Goal:** This should feel like unwrapping a present, not browsing a list.

**Layout:**
```
┌─────────────────────────────┐
│                             │
│  ┌───────────────────────┐  │
│  │                       │  │
│  │    [Hero Image or     │  │
│  │     Gradient Card]    │  │
│  │                       │  │
│  │   Marination Station  │  │
│  │   0.3 mi · Open til 9p│  │
│  │                       │  │
│  │   ⭐ THE MOVE:        │  │
│  │   Kalbi Tacos         │  │
│  │                       │  │
│  │   ┌─────────────────┐ │  │
│  │   │  Get Directions │ │  │  ← Primary action ON the card
│  │   └─────────────────┘ │  │
│  │                       │  │
│  └───────────────────────┘  │
│                             │
│       ❤️        👎          │  ← Secondary actions (smaller)
│     Save     Not for me     │
│                             │
│  ────────────────────────── │
│     ●      ♡      ⚙        │
└─────────────────────────────┘

Swipe gestures:
  ← Swipe left = "Not now" (next recommendation)
  → Swipe right = Save (favorite)
  ↑ Swipe up = "I'm going!" (marks visited + opens Maps)
```

**Loading State ("The Reveal"):**
- On load, show: "Finding your snack..." with a subtle snack emoji animation (e.g., 🍜 that wiggles)
- Brief delay (300-500ms minimum, even if data loads faster) to build anticipation
- Then *reveal* the card with a gentle scale-up + fade-in animation
- Card should feel like an answer appearing, not a result loading

**Swipe Gesture Discovery:**

Users won't know they can swipe unless we teach them. Use a layered approach:

1. **First-Launch Tutorial Overlay** (shows once, after dietary sheet dismisses)
   ```
   ┌─────────────────────────────┐
   │                             │
   │  ┌───────────────────────┐  │
   │  │                       │  │
   │  │     [Card behind]     │  │
   │  │                       │  │
   │  └───────────────────────┘  │
   │                             │
   │    👆                       │
   │   ╱                         │
   │  ← Skip    Save →    ↑ Go!  │
   │                             │
   │     Swipe to explore        │
   │                             │
   │        (tap to start)       │
   └─────────────────────────────┘
   ```
   - Semi-transparent overlay with animated hand showing swipe directions
   - Ghost-hand animates: left, right, up in sequence
   - Auto-dismisses after 3 seconds OR tap anywhere
   - Track `hasSeenSwipeTutorial` in User document

2. **Card Wobble** (every load)
   - On reveal, card has a very subtle horizontal wobble (±3px, 0.3s)
   - Creates subconscious expectation that it's moveable
   - Stops after animation completes

3. **Button-User Nudge** (one-time)
   - If user taps buttons 5+ times without ever swiping
   - Show toast: "Pro tip: Swipe the card! ← → ↑"
   - Track `hasSeenSwipeNudge` in User document
   - Never show again after this

**Elements:**

1. **Recommendation Card**
   - Hero image (if available) or gradient background
   - Place name (bold)
   - Distance + open status (e.g., "0.3 mi · Open until 9pm")
   - **Hero dish callout:** "⭐ THE MOVE: {dish name}" — the signature snack
   - If no hero dish designated, show: "{dish name} + {N} more"
   - "Get Directions" button prominently on the card (primary action)
   - Entire card (except button) is tappable → goes to Place Detail

2. **Swipe Gestures** (primary interaction)
   - **Swipe left:** "Not now" — shows next recommendation (no data saved)
   - **Swipe right:** Save — adds to favorites, shows brief heart animation, then next
   - **Swipe up:** "I'm going!" — marks as visited, triggers celebration, opens Maps
   - Subtle visual hints on swipe (color tint, icon preview)

3. **Secondary Action Buttons** (below card, smaller)
   - ❤️ "Save" — same as swipe right
   - 👎 "Not for me" — opens Dismiss Modal
   - These are for users who don't discover swiping

4. **Bottom Navigation** (3 items)
   - Home (dot/radar icon) — current
   - My Snacks (heart icon) — was "Favorites"
   - Settings (gear icon)

**Behavior:**
- On load, fetch user's current location
- Show loading state with anticipation-building animation
- Query for nearest open place with at least one dish matching user's dietary filters
- Exclude places where user has `dismissed: true`
- Reveal card with animation
- Swipe/tap interactions as described above
- "Get Directions" → opens Google Maps AND marks as visited AND triggers celebration

**Algorithm for "Nearest Open Place":**
```
1. Get user's current location
2. Get user's dietary filters
3. Query all places within 5 miles
4. For each place:
   a. Check if user has dismissed it → skip if true
   b. Check if open right now (Google Places API) → skip if closed
   c. Check if has at least one active dish matching dietary filters → skip if not
   d. Calculate distance from user
5. Sort by distance ascending
6. Return first result (and cache next N for swipe-left queue)
```

**Edge Cases:**
- No places within 5 miles → show "Not In Area" empty state
- Places exist but none open → show "Nothing Open" empty state
- User has dismissed all nearby places → treat as "Nothing Open"
- User swipes through all available places → show "You've seen everything nearby! Check back later."

---

#### SCREEN: Place Detail

**Purpose:** Full details and dish list for a place

**Layout:**
```
┌─────────────────────────────┐
│  [←]                   [↗️]  │  ← Back + Share
│                             │
│  ┌───────────────────────┐  │
│  │    [Hero Image]       │  │
│  └───────────────────────┘  │
│                             │
│  Marination Station         │
│  0.3 mi · Capitol Hill      │
│  Open until 9pm             │
│                             │
│  ⭐ THE MOVE                 │
│  ┌───────────────────────┐  │
│  │ [img] Kalbi Tacos     │  │  ← Hero dish (larger)
│  │       The signature   │  │
│  │       GF              │  │
│  └───────────────────────┘  │
│                             │
│  Also good                  │
│  ┌───────────────────────┐  │
│  │ [img] Spam Sliders    │  │  ← Other dishes (smaller)
│  ├───────────────────────┤  │
│  │ [img] Tofu Tacos      │  │
│  │       VEG  V          │  │
│  └───────────────────────┘  │
│                             │
│  [ Get Directions ]         │
│                             │
└─────────────────────────────┘
```

**Elements:**

1. **Header**
   - Back button — returns to Home (or My Snacks if came from there)
   - Share button — triggers native share sheet

2. **Hero Image** — Place image if available, otherwise gradient or placeholder

3. **Place Info**
   - Name (large, bold)
   - Distance + neighborhood (if available from Google)
   - Open status with closing time

4. **Hero Dish Section** (if designated)
   - Section header: "⭐ THE MOVE" 
   - Hero dish displayed larger/more prominently
   - Shows: thumbnail, name, description (if any), dietary tags
   - If no hero dish designated, skip this section

5. **Other Dishes Section**
   - Section header: "Also good" (or just no header if only 1-2 dishes)
   - Scrollable list of remaining dishes
   - Each shows: thumbnail (smaller), name, dietary tags
   - Only show dishes matching user's dietary filters (or all if no filters)

6. **Get Directions Button** (primary, sticky at bottom)
   - Opens Google Maps to this place
   - Also marks as visited and triggers celebration

**Behavior:**
- Back → return to previous screen
- Share → generate share link (see Sharing spec)
- Get Directions → mark visited + celebration + open Maps
- Dish tap → could expand to show full description (optional for MVP)

---

#### MODAL: Dismiss Modal

**Purpose:** Clarify dismiss intent

**Layout:**
```
┌─────────────────────────────┐
│                             │
│  Not your thing?            │
│  {Place Name}               │
│                             │
│  [ Never show this place ]  │
│                             │
│  [ Just not today ]         │
│                             │
│  Cancel                     │
│                             │
└─────────────────────────────┘
```

**Behavior:**
- "Never show this place" → set `dismissed: true` in UserPlaceInteraction, close modal, show next recommendation
- "Just not today" → close modal, show next recommendation (no data change)
- "Cancel" → close modal, stay on current recommendation

**Technical Notes:**
- Implement as bottom sheet or centered modal
- "Never show" is permanent (no UI to undo in MVP, but data exists to enable this later)

---

#### MODAL: Visited Celebration

**Purpose:** Celebrate when user marks a place as visited — small moment of delight

**Trigger:** 
- User swipes up on Home card
- User taps "Get Directions" (anywhere)
- User manually marks visited

**Layout:**
```
┌─────────────────────────────┐
│                             │
│           🎉                │
│                             │
│        Nice!                │
│                             │
│   That's your 5th spot!     │  ← Dynamic count
│                             │
│      [ Enjoy! ]             │
│                             │
└─────────────────────────────┘
```

**Animation:**
- Brief confetti burst (subtle, not over the top — think 0.5 seconds)
- Modal scales up with a bounce
- Auto-dismisses after 2 seconds OR tap "Enjoy!" OR tap outside

**Behavior:**
- Show visit count: "That's your Nth spot!" 
- If first visit ever: "Your first snack spot! 🎉"
- If milestone (10, 25, 50, 100): Slightly bigger celebration
- After dismissal → proceed to Maps (if triggered by Get Directions)

**Technical Notes:**
- Count stored in User document: `totalVisits: number`
- Keep celebration brief — don't block the user from getting to their snack

---

#### SCREEN: Nothing Open (Empty State)

**Purpose:** Shown when places exist but none are currently open

**Design Goal:** Don't dead-end the user. Give them something to do.

**Layout:**
```
┌─────────────────────────────┐
│                             │
│           😴                │
│                             │
│   Everything's closed       │
│   right now                 │
│                             │
│   ┌───────────────────────┐ │
│   │  Next to open:        │ │
│   │  Marination Station   │ │
│   │  Opens in 47 min      │ │  ← Countdown
│   │                       │ │
│   │  [ Remind Me ]        │ │
│   └───────────────────────┘ │
│                             │
│  ────────────────────────── │
│     ●      ♡      ⚙        │
└─────────────────────────────┘
```

**Elements:**
- Sleeping emoji or moon icon
- Headline: "Everything's closed right now"
- **Next to open card:** Shows the place opening soonest
  - Place name
  - Live countdown: "Opens in X min" or "Opens at 11:00 AM"
  - "Remind Me" button → sets a local notification for opening time
- If nothing opens within 4 hours, show: "Check back tomorrow" instead

**Behavior:**
- Countdown updates in real-time (every minute)
- "Remind Me" → schedules local notification, button changes to "Reminder Set ✓"
- Pull to refresh re-checks all places
- User can still navigate to My Snacks or Settings

**Technical Notes:**
- Query for place with earliest opening time
- Calculate time until open from Google Places hours

---

#### SCREEN: Not In Area (Empty State)

**Purpose:** Shown when user is outside Seattle coverage area

**Design Goal:** Show them what they're missing. Create desire.

**Layout:**
```
┌─────────────────────────────┐
│                             │
│           🗺️                │
│                             │
│   We're not in your         │
│   area yet                  │
│                             │
│   We've got 23 snack spots  │
│   in Seattle so far...      │
│                             │
│  ┌─────┐ ┌─────┐ ┌─────┐   │
│  │     │ │     │ │     │   │  ← Preview carousel
│  │ 🌮  │ │ 🍜  │ │ 🥟  │   │    (non-interactive)
│  │     │ │     │ │     │   │
│  └─────┘ └─────┘ └─────┘   │
│   Tacos   Ramen  Dumplings  │
│                             │
│  ┌───────────────────────┐  │
│  │ Enter email...        │  │
│  └───────────────────────┘  │
│  [ Tell me when you launch ]│
│                             │
│  ────────────────────────── │
│     ●      ♡      ⚙        │
└─────────────────────────────┘
```

**Elements:**
- Map emoji or location icon
- Headline: "We're not in your area yet"
- Subhead: "We've got {N} snack spots in Seattle so far..."
- **Preview carousel:** Non-interactive horizontal scroll showing 5-6 place cards
  - Each card shows: image/gradient, place name, hero dish name
  - Slightly desaturated or with overlay to indicate "not available to you"
  - Auto-scrolls slowly to show variety
- Email input field
- "Tell me when you launch" button

**Behavior:**
- User enters email → create WaitlistEntry document
- Show confirmation: "You're on the list! We'll let you know."
- Preview carousel creates FOMO and shows the app has real content
- User can still access Settings (to sign out, etc.)

**Technical Notes:**
- Store approximate location with waitlist entry for expansion planning
- Pull a random sample of 5-6 places for preview (can be cached)

---

#### SCREEN: My Snacks (formerly Favorites)

**Purpose:** View saved and visited places, with actionable features

**Design Goal:** Make this a living collection, not a dead list.

**Layout:**
```
┌─────────────────────────────┐
│                             │
│  My Snacks                  │
│                             │
│  You've been to 12 of 47    │  ← Progress indicator
│  spots 🎯                   │
│                             │
│  [Saved] [Visited]          │  ← Tab selector
│                             │
│  [ 🎲 Surprise Me ]         │  ← Random open favorite
│                             │
│  ┌───────────────────────┐  │
│  │ [img] Marination      │  │
│  │       Capitol Hill    │  │
│  │       Last visit: 2w  │  │  ← Time since visit
│  ├───────────────────────┤  │
│  │ [img] Off the Rez     │  │
│  │       Various         │  │
│  │       Not visited yet │  │
│  └───────────────────────┘  │
│                             │
│  ────────────────────────── │
│     ○      ●      ○        │
└─────────────────────────────┘
```

**Elements:**

1. **Header:** "My Snacks"

2. **Progress Indicator**
   - "You've been to {visited} of {total} spots 🎯"
   - Only shows if user has visited at least 1 place
   - Creates lightweight collection/completionist motivation

3. **Tab Selector** — "Saved" and "Visited" tabs

4. **Surprise Me Button**
   - "🎲 Surprise Me" — picks a random favorite that's currently **open**
   - If no favorites are open, button is disabled with tooltip: "None of your saves are open right now"
   - Tapping it takes user directly to that place's detail screen

5. **Place List** — Shows places matching selected tab
   - Each card shows:
     - Thumbnail image
     - Place name
     - Neighborhood
     - **Context line:** 
       - For Saved tab: "Not visited yet" or "Last visit: 2 weeks ago"
       - For Visited tab: "Visited 3 times" or "Last visit: 2 weeks ago"
   - Swipe left on card to remove from list (with undo toast)

6. **Bottom Navigation** — My Snacks tab highlighted

**Behavior:**
- Tabs filter the list
- Tap place → Place Detail
- Surprise Me → navigates to random open favorite
- If list empty:
  - Saved tab: "No saves yet. Swipe right on snacks you want to remember!"
  - Visited tab: "No visits yet. Get out there and snack!"

**Technical Notes:**
- Query UserPlaceInteraction where userId == current user AND favorited == true (or visited == true)
- Join with Place data
- "Last visit" calculated from `visitedAt` timestamp
- For "Surprise Me": query favorites, filter to open ones, pick random

---

#### SCREEN: Settings

**Purpose:** User preferences and account management

**Design Goal:** Even settings should have personality.

**Layout:**
```
┌─────────────────────────────┐
│                             │
│  Settings                   │
│                             │
│  HOW FAR WILL YOU GO?       │
│  ┌───────────────────────┐  │
│  │ Tell me when I'm      │  │
│  │ within...             │  │
│  │ [0.5 miles      ▼]   │  │
│  └───────────────────────┘  │
│                             │
│  WHAT CAN YOU EAT?          │
│  ┌───────────────────────┐  │
│  │ ☑ Vegetarian only     │  │
│  │ ☐ Vegan only          │  │
│  │ ☐ Gluten-free only    │  │
│  └───────────────────────┘  │
│                             │
│  KEEP IN TOUCH              │
│  ┌───────────────────────┐  │
│  │ Email updates    [ON] │  │
│  └───────────────────────┘  │
│                             │
│  ACCOUNT                    │
│  ┌───────────────────────┐  │
│  │ Manage Subscription → │  │
│  │ Sign Out →            │  │
│  └───────────────────────┘  │
│                             │
│  ────────────────────────── │
│     ○      ○      ●        │
└─────────────────────────────┘
```

**Elements:**

1. **Distance Setting**
   - Section header: "HOW FAR WILL YOU GO?"
   - Label: "Tell me when I'm within..."
   - Dropdown/picker: 0.25, 0.5, 1, 2 miles
   - Default: 0.5 miles

2. **Dietary Preferences**
   - Section header: "WHAT CAN YOU EAT?"
   - Same checkboxes as onboarding sheet
   - Changes take effect immediately

3. **Communication**
   - Section header: "KEEP IN TOUCH"
   - Email updates toggle

4. **Account Section**
   - "Manage Subscription" → links to App Store/Play Store subscription management
   - "Sign Out" → signs out, returns to Welcome screen

5. **Admin Button** (conditional)
   - Only visible if user.isAdmin == true
   - "Admin Dashboard →"

**Behavior:**
- All changes save automatically (no save button needed)
- Sign out clears local state, FCM token

---

#### SCREEN: Admin Home

**Purpose:** Admin dashboard for managing places and dishes

**Access:** Only visible to users where `isAdmin == true`

**Layout:**
```
┌─────────────────────────────┐
│  [←]              Admin     │
│                             │
│  [ + Add Place ]            │
│                             │
│  Search places...           │
│                             │
│  ┌───────────────────────┐  │
│  │ Marination Station    │  │
│  │ 3 dishes · Active     │  │
│  ├───────────────────────┤  │
│  │ Off the Rez           │  │
│  │ 2 dishes · Active     │  │
│  ├───────────────────────┤  │
│  │ Tacos Chukis          │  │
│  │ 4 dishes · Inactive   │  │
│  └───────────────────────┘  │
│                             │
└─────────────────────────────┘
```

**Elements:**
1. **Add Place Button** (primary)
2. **Search Field** — filter places by name
3. **Place List** — all places, showing name, dish count, active status

**Behavior:**
- Add Place → Add/Edit Place screen (empty)
- Tap place → Add/Edit Place screen (populated)
- Search filters list in real-time

---

#### SCREEN: Add/Edit Place

**Purpose:** Admin creates or edits a place

**Layout:**
```
┌─────────────────────────────┐
│  [←]    Add Place    [Save] │
│                             │
│  PLACE                      │
│  ┌───────────────────────┐  │
│  │ 🔍 Search place...    │  │
│  └───────────────────────┘  │
│  ↳ Google Places results    │
│                             │
│  Name: Marination Station   │
│  Address: 1412 Harvard Ave  │
│  (auto-filled from Google)  │
│                             │
│  [ + Add Image ]            │
│                             │
│  DISHES                     │
│  ┌───────────────────────┐  │
│  │ Kalbi Tacos      [✎]  │  │
│  │ GF                    │  │
│  ├───────────────────────┤  │
│  │ Spam Sliders     [✎]  │  │
│  └───────────────────────┘  │
│                             │
│  [ + Add Dish ]             │
│                             │
│  ┌───────────────────────┐  │
│  │ ☑ Active              │  │
│  └───────────────────────┘  │
│                             │
└─────────────────────────────┘
```

**Elements:**

1. **Place Search** (for new places)
   - Google Places Autocomplete
   - On selection, auto-fill name, address, lat/lng, googlePlaceId
   - Hidden for existing places (show static info instead)

2. **Auto-filled Place Info**
   - Name, Address (read-only, from Google)

3. **Add Image Button**
   - Upload hero image for place (optional)

4. **Dish List**
   - Shows all dishes for this place
   - Edit icon on each → Add/Edit Dish screen
   - Swipe to delete (with confirmation)

5. **Add Dish Button**
   - → Add/Edit Dish screen (empty)

6. **Active Toggle**
   - Inactive places won't appear in recommendations

7. **Save Button**
   - Validates: must have googlePlaceId, at least one dish
   - Saves and returns to Admin Home

---

#### SCREEN: Add/Edit Dish

**Purpose:** Admin creates or edits a dish

**Layout:**
```
┌─────────────────────────────┐
│  [←]    Add Dish     [Save] │
│                             │
│  DISH NAME                  │
│  ┌───────────────────────┐  │
│  │ Kalbi Tacos           │  │
│  └───────────────────────┘  │
│                             │
│  DESCRIPTION (optional)     │
│  ┌───────────────────────┐  │
│  │ Korean-style short    │  │
│  │ rib tacos with...     │  │
│  └───────────────────────┘  │
│                             │
│  ⭐ THE MOVE                 │
│  ┌───────────────────────┐  │
│  │ This is the signature │  │
│  │ dish         [TOGGLE] │  │
│  └───────────────────────┘  │
│                             │
│  DIETARY TAGS               │
│  ┌───────────────────────┐  │
│  │ ☐ Vegetarian          │  │
│  │ ☐ Vegan               │  │
│  │ ☑ Gluten-free         │  │
│  └───────────────────────┘  │
│                             │
│  PHOTO                      │
│  [ + Add Photo ]            │
│                             │
│  ┌───────────────────────┐  │
│  │ ☑ Active              │  │
│  └───────────────────────┘  │
│                             │
│  [ Delete Dish ]            │
│                             │
└─────────────────────────────┘
```

**Elements:**

1. **Dish Name** (required)
2. **Description** (optional, multiline)
3. **Hero Dish Toggle** — "⭐ THE MOVE: This is the signature dish"
   - Only one dish per place can be the hero
   - If toggled on, automatically toggles off any other hero dish for this place
4. **Dietary Tags** (checkboxes)
5. **Photo Upload** (optional)
6. **Active Toggle**
7. **Delete Button** (for existing dishes, with confirmation)
8. **Save Button** — validates name is not empty

**Technical Notes:**
- When saving with `isHero: true`, update any other dish at this place to `isHero: false`

---

## 9. Feature Specifications

### 9.1 Social Login

**Supported Providers:**
- Google
- Apple (required for iOS App Store)

**Flow:**
1. User taps provider button
2. OAuth flow opens (popup or redirect)
3. On success, Firebase creates/returns user
4. App checks if User document exists in Firestore
   - If not, create with default values
   - If yes, update `lastActiveAt`
5. Check if email matches admin email → set `isAdmin: true`

**Admin Email:** `michaelnatkin@gmail.com`

### 9.2 Location Tracking

**Permissions:**
- Request on first launch during onboarding
- Required for core functionality

**Background Location:**
- For PWA: limited capability, primarily foreground
- For future native: request "always" permission for background notifications

**Location Updates:**
- Update user's `lastKnownLocation` when app is opened
- For push notifications, Cloud Function will use last known location

### 9.3 Sharing

**Share a Place:**
- URL format: `https://snackindex.app/place/{placeId}`
- Share text: "Check out {Place Name} on Snack Index!"
- Uses Web Share API (native share sheet on mobile)

**Share a Dish:**
- URL format: `https://snackindex.app/place/{placeId}/dish/{dishId}`
- Share text: "Try the {Dish Name} at {Place Name}!"

**Deep Link Handling:**
- If user has app installed → open directly to that place/dish
- If not → show web preview with "Get the app" prompt

### 9.4 Subscription Management

**Trial:**
- 7 days from account creation
- Full access during trial
- Store `trialStartDate` and `trialEndDate` in User document

**Post-Trial:**
- Check subscription status on app open
- If expired, show paywall modal
- Link to App Store/Play Store for subscription

**MVP Approach:**
- For PWA, subscription can be honor-system or use a service like Stripe
- For app store versions, use native in-app purchase

**Paywall Modal:**
- Headline: "Your trial has ended"
- Body: "Subscribe to keep finding great snacks"
- Button: "Subscribe" → external subscription link
- Secondary: "Restore Purchase"

---

## 10. Push Notification System

### 10.1 Overview

**Important:** True background notifications require the native Capacitor wrapper (Phase 8). The PWA can only show notifications when the app is in the foreground.

Once wrapped in Capacitor, the app uses **local notifications** triggered by background location changes—NOT server-pushed notifications. This is more reliable and doesn't require a server component.

**How it works:**
1. iOS/Android monitors for Significant Location Changes (~500m movement)
2. OS wakes the app briefly when location changes
3. App checks for nearby open places matching user preferences
4. If match found, app fires a local notification
5. User taps notification → app opens to that place

### 10.2 Notification Rules

| Rule | Implementation |
|------|----------------|
| Max 3 notifications per day per user | Count notifications sent today (stored locally) |
| Max 1 notification per place per day per user | Track place IDs notified today (stored locally) |
| Only when place is open | Check Google Places API (with cache) |
| Only when within distance threshold | Calculate distance from current location |
| Only when matching dish exists | Filter dishes by user's dietary preferences |
| Only if user has valid subscription | Check subscription status |

### 10.3 Notification Content

**Title:** "{Place Name}"
**Body:** "Open now, {distance} away"

Example:
- Title: "Marination Station"
- Body: "Open now, 0.3 mi away"

### 10.4 Notification Tap Behavior

- Deep link to Place Detail screen for that place
- Works whether app is in foreground, background, or terminated

### 10.5 Local Storage for Throttling

Store notification history locally (not in Firestore) for performance:

```typescript
interface NotificationHistory {
  date: string;  // YYYY-MM-DD
  count: number;
  placeIds: string[];
}

// Check before sending
function canNotify(placeId: string): boolean {
  const today = getTodayString();
  const history = getNotificationHistory(today);
  
  if (history.count >= 3) return false;
  if (history.placeIds.includes(placeId)) return false;
  
  return true;
}

// Record after sending
function recordNotification(placeId: string): void {
  const today = getTodayString();
  const history = getNotificationHistory(today);
  
  history.count++;
  history.placeIds.push(placeId);
  
  saveNotificationHistory(today, history);
}
```

### 10.6 Pseudocode for Background Location Handler

```typescript
async function onLocationUpdate(latitude: number, longitude: number) {
  // Skip if subscription expired
  const user = await getUser();
  if (!isSubscriptionValid(user)) return;
  
  // Get user preferences
  const { notificationDistance, dietaryFilters } = user.preferences;
  
  // Find nearby places
  const places = await getPlacesWithinDistance(
    { latitude, longitude },
    notificationDistance
  );
  
  for (const place of places) {
    // Check notification throttling
    if (!canNotify(place.id)) continue;
    
    // Check if user has dismissed this place
    if (await isPlaceDismissed(user.id, place.id)) continue;
    
    // Check if open (with 15-min cache)
    const isOpen = await checkIfOpen(place.googlePlaceId);
    if (!isOpen) continue;
    
    // Check for matching dishes
    const matchingDishes = getMatchingDishes(place.dishes, dietaryFilters);
    if (matchingDishes.length === 0) continue;
    
    // Send local notification
    await LocalNotifications.schedule({
      notifications: [{
        title: place.name,
        body: `Open now, ${formatDistance(place.distance)} away`,
        id: Date.now(),
        extra: { placeId: place.id }
      }]
    });
    
    // Record notification
    recordNotification(place.id);
    
    // Log for analytics (can sync to server later)
    await logNotification(user.id, place.id, place.distance);
    
    // Only one notification per location update
    break;
  }
}
```

### 10.7 iOS-Specific Considerations

- **Significant Location Changes:** iOS decides when to wake the app (~500m movement, but varies)
- **"Always" Permission Required:** User must grant "Always Allow" for background updates
- **Permission Flow:** iOS 13+ shows "When In Use" first, then prompts for "Always" upgrade
- **Low Power Mode:** May reduce or stop background location updates
- **Blue Status Bar:** Will appear when app is using location in background

---

## 11. Admin System

### 11.1 Access Control

- Admin access determined by `isAdmin` flag on User document
- Set to `true` only for email: `michaelnatkin@gmail.com`
- Admin button only visible in Settings if `isAdmin == true`

### 11.2 Admin Capabilities

| Capability | Description |
|------------|-------------|
| Add Place | Search Google Places, select, save to Firestore |
| Edit Place | Modify any place details |
| Deactivate Place | Set `isActive: false` (soft delete) |
| Delete Place | Hard delete (with confirmation) |
| Add Dish | Create dish under a place |
| Edit Dish | Modify dish details |
| Delete Dish | Remove dish (with confirmation) |
| Upload Images | Add photos to places and dishes |

### 11.3 Google Places Autocomplete Integration

**Flow:**
1. Admin starts typing place name
2. Call Google Places Autocomplete API
3. Show dropdown of matching places
4. Admin selects one
5. Call Google Places Details API for full info
6. Auto-populate: name, address, lat/lng, googlePlaceId

**API Calls:**
```javascript
// Autocomplete
const predictions = await placesAutocomplete(query, {
  types: ['establishment'],
  location: seattleCenter,  // Bias to Seattle
  radius: 50000             // 50km
});

// Details
const details = await placesDetails(placeId, {
  fields: ['name', 'formatted_address', 'geometry', 'place_id']
});
```

---

## 12. Analytics Requirements

### 12.1 Events to Track

**User Lifecycle:**
| Event | Properties |
|-------|------------|
| `user_signup` | auth_provider, timestamp |
| `onboarding_complete` | dietary_filters_set |
| `trial_started` | timestamp |
| `trial_ended` | converted (boolean) |
| `subscription_started` | timestamp |
| `subscription_cancelled` | timestamp |

**Core Engagement:**
| Event | Properties |
|-------|------------|
| `app_opened` | source (direct, notification, share_link) |
| `place_viewed` | place_id, distance, from_screen |
| `place_favorited` | place_id |
| `place_dismissed` | place_id, dismiss_type (never, not_now) |
| `place_visited` | place_id |
| `place_shared` | place_id, share_method |
| `next_tapped` | from_place_id, to_place_id |
| `maps_opened` | place_id |

**Notifications:**
| Event | Properties |
|-------|------------|
| `notification_sent` | user_id, place_id, distance |
| `notification_opened` | user_id, place_id, latency_seconds |
| `notification_dismissed` | user_id, place_id |

**Admin:**
| Event | Properties |
|-------|------------|
| `admin_place_added` | place_id |
| `admin_dish_added` | place_id, dish_id |

### 12.2 Key Metrics to Monitor

- **DAU / WAU / MAU** — Active users
- **Notification → Open rate** — Are notifications working?
- **Open → Maps rate** — Are people actually going?
- **Trial → Paid conversion** — Business health
- **Places per user per week** — Engagement depth
- **Dismiss rate** — Content quality signal

### 12.3 Recommended Tools

- **Firebase Analytics** (free, integrated with Firebase)
- **Mixpanel** or **Amplitude** (if more advanced funnels needed later)

---

## 13. MVP Development Phases

The MVP is broken into 7 phases, each representing approximately 1 day of work for a skilled developer. Each phase results in a testable, demonstrable increment.

### ⚠️ CRITICAL: Development Process Requirements

**Every phase MUST follow this process:**

1. **Implement** — Write the code for the phase
2. **Unit Test** — Write unit tests for all business logic, utilities, and components
3. **E2E Test** — Write end-to-end tests for all user flows introduced in the phase
4. **Manual QA** — Test on real devices (iOS Safari, Android Chrome, desktop)
5. **Code Review** — Self-review or peer review if available
6. **Commit & Push** — Commit with clear message, push to GitHub
7. **Verify CI** — Ensure all tests pass in CI before proceeding

**DO NOT proceed to the next phase until:**
- [ ] All unit tests pass
- [ ] All E2E tests pass
- [ ] Code is committed and pushed to GitHub
- [ ] CI pipeline is green

### Testing Stack (Recommended)

| Type | Tool | Purpose |
|------|------|---------|
| Unit Tests | Vitest | Fast, Vite-native unit testing |
| Component Tests | React Testing Library | Component behavior testing |
| E2E Tests | Playwright | Cross-browser E2E testing |
| Mobile E2E | Playwright + Device Emulation | Mobile viewport testing |
| CI/CD | GitHub Actions | Automated test runs on push |

### Test Coverage Expectations

| Category | Minimum Coverage |
|----------|-----------------|
| Utility functions | 100% |
| Business logic (algorithms, filtering) | 100% |
| React components | 80% |
| API integrations | Mock + integration tests |
| User flows (E2E) | All critical paths |

---

### Phase 1: Project Setup & Authentication (Day 1)

**Goal:** Skeleton app with working social login

**Tasks:**
1. Initialize project (React + TypeScript + Vite recommended)
2. Set up Tailwind CSS
3. Configure as PWA (manifest.json, service worker basics)
4. Set up Firebase project
   - Enable Authentication (Google, Apple providers)
   - Create Firestore database
   - Set up Firebase Hosting
5. Create Welcome screen with Google Sign-In
6. Implement auth flow and store user in Firestore
7. Create basic routing (react-router or similar)
8. **Set up testing infrastructure (Vitest, React Testing Library, Playwright)**
9. **Set up GitHub repo with CI/CD (GitHub Actions)**
10. Deploy to Firebase Hosting

**Deliverable:** User can sign in with Google and see a "Hello, {name}" screen

**Required Tests:**

| Test Type | What to Test |
|-----------|--------------|
| Unit | Firebase auth helper functions |
| Unit | User document creation logic |
| Component | Welcome screen renders correctly |
| Component | Auth button states (loading, error) |
| E2E | Full sign-in flow (use Firebase Auth emulator) |
| E2E | Returning user auto-redirect |

**Exit Criteria:**
- [ ] All tests pass locally
- [ ] CI pipeline configured and green
- [ ] PWA installable on phone
- [ ] Google sign-in works
- [ ] User document created in Firestore
- [ ] Returning user recognized
- [ ] Code committed and pushed to GitHub

---

### Phase 2: Onboarding Flow (Day 2)

**Goal:** Streamlined 2-screen onboarding that gets users to their first snack fast

**Tasks:**
1. Create Permissions screen
   - Combined location + notification permission request
   - Single "Let's Go" button triggers both sequentially
   - Handle denial states gracefully
2. Implement Geolocation API request
   - Store location in user document
3. Set up Firebase Cloud Messaging
   - Store FCM token in user document
4. Create Dietary Preferences bottom sheet
   - Triggered on first Home screen load
   - Dismissible, defaults to "show all"
   - Track `hasSeenDietarySheet` in user document
5. Implement onboarding state tracking
   - Track completion in user document
   - Route returning users appropriately
6. Add bottom navigation component (Home, My Snacks, Settings)

**Deliverable:** New user completes onboarding in 2 screens, sees first snack within 30 seconds

**Required Tests:**

| Test Type | What to Test |
|-----------|--------------|
| Unit | Permission state machine logic |
| Unit | Preference storage/retrieval |
| Component | Permissions screen renders correctly |
| Component | Dietary bottom sheet behavior |
| Component | Bottom navigation active states |
| E2E | Complete onboarding flow (new user) |
| E2E | Skip onboarding (returning user) |
| E2E | Location denial handling |
| E2E | Notification denial (should still proceed) |
| E2E | Dietary sheet appears on first Home load |
| E2E | Dietary sheet doesn't reappear after dismissal |

**Exit Criteria:**
- [ ] All unit tests pass
- [ ] All E2E tests pass
- [ ] User reaches Home in ≤2 screens after sign-in
- [ ] Location permission requested and stored
- [ ] Notification permission requested and token stored
- [ ] Dietary sheet shows on first Home load
- [ ] Dietary preferences saved
- [ ] Onboarding only shows once
- [ ] Code committed and pushed to GitHub
- [ ] CI pipeline green

---

### Phase 3: Data Models & Admin Foundation (Day 3)

**Goal:** Admin can add places and dishes with hero dish designation

**Tasks:**
1. Set up Firestore security rules
2. Implement admin check (isAdmin flag)
3. Create Admin Home screen
4. Create Add/Edit Place screen
   - Integrate Google Places Autocomplete
   - Save place to Firestore
5. Create Add/Edit Dish screen
   - Link to place
   - **Hero dish toggle** ("⭐ THE MOVE")
   - Auto-unset other hero dishes when one is set
   - Save dish to Firestore
6. Add admin button to Settings (conditional)

**Deliverable:** Admin can search for a place, add it, add dishes, and designate a hero dish

**Required Tests:**

| Test Type | What to Test |
|-----------|--------------|
| Unit | Firestore security rules (use emulator) |
| Unit | Admin check logic |
| Unit | Place/Dish data validation |
| Unit | Hero dish toggle logic (only one per place) |
| Unit | Google Places API response parsing |
| Component | Admin screens render correctly |
| Component | Autocomplete dropdown behavior |
| Component | Hero dish toggle UI |
| E2E | Add new place flow |
| E2E | Add dish to place flow |
| E2E | Set hero dish, verify only one is hero |
| E2E | Edit existing place/dish |
| E2E | Non-admin cannot access admin screens |

**Exit Criteria:**
- [ ] All unit tests pass
- [ ] All E2E tests pass
- [ ] Firestore security rules tested with emulator
- [ ] Admin button only visible for admin email
- [ ] Google Places autocomplete works
- [ ] Place saved with correct data
- [ ] Dishes saved and linked to place
- [ ] Hero dish toggle works correctly
- [ ] Can edit existing places/dishes
- [ ] Code committed and pushed to GitHub
- [ ] CI pipeline green

---

### Phase 4: Home Screen Core (Day 4)

**Goal:** Home screen with reveal animation, swipe gestures with discovery, and nearest open place

**Tasks:**
1. Implement location fetching on Home load
2. Create "Finding your snack..." loading state
   - Snack emoji animation (subtle wiggle)
   - Minimum 300-500ms display time for anticipation
3. Create algorithm to find nearest place
   - Query places from Firestore
   - Calculate distances using Haversine formula
   - Sort by distance
4. Integrate Google Places API for hours checking
   - Implement caching (15-minute TTL)
5. Build recommendation card component
   - Hero dish callout ("⭐ THE MOVE")
   - "Get Directions" button on card
   - Reveal animation (scale-up + fade-in)
   - **Wobble animation on reveal** (±3px, 0.3s)
6. Implement swipe gesture system
   - Swipe left = next (no data)
   - Swipe right = save (favorite)
   - Swipe up = going (visited + maps)
   - Visual hints on swipe initiation
7. **Implement swipe discovery system**
   - First-launch tutorial overlay with animated hand demo
   - Track `hasSeenSwipeTutorial` in user document
   - Button-user nudge toast after 5 button taps without swiping
   - Track `hasSeenSwipeNudge` and `swipeCount` / `buttonTapCount`
8. Implement secondary action buttons (Save, Not for me)
9. Handle empty states (nothing open with countdown, not in area with preview)

**Deliverable:** User sees animated reveal of nearest open place, learns swipe gestures naturally, can swipe to interact

**Required Tests:**

| Test Type | What to Test |
|-----------|--------------|
| Unit | Haversine distance calculation (multiple test cases) |
| Unit | Place sorting algorithm |
| Unit | Hours caching logic |
| Unit | "Is open now" logic with various timezones |
| Unit | Hero dish selection logic |
| Unit | Swipe vs button tap tracking logic |
| Component | Loading state animation renders |
| Component | Recommendation card renders all states |
| Component | Card wobble animation |
| Component | Swipe tutorial overlay |
| Component | Swipe gesture detection |
| Component | Empty state components (both variants) |
| E2E | Home screen loads with loading → reveal → wobble |
| E2E | First-time user sees swipe tutorial overlay |
| E2E | Tutorial auto-dismisses after 3 seconds |
| E2E | Tutorial doesn't reappear on subsequent loads |
| E2E | Swipe left cycles through places |
| E2E | Swipe right saves to favorites |
| E2E | Swipe up marks visited and triggers maps |
| E2E | Button-only user sees nudge toast after 5 taps |
| E2E | Nudge toast doesn't reappear |
| E2E | Empty states display correctly (mock no places) |
| E2E | "Remind Me" on Nothing Open state |

**Exit Criteria:**
- [ ] All unit tests pass (especially distance calculation!)
- [ ] All E2E tests pass
- [ ] Loading animation displays before reveal
- [ ] Card reveals with animation + wobble
- [ ] Swipe tutorial shows on first launch
- [ ] Tutorial doesn't reappear
- [ ] Correct place shown based on location
- [ ] Hero dish displayed if designated
- [ ] Closed places filtered out
- [ ] Swipe gestures work in all directions
- [ ] Button-user nudge works correctly
- [ ] Empty states display correctly with interactive elements
- [ ] Code committed and pushed to GitHub
- [ ] CI pipeline green

---

### Phase 5: Place Detail & Interactions (Day 5)

**Goal:** Place detail with hero dish, user interactions with celebration moments

**Tasks:**
1. Create Place Detail screen
   - Display all place info
   - Hero dish section ("⭐ THE MOVE") displayed prominently
   - Other dishes in "Also good" section
   - Share button in header
   - "Get Directions" as primary action
2. Implement Visited Celebration modal
   - Confetti animation (brief, 0.5s)
   - Dynamic count: "That's your Nth spot!"
   - Milestone variations (1st, 10th, 25th, etc.)
   - Auto-dismiss after 2 seconds
3. Implement favorite/save action
   - Heart animation on swipe-right or tap
   - Update UserPlaceInteraction
   - Increment user.stats.totalFavorites
4. Implement dismiss action
   - Create Dismiss Modal with personality ("Not your thing?")
   - Handle "never" vs "just not today"
5. Implement visited action
   - Trigger celebration modal
   - Update UserPlaceInteraction
   - Increment user.stats.totalVisits
6. Filter out dismissed places from Home
7. Create My Snacks screen (renamed from Favorites)
   - Progress indicator ("You've been to X of Y spots")
   - "Surprise Me" button (random open favorite)
   - Tabs: Saved / Visited
   - "Last visit" timestamps on cards
   - Swipe-to-remove with undo

**Deliverable:** Full place detail with hero dish, celebration on visit, actionable My Snacks screen

**Required Tests:**

| Test Type | What to Test |
|-----------|--------------|
| Unit | UserPlaceInteraction CRUD operations |
| Unit | Dismiss logic (permanent vs temporary) |
| Unit | Filtering dismissed places |
| Unit | Visit count incrementing |
| Unit | "Surprise Me" random selection (only open places) |
| Component | Place detail renders hero dish correctly |
| Component | Dietary tags display correctly |
| Component | Celebration modal animation |
| Component | Dismiss modal behavior |
| Component | My Snacks progress indicator |
| E2E | View place detail from home |
| E2E | Hero dish displays at top |
| E2E | Favorite a place, verify in My Snacks |
| E2E | Dismiss permanently, verify not shown |
| E2E | Dismiss "not today", verify still in rotation |
| E2E | Mark as visited, verify celebration shows |
| E2E | Visit count increments correctly |
| E2E | Surprise Me picks random open favorite |
| E2E | Surprise Me disabled when none open |

**Exit Criteria:**
- [ ] All unit tests pass
- [ ] All E2E tests pass
- [ ] Place detail shows hero dish prominently
- [ ] Dietary tags display correctly
- [ ] Get Directions triggers celebration + maps
- [ ] Favorite toggle works with animation
- [ ] Dismiss "never" hides place permanently
- [ ] Celebration modal shows with confetti
- [ ] Visit count displays correctly
- [ ] My Snacks shows progress and Surprise Me
- [ ] Code committed and pushed to GitHub
- [ ] CI pipeline green

---

### Phase 6: Settings & Filtering (Day 6)

**Goal:** User preferences affect recommendations

**Tasks:**
1. Create Settings screen
   - Distance preference dropdown
   - Dietary preference toggles
   - Email updates toggle
2. Implement dietary filtering in Home algorithm
   - Only show places with matching dishes
   - Show only matching dishes in Place Detail
3. Implement distance preference in recommendations
4. Add sign-out functionality
5. Create Not In Area screen with waitlist signup

**Deliverable:** Settings affect what user sees; users outside Seattle can join waitlist

**Required Tests:**

| Test Type | What to Test |
|-----------|--------------|
| Unit | Dietary filtering algorithm (all combinations) |
| Unit | Distance threshold filtering |
| Unit | Preference persistence |
| Component | Settings controls work correctly |
| Component | Not In Area screen and form |
| E2E | Change dietary prefs → verify home changes |
| E2E | Change distance → verify filtering |
| E2E | Sign out → return to Welcome |
| E2E | Waitlist signup (outside Seattle) |

**Exit Criteria:**
- [ ] All unit tests pass
- [ ] All E2E tests pass
- [ ] Changing dietary prefs changes recommendations
- [ ] Distance preference respected
- [ ] Sign out works and returns to Welcome
- [ ] Waitlist signup saves email
- [ ] Code committed and pushed to GitHub
- [ ] CI pipeline green

---

### Phase 7: Sharing & Polish (Day 7)

**Goal:** Sharing works, app is polished for beta

**Tasks:**
1. Implement Web Share API for sharing
   - Share place
   - Share dish
   - Generate proper URLs
2. Create share link landing page (for non-users)
3. Implement deep linking for share URLs
4. Add loading states throughout app
5. Add error handling throughout app
6. Visual polish pass
   - Consistent spacing
   - Proper typography
   - Smooth transitions
7. Final testing and bug fixes

**Deliverable:** App is ready for beta users

**Required Tests:**

| Test Type | What to Test |
|-----------|--------------|
| Unit | Share URL generation |
| Unit | Deep link parsing |
| Component | Loading states render correctly |
| Component | Error states render correctly |
| E2E | Share place flow |
| E2E | Share dish flow |
| E2E | Deep link opens correct screen |
| E2E | Full user journey (onboard → find snack → favorite → share) |
| Visual | Screenshot regression tests (optional but recommended) |

**Exit Criteria:**
- [ ] All unit tests pass
- [ ] All E2E tests pass
- [ ] Share sheet opens with correct content
- [ ] Share links work for recipients
- [ ] Deep links open correct screen
- [ ] No console errors
- [ ] Smooth, polished feel
- [ ] **Full regression test of all previous phases**
- [ ] Code committed and pushed to GitHub
- [ ] CI pipeline green
- [ ] Ready for beta deployment

---

### Post-MVP Phase 8: Capacitor Wrapper & Background Notifications (Days 8-10)

**Goal:** Native iOS/Android app with background location-based notifications

**Overview:**

The PWA cannot reliably check location in the background. To enable "notify me when I'm near a snack" functionality, we must wrap the app in Capacitor and use native background location APIs.

**Architecture:**

```
User walks around Seattle (app in background)
        ↓
iOS detects ~500m movement (Significant Location Change)
        ↓
@capacitor-community/background-geolocation wakes the app
        ↓
App checks: any open places with matching dishes nearby?
        ↓
If yes → Fire local notification
        ↓
User taps notification → App opens to that place
```

**Plugin:** `@capacitor-community/background-geolocation` (free, open source)

**Tasks:**

1. **Set up Capacitor**
   - Install Capacitor CLI
   - Initialize iOS and Android projects
   - Configure app icons, splash screens
   - Test PWA runs in Capacitor shell

2. **Integrate Background Geolocation**
   - Install `@capacitor-community/background-geolocation`
   - Configure for Significant Location Changes mode
   - Request "Always" location permission (with proper explanation)
   - Handle permission denial gracefully

3. **Implement Notification Logic**
   - On location update, query nearby open places
   - Apply all notification rules (see section 10)
   - Fire local notification via `@capacitor/local-notifications`
   - Track notifications sent in NotificationLog

4. **Handle Notification Taps**
   - Deep link to Place Detail screen
   - Handle cold start vs. warm start

5. **App Store Preparation**
   - Add required privacy descriptions (location, notifications)
   - Implement Apple Sign-In (required for App Store)
   - Test on physical devices
   - Prepare App Store / Play Store listings

**Required Tests:**

| Test Type | What to Test |
|-----------|--------------|
| Unit | Notification rule logic (max 3/day, 1/place/day) |
| Unit | Distance threshold checking |
| Unit | Open hours + dietary filter combination |
| Integration | Background location callback fires |
| Integration | Local notification appears |
| E2E | Tap notification → correct screen opens |
| Manual | Real-world testing walking around Seattle |

**Key Implementation Notes:**

```typescript
import BackgroundGeolocation from "@capacitor-community/background-geolocation";

// Start watching location in background
BackgroundGeolocation.addWatcher(
  {
    backgroundMessage: "Snack Index is looking for snacks nearby",
    backgroundTitle: "Finding snacks...",
    requestPermissions: true,
    stale: false,
    distanceFilter: 100  // meters, but iOS controls actual frequency
  },
  async (location, error) => {
    if (error) {
      console.error(error);
      return;
    }
    
    // Check for nearby open snacks
    await checkAndNotify(location.latitude, location.longitude);
  }
);
```

**iOS Constraints to Document for Users:**

- Location updates occur roughly every 500m of movement
- Updates may be delayed when phone is stationary
- Low Power Mode may reduce update frequency
- User must grant "Always" location permission

**Exit Criteria:**
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] App runs in Capacitor on iOS and Android
- [ ] Background location updates received
- [ ] Notifications fire when near open place
- [ ] Notification tap opens correct screen
- [ ] Apple Sign-In works
- [ ] Tested on physical devices
- [ ] Code committed and pushed to GitHub
- [ ] CI pipeline green

---

## 14. Future Features

These features are explicitly **out of scope** for MVP (Phases 1-7) but planned for future versions:

### Phase 8: Native Wrapper & Background Notifications (Post-MVP Priority)

| Feature | Description | Priority |
|---------|-------------|----------|
| Capacitor Wrapper | Wrap PWA for App Store distribution | High |
| Background Location | @capacitor-community/background-geolocation | High |
| Local Notifications | Notify when near open snack spots | High |
| Apple Sign-In | Required for iOS App Store | High |
| Subscription/Paywall | Actually gate features post-trial | High |

### Phase 9: Engagement & Delight

| Feature | Description | Priority |
|---------|-------------|----------|
| "I Got It" Photo Moment | After visiting, prompt: "Enjoying your snack? Snap a pic!" | High |
| Personal Snack Gallery | Collection of user's snack photos over time | Medium |
| Image Upload | Admin photo uploads for places/dishes | Medium |
| Achievement Badges | Unlock badges for milestones (10 spots, tried 5 food trucks, etc.) | Low |

### Phase 10: Community & Growth

| Feature | Description | Priority |
|---------|-------------|----------|
| User-Submitted Places | Users suggest places for admin review | Medium |
| User Comments | Comments on places | Medium |
| User Photos | Users can add public photos | Low |
| Expansion Beyond Seattle | Multiple cities | High |

### Phase 11: Refinement

| Feature | Description | Priority |
|---------|-------------|----------|
| Price Information | Approximate prices per dish | Low |
| Advanced Filtering | More dietary options, cuisine types | Low |
| Cuisine Categories | Filter by type (tacos, dumplings, etc.) | Low |

### Long-term Vision

| Feature | Description |
|---------|-------------|
| React Native Rebuild | True native app for better performance |
| Partnerships | Featured placements for vendors |
| User Reviews | Ratings and reviews |
| Personalization | ML-based recommendations based on visit history |

---

## 15. Appendix: Screen Wireframes

### Wireframe Key

```
┌─────────────────────────────┐
│ [←]     Title         [Act] │  ← Header with back/action
│                             │
│  ┌───────────────────────┐  │  ← Card/Container
│  │                       │  │
│  └───────────────────────┘  │
│                             │
│  [ Button Label ]           │  ← Primary button
│                             │
│  ────────────────────────── │  ← Separator
│     ●      ○      ○        │  ← Bottom nav (● = active)
└─────────────────────────────┘

Elements:
[←]     = Back button
[Act]   = Action button (Save, etc.)
[ x ]   = Button
🔍      = Search input
☐ / ☑  = Checkbox
```

### All Screens Overview

```
ONBOARDING FLOW (2 screens - get to first snack in <30 seconds)
┌─────────┐    ┌─────────┐
│ Welcome │ →  │Permissns│ → HOME
│         │    │(combined│
└─────────┘    └─────────┘
     │
     ↓ (returning user)
┌─────────┐
│  Home   │ ← MAIN ENTRY POINT
└─────────┘
     │
     ├──────────────────────────────────┬────────────────┐
     ↓                                  ↓                ↓
┌─────────┐                       ┌───────────┐   ┌───────────┐
│ Place   │                       │  Dismiss  │   │ Celebrate │
│ Detail  │                       │  Modal    │   │  Modal    │
└─────────┘                       └───────────┘   └───────────┘

FIRST HOME LOAD (one-time)
┌─────────┐
│ Dietary │  ← Bottom sheet over Home
│ Prefs   │    (dismissible)
└─────────┘

BOTTOM NAV
┌─────────┐    ┌─────────┐    ┌─────────┐
│  Home   │ ↔  │My Snacks│ ↔  │Settings │
│    ●    │    │    ♡    │    │    ⚙    │
└─────────┘    └─────────┘    └─────────┘
                                   │
                                   ↓ (admin only)
                              ┌─────────┐
                              │ Admin   │
                              │ Home    │
                              └─────────┘
                                   │
                         ┌─────────┴─────────┐
                         ↓                   ↓
                    ┌─────────┐         ┌─────────┐
                    │Add/Edit │    ↔    │Add/Edit │
                    │ Place   │         │  Dish   │
                    └─────────┘         └─────────┘

EMPTY STATES
┌─────────┐    ┌─────────┐
│ Nothing │    │ Not In  │
│  Open   │    │  Area   │
│(w/count │    │(w/prevew│
│  down)  │    │+waitlst)│
└─────────┘    └─────────┘

INTERACTIONS
- Swipe left on Home card = next recommendation
- Swipe right on Home card = save to My Snacks
- Swipe up on Home card = I'm going! (celebrate + maps)
- Swipe left on My Snacks list item = remove (with undo)
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Dec 27, 2024 | Michael Natkin | Initial PRD |
| 1.1 | Dec 27, 2024 | Michael Natkin | Added UX enhancements: swipe gestures, reveal animation, hero dish, celebration moments, streamlined onboarding, enhanced empty states, My Snacks with Surprise Me |

---

*End of Document*
