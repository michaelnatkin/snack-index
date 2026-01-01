import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { getDish, createDish, updateDish, deleteDish, getDishByNameForPlace } from '@/lib/places';
import type { DietaryFilters } from '@/types/models';

export function DishEditor() {
  const navigate = useNavigate();
  const { placeId, dishId } = useParams<{ placeId: string; dishId: string }>();
  const isNew = dishId === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isHero, setIsHero] = useState(false);
  const [dietary, setDietary] = useState<DietaryFilters>({
    vegetarian: false,
    vegan: false,
    glutenFree: false,
  });
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!isNew && dishId) {
      loadDish(dishId);
    }
  }, [isNew, dishId]);

  const loadDish = async (id: string) => {
    setLoading(true);
    setError(null);

    try {
      const dish = await getDish(id);
      if (!dish) {
        setError('Dish not found');
        return;
      }

      setName(dish.name);
      setDescription(dish.description || '');
      setIsHero(dish.isHero);
      setDietary(dish.dietary);
      setIsActive(dish.isActive);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dish');
    } finally {
      setLoading(false);
    }
  };

  const handleDietaryChange = (key: keyof DietaryFilters) => {
    setDietary((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Dish name is required');
      return;
    }

    if (!placeId) {
      setError('Place ID is missing');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Check for duplicate dish name when creating new
      if (isNew) {
        const existingDish = await getDishByNameForPlace(placeId, name.trim());
        if (existingDish) {
          setError(`A dish named "${existingDish.name}" already exists for this place.`);
          setSaving(false);
          return;
        }
      }

      const desc = description.trim();
      const dishData: {
        placeId: string;
        name: string;
        description?: string;
        isHero: boolean;
        dietary: DietaryFilters;
        isActive: boolean;
      } = {
        placeId,
        name: name.trim(),
        isHero,
        dietary,
        isActive,
      };
      if (desc) {
        dishData.description = desc;
      }

      if (isNew) {
        await createDish(dishData);
      } else {
        await updateDish(dishId!, dishData);
      }

      navigate(`/admin/place/${placeId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save dish');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this dish? This cannot be undone.')) {
      return;
    }

    setSaving(true);
    try {
      await deleteDish(dishId!);
      navigate(`/admin/place/${placeId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete dish');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-surface border-b border-butter/30 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-[42rem] mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate(`/admin/place/${placeId}`)}
            className="text-2xl"
            aria-label="Back"
          >
            ←
          </button>
          <h1 className="text-xl font-bold text-charcoal font-display">
            {isNew ? 'Add Dish' : 'Edit Dish'}
          </h1>
          <Button size="sm" onClick={handleSave} loading={saving}>
            Save
          </Button>
        </div>
      </header>

      <div className="max-w-[42rem] mx-auto px-4 py-6 space-y-6">
        {error && (
          <div className="p-4 bg-paprika/10 rounded-lg border border-paprika/20">
            <p className="text-paprika">{error}</p>
          </div>
        )}

        {/* Dish Name */}
        <div>
          <label className="block text-sm font-medium text-charcoal mb-2">
            Dish Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Kalbi Tacos"
            className="w-full px-4 py-2 rounded-lg border border-butter bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-charcoal mb-2">
            Description (optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What makes this dish special?"
            rows={3}
            className="w-full px-4 py-2 rounded-lg border border-butter bg-surface focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          />
        </div>

        {/* Hero Dish Toggle */}
        <div className="bg-surface rounded-lg p-4 border border-butter/30">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isHero}
              onChange={(e) => setIsHero(e.target.checked)}
              className="w-5 h-5 rounded border-sage text-primary focus:ring-primary"
            />
            <div>
              <span className="text-charcoal font-medium">⭐ THE MOVE</span>
              <p className="text-xs text-text-muted">
                Mark as the signature dish for this place
              </p>
            </div>
          </label>
          {isHero && (
            <p className="text-xs text-sage mt-2 ml-8">
              Only one dish per place can be the hero. Setting this will unset any other hero dish.
            </p>
          )}
        </div>

        {/* Dietary Tags */}
        <div>
          <label className="block text-sm font-medium text-charcoal mb-3">
            Dietary Tags
          </label>
          <div className="bg-surface rounded-lg p-4 border border-butter/30 space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={dietary.vegetarian}
                onChange={() => handleDietaryChange('vegetarian')}
                className="w-5 h-5 rounded border-sage text-primary focus:ring-primary"
              />
              <span className="text-charcoal">Vegetarian</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={dietary.vegan}
                onChange={() => handleDietaryChange('vegan')}
                className="w-5 h-5 rounded border-sage text-primary focus:ring-primary"
              />
              <span className="text-charcoal">Vegan</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={dietary.glutenFree}
                onChange={() => handleDietaryChange('glutenFree')}
                className="w-5 h-5 rounded border-sage text-primary focus:ring-primary"
              />
              <span className="text-charcoal">Gluten-free</span>
            </label>
          </div>
        </div>

        {/* Active Toggle */}
        <div className="bg-surface rounded-lg p-4 border border-butter/30">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-5 h-5 rounded border-sage text-primary focus:ring-primary"
            />
            <span className="text-charcoal">Active</span>
          </label>
          <p className="text-xs text-text-muted mt-1 ml-8">
            Inactive dishes won&apos;t appear in recommendations
          </p>
        </div>

        {/* Delete Button (only for existing dishes) */}
        {!isNew && (
          <Button
            variant="ghost"
            className="w-full text-paprika hover:bg-paprika/10"
            onClick={handleDelete}
          >
            Delete Dish
          </Button>
        )}
      </div>
    </div>
  );
}

export default DishEditor;

