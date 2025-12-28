import { NavLink } from 'react-router-dom';

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  activeIcon: React.ReactNode;
  label: string;
}

function NavItem({ to, icon, activeIcon, label }: NavItemProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex flex-col items-center justify-center py-2 px-4 transition-colors ${
          isActive ? 'text-primary' : 'text-sage hover:text-charcoal'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span className="text-2xl">{isActive ? activeIcon : icon}</span>
          <span className="text-xs mt-0.5">{label}</span>
        </>
      )}
    </NavLink>
  );
}

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-surface border-t border-butter/30 z-30">
      <div className="max-w-[32rem] mx-auto flex items-center justify-around">
        <NavItem
          to="/home"
          icon={<span>○</span>}
          activeIcon={<span>●</span>}
          label="Home"
        />
        <NavItem
          to="/my-snacks"
          icon={<span>♡</span>}
          activeIcon={<span>♥</span>}
          label="My Snacks"
        />
        <NavItem
          to="/settings"
          icon={<span>⚙</span>}
          activeIcon={<span>⚙️</span>}
          label="Settings"
        />
      </div>
      {/* Safe area padding for iOS */}
      <div className="h-safe-area-bottom bg-surface" />
    </nav>
  );
}

export default BottomNav;

