
import React from 'react';
import { storage, STORES } from '../services/storageService';
import { User } from '../types';
import PageHeader from '../components/ui/PageHeader';

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
        <div className="app-page">
            <PageHeader
                title="Reporting Center"
                subtitle="Generate and export system data for administrative review."
            />
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
    <div className="surface-card surface-card-hover flex flex-col justify-between">
        <div>
            <h3 className="text-lg font-semibold text-civic-text dark:text-white mb-2">{title}</h3>
            <p className="text-sm text-civic-muted dark:text-slate-400 mb-6">{desc}</p>
        </div>
        <button onClick={onExport} className="civic-button-primary w-full">
            Download CSV Report
        </button>
    </div>
);

export default Reports;
