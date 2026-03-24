
import React from 'react';
import { storage, STORES } from '../services/storageService';
import { User } from '../types';
import PageHeader from '../components/ui/PageHeader';

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

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

            await storage.logActivity(user.id, user.username, 'EXPORT_CSV', `Exported ${type} CSV report.`);
        } catch (err) {
            console.error('Export failed:', err);
            alert('Failed to generate CSV. Please check the console.');
        }
    };

    const downloadPDF = async (type: 'inventory' | 'assets') => {
        try {
            const data = await storage.getAll(type === 'inventory' ? STORES.INVENTORY : STORES.ASSETS);
            if (data.length === 0) return alert('No data to export.');

            const doc = new jsPDF('l', 'mm', 'a4');
            const title = type === 'inventory' ? 'Inventory Audit Register' : 'Asset Register';
            const timestamp = new Date().toLocaleString();

            doc.setFontSize(18);
            doc.text(`Bulawayo City Council - ${title}`, 14, 20);
            doc.setFontSize(10);
            doc.text(`Generated on: ${timestamp} | User: ${user.fullName}`, 14, 28);

            const headers = Object.keys(data[0]);
            const rows = data.map(item => headers.map(h => String((item as any)[h] || '')));

            autoTable(doc, {
                startY: 35,
                head: [headers.map(h => h.replace(/_/g, ' ').toUpperCase())],
                body: rows,
                theme: 'striped',
                headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255] },
                styles: { fontSize: 8, cellPadding: 2 },
            });

            doc.save(`Bulawayo_SIMS_${type}_Report_${new Date().toISOString().split('T')[0]}.pdf`);
            await storage.logActivity(user.id, user.username, 'EXPORT_PDF', `Exported ${type} PDF report.`);
        } catch (err) {
            console.error('PDF Export failed:', err);
            alert('Failed to generate PDF. Please check the console.');
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
                    onCSV={() => downloadCSV('inventory')}
                    onPDF={() => downloadPDF('inventory')}
                />
                <ReportCard
                    title="Asset Register"
                    desc="Registry of all hardware assigned to employees across all departments."
                    onCSV={() => downloadCSV('assets')}
                    onPDF={() => downloadPDF('assets')}
                />
            </div>
        </div>
    );
};

const ReportCard: React.FC<{ title: string, desc: string, onCSV: () => void, onPDF: () => void }> = ({ title, desc, onCSV, onPDF }) => (
    <div className="surface-card surface-card-hover flex flex-col justify-between">
        <div>
            <h3 className="text-lg font-semibold text-civic-text dark:text-white mb-2">{title}</h3>
            <p className="text-sm text-civic-muted dark:text-slate-400 mb-6">{desc}</p>
        </div>
        <div className="flex flex-col gap-3">
            <button onClick={onCSV} className="civic-button-secondary w-full text-xs py-2">
                Download CSV
            </button>
            <button onClick={onPDF} className="civic-button-primary w-full text-xs py-2">
                Download PDF Register
            </button>
        </div>
    </div>
);

export default Reports;
