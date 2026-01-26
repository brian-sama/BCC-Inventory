import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, Outlet, useLocation } from 'react-router-dom';
import { ICONS, COLORS } from '../constants';
import { User, UserRole } from '../types';

interface LayoutProps {
  user: User | null;
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ user, onLogout }) => {
  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') === 'dark');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  if (!user) return <Outlet />;

  const navItems = [
    { name: 'Dashboard', icon: ICONS.Dashboard, path: '/', roles: [UserRole.ADMIN, UserRole.STOCK_TAKER, UserRole.ASSET_ADDER] },
    { name: 'Inventory', icon: ICONS.Inventory, path: '/inventory', roles: [UserRole.ADMIN, UserRole.STOCK_TAKER] },
    { name: 'Assets', icon: ICONS.Assets, path: '/assets', roles: [UserRole.ADMIN, UserRole.ASSET_ADDER] },
    { name: 'Reports', icon: ICONS.Reports, path: '/reports', roles: [UserRole.ADMIN, UserRole.SUPER_ADMIN] },
    { name: 'Audit Trail', icon: ICONS.Reports, path: '/audit-trail', roles: [UserRole.ADMIN, UserRole.SUPER_ADMIN] },
    { name: 'User Management', icon: ICONS.Assets, path: '/users', roles: [UserRole.SUPER_ADMIN] },
    { name: 'Settings', icon: ICONS.Settings, path: '/settings', roles: [UserRole.ADMIN, UserRole.SUPER_ADMIN] },
  ];

  const filteredNavItems = navItems.filter(item => {
    const hasRole = item.roles.some(role => role.toLowerCase() === user.role.toLowerCase());
    return hasRole;
  });

  // Debug role matching
  useEffect(() => {
    console.log('Layout user role:', user.role);
    console.log('Available links for this role:', filteredNavItems.map(i => i.name));
  }, [user.role]);

  return (
    <div className={`min-h-screen flex flex-col ${isDark ? 'dark bg-slate-950' : 'bg-slate-50'}`}>
      {/* Top Navigation Bar */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            {/* Logo and Branding */}
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
              <img src="/bcc-logo.jpg" alt="BCC Logo" className="w-10 h-10 object-contain" />
              <div className="hidden sm:block">
                <p className="text-sm font-bold leading-tight dark:text-white">Bulawayo Council</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Enterprise SIMS</p>
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-1 lg:space-x-4">
              {filteredNavItems.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.path}
                  className={({ isActive }) => `
                    flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all
                    ${isActive
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                      : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/50'}
                  `}
                >
                  <item.icon className="w-4 h-4" />
                  {item.name}
                </NavLink>
              ))}
            </nav>

            {/* Right Side Actions */}
            <div className="flex items-center gap-2 sm:gap-4">
              <button
                onClick={() => setIsDark(!isDark)}
                className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                title="Toggle Theme"
              >
                {isDark ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 7a5 5 0 100 10 5 5 0 000-10z" /></svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                )}
              </button>

              <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block"></div>

              {/* User Dropdown (Simulated with simple flex) */}
              <div className="flex items-center gap-2 pl-2">
                <div className="hidden sm:block text-right">
                  <p className="text-xs font-bold dark:text-white truncate max-w-[100px]">{user.username}</p>
                  <p className="text-[10px] text-slate-400 truncate capitalize">{user.role}</p>
                </div>
                <button
                  onClick={onLogout}
                  className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-full transition-colors"
                  title="Sign Out"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                </button>
              </div>

              {/* Mobile Menu Button */}
              <button
                className="md:hidden p-2 text-slate-600 dark:text-slate-400"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                title="Open Menu"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" /></svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
            <nav className="px-2 pt-2 pb-3 space-y-1">
              {filteredNavItems.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.path}
                  onClick={() => setIsMenuOpen(false)}
                  className={({ isActive }) => `
                    flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-colors
                    ${isActive
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                      : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/50'}
                  `}
                >
                  <item.icon className="w-5 h-5" />
                  {item.name}
                </NavLink>
              ))}
            </nav>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-x-hidden overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Outlet />
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-2">
          <p className="text-[10px] text-slate-500">© 2026 Bulawayo City Council. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] font-bold ring-1 ring-inset ring-green-600/20">
              <span className="w-1 h-1 rounded-full bg-green-500 animate-pulse"></span>
              Secure Connection
            </span>
            <p className="text-[10px] text-slate-500">v2.1.0-cloud-entry</p>
          </div>
        </div>
      </footer>

      {/* DEBUG OVERLAY - Remove in Production */}
      <div className="fixed bottom-4 left-4 z-[9999] bg-black/80 text-[10px] text-white p-2 rounded border border-white/20 font-mono pointer-events-none">
        ROLE: {user.role} | PATH: {location.pathname}
      </div>
    </div>
  );
};

export default Layout;
