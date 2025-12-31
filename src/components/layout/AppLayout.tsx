import type { ReactNode } from 'react';
import { BottomNav } from './BottomNav';

interface AppLayoutProps {
  children: ReactNode;
  hideNav?: boolean;
}

export function AppLayout({ children, hideNav = false }: AppLayoutProps) {
  return (
    <div className="app-shell">
      <div className="shell-inner">
        <main className={hideNav ? 'pb-6' : 'pb-28'}>
          {children}
        </main>
      </div>
      {!hideNav && <BottomNav />}
    </div>
  );
}

export default AppLayout;

