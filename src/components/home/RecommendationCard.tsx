import { useEffect, useRef, useState } from 'react';
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
  onGetDirections: _onGetDirections,
  onCardTap,
}: RecommendationCardProps) {
  // Note: onGetDirections kept for API compatibility but swipe-up triggers it
  void _onGetDirections;
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

  return (
    <div className="relative">
      {swipeHint && (
        <div className={`absolute inset-0 flex items-center justify-center z-10 pointer-events-none ${swipeHint.color}`}>
          <div className="text-6xl font-bold opacity-50">{swipeHint.icon}</div>
        </div>
      )}

      <div
        ref={cardRef}
        className="hero-card cursor-grab active:cursor-grabbing animate-card-reveal animate-wobble-once"
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
          if (Math.abs(offset.x) < 10 && Math.abs(offset.y) < 10) {
            onCardTap();
          }
        }}
      >
        <div className="relative aspect-[3/5] w-full">
          {place.imageURL || photoUrl ? (
            <img
              src={place.imageURL || photoUrl || ''}
              alt={place.name}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-honey via-paprika to-eggplant text-6xl">
              🍽️
            </div>
          )}

          <div className="hero-card__overlay" />

          <div className="hero-card__content">
            {/* Spacer to push content to bottom */}
            <div className="flex-1" />

            {/* Bottom content stack */}
            <div className="space-y-3">
              {/* Place name */}
              <h2 className="text-3xl font-bold font-display leading-tight text-white drop-shadow-lg">
                {place.name}
              </h2>

              {/* Distance and hours */}
              <p className="text-sm text-white/90">
                {formatDistance(distance)} · Open{closeTime ? ` until ${closeTime}` : ''}
              </p>

              {/* Top Pick pill - at the bottom */}
              {displayDish && (
                <div className="card-pill inline-flex">
                  <span className="text-base">🔥</span>
                  <span className="text-sm font-semibold">Top Pick: {displayDish.name}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RecommendationCard;

