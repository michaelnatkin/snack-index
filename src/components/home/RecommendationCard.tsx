import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { formatDistance } from '@/lib/location';
import { getGooglePlacePhotoUrl } from '@/lib/googlePlaces';
import type { PlaceRecommendation } from '@/lib/recommendations';

interface RecommendationCardProps {
  recommendation: PlaceRecommendation;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onSwipeUp: () => void;
  onGetDirections: () => void;
  onCardTap: () => void;
}

export function RecommendationCard({
  recommendation,
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onGetDirections,
  onCardTap,
}: RecommendationCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const { place, heroDish, dishes, distance, closeTime } = recommendation;

  useEffect(() => {
    let isMounted = true;

    const loadPhoto = async () => {
      const url = await getGooglePlacePhotoUrl(place.googlePlaceId, 800);
      if (isMounted) {
        setPhotoUrl(url);
      }
    };

    loadPhoto();
    return () => {
      isMounted = false;
    };
  }, [place.googlePlaceId]);

  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    const point = 'touches' in e ? e.touches[0] : e;
    setTouchStart({ x: point.clientX, y: point.clientY });
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!touchStart || !isDragging) return;
    
    const point = 'touches' in e ? e.touches[0] : e;
    const deltaX = point.clientX - touchStart.x;
    const deltaY = point.clientY - touchStart.y;
    
    setOffset({ x: deltaX, y: Math.min(0, deltaY) });
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    
    const threshold = 80;
    
    if (offset.x < -threshold) {
      onSwipeLeft();
    } else if (offset.x > threshold) {
      onSwipeRight();
    } else if (offset.y < -threshold) {
      onSwipeUp();
    }
    
    setOffset({ x: 0, y: 0 });
    setTouchStart(null);
    setIsDragging(false);
  };

  const getSwipeHint = () => {
    if (offset.x < -40) return { icon: '←', text: 'Skip', color: 'text-sage' };
    if (offset.x > 40) return { icon: '♥', text: 'Save', color: 'text-paprika' };
    if (offset.y < -40) return { icon: '↑', text: 'Go!', color: 'text-success' };
    return null;
  };

  const swipeHint = getSwipeHint();

  // Get display dish info
  const displayDish = heroDish || dishes[0];
  const otherDishCount = dishes.length - 1;

  return (
    <div className="relative">
      {/* Swipe hint overlay */}
      {swipeHint && (
        <div className={`absolute inset-0 flex items-center justify-center z-10 pointer-events-none ${swipeHint.color}`}>
          <div className="text-6xl font-bold opacity-50">{swipeHint.icon}</div>
        </div>
      )}

      {/* Card */}
      <div
        ref={cardRef}
        className="bg-surface rounded-2xl shadow-lg overflow-hidden cursor-grab active:cursor-grabbing animate-card-reveal animate-wobble-once"
        style={{
          transform: `translateX(${offset.x}px) translateY(${offset.y}px) rotate(${offset.x * 0.02}deg)`,
          transition: isDragging ? 'none' : 'transform 0.3s ease-out',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleTouchStart}
        onMouseMove={isDragging ? handleTouchMove : undefined}
        onMouseUp={handleTouchEnd}
        onMouseLeave={handleTouchEnd}
        onClick={() => {
          // Only trigger tap if not dragging
          if (Math.abs(offset.x) < 10 && Math.abs(offset.y) < 10) {
            onCardTap();
          }
        }}
      >
        {/* Hero Image / Gradient */}
        <div className="h-48 bg-gradient-to-br from-honey via-paprika to-eggplant flex items-center justify-center">
          {place.imageURL || photoUrl ? (
            <img
              src={place.imageURL || photoUrl || ''}
              alt={place.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-6xl">🍽️</span>
          )}
        </div>

        {/* Content */}
        <div className="p-5">
          <h2 className="text-2xl font-bold text-charcoal font-display mb-1">
            {place.name}
          </h2>
          
          <p className="text-text-muted mb-4">
            {formatDistance(distance)} · Open{closeTime ? ` until ${closeTime}` : ''}
          </p>

          {/* Hero Dish */}
          {displayDish && (
            <div className="mb-4">
              <p className="text-sm text-sage uppercase tracking-wide mb-1">
                {heroDish ? '⭐ THE MOVE' : 'Try'}
              </p>
              <p className="text-lg font-semibold text-charcoal">
                {displayDish.name}
              </p>
              {heroDish && otherDishCount > 0 && (
                <p className="text-sm text-text-muted">
                  + {otherDishCount} more {otherDishCount === 1 ? 'dish' : 'dishes'}
                </p>
              )}
            </div>
          )}

          {/* Get Directions Button */}
          <Button
            size="lg"
            className="w-full"
            onClick={(e) => {
              e.stopPropagation();
              onGetDirections();
            }}
          >
            Get Directions
          </Button>
        </div>
      </div>
    </div>
  );
}

export default RecommendationCard;

