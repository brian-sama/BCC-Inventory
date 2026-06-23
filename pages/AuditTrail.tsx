import React, { useState, useEffect, useMemo } from 'react';
import { ICONS } from '../constants';
import { TableSkeleton } from '../components/Skeleton';
import { useToast } from '../components/ToastProvider';
import PageHeader from '../components/ui/PageHeader';
import Pagination from '../components/ui/Pagination';

const AVATAR_COLORS = [
    'bg-blue-100 text-blue-600',
    'bg-purple-100 text-purple-600',
    'bg-green-100 text-green-600',
    'bg-amber-100 text-amber-600',
    'bg-rose-100 text-rose-600',
    'bg-teal-100 text-teal-600',
];

const AVATAR_COLORS_DARK = [
    'dark:bg-blue-900/30 dark:text-blue-400',
    'dark:bg-purple-900/30 dark:text-purple-400',
    'dark:bg-green-900/30 dark:text-green-400',
    'dark:bg-amber-900/30 dark:text-amber-400',
    'dark:bg-rose-900/30 dark:text-rose-400',
    'dark:bg-teal-900/30 dark:text-teal-400',
];

function avatarColor(username: string): string {
    let hash = 0;
    for (let i = 0; i < username.length; i++) hash = (hash * 31 + username.charCodeAt(i)) >>> 0;
    const idx = hash % AVATAR_COLORS.length;
    return `${AVATAR_COLORS[idx]} ${AVATAR_COLORS_DARK[idx]}`;
}

function actionBadgeClass(action: string): string {
    if (action.includes('DELETE') || action.includes('REMOVE')) {
        return 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400';
    }
    if (action.includes('ADD') || action.includes('CREATE') || action.includes('IMPORT')) {
        return 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400';
    }
    if (action.includes('UPDATE') || action.includes('EDIT')) {
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    }
    return 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400';
}

const ITEMS_PER_PAGE = 20;

const AuditTrail: React.FC = () => {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const { showToast } = useToast();

    useEffect(() => {
        loadLogs();
    }, []);

    const loadLogs = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/audit-logs', { credentials: 'include' });
            const data = await response.json();
            if (data.success) {
                setLogs(data.logs);
            }
        } catch (err) {
            showToast('Failed to load activity logs', 'error');
        } finally {
            setLoading(false);
        }
    };

    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            const matchesText =
                (log.username || '').toLowerCase().includes(filter.toLowerCase()) ||
                (log.action || '').toLowerCase().includes(filter.toLowerCase()) ||
                (log.details || '').toLowerCase().includes(filter.toLowerCase());

            const logDate = log.timestamp ? new Date(log.timestamp) : null;
            const matchesStart = !startDate || (logDate && logDate >= new Date(`${startDate}T00:00:00`));
            const matchesEnd = !endDate || (logDate && logDate <= new Date(`${endDate}T23:59:59`));

            return matchesText && matchesStart && matchesEnd;
        });
    }, [logs, filter, startDate, endDate]);

    useEffect(() => { setCurrentPage(1); }, [filter, startDate, endDate]);

    const totalPages = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE);
    const paginated = filteredLogs.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const hasFilters = filter || startDate || endDate;

    return (
        <div className="app-page">
            <PageHeader
                title="Activity History"
                subtitle="Complete record of system actions and data changes."
            />

            <div className="surface-card overflow-hidden p-0">
                <div className="flex flex-wrap items-center gap-3 border-b border-civic-border bg-slate-50 px-4 py-3 dark:bg-slate-800/70">
                    <ICONS.Search className="w-5 h-5 text-slate-400 flex-shrink-0" />
                    <input
                        type="text"
                        placeholder="Filter by username, action, or details..."
                        className="flex-1 min-w-[140px] border-none bg-transparent text-sm placeholder-slate-400 focus:ring-0 dark:text-white"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                    />
                    <div className="flex items-center gap-2 border-l border-civic-border pl-3">
                        <input
                            type="date"
                            value={startDate}
                            max={endDate || undefined}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md px-2 py-1.5 focus:ring-1 focus:ring-blue-500 outline-none dark:text-white"
                            title="Start date"
                            aria-label="Filter start date"
                        />
                        <span className="text-xs text-slate-400">to</span>
                        <input
                            type="date"
                            value={endDate}
                            min={startDate || undefined}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md px-2 py-1.5 focus:ring-1 focus:ring-blue-500 outline-none dark:text-white"
                            title="End date"
                            aria-label="Filter end date"
                        />
                        {hasFilters && (
                            <button
                                type="button"
                                onClick={() => { setFilter(''); setStartDate(''); setEndDate(''); }}
                                className="text-xs text-slate-500 hover:text-red-500 transition-colors px-2 py-1 rounded"
                                aria-label="Clear filters"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    {loading ? (
                        <TableSkeleton rows={10} cols={4} />
                    ) : (
                        <table className="table-shell text-left">
                            <thead className="table-head text-xs uppercase tracking-wider">
                                <tr>
                                    <th className="px-6 py-4">User</th>
                                    <th className="px-6 py-4">Action</th>
                                    <th className="px-6 py-4">Details</th>
                                    <th className="px-6 py-4">Timestamp</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                {paginated.map((log, i) => (
                                    <tr key={log.id || i} className="table-row transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs uppercase flex-shrink-0 ${avatarColor(log.username || 'U')}`}>
                                                    {(log.username || 'U').substring(0, 2)}
                                                </div>
                                                <span className="font-semibold text-civic-text dark:text-white">{log.username || 'System'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-tight ${actionBadgeClass(log.action || '')}`}>
                                                {(log.action || 'Action').replace(/_/g, ' ')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-civic-muted dark:text-slate-400 max-w-xs truncate">
                                            {log.details}
                                        </td>
                                        <td className="px-6 py-4 text-xs text-slate-400 whitespace-nowrap">
                                            {new Date(log.timestamp).toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                                {filteredLogs.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-20 text-center text-slate-400 italic">
                                            {hasFilters ? 'No logs match the current filters.' : 'No activity logs found.'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>

                {totalPages > 1 && (
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalItems={filteredLogs.length}
                        itemsPerPage={ITEMS_PER_PAGE}
                        onPageChange={setCurrentPage}
                        itemLabel="log entries"
                    />
                )}
            </div>
        </div>
    );
};

export default AuditTrail;
