
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { storage } from './services/storageService';
import { User, UserRole } from './types';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Assets from './pages/Assets';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import AuditTrail from './pages/AuditTrail';
import UserManagement from './pages/UserManagement';
import Login from './components/Login';
import { ToastProvider } from './components/ToastProvider';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initApp = async () => {
      try {
        await storage.init();
        const currentUser = await storage.getCurrentUser();
        if (currentUser) setUser(currentUser);
      } catch (err) {
        console.error('Failed to initialize system:', err);
      } finally {
        setLoading(false);
      }
    };
    initApp();
  }, []);

  const handleLogin = (u: User) => {
    setUser(u);
  };

  const handleLogout = () => {
    storage.logout().finally(() => setUser(null));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-civic-bg flex flex-col items-center justify-center text-civic-text p-6 text-center">
        <img src="/bcc-logo.jpg" alt="BCC Logo" className="w-20 h-20 object-contain mb-8 animate-pulse bg-white rounded-2xl p-1" />
        <div className="w-12 h-12 border-4 border-civic-primary border-t-transparent rounded-full animate-spin mb-6"></div>
        <h1 className="text-2xl font-bold mb-2">Bulawayo City Council</h1>
        <p className="text-civic-muted">Loading City Inventory System...</p>
      </div>
    );
  }

  return (
    <ToastProvider>
      <Router>
        <Routes>
          <Route
            path="/login"
            element={user ? <Navigate to="/" replace /> : <Login onLogin={handleLogin} />}
          />

          {/* Main Application Routes using persistent Layout */}
          <Route element={user ? <Layout user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />}>
            <Route path="/" element={<Dashboard />} />

            <Route path="/inventory" element={
              user?.role && [UserRole.ADMIN.toLowerCase(), UserRole.HEAD_ADMIN.toLowerCase(), UserRole.STOCK_TAKER.toLowerCase()].includes(user.role.toLowerCase())
                ? <Inventory user={user!} />
                : <Navigate to="/" replace />
            } />

            <Route path="/assets" element={
              user?.role && [UserRole.ADMIN.toLowerCase(), UserRole.HEAD_ADMIN.toLowerCase(), UserRole.ASSET_ADDER.toLowerCase()].includes(user.role.toLowerCase())
                ? <Assets user={user!} />
                : <Navigate to="/" replace />
            } />

            <Route path="/reports" element={
              user?.role?.toLowerCase() === UserRole.ADMIN.toLowerCase() || user?.role?.toLowerCase() === UserRole.HEAD_ADMIN.toLowerCase()
                ? <Reports user={user!} />
                : <Navigate to="/" replace />
            } />

            <Route path="/audit-trail" element={
              user?.role?.toLowerCase() === UserRole.ADMIN.toLowerCase() || user?.role?.toLowerCase() === UserRole.HEAD_ADMIN.toLowerCase()
                ? <AuditTrail />
                : <Navigate to="/" replace />
            } />

            <Route path="/users" element={
              user?.role?.toLowerCase() === UserRole.HEAD_ADMIN.toLowerCase()
                ? <UserManagement />
                : <Navigate to="/" replace />
            } />

            <Route path="/settings" element={
              user?.role?.toLowerCase() === UserRole.ADMIN.toLowerCase() || user?.role?.toLowerCase() === UserRole.HEAD_ADMIN.toLowerCase()
                ? <Settings user={user!} />
                : <Navigate to="/" replace />
            } />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </ToastProvider>
  );
};

export default App;
