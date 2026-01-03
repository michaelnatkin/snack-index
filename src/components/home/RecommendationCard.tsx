import { useEffect, useRef, useState } from 'react';
import { formatDistance } from '@/lib/location';
import { getGooglePlacePhotoUrlWithRefresh } from '@/lib/googlePlaces';
import { usePlanningStore } from '@/stores/planningStore';
import type { PlaceRecommendation } from '@/lib/recommendations';

interface RecommendationCardProps {
  recommendation: PlaceRecommendation;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onSwipeUp: () => void;
  onClick: () => void;
}

export function RecommendationCard({
  recommendation,
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onClick,
}: RecommendationCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [hasMoved, setHasMoved] = useState(false);
  const { hasOverrides } = usePlanningStore();

  const { place, heroDish, dishes, distance, closeTime, todayHoursRange } = recommendation;
  const isPlanningAhead = hasOverrides();

  useEffect(() => {
    let isMounted = true;

    const loadPhoto = async () => {
      try {
        const url = await getGooglePlacePhotoUrlWithRefresh(place.id, place.googlePlaceId, 800);
        if (isMounted) {
          setPhotoUrl(url);
        }
      } catch (err) {
        console.error('Failed to load photo:', err);
      }
    };

    loadPhoto();
    return () => {
      isMounted = false;
    };
  }, [place.id, place.googlePlaceId]);

  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    const point = 'touches' in e ? e.touches[0] : e;
    setTouchStart({ x: point.clientX, y: point.clientY });
    setIsDragging(true);
    setHasMoved(false);
  };

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!touchStart || !isDragging) return;
    
    const point = 'touches' in e ? e.touches[0] : e;
    const deltaX = point.clientX - touchStart.x;
    const deltaY = point.clientY - touchStart.y;
    
    // Mark as moved if user drags more than a small threshold
    if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
      setHasMoved(true);
    }
    
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
    } else if (!hasMoved) {
      // User tapped without significant movement - go to details
      onClick();
    }
    
    setOffset({ x: 0, y: 0 });
    setTouchStart(null);
    setIsDragging(false);
    setHasMoved(false);
  };

  const getSwipeHint = () => {
    if (offset.x < -40) return { icon: '←', text: 'Back', color: 'text-sage' };
    if (offset.x > 40) return { icon: '→', text: 'Next', color: 'text-sage' };
    if (offset.y < -40) return { icon: '↑', text: 'Go!', color: 'text-success' };
    return null;
  };

  const swipeHint = getSwipeHint();

  // Get display dish info
  const displayDish = heroDish || dishes[0];

  return (
    <div
      ref={cardRef}
      className="fullpage-hero cursor-grab active:cursor-grabbing"
      style={{
        transform: `translateX(${offset.x * 0.3}px) translateY(${offset.y * 0.3}px)`,
        transition: isDragging ? 'none' : 'transform 0.3s ease-out',
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleTouchStart}
      onMouseMove={isDragging ? handleTouchMove : undefined}
      onMouseUp={handleTouchEnd}
      onMouseLeave={handleTouchEnd}
    >
      {/* Background image */}
      {place.imageURL || photoUrl ? (
        <img
          src={place.imageURL || photoUrl || ''}
          alt={place.name}
          className="fullpage-hero__image"
        />
      ) : (
        <div className="fullpage-hero__placeholder">
          🍽️
        </div>
      )}

      {/* Bottom third gradient overlay */}
      <div className="fullpage-hero__gradient" />

      {/* Swipe hint overlay */}
      {swipeHint && (
        <div className={`absolute inset-0 flex items-center justify-center z-10 pointer-events-none ${swipeHint.color}`}>
          <div className="text-8xl font-bold opacity-40">{swipeHint.icon}</div>
        </div>
      )}

      {/* Bottom content */}
      <div className="fullpage-hero__content">
        <h2 className="text-4xl font-bold font-display leading-tight text-white drop-shadow-lg">
          {place.name}
        </h2>

        <p className="text-base text-white/90 mt-2">
          {formatDistance(distance)} · {isPlanningAhead && todayHoursRange ? todayHoursRange : `Open${closeTime ? ` until ${closeTime}` : ''}`}
          {displayDish && <> · 🔥 {displayDish.name}</>}
        </p>
      </div>
    </div>
  );
}

export default RecommendationCard;

