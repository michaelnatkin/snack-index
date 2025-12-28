# Snack Index - Bug Fixes Log

This document tracks all bugs found and fixed during comprehensive testing.

---

## Testing Session: December 28, 2025

### Test Environment
- Browser: Chromium (via Playwright)
- Viewport: iPhone 14 Pro (393x852)
- App URL: http://localhost:5173

---

## Bugs Found and Fixed

| Status | Area | Issue | Fix |
|--------|------|-------|-----|
| ✅ | Auth (email) | Firestore rejected `photoURL: undefined` during email sign-up/sign-in. | Only include `photoURL` when present in `getOrCreateUserDocument` to avoid undefined writes. |
| ✅ | Welcome Screen | Unit test expected old tagline text. | Updated test to match new tagline "Discover snacks near you". |
| ✅ | Layout (Tailwind max-w) | Tailwind v4 `max-w-*` utilities resolved to `16px/8px`, causing ultra-narrow containers across onboarding, admin, home states. | Replaced `max-w-*` utilities with explicit arbitrary widths (e.g., `max-w-[28rem]`, `max-w-[32rem]`, `max-w-[20rem]`, etc.) via search/replace across affected components. |
| ✅ | Onboarding - Permissions | Heading wrapped every word and container collapsed due to broken `max-w` utility. | Switched to `max-w-[28rem]` container; verified typography and spacing on iPhone viewport. |
| ✅ | Share Landing | When place not found, loading spinner never resolved (stuck). | Set `setLoading(false)` on missing place; now shows friendly "Place not found" state. |
| ✅ | Admin - Places list | Firestore composite index error when listing dishes per place (`where placeId` + `orderBy name`). | Removed `orderBy('name')` from `getDishesForPlace` to avoid composite index requirement in dev; admin list now loads. |
| ✅ | Home - Not In Area | Email capture input was off-screen/narrow due to max-width bug. | Same `max-w` fix; waitlist input/button now visible and full-width. |
| ✅ | Admin - Add Place | Autocomplete returned no results (Temple Pastries) because Google Places script never loaded and mock data lacked the place. | Added Google Places script loader using `VITE_GOOGLE_PLACES_API_KEY`, initialize services when available, and expanded mock autocomplete/details to include Temple Pastries fallback. |

---

### Testing notes
- End-to-end manual checks with Playwright on iPhone 14 Pro viewport for: welcome, email sign-up/sign-in, permissions, dietary sheet, home/not-in-area, my snacks (saved/visited), settings (sign out/in, admin link), admin dashboard & place editor, place detail, share landing (found & not found states).
- Full unit test suite: **pass** (`npm test` / vitest). Act warnings from React Testing Library appear in stdout but tests pass.

