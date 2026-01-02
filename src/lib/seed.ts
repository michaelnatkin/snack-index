import { doc, setDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import type { Place, Dish, DietaryFilters } from '../types/models';

// Sample Seattle-area snack spots
const samplePlaces: Omit<Place, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>[] = [
  {
    name: "Mighty-O Donuts",
    googlePlaceId: "ChIJN1t_tDeuEmsRUsoyG83frY4",
    address: "2110 N 55th St, Seattle, WA 98103",
    latitude: 47.6688,
    longitude: -122.3363,
    status: 'ACCEPTED',
  },
  {
    name: "General Porpoise",
    googlePlaceId: "ChIJd8BlQ2K_woART1gXUxw4a30",
    address: "1020 E Union St, Seattle, WA 98122",
    latitude: 47.6129,
    longitude: -122.3186,
    status: 'ACCEPTED',
  },
  {
    name: "Hood Famous Cafe",
    googlePlaceId: "ChIJNz_rDHkVkFQRZqTh5tY3Kqc",
    address: "2325 E Union St, Seattle, WA 98122",
    latitude: 47.6127,
    longitude: -122.3019,
    status: 'ACCEPTED',
  },
  {
    name: "Rachel's Ginger Beer",
    googlePlaceId: "ChIJcWGw3hBqkFQRHMWx8YFmAQQ",
    address: "1530 Post Alley, Seattle, WA 98101",
    latitude: 47.6097,
    longitude: -122.3425,
    status: 'ACCEPTED',
  },
];

const noDietary: DietaryFilters = { vegetarian: false, vegan: false, glutenFree: false };
const vegan: DietaryFilters = { vegetarian: true, vegan: true, glutenFree: false };
const veganGF: DietaryFilters = { vegetarian: true, vegan: true, glutenFree: true };
const gfOnly: DietaryFilters = { vegetarian: false, vegan: false, glutenFree: true };

const sampleDishes: Record<string, Omit<Dish, 'id' | 'placeId' | 'createdAt' | 'updatedAt'>[]> = {
  "Mighty-O Donuts": [
    {
      name: "French Toast Donut",
      description: "Organic, vegan donut with maple glaze and cinnamon",
      isHero: true,
      dietary: vegan,
      status: 'ACCEPTED',
    },
    {
      name: "Chocolate Old Fashioned",
      description: "Classic cake donut with rich chocolate glaze",
      isHero: false,
      dietary: vegan,
      status: 'ACCEPTED',
    },
  ],
  "General Porpoise": [
    {
      name: "Salted Caramel Doughnut",
      description: "Brioche doughnut filled with house-made salted caramel",
      isHero: true,
      dietary: noDietary,
      status: 'ACCEPTED',
    },
    {
      name: "Lemon Curd Doughnut",
      description: "Light and tangy lemon curd in a pillowy brioche",
      isHero: false,
      dietary: noDietary,
      status: 'ACCEPTED',
    },
  ],
  "Hood Famous Cafe": [
    {
      name: "Ube Cheesecake",
      description: "Filipino purple yam cheesecake with coconut crust",
      isHero: true,
      dietary: gfOnly,
      status: 'ACCEPTED',
    },
    {
      name: "Mango Float",
      description: "Layers of graham, cream, and fresh mango",
      isHero: false,
      dietary: noDietary,
      status: 'ACCEPTED',
    },
  ],
  "Rachel's Ginger Beer": [
    {
      name: "Original Ginger Beer",
      description: "Spicy, fresh-pressed ginger beer on tap",
      isHero: true,
      dietary: veganGF,
      status: 'ACCEPTED',
    },
    {
      name: "Blood Orange Ginger Beer",
      description: "Seasonal citrus twist on the classic",
      isHero: false,
      dietary: veganGF,
      status: 'ACCEPTED',
    },
  ],
};

export async function seedDatabase(userId: string, userEmail: string): Promise<void> {
  console.log('🌱 Starting database seed...');

  // 1. Make current user an admin
  console.log('👤 Setting up admin user...');
  await setDoc(doc(db, 'users', userId), {
    email: userEmail,
    isAdmin: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    preferences: {
      dietaryFilters: { vegetarian: false, vegan: false, glutenFree: false },
      notificationDistance: 0.5,
      emailUpdates: true,
    },
    onboarding: {
      completed: true,
      hasSeenDietarySheet: true,
      hasSeenSwipeTutorial: false,
      hasSeenSwipeNudge: false,
    },
    stats: { totalVisits: 0, totalFavorites: 0 },
    interactions: { totalSwipes: 0, totalButtonTaps: 0 },
  }, { merge: true });
  console.log('✅ Admin user created');

  // 2. Add sample places and dishes
  console.log('🏪 Adding sample places...');
  for (const place of samplePlaces) {
    const placeRef = await addDoc(collection(db, 'places'), {
      ...place,
      createdBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    console.log(`  ✅ Added: ${place.name}`);

    // Add dishes for this place
    const dishes = sampleDishes[place.name] || [];
    for (const dish of dishes) {
      await addDoc(collection(db, 'dishes'), {
        ...dish,
        placeId: placeRef.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      console.log(`    🍩 Added dish: ${dish.name}`);
    }
  }

  console.log('🎉 Database seeded successfully!');
  console.log('   Refresh the page to see your admin access.');
}
