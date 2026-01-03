import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserStore } from '@/stores/userStore';
import { usePlanningStore } from '@/stores/planningStore';
import { requestLocation } from '@/lib/location';
import { TimePlaceModal } from './TimePlaceModal';

interface ProfileMenuProps {
  placeId?: string;
}

export function ProfileMenu({ placeId }: ProfileMenuProps) {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { updateLocation } = useUserStore();
  const { hasOverrides } = usePlanningStore();
  const [isOpen, setIsOpen] = useState(false);
  const [updatingLocation, setUpdatingLocation] = useState(false);
  const [showTimePlaceModal, setShowTimePlaceModal] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleNavigate = (path: string) => {
    setIsOpen(false);
    navigate(path);
  };

  const handleUpdateLocation = async () => {
    setUpdatingLocation(true);
    try {
      const result = await requestLocation();
      if (result.success && result.coordinates) {
        await updateLocation(result.coordinates);
        // Reload the page to get fresh recommendations with new location
        window.location.reload();
      } else {
        alert(result.error || 'Could not get location');
      }
    } catch (err) {
      console.error('Failed to update location:', err);
      alert('Failed to update location');
    } finally {
      setUpdatingLocation(false);
      setIsOpen(false);
    }
  };

  const handleSetTimePlace = () => {
    setIsOpen(false);
    setShowTimePlaceModal(true);
  };

  const isPlanningAhead = hasOverrides();

  return (
    <>
      <div ref={menuRef} className="relative z-50">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="profile-menu-button"
          aria-label="Profile menu"
          aria-expanded={isOpen}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          {/* Indicator dot when planning ahead */}
          {isPlanningAhead && (
            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-honey rounded-full border-2 border-surface" />
          )}
        </button>

        {isOpen && (
          <div className="profile-menu-dropdown">
            <button
              onClick={handleSetTimePlace}
              className="profile-menu-item"
            >
              <span className="profile-menu-icon">🗓️</span>
              Plan Ahead
              {isPlanningAhead && (
                <span className="ml-auto text-xs bg-honey/30 text-charcoal px-1.5 py-0.5 rounded-full">Active</span>
              )}
            </button>
            <button
              onClick={() => handleNavigate('/settings')}
              className="profile-menu-item"
            >
              <span className="profile-menu-icon">⚙️</span>
              Settings
            </button>
            <button
              onClick={() => handleNavigate('/my-snacks')}
              className="profile-menu-item"
            >
              <span className="profile-menu-icon">♥</span>
              My Snacks
            </button>
            <button
              onClick={handleUpdateLocation}
              className="profile-menu-item"
              disabled={updatingLocation}
            >
              <span className="profile-menu-icon">📍</span>
              {updatingLocation ? 'Updating...' : 'Update Location'}
            </button>
            {isAdmin && placeId && (
              <button
                onClick={() => handleNavigate(`/admin/place/${placeId}`)}
                className="profile-menu-item"
              >
                <span className="profile-menu-icon">✏️</span>
                Edit Place
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => handleNavigate('/admin')}
                className="profile-menu-item"
              >
                <span className="profile-menu-icon">🔧</span>
                Admin
              </button>
            )}
          </div>
        )}
      </div>

      {/* Time & Place Modal */}
      {showTimePlaceModal && (
        <TimePlaceModal onClose={() => setShowTimePlaceModal(false)} />
      )}
    </>
  );
}

export default ProfileMenu;
