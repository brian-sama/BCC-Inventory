import React, { useState, useEffect } from 'react';
import { storage, STORES } from '../services/storageService';
import { ICONS } from '../constants';
import { TableSkeleton } from '../components/Skeleton';
import { useToast } from '../components/ToastProvider';

const AuditTrail: React.FC = () => {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');
    const { showToast } = useToast();

    useEffect(() => {
        loadLogs();
    }, []);

    const loadLogs = async () => {
        try {
            setLoading(true);
            const data = await storage.getAll<any>(STORES.ACTIVITY_LOGS);
            setLogs(data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
        } catch (err) {
            showToast('Failed to load activity logs', 'error');
        } finally {
            setLoading(false);
        }
    };

    const filteredLogs = logs.filter(log =>
        log.username.toLowerCase().includes(filter.toLowerCase()) ||
        log.action.toLowerCase().includes(filter.toLowerCase()) ||
        log.details.toLowerCase().includes(filter.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
                <h2 className="text-2xl font-bold dark:text-white">Activity History</h2>
                <p className="text-slate-500 dark:text-slate-400">Complete record of system actions and data changes.</p>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center gap-3">
                    <ICONS.Search className="w-5 h-5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Filter logs by username, action, or details..."
                        className="bg-transparent border-none focus:ring-0 text-sm w-full dark:text-white placeholder-slate-400"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                    />
                </div>

                <div className="overflow-x-auto">
                    {loading ? (
                        <TableSkeleton rows={10} cols={4} />
                    ) : (
                        <table className="w-full text-left">
                            <thead className="text-xs uppercase tracking-wider font-bold text-slate-500 border-b border-slate-200 dark:border-slate-800">
                                <tr>
                                    <th className="px-6 py-4">User</th>
                                    <th className="px-6 py-4">Action</th>
                                    <th className="px-6 py-4">Details</th>
                                    <th className="px-6 py-4">Timestamp</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                {filteredLogs.map((log, i) => (
                                    <tr key={log.id || i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 font-bold text-xs uppercase">
                                                    {log.username.substring(0, 2)}
                                                </div>
                                                <span className="font-semibold dark:text-white">{log.username}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-tight ${log.action.includes('DELETE') ? 'bg-red-100 text-red-600' :
                                                log.action.includes('ADD') ? 'bg-green-100 text-green-600' :
                                                    'bg-blue-100 text-blue-600'
                                                }`}>
                                                {log.action.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                                            {log.details}
                                        </td>
                                        <td className="px-6 py-4 text-xs text-slate-400">
                                            {new Date(log.timestamp).toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                                {filteredLogs.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-20 text-center text-slate-400 italic">No activity logs found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AuditTrail;
