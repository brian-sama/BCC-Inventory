import React, { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ICONS } from '../constants';
import { useToast } from '../components/ToastProvider';
import FilterBar from '../components/ui/FilterBar';
import KpiTile from '../components/ui/KpiTile';
import PageHeader from '../components/ui/PageHeader';
import SectionCard from '../components/ui/SectionCard';
import TrackingButton from '../components/ui/TrackingButton';
import { storage, STORES } from '../services/storageService';
import { trackingService } from '../services/trackingService';
import {
  ActivityLog,
  Asset,
  DashboardAlert,
  DashboardFilterState,
  InventoryItem,
  KpiMetric,
  RfidStatus,
} from '../types';
import { civicTheme, TABLE_CLASSES } from '../theme';

const ALERT_PRIORITY: Record<DashboardAlert['severity'], number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

const CHART_COLORS = ['#1E40AF', '#4338CA', '#0284C7', '#0F766E', '#B45309', '#475569'];

const Dashboard: React.FC = () => {
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [rfidStatus, setRfidStatus] = useState<RfidStatus>({
    state: 'disconnected',
    message: 'Checking reader status...',
    lastChecked: new Date().toISOString(),
  });
  const [filters, setFilters] = useState<DashboardFilterState>({
    startDate: '',
    endDate: '',
    department: '',
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [itemsData, assetsData, logsData, readerStatus] = await Promise.all([
          storage.getAll<InventoryItem>(STORES.INVENTORY),
          storage.getAll<Asset>(STORES.ASSETS),
          storage.getAll<ActivityLog>(STORES.LOGS),
          trackingService.getRfidStatus(),
        ]);

        setInventory(itemsData);
        setAssets(assetsData);
        setLogs(logsData);
        setRfidStatus(readerStatus);
      } catch (err) {
        setError('Failed to load dashboard data. Please refresh and try again.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const matchesDateRange = (isoDate: string) => {
    if (!filters.startDate && !filters.endDate) return true;
    if (!isoDate) return false;

    const sourceDate = new Date(isoDate);
    if (Number.isNaN(sourceDate.getTime())) return false;

    if (filters.startDate) {
      const start = new Date(`${filters.startDate}T00:00:00`);
      if (sourceDate < start) return false;
    }

    if (filters.endDate) {
      const end = new Date(`${filters.endDate}T23:59:59.999`);
      if (sourceDate > end) return false;
    }

    return true;
  };

  const filteredInventory = useMemo(
    () => inventory.filter((item) => matchesDateRange(item.createdAt)),
    [inventory, filters.startDate, filters.endDate],
  );

  const filteredAssets = useMemo(
    () =>
      assets.filter((asset) => {
        const inDateRange = matchesDateRange(asset.createdAt);
        const matchesDepartment = !filters.department || asset.department === filters.department;
        return inDateRange && matchesDepartment;
      }),
    [assets, filters.department, filters.startDate, filters.endDate],
  );

  const filteredLogs = useMemo(
    () => logs.filter((log) => matchesDateRange(log.timestamp)),
    [logs, filters.startDate, filters.endDate],
  );

  const departments = useMemo(() => {
    const departmentSet = new Set<string>();
    assets.forEach((asset) => {
      if (asset.department) departmentSet.add(asset.department);
    });
    return [...departmentSet].sort((a, b) => a.localeCompare(b));
  }, [assets]);

  const kpis = useMemo<KpiMetric[]>(() => {
    const lowStock = filteredInventory.filter(
      (item) => item.quantity > 0 && item.quantity <= item.lowStockThreshold,
    ).length;
    const outOfStock = filteredInventory.filter((item) => item.quantity === 0).length;
    const operationalAssets = filteredAssets.filter((asset) => asset.status.toLowerCase() === 'active').length;

    return [
      {
        key: 'total_inventory',
        label: 'Total Inventory',
        value: filteredInventory.length,
        description: 'Tracked stock records',
        tone: 'blue',
      },
      {
        key: 'low_stock',
        label: 'Low Stock',
        value: lowStock,
        description: 'Needs replenishment',
        tone: 'amber',
      },
      {
        key: 'out_of_stock',
        label: 'Out of Stock',
        value: outOfStock,
        description: 'Requires urgent action',
        tone: 'red',
      },
      {
        key: 'assets_assigned',
        label: 'Assets Assigned',
        value: filteredAssets.length,
        description: 'Assigned to personnel',
        tone: 'indigo',
      },
      {
        key: 'operational',
        label: 'Operational',
        value: operationalAssets,
        description: 'Assets in active state',
        tone: 'green',
      },
    ];
  }, [filteredAssets, filteredInventory]);

  const inventoryByCategory = useMemo(() => {
    const categoryTotals: Record<string, number> = {};
    filteredInventory.forEach((item) => {
      categoryTotals[item.category || 'Uncategorized'] =
        (categoryTotals[item.category || 'Uncategorized'] || 0) + item.quantity;
    });

    return Object.entries(categoryTotals).map(([name, value]) => ({ name, value }));
  }, [filteredInventory]);

  const alerts = useMemo<DashboardAlert[]>(() => {
    const now = new Date();
    const list: DashboardAlert[] = [];

    filteredInventory.forEach((item) => {
      if (item.quantity === 0) {
        list.push({
          id: `out-${item.id}`,
          severity: 'critical',
          title: `${item.name} is out of stock`,
          description: `Current quantity is 0 for serial ${item.serialNumber || 'N/A'}.`,
          source: 'Inventory',
          actionLabel: 'Open Inventory',
          actionHref: '/inventory',
        });
      } else if (item.quantity <= item.lowStockThreshold) {
        list.push({
          id: `low-${item.id}`,
          severity: 'warning',
          title: `${item.name} is below threshold`,
          description: `${item.quantity} units remaining (limit ${item.lowStockThreshold}).`,
          source: 'Inventory',
          actionLabel: 'Review Stock',
          actionHref: '/inventory',
        });
      }
    });

    filteredAssets.forEach((asset) => {
      if (asset.warrantyExpiry) {
        const expiryDate = new Date(asset.warrantyExpiry);
        if (!Number.isNaN(expiryDate.getTime())) {
          const daysUntilExpiry = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (daysUntilExpiry < 0) {
            list.push({
              id: `w-exp-${asset.id}`,
              severity: 'critical',
              title: `Warranty expired for ${asset.employeeName}`,
              description: `${asset.type} (${asset.serialNumber || 'N/A'}) expired on ${expiryDate.toLocaleDateString()}.`,
              source: 'Assets',
              actionLabel: 'Open Assets',
              actionHref: '/assets',
            });
          } else if (daysUntilExpiry <= 30) {
            list.push({
              id: `w-warn-${asset.id}`,
              severity: 'warning',
              title: `Warranty near expiry for ${asset.employeeName}`,
              description: `${asset.type} warranty expires in ${daysUntilExpiry} day(s).`,
              source: 'Assets',
              actionLabel: 'Open Assets',
              actionHref: '/assets',
            });
          }
        }
      }

      if (asset.status === 'Under Repair') {
        list.push({
          id: `repair-${asset.id}`,
          severity: 'info',
          title: `${asset.employeeName} asset under repair`,
          description: `${asset.type} (${asset.serialNumber || 'N/A'}) currently flagged for repair.`,
          source: 'Assets',
          actionLabel: 'Open Assets',
          actionHref: '/assets',
        });
      }
    });

    return list.sort((a, b) => ALERT_PRIORITY[a.severity] - ALERT_PRIORITY[b.severity]).slice(0, 6);
  }, [filteredAssets, filteredInventory]);

  const recentActivity = useMemo(
    () =>
      [...filteredLogs]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 8),
    [filteredLogs],
  );

  const exportFilteredAssets = () => {
    if (filteredAssets.length === 0) {
      showToast('No filtered rows available to export.', 'warning');
      return;
    }

    const rows = filteredAssets.map((asset) => ({
      employeeName: asset.employeeName,
      type: asset.type,
      serialNumber: asset.serialNumber,
      department: asset.department,
      status: asset.status,
      warrantyExpiry: asset.warrantyExpiry,
      createdAt: asset.createdAt,
    }));

    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(','),
      ...rows.map((row) => headers.map((header) => `"${String((row as any)[header] ?? '').replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `bcc_dashboard_filtered_assets_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 200);
    showToast(`Exported ${rows.length} filtered asset rows.`, 'success');
  };

  const handleQrScan = async () => {
    const result = await trackingService.scanQrCode();
    showToast(result.message, result.success ? 'info' : 'error');
  };

  const handleBarcodeScan = async () => {
    const result = await trackingService.scanBarcode();
    showToast(result.message, result.success ? 'info' : 'error');
  };

  const handleRfidAction = async () => {
    const nextStatus = await trackingService.connectRfidReader();
    setRfidStatus(nextStatus);
    showToast(nextStatus.message, nextStatus.state === 'connected' ? 'success' : 'warning');
  };

  const rfidBadgeClass =
    rfidStatus.state === 'connected'
      ? 'bg-green-100 text-green-700 border border-green-200'
      : rfidStatus.state === 'disconnected'
        ? 'bg-amber-100 text-amber-700 border border-amber-200'
        : 'bg-slate-100 text-slate-700 border border-slate-200';

  const kpiIcons: Record<KpiMetric['key'], React.ReactNode> = {
    total_inventory: <ICONS.Inventory className="h-5 w-5" />,
    low_stock: <ICONS.AlertCircle className="h-5 w-5" />,
    out_of_stock: <ICONS.AlertCircle className="h-5 w-5" />,
    assets_assigned: <ICONS.Assets className="h-5 w-5" />,
    operational: <ICONS.Dashboard className="h-5 w-5" />,
  };

  return (
    <div className="app-page space-y-5">
      <PageHeader
        title="System Overview"
        subtitle="Structured municipal operations summary for inventory, assets, and tracking."
      />

      <FilterBar filters={filters} departments={departments} onChange={setFilters} onExport={exportFilteredAssets} />

      {loading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-40 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
          ))}
        </div>
      ) : null}

      {error ? (
        <div className="surface-card border-red-200 bg-red-50 text-red-700">{error}</div>
      ) : null}

      {!loading && !error ? (
        <>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-5">
            {kpis.map((metric) => (
              <KpiTile key={metric.key} metric={metric} icon={kpiIcons[metric.key]} />
            ))}
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
            <SectionCard title="Inventory by Category" className="xl:col-span-8">
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={inventoryByCategory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis dataKey="name" fontSize={12} stroke="#64748B" />
                    <YAxis fontSize={12} stroke="#64748B" />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid #E2E8F0',
                        boxShadow: '0 6px 16px rgba(15, 23, 42, 0.08)',
                      }}
                      cursor={{ fill: 'rgba(219, 234, 254, 0.55)' }}
                    />
                    <Legend />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {inventoryByCategory.map((_, index) => (
                        <Cell key={`category-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>

            <div className="space-y-6 xl:col-span-4">
              <SectionCard title="Alerts" subtitle="Prioritized risk signals from inventory and assets">
                {alerts.length === 0 ? (
                  <p className="text-sm text-civic-muted">No active alerts for the selected filters.</p>
                ) : (
                  <ul className="space-y-3">
                    {alerts.map((alert) => (
                      <li key={alert.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-civic-text">{alert.title}</p>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${civicTheme.statusBadgeClasses[alert.severity]}`}>
                            {alert.severity}
                          </span>
                        </div>
                        <p className="text-xs text-civic-muted">{alert.description}</p>
                        <a className="mt-2 inline-block text-xs font-semibold text-civic-primary hover:text-civic-primaryHover" href={alert.actionHref}>
                          {alert.actionLabel}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>

              <SectionCard title="Tracking Operations" subtitle="Scan and reader controls">
                <div className="grid grid-cols-3 gap-3">
                  <TrackingButton
                    label="Scan QR Code"
                    onClick={handleQrScan}
                    icon={
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z" />
                        <path d="M14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z" />
                      </svg>
                    }
                  />
                  <TrackingButton
                    label="Scan Barcode"
                    onClick={handleBarcodeScan}
                    icon={
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M4 6v12M7 6v12M10 6v12M14 6v12M17 6v12M20 6v12" />
                      </svg>
                    }
                  />
                  <TrackingButton
                    label="RFID Reader"
                    onClick={handleRfidAction}
                    icon={
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M3 12a9 9 0 0 1 18 0M6 12a6 6 0 0 1 12 0M9 12a3 3 0 0 1 6 0M12 16h.01" />
                      </svg>
                    }
                  />
                </div>
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-civic-muted">Reader Status</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${rfidBadgeClass}`}>
                      {rfidStatus.state}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-civic-muted">{rfidStatus.message}</p>
                </div>
              </SectionCard>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <SectionCard title="Asset Details" subtitle="Filtered operational asset records">
              <div className={TABLE_CLASSES.wrapper}>
                <table className={TABLE_CLASSES.table}>
                  <thead className={TABLE_CLASSES.head}>
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Employee</th>
                      <th className="px-4 py-3 text-left font-semibold">Asset</th>
                      <th className="px-4 py-3 text-left font-semibold">Department</th>
                      <th className="px-4 py-3 text-left font-semibold">Status</th>
                      <th className="px-4 py-3 text-left font-semibold">Warranty</th>
                    </tr>
                  </thead>
                  <tbody className={TABLE_CLASSES.body}>
                    {filteredAssets.slice(0, 5).map((asset) => (
                      <tr key={asset.id} className={TABLE_CLASSES.row}>
                        <td className="px-4 py-3 font-medium text-civic-text">{asset.employeeName}</td>
                        <td className="px-4 py-3 text-civic-muted">{asset.type}</td>
                        <td className="px-4 py-3 text-civic-muted">{asset.department || 'N/A'}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                            {asset.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-civic-muted">
                          {asset.warrantyExpiry ? new Date(asset.warrantyExpiry).toLocaleDateString() : 'N/A'}
                        </td>
                      </tr>
                    ))}
                    {filteredAssets.length === 0 ? (
                      <tr>
                        <td className="px-4 py-8 text-center text-sm text-civic-muted" colSpan={5}>
                          No assets available for the current filter.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            <SectionCard title="Recent Activity" subtitle="Latest operational history">
              <div className={TABLE_CLASSES.wrapper}>
                <table className={TABLE_CLASSES.table}>
                  <thead className={TABLE_CLASSES.head}>
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Action</th>
                      <th className="px-4 py-3 text-left font-semibold">User</th>
                      <th className="px-4 py-3 text-left font-semibold">Details</th>
                      <th className="px-4 py-3 text-right font-semibold">Time</th>
                    </tr>
                  </thead>
                  <tbody className={TABLE_CLASSES.body}>
                    {recentActivity.slice(0, 5).map((log) => (
                      <tr key={log.id} className={TABLE_CLASSES.row}>
                        <td className="px-4 py-3 font-medium text-civic-text">{log.action}</td>
                        <td className="px-4 py-3 text-civic-muted">{log.username}</td>
                        <td className="px-4 py-3 text-civic-muted">{log.details}</td>
                        <td className="px-4 py-3 text-right text-civic-muted">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                    {recentActivity.length === 0 ? (
                      <tr>
                        <td className="px-4 py-8 text-center text-sm text-civic-muted" colSpan={4}>
                          No activity records available for the current filter.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </div>

        </>
      ) : null}
    </div>
  );
};

export default Dashboard;
