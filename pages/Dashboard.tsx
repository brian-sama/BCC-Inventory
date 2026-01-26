import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { storage, STORES } from '../services/storageService';
import { InventoryItem, Asset, SystemStats, ActivityLog } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<SystemStats>({ totalInventoryValue: 0, totalItems: 0, totalAssets: 0, lowStockCount: 0 });
  const [recentLogs, setRecentLogs] = useState<ActivityLog[]>([]);
  const [inventoryByCat, setInventoryByCat] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const items = await storage.getAll<InventoryItem>(STORES.INVENTORY);
    const assets = await storage.getAll<Asset>(STORES.ASSETS);
    const logs = await storage.getAll<ActivityLog>(STORES.LOGS);

    const totalValue = items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const lowStock = items.filter(i => i.quantity <= i.lowStockThreshold).length;

    setStats({
      totalInventoryValue: totalValue,
      totalItems: items.length,
      totalAssets: assets.length,
      lowStockCount: lowStock
    });

    setRecentLogs(logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 5));

    // Category aggregation
    const cats: Record<string, number> = {};
    items.forEach(i => {
      cats[i.category] = (cats[i.category] || 0) + i.quantity;
    });
    setInventoryByCat(Object.entries(cats).map(([name, value]) => ({ name, value })));
  };

  const COLORS_LIST = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className="space-y-8">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-4 mb-6">
        <h2 className="text-2xl font-bold dark:text-white">System Overview</h2>
        <p className="text-slate-500 dark:text-slate-400">Real-time statistics for Bulawayo City Council assets and stock.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Inventory Value"
          value={`$${stats.totalInventoryValue.toLocaleString()}`}
          sub="Total market value"
          icon="💰"
          trend="primary"
          onClick={() => navigate('/inventory')}
        />
        <StatCard
          title="Stock Items"
          value={stats.totalItems.toString()}
          sub="Unique SKUs tracked"
          icon="📦"
          trend="neutral"
          onClick={() => navigate('/inventory')}
        />
        <StatCard
          title="Employee Assets"
          value={stats.totalAssets.toString()}
          sub="Assigned hardware"
          icon="💻"
          trend="neutral"
          onClick={() => navigate('/assets')}
        />
        <StatCard
          title="Low Stock Alerts"
          value={stats.lowStockCount.toString()}
          sub="Requires attention"
          icon="⚠️"
          trend={stats.lowStockCount > 0 ? "danger" : "success"}
          onClick={() => navigate('/inventory')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
          <h3 className="text-lg font-bold mb-6 dark:text-white">Inventory by Category</h3>
          <div className="h-[300px] w-full min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={inventoryByCat}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" fontSize={12} stroke="#94a3b8" />
                <YAxis fontSize={12} stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {inventoryByCat.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS_LIST[index % COLORS_LIST.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
          <h3 className="text-lg font-bold mb-6 dark:text-white">Recent Activity</h3>
          <div className="space-y-4">
            {recentLogs.length > 0 ? recentLogs.map((log) => (
              <div key={log.id} className="flex gap-4 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0 font-bold">
                  {log.username[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <p className="text-sm font-semibold dark:text-white truncate">{log.action}</p>
                    <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">{new Date(log.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">{log.details}</p>
                  <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-tight">User: {log.username}</p>
                </div>
              </div>
            )) : (
              <div className="text-center py-12 text-slate-400 italic">No recent activity</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ title: string, value: string, sub: string, icon: string, trend: 'primary' | 'danger' | 'success' | 'neutral', onClick?: () => void }> = ({ title, value, sub, icon, trend, onClick }) => {
  const trendColors = {
    primary: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20',
    danger: 'text-red-600 bg-red-50 dark:bg-red-900/20',
    success: 'text-green-600 bg-green-50 dark:bg-green-900/20',
    neutral: 'text-slate-600 bg-slate-50 dark:bg-slate-800/50'
  };

  return (
    <div
      onClick={onClick}
      className={`bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-all duration-300 ${onClick ? 'cursor-pointer hover:shadow-xl hover:-translate-y-1 hover:border-blue-500/30' : ''}`}
    >
      <div className="flex justify-between items-start mb-4">
        <span className="text-2xl">{icon}</span>
        <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide ${trendColors[trend]}`}>
          {trend === 'danger' ? 'Critical' : 'Live'}
        </div>
      </div>
      <h4 className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">{title}</h4>
      <div className="text-3xl font-bold dark:text-white mb-1">{value}</div>
      <div className="flex justify-between items-center">
        <p className="text-xs text-slate-400 dark:text-slate-500">{sub}</p>
        {onClick && (
          <svg className="w-4 h-4 text-slate-300 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
