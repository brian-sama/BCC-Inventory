
import React from 'react';
import { storage, STORES } from '../services/storageService';
import { User } from '../types';

interface ReportsProps {
    user: User;
}

const Reports: React.FC<ReportsProps> = ({ user }) => {
    const downloadCSV = async (type: 'inventory' | 'assets') => {
        try {
            const data = await storage.getAll(type === 'inventory' ? STORES.INVENTORY : STORES.ASSETS);
            if (data.length === 0) return alert('No data to export.');

            const headers = Object.keys(data[0]);
            const csvContent = [
                headers.join(','),
                ...data.map(row => headers.map(h => {
                    const val = (row as any)[h];
                    return `"${String(val ?? '').replace(/"/g, '""')}"`;
                }).join(','))
            ].join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Bulawayo_SIMS_${type}_Report_${new Date().toISOString().split('T')[0]}.csv`);

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            setTimeout(() => URL.revokeObjectURL(url), 200);

            await storage.logActivity(user.id, user.username, 'EXPORT_CSV', `Exported ${type} report.`);
        } catch (err) {
            console.error('Export failed:', err);
            alert('Failed to generate report. Please check the console for details.');
        }
    };

    return (
        <div className="space-y-6">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-4 mb-6">
                <h2 className="text-2xl font-bold dark:text-white">Reporting Center</h2>
                <p className="text-slate-500 dark:text-slate-400">Generate and export system data for administrative review.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ReportCard
                    title="Full Inventory Audit"
                    desc="Complete list of all stock items, quantities, and market values."
                    onExport={() => downloadCSV('inventory')}
                />
                <ReportCard
                    title="Asset Register"
                    desc="Registry of all hardware assigned to employees across all departments."
                    onExport={() => downloadCSV('assets')}
                />
            </div>
        </div>
    );
};

const ReportCard: React.FC<{ title: string, desc: string, onExport: () => void }> = ({ title, desc, onExport }) => (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between transition-all hover:shadow-md hover:border-blue-500/30">
        <div>
            <h3 className="text-lg font-bold dark:text-white mb-2">{title}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{desc}</p>
        </div>
        <button onClick={onExport} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors shadow-lg shadow-blue-500/20 active:scale-[0.98]">
            Download CSV Report
        </button>
    </div>
);

export default Reports;
