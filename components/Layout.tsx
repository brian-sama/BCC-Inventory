import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, Outlet } from 'react-router-dom';
import { ICONS, COLORS } from '../constants';
import { User, UserRole } from '../types';

interface LayoutProps {
  user: User | null;
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ user, onLogout }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') === 'dark');
  const navigate = useNavigate();

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
    { name: 'Reports', icon: ICONS.Reports, path: '/reports', roles: [UserRole.ADMIN] },
    { name: 'Audit Trail', icon: ICONS.Reports, path: '/audit-trail', roles: [UserRole.ADMIN] },
    { name: 'User Management', icon: ICONS.Assets, path: '/users', roles: [UserRole.HEAD_ADMIN] },
    { name: 'Settings', icon: ICONS.Settings, path: '/settings', roles: [UserRole.ADMIN] },
  ];

  const filteredNavItems = navItems.filter(item => {
    const userRole = user.role as UserRole;
    return item.roles.includes(userRole);
  });

  return (
    <div className={`min-h-screen flex flex-col ${isDark ? 'dark bg-slate-950' : 'bg-slate-50'}`}>

      {/* Top Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">

            {/* Logo & Desktop Nav */}
            <div className="flex">
              <div className="flex-shrink-0 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-lg">B</div>
                <div className="hidden md:block">
                  <h1 className="text-sm font-bold leading-tight dark:text-white">Bulawayo</h1>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium tracking-wide">City Council SIMS</p>
                </div>
              </div>

              <nav className="hidden md:ml-8 md:flex md:space-x-1">
                {filteredNavItems.map((item) => (
                  <NavLink
                    key={item.name}
                    to={item.path}
                    className={({ isActive }) => `
                      inline-flex items-center px-3 pt-1 border-b-2 text-sm font-medium transition-colors h-full
                      ${isActive
                        ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-200'}
                    `}
                  >
                    <item.icon className="w-4 h-4 mr-2" />
                    {item.name}
                  </NavLink>
                ))}
              </nav>
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsDark(!isDark)}
                className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                title="Toggle Theme"
              >
                {isDark ? (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M3 12h2.25m.386-6.364 1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M3 12h2.25m.386-6.364 1.591-1.591M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
                  </svg>
                )}
              </button>

              <div className="hidden md:flex items-center gap-3 pl-4 border-l border-slate-200 dark:border-slate-800">
                <div className="text-right">
                  <p className="text-xs font-bold text-slate-900 dark:text-white">{user.username}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 capitalize">{user.role}</p>
                </div>
                <button
                  onClick={onLogout}
                  className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"
                  title="Sign Out"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
                  </svg>
                </button>
              </div>

              {/* Mobile menu button */}
              <div className="flex items-center md:hidden">
                <button
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="inline-flex items-center justify-center p-2 rounded-md text-slate-400 hover:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <span className="sr-only">Open main menu</span>
                  {isMobileMenuOpen ? (
                    <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : (
                    <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="pt-2 pb-3 space-y-1 px-2">
              {filteredNavItems.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={({ isActive }) => `
                    flex items-center gap-3 px-3 py-2 rounded-lg text-base font-medium transition-colors
                    ${isActive
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                      : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/50'}
                  `}
                >
                  <item.icon className="w-5 h-5" />
                  {item.name}
                </NavLink>
              ))}
            </div>
            <div className="pt-4 pb-4 border-t border-slate-200 dark:border-slate-800 px-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                  <ICONS.User className="w-5 h-5 text-slate-500" />
                </div>
                <div>
                  <div className="text-base font-medium text-slate-800 dark:text-white">{user.username}</div>
                  <div className="text-sm font-medium text-slate-500 dark:text-slate-400 capitalize">{user.role}</div>
                </div>
              </div>
              <button
                onClick={onLogout}
                className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
              >
                Sign Out
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
