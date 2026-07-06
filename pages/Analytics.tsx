import React, { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import PageHeader from '../components/ui/PageHeader';
import SectionCard from '../components/ui/SectionCard';
import { storage, STORES } from '../services/storageService';
import { Asset } from '../types';
import { TABLE_CLASSES } from '../theme';

const CHART_COLORS = ['#1E40AF', '#4338CA', '#0284C7', '#0F766E', '#B45309', '#475569', '#9333EA', '#DB2777'];
const STATUS_COLORS: Record<string, string> = {
  Active: '#0F766E',
  'Under Repair': '#B45309',
  Disposed: '#DC2626',
};

interface StatTileProps {
  label: string;
  value: number;
  tone: 'blue' | 'red' | 'amber' | 'green';
}

const TONE_CLASSES: Record<StatTileProps['tone'], string> = {
  blue: 'bg-blue-600',
  red: 'bg-red-600',
  amber: 'bg-amber-500',
  green: 'bg-green-600',
};

const StatTile: React.FC<StatTileProps> = ({ label, value, tone }) => (
  <article className={`rounded-xl p-5 text-white shadow-civic-sm ${TONE_CLASSES[tone]}`}>
    <span className="text-sm font-medium opacity-90">{label}</span>
    <p className="mt-2 text-3xl font-semibold leading-none">{value.toLocaleString()}</p>
  </article>
);

const Analytics: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [showRawData, setShowRawData] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await storage.getAll<Asset>(STORES.ASSETS);
        setAssets(data);
      } catch (err) {
        setError('Failed to load asset analytics. Please refresh and try again.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const next30 = new Date(today);
    next30.setDate(next30.getDate() + 30);

    let expired = 0;
    let upcomingDisposals = 0;
    let healthy = 0;

    assets.forEach((asset) => {
      if (asset.disposalDate) {
        const disposal = new Date(asset.disposalDate);
        if (!Number.isNaN(disposal.getTime())) {
          if (disposal < today) expired += 1;
          else if (disposal <= next30) upcomingDisposals += 1;
        }
      }
      if (asset.status === 'Active') healthy += 1;
    });

    return {
      total: assets.length,
      expired,
      upcomingDisposals,
      healthy,
    };
  }, [assets]);

  const conditionDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    assets.forEach((asset) => {
      const status = asset.status || 'Unknown';
      counts[status] = (counts[status] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [assets]);

  const byDepartment = useMemo(() => {
    const counts: Record<string, number> = {};
    assets.forEach((asset) => {
      const department = asset.department || 'Unassigned';
      counts[department] = (counts[department] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([department, count]) => ({ department, count }))
      .sort((a, b) => b.count - a.count);
  }, [assets]);

  const acquisitionTimeline = useMemo(() => {
    const counts: Record<number, number> = {};
    assets.forEach((asset) => {
      if (!asset.purchaseDate) return;
      const year = new Date(asset.purchaseDate).getFullYear();
      if (Number.isNaN(year)) return;
      counts[year] = (counts[year] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([year, count]) => ({ year: Number(year), count }))
      .sort((a, b) => a.year - b.year);
  }, [assets]);

  return (
    <div className="app-page space-y-5">
      <PageHeader
        title="Asset Intelligence Dashboard"
        subtitle="Live procurement analytics and asset age profiling."
      />

      {loading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
          ))}
        </div>
      ) : null}

      {error ? <div className="surface-card border-red-200 bg-red-50 text-red-700">{error}</div> : null}

      {!loading && !error && assets.length === 0 ? (
        <div className="surface-card text-sm text-civic-muted">
          No asset data found. Please ensure assets have been added to the system.
        </div>
      ) : null}

      {!loading && !error && assets.length > 0 ? (
        <>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Total Assets" value={stats.total} tone="blue" />
            <StatTile label="Expired Assets" value={stats.expired} tone="red" />
            <StatTile label="Upcoming Disposals (30d)" value={stats.upcomingDisposals} tone="amber" />
            <StatTile label="Healthy Assets" value={stats.healthy} tone="green" />
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <SectionCard title="Asset Condition Distribution">
              <div className="h-[300px] min-h-[300px] min-w-0">
                <ResponsiveContainer width="100%" height={300} minWidth={1} minHeight={1}>
                  <PieChart>
                    <Pie
                      data={conditionDistribution}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={(entry) => `${entry.name}: ${entry.value}`}
                    >
                      {conditionDistribution.map((entry) => (
                        <Cell
                          key={entry.name}
                          fill={STATUS_COLORS[entry.name] || CHART_COLORS[0]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid #E2E8F0',
                        boxShadow: '0 6px 16px rgba(15, 23, 42, 0.08)',
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>

            <SectionCard title="Assets by Department">
              <div className="h-[300px] min-h-[300px] min-w-0">
                <ResponsiveContainer width="100%" height={300} minWidth={1} minHeight={1}>
                  <BarChart data={byDepartment}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis dataKey="department" fontSize={12} stroke="#64748B" />
                    <YAxis fontSize={12} stroke="#64748B" allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid #E2E8F0',
                        boxShadow: '0 6px 16px rgba(15, 23, 42, 0.08)',
                      }}
                      cursor={{ fill: 'rgba(219, 234, 254, 0.55)' }}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {byDepartment.map((_, index) => (
                        <Cell key={`dept-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
          </div>

          <SectionCard title="Procurement & Age Profile" subtitle="Asset acquisition timeline by purchase year">
            {acquisitionTimeline.length === 0 ? (
              <p className="text-sm text-civic-muted">No valid purchase dates available for the acquisition timeline.</p>
            ) : (
              <div className="h-[300px] min-h-[300px] min-w-0">
                <ResponsiveContainer width="100%" height={300} minWidth={1} minHeight={1}>
                  <LineChart data={acquisitionTimeline}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis dataKey="year" fontSize={12} stroke="#64748B" />
                    <YAxis fontSize={12} stroke="#64748B" allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid #E2E8F0',
                        boxShadow: '0 6px 16px rgba(15, 23, 42, 0.08)',
                      }}
                    />
                    <Line type="monotone" dataKey="count" stroke="#1E40AF" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Raw Asset Data"
            actions={
              <button
                type="button"
                className="civic-button-secondary text-sm"
                onClick={() => setShowRawData((prev) => !prev)}
              >
                {showRawData ? 'Hide' : 'View'} Raw Asset Data
              </button>
            }
          >
            {showRawData ? (
              <div className={TABLE_CLASSES.wrapper}>
                <table className={TABLE_CLASSES.table}>
                  <thead className={TABLE_CLASSES.head}>
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Employee</th>
                      <th className="px-4 py-3 text-left font-semibold">Asset</th>
                      <th className="px-4 py-3 text-left font-semibold">Department</th>
                      <th className="px-4 py-3 text-left font-semibold">Status</th>
                      <th className="px-4 py-3 text-left font-semibold">Purchase Date</th>
                      <th className="px-4 py-3 text-left font-semibold">Disposal Date</th>
                    </tr>
                  </thead>
                  <tbody className={TABLE_CLASSES.body}>
                    {assets.map((asset) => (
                      <tr key={asset.id} className={TABLE_CLASSES.row}>
                        <td className="px-4 py-3 font-medium text-civic-text">{asset.employeeName}</td>
                        <td className="px-4 py-3 text-civic-muted">{asset.type}</td>
                        <td className="px-4 py-3 text-civic-muted">{asset.department || 'N/A'}</td>
                        <td className="px-4 py-3 text-civic-muted">{asset.status}</td>
                        <td className="px-4 py-3 text-civic-muted">
                          {asset.purchaseDate ? new Date(asset.purchaseDate).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-civic-muted">
                          {asset.disposalDate ? new Date(asset.disposalDate).toLocaleDateString() : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-civic-muted">Click "View Raw Asset Data" to inspect the underlying records.</p>
            )}
          </SectionCard>
        </>
      ) : null}
    </div>
  );
};

export default Analytics;
