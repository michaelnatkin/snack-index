import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserStore } from '@/stores/userStore';
import { requestLocation } from '@/lib/location';

export function ProfileMenu() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { updateLocation } = useUserStore();
  const [isOpen, setIsOpen] = useState(false);
  const [updatingLocation, setUpdatingLocation] = useState(false);
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

  return (
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
      </button>

      {isOpen && (
        <div className="profile-menu-dropdown">
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
  );
}

export default ProfileMenu;

