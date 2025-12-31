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
    <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[92vw] max-w-[30rem] z-40 floating-nav rounded-2xl">
      <div className="flex items-center justify-around px-4">
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
      <div className="h-safe-area-bottom" />
    </nav>
  );
}

export default BottomNav;

