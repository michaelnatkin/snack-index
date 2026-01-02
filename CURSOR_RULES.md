Cursor working rule: always prefer the newest/stable version of any API or SDK (e.g., use Places API (New) over legacy, upgrade endpoints when available).

## Testing Rules

**NEVER write fake inline tests.** Every test must:

1. **Import the actual function/component being tested** from its source file
2. **Call the real imported function** with test inputs
3. **Assert on the real function's output**

Examples of what NOT to do:

```typescript
// BAD - This tests inline code, not the actual filterDishesByDietary function
it('filters vegan dishes', () => {
  const mockDishes = [{ id: '1', dietary: { vegan: true } }];
  const filtered = mockDishes.filter(d => d.dietary.vegan);  // <-- NOT testing the real function!
  expect(filtered.length).toBe(1);
});

// BAD - This just tests that an object has properties
it('should have required fields', () => {
  const place = { id: 'test', name: 'Test' };  // <-- Inline object, not from real code
  expect(place.name).toBeDefined();
});
```

Examples of what TO do:

```typescript
// GOOD - Import and test the real function
import { processCandidateBatch } from './recommendations';

it('filters out closed places', async () => {
  mockGetPlaceHours.mockResolvedValue({ isOpen: false });
  const result = await processCandidateBatch(candidates, filters);  // <-- Calling real function
  expect(result).toHaveLength(0);
});
```

If a function has complex dependencies, mock them properly and test the real function's behavior.

## Firestore Index Changes

When modifying Firestore queries that use composite indexes (e.g., changing `where` clauses, adding new query constraints):

1. **Update `firestore.indexes.json`** with the new index definition
2. **Deploy indexes immediately**: Run `firebase deploy --only firestore:indexes` (or prompt user to do so)
3. **Test against real Firestore** - not just mocks/emulator. The emulator doesn't enforce composite index requirements.
4. **Check browser console AFTER triggering the specific query** - index errors only appear when that query path is hit

Unit tests with mocks will NOT catch missing Firestore indexes. Always verify index-dependent queries work in production.

