import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { storage, STORES } from '../services/storageService';
import { Asset, User, Department } from '../types';
import { ICONS } from '../constants';
import Papa from 'papaparse';
import { format, addYears } from 'date-fns';
import PageHeader from '../components/ui/PageHeader';
import { TableSkeleton } from '../components/Skeleton';
import { useToast } from '../components/ToastProvider';
import { ConfirmModal } from '../components/ConfirmModal';
import Pagination from '../components/ui/Pagination';

interface AssetsProps {
  user: User;
}

const Assets: React.FC<AssetsProps> = ({ user }) => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [repairStatuses, setRepairStatuses] = useState<Record<string, string>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string; name: string } | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDepartment, setFilterDepartment] = useState('all');

  const loadAssets = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await storage.getAll<Asset>(STORES.ASSETS);
      setAssets(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setSelectedIds(new Set());
      loadRepairStatuses(data);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAssets();
    (async () => {
      try {
        const res = await fetch('/api/departments', { credentials: 'include' });
        const data = await res.json();
        if (data.success) setDepartments(data.departments);
      } catch { console.warn('Failed to load departments'); }
    })();
  }, [loadAssets]);

  const loadRepairStatuses = async (currentAssets: Asset[]) => {
    const inRepair = currentAssets.filter(a => a.status === 'Under Repair' && a.serialNumber);
    const statuses: Record<string, string> = {};
    for (const asset of inRepair) {
      try {
        const res = await fetch(`/api/assets/repair-status/${asset.serialNumber}`, { credentials: 'include' });
        const result = await res.json();
        statuses[asset.serialNumber] = result.success && result.data?.status ? result.data.status : 'In Shop';
      } catch { /* silent */ }
    }
    setRepairStatuses(statuses);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await storage.delete(STORES.ASSETS, deleteConfirm.id);
      await storage.logActivity(user.id, user.username, 'DELETE_ASSET', `Deleted asset assigned to: ${deleteConfirm.name}`);
      showToast(`Asset for "${deleteConfirm.name}" unregistered.`, 'success');
      loadAssets();
    } catch {
      showToast('Failed to delete asset.', 'error');
    } finally {
      setDeleteConfirm(null);
    }
  };

  const handleBulkDelete = async () => {
    const count = selectedIds.size;
    try {
      for (const id of selectedIds) await storage.delete(STORES.ASSETS, id);
      await storage.logActivity(user.id, user.username, 'BULK_DELETE_ASSET', `Deleted ${count} assets`);
      showToast(`${count} asset${count !== 1 ? 's' : ''} unregistered.`, 'success');
      setSelectedIds(new Set());
      loadAssets();
    } catch {
      showToast('Failed to delete some assets.', 'error');
    } finally {
      setBulkDeleteConfirm(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredAssets.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredAssets.map(a => a.id)));
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedIds(next);
  };

  const filteredAssets = assets
    .filter(a => {
      const q = search.toLowerCase();
      const matchesSearch = a.employeeName.toLowerCase().includes(q) || a.type.toLowerCase().includes(q) || a.srNumber.toLowerCase().includes(q) || a.department.toLowerCase().includes(q);
      const matchesStatus = filterStatus === 'all' || a.status.toLowerCase() === filterStatus.toLowerCase();
      const matchesDept = filterDepartment === 'all' || a.department === filterDepartment;
      return matchesSearch && matchesStatus && matchesDept;
    })
    .sort((a, b) => {
      let valA: any = sortBy === 'createdAt' ? new Date(a.createdAt).getTime() : (a as any)[sortBy] || '';
      let valB: any = sortBy === 'createdAt' ? new Date(b.createdAt).getTime() : (b as any)[sortBy] || '';
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

  useEffect(() => { setCurrentPage(1); }, [search, filterStatus, filterDepartment, sortBy, sortOrder]);

  const totalPages = Math.ceil(filteredAssets.length / itemsPerPage);
  const paginatedAssets = filteredAssets.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="app-page">
      <PageHeader
        title="Asset Registry"
        subtitle="Track company hardware assigned to staff members."
        actions={
          <>
            <button type="button" onClick={() => { setEditingAsset(null); setIsModalOpen(true); }} className="civic-button-primary">
              <ICONS.Plus className="w-5 h-5" />
              Register New Asset
            </button>
            <button type="button" onClick={() => setIsImportModalOpen(true)} className="civic-button-secondary">
              <ICONS.Upload className="w-5 h-5" />
              Import CSV
            </button>
          </>
        }
      />

      <div className="surface-card overflow-hidden p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-civic-border bg-slate-50 px-4 py-3 dark:bg-slate-800/70">
          <ICONS.Search className="w-5 h-5 text-slate-400 flex-shrink-0" />
          <div className="relative flex-1 min-w-[160px]">
            <input
              type="text"
              placeholder="Search by employee, asset type, SR number..."
              className="w-full border-none bg-transparent text-sm placeholder-slate-400 focus:ring-0 dark:text-white pr-7"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} aria-label="Clear search" className="absolute right-0 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" /></svg>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 border-l border-civic-border pl-3 flex-wrap">
            <div className="flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md shadow-sm">
              <ICONS.Filter className="w-3.5 h-3.5 text-slate-400" />
              <select title="Filter by status" aria-label="Filter by status" className="bg-transparent text-xs border-none focus:ring-0 p-0 pr-6 dark:text-slate-200" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="under repair">Under Repair</option>
                <option value="disposed">Disposed</option>
              </select>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md shadow-sm">
              <select title="Filter by department" aria-label="Filter by department" className="bg-transparent text-xs border-none focus:ring-0 p-0 pr-6 dark:text-slate-200" value={filterDepartment} onChange={(e) => setFilterDepartment(e.target.value)}>
                <option value="all">All Departments</option>
                {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md shadow-sm">
              <button type="button" onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')} title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}>
                {sortOrder === 'asc' ? <ICONS.SortAsc className="w-3.5 h-3.5 text-blue-600" /> : <ICONS.SortDesc className="w-3.5 h-3.5 text-blue-600" />}
              </button>
              <select title="Sort by field" aria-label="Sort by field" className="bg-transparent text-xs border-none focus:ring-0 p-0 pr-6 dark:text-slate-200" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="createdAt">Added Date</option>
                <option value="employeeName">Employee</option>
                <option value="type">Asset Name</option>
                <option value="status">Status</option>
              </select>
            </div>
          </div>

          {selectedIds.size > 0 && (
            <button type="button" onClick={() => setBulkDeleteConfirm(true)} className="flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors whitespace-nowrap">
              <ICONS.Trash className="w-4 h-4" />
              Delete {selectedIds.size}
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <TableSkeleton rows={8} cols={7} />
          ) : (
            <table className="table-shell text-left">
              <thead className="table-head text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 w-10">
                    <input type="checkbox" title="Select all assets" checked={selectedIds.size > 0 && selectedIds.size === filteredAssets.length} onChange={toggleSelectAll} className="w-4 h-4 rounded border-slate-300 text-blue-600 cursor-pointer" />
                  </th>
                  <th className="px-6 py-4">Employee &amp; Position</th>
                  <th className="px-6 py-4">Asset Info</th>
                  <th className="px-6 py-4">Department</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Lifecycle Dates</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {paginatedAssets.map(asset => (
                  <tr
                    key={asset.id}
                    className={`table-row transition-colors cursor-pointer ${selectedIds.has(asset.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input[type="checkbox"]')) return;
                      navigate(`/assets/${asset.id}`);
                    }}
                  >
                    <td className="px-6 py-4" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" aria-label={`Select ${asset.employeeName}`} checked={selectedIds.has(asset.id)} onChange={() => toggleSelect(asset.id)} className="w-4 h-4 rounded border-slate-300 text-blue-600 cursor-pointer" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-civic-text dark:text-white">{asset.employeeName}</div>
                      <div className="text-xs text-slate-400">{asset.position}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-civic-text dark:text-slate-300">{asset.brand ? `${asset.brand} ` : ''}{asset.type}</div>
                      <div className="text-[10px] text-slate-400 uppercase tracking-tighter flex flex-col">
                        <span>SR: {asset.srNumber}</span>
                        {asset.serialNumber && <span>SN: {asset.serialNumber}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-civic-muted dark:text-slate-400">{asset.department}</span>
                      <div className="text-[10px] text-slate-400 italic">{asset.section}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <StatusBadge status={asset.status} />
                        {repairStatuses[asset.serialNumber] && (
                          <span className="flex items-center gap-1 text-[9px] font-bold text-amber-500 uppercase bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                            <ICONS.AlertCircle className="w-3 h-3" />
                            Repair: {repairStatuses[asset.serialNumber]}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 text-xs text-civic-muted dark:text-slate-400">
                        {asset.purchaseDate && <span>Purchased: {format(new Date(asset.purchaseDate), 'dd/MM/yyyy')}</span>}
                        {asset.warrantyExpiry && (
                          new Date(asset.warrantyExpiry) < new Date()
                            ? <span className="text-red-500 font-bold">Wty: Expired</span>
                            : <span>Wty Exp: {format(new Date(asset.warrantyExpiry), 'dd/MM/yyyy')}</span>
                        )}
                        {asset.disposalDate && <span>Dispose: {format(new Date(asset.disposalDate), 'dd/MM/yyyy')}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => { setEditingAsset(asset); setIsModalOpen(true); }} className="p-1.5 text-slate-400 hover:text-civic-primary transition-colors" title="Edit Asset" aria-label="Edit asset">
                          <ICONS.Edit className="w-5 h-5" />
                        </button>
                        <button type="button" onClick={() => setDeleteConfirm({ isOpen: true, id: asset.id, name: asset.employeeName })} className="p-1.5 text-slate-400 hover:text-red-600 transition-colors" title="Delete Asset" aria-label="Delete asset">
                          <ICONS.Trash className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredAssets.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-20 text-center text-slate-400 italic">No assets found matching your criteria.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredAssets.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          itemLabel="assets"
        />
      </div>

      {isModalOpen && (
        <AssetModal asset={editingAsset} departments={departments} user={user} onClose={() => setIsModalOpen(false)} onSave={() => { loadAssets(); setIsModalOpen(false); }} />
      )}
      {isImportModalOpen && (
        <ImportModal user={user} onClose={() => setIsImportModalOpen(false)} onSave={() => { loadAssets(); setIsImportModalOpen(false); }} />
      )}

      <ConfirmModal
        isOpen={!!deleteConfirm?.isOpen}
        title="Unregister Asset?"
        message={`Remove the asset assigned to "${deleteConfirm?.name}"? This cannot be undone.`}
        confirmText="Unregister"
        isDanger
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
      <ConfirmModal
        isOpen={bulkDeleteConfirm}
        title={`Unregister ${selectedIds.size} Asset${selectedIds.size !== 1 ? 's' : ''}?`}
        message="This will permanently remove all selected assets from the registry."
        confirmText="Unregister All"
        isDanger
        onConfirm={handleBulkDelete}
        onCancel={() => setBulkDeleteConfirm(false)}
      />
    </div>
  );
};

const StatusBadge: React.FC<{ status: Asset['status'] }> = ({ status }) => {
  const styles: Record<string, string> = {
    Active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    'Under Repair': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    Disposed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };
  return <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-tight ${styles[status] || styles.Active}`}>{status}</span>;
};

interface ModalProps {
  asset: Asset | null;
  departments: Department[];
  user: User;
  onClose: () => void;
  onSave: () => void;
}

const AssetModal: React.FC<ModalProps> = ({ asset, departments, user, onClose, onSave }) => {
  const { showToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<Partial<Asset>>(asset || {
    employeeName: '', type: '', srNumber: '', serialNumber: '', extNumber: '', officeNumber: '',
    position: '', departmentId: '', department: '', section: '', warrantyExpiry: '', status: 'Active',
    brand: '', purchaseDate: new Date().toISOString().split('T')[0], disposalDate: ''
  });

  useEffect(() => {
    if (asset) setFormData({ ...asset, purchaseDate: asset.purchaseDate || new Date().toISOString().split('T')[0] });
  }, [asset]);

  useEffect(() => {
    if (formData.purchaseDate) {
      try {
        const pd = new Date(formData.purchaseDate);
        if (!isNaN(pd.getTime())) {
          setFormData(prev => ({
            ...prev,
            warrantyExpiry: addYears(pd, 1).toISOString().split('T')[0],
            disposalDate: addYears(pd, 3).toISOString().split('T')[0],
          }));
        }
      } catch { /* invalid date */ }
    }
  }, [formData.purchaseDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const newAsset = { ...formData, ...(asset?.id ? { id: asset.id } : {}), createdAt: asset?.createdAt || new Date().toISOString() } as Asset;
      await storage.save(STORES.ASSETS, newAsset);
      await storage.logActivity(user.id, user.username, asset ? 'UPDATE_ASSET' : 'ADD_ASSET', `${asset ? 'Updated' : 'Assigned'} asset to: ${newAsset.employeeName}`);
      showToast(`Asset ${asset ? 'updated' : 'registered'} successfully.`, 'success');
      onSave();
    } catch (err: any) {
      showToast(err.message || 'Failed to save asset.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputCls = "w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white";

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 bg-slate-950/60 backdrop-blur-sm overflow-y-auto pt-10 md:pt-20" role="dialog" aria-modal="true">
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl my-8 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
          <h3 className="text-lg font-bold dark:text-white">{asset ? 'Edit Asset Registration' : 'Register New Asset'}</h3>
          <button type="button" onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500" aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-blue-600 uppercase tracking-widest flex items-center gap-2"><span className="w-4 h-px bg-blue-600"></span>Custodian Details</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><label htmlFor="a-emp" className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Employee Name</label><input id="a-emp" required type="text" className={inputCls} value={formData.employeeName} onChange={e => setFormData({ ...formData, employeeName: e.target.value })} /></div>
              <div><label htmlFor="a-pos" className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Position</label><input id="a-pos" required type="text" className={inputCls} value={formData.position} onChange={e => setFormData({ ...formData, position: e.target.value })} /></div>
              <div><label htmlFor="a-ext" className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Ext Number</label><input id="a-ext" type="text" className={inputCls} value={formData.extNumber} onChange={e => setFormData({ ...formData, extNumber: e.target.value })} /></div>
              <div>
                <label htmlFor="a-dept" className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Department</label>
                <select id="a-dept" required title="Select Department" className={inputCls} value={formData.departmentId || ''} onChange={e => { const d = departments.find(x => x.id === e.target.value); setFormData({ ...formData, departmentId: e.target.value, department: d ? d.name : '' }); }}>
                  <option value="">Select Department</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  {formData.department && !formData.departmentId && <option value="" disabled>Current: {formData.department}</option>}
                </select>
              </div>
              <div><label htmlFor="a-sec" className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Section</label><input id="a-sec" type="text" placeholder="e.g. Accounts" className={inputCls} value={formData.section} onChange={e => setFormData({ ...formData, section: e.target.value })} /></div>
              <div><label htmlFor="a-office" className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Office No.</label><input id="a-office" type="text" placeholder="e.g. 101" className={inputCls} value={formData.officeNumber} onChange={e => setFormData({ ...formData, officeNumber: e.target.value })} /></div>
            </div>

            <h4 className="text-sm font-bold text-blue-600 uppercase tracking-widest flex items-center gap-2 mt-6"><span className="w-4 h-px bg-blue-600"></span>Hardware Information</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="a-type" className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Asset Type</label>
                <select id="a-type" title="Select Asset Type" className={inputCls} value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}>
                  <option value="">Select Type</option>
                  <option value="Laptop">Laptop</option><option value="Desktop">Desktop</option><option value="Printer">Printer</option><option value="Scanner">Scanner</option><option value="Tablet">Tablet</option><option value="Mobile Phone">Mobile Phone</option>
                </select>
              </div>
              <div><label htmlFor="a-brand" className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Brand / Make</label><input id="a-brand" type="text" placeholder="e.g. HP, Dell, Apple" className={inputCls} value={formData.brand || ''} onChange={e => setFormData({ ...formData, brand: e.target.value })} /></div>
              <div><label htmlFor="a-sn" className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Manufacturer Serial No.</label><input id="a-sn" type="text" placeholder="e.g. 5CD20..." className={inputCls} value={formData.serialNumber} onChange={e => setFormData({ ...formData, serialNumber: e.target.value })} /></div>
              <div>
                <label htmlFor="a-sr" className="block text-xs font-bold text-slate-500 uppercase mb-1.5">SR Number (Internal)</label>
                <input id="a-sr" disabled={!asset} readOnly={!asset} type="text" title="Internal SR Number" placeholder="System Generated" className={`${inputCls} ${!asset ? 'cursor-not-allowed italic text-slate-400 bg-slate-100 dark:bg-slate-900' : ''}`} value={formData.srNumber} onChange={e => setFormData({ ...formData, srNumber: e.target.value })} />
              </div>
              <div><label htmlFor="a-pd" className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Date of Purchase</label><input id="a-pd" type="date" title="Select Purchase Date" className={inputCls} value={formData.purchaseDate || ''} onChange={e => setFormData({ ...formData, purchaseDate: e.target.value })} /></div>
              <div><label htmlFor="a-we" className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Warranty Expiry (Auto)</label><input id="a-we" readOnly type="date" className={`${inputCls} bg-gray-100 dark:bg-slate-900 cursor-not-allowed dark:text-slate-400`} value={formData.warrantyExpiry || ''} /></div>
              <div><label htmlFor="a-dd" className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Disposal Date (Auto)</label><input id="a-dd" readOnly type="date" className={`${inputCls} bg-gray-100 dark:bg-slate-900 cursor-not-allowed dark:text-slate-400`} value={formData.disposalDate || ''} /></div>
              <div>
                <label htmlFor="a-status" className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Current Status</label>
                <select id="a-status" title="Select Status" className={inputCls} value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as any })}>
                  <option value="Active">Active</option><option value="Under Repair">Under Repair</option><option value="Disposed">Disposed</option>
                </select>
              </div>
            </div>
          </div>
          <div className="flex gap-3 mt-8">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 transition-colors">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors shadow-lg disabled:opacity-60 disabled:cursor-not-allowed">
              {isSubmitting ? 'Saving...' : 'Save Asset Data'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface ImportModalProps {
  user: User;
  onClose: () => void;
  onSave: () => void;
}

const ImportModal: React.FC<ImportModalProps> = ({ user, onClose, onSave }) => {
  const { showToast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importStats, setImportStats] = useState<{ imported: number; skipped: number } | null>(null);

  const handleImport = async () => {
    if (!file) return;
    setIsUploading(true);
    setError(null);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const headers = (results.meta?.fields || []).map(f => f.trim()).filter(Boolean);
          const normalized = new Set(headers.map(h => h.toLowerCase().replace(/[\s_-]/g, '')));
          if (!normalized.has('employeename') || !normalized.has('serialnumber')) throw new Error('Missing required CSV headers: Employee Name, Serial Number.');
          const rawData = results.data as any[];
          const currentAssets = await storage.getAssets();
          const existingSerials = new Set(currentAssets.map(a => a.serialNumber?.trim().toLowerCase()).filter(Boolean));
          let skippedCount = 0;
          const seen = new Set<string>();
          const toImport: Partial<Asset>[] = rawData.map(row => {
            const name = (row.EmployeeName || row.employeeName || row['Employee Name'] || '').toString().trim();
            const serial = (row.SerialNumber || row.serialNumber || row['Serial Number'] || '').toString().trim();
            const ns = serial.toLowerCase();
            const statusRaw = (row.Status || row.status || 'Active').toString().trim().toLowerCase();
            const status: Asset['status'] = statusRaw === 'under repair' || statusRaw === 'repair' ? 'Under Repair' : statusRaw === 'disposed' ? 'Disposed' : 'Active';
            if (!name || !serial || existingSerials.has(ns) || seen.has(ns)) { skippedCount++; return null; }
            seen.add(ns);
            return { employeeName: name, type: row.AssetType || row['Asset Type'] || 'Other', serialNumber: serial, extNumber: row.ExtNumber || row['Ext Number'] || '', officeNumber: row.OfficeNumber || row['Office Number'] || '', position: row.Position || row.position || '', department: row.Department || row.department || '', section: row.Section || row.section || '', brand: row.Brand || row.brand || '', purchaseDate: row.PurchaseDate || row['Purchase Date'] || null, warrantyExpiry: row.WarrantyExpiry || row['Warranty Expiry'] || null, disposalDate: row.DisposalDate || row['Disposal Date'] || null, status, createdAt: new Date().toISOString() };
          }).filter(Boolean) as Partial<Asset>[];
          if (toImport.length === 0) throw new Error('No valid asset rows found. Check required fields and serial number uniqueness.');
          const serverStats = await storage.bulkAddAssets(toImport);
          skippedCount += serverStats.skipped;
          await storage.logActivity(user.id, user.username, 'IMPORT_ASSETS', `Imported ${serverStats.imported} assets, skipped ${skippedCount} rows.`);
          setImportStats({ imported: serverStats.imported, skipped: skippedCount });
          setIsUploading(false);
          setTimeout(() => { showToast(`Imported ${serverStats.imported} assets.`, 'success'); onSave(); }, 2000);
        } catch (err: any) {
          setError(err.message || 'Import failed.');
          setIsUploading(false);
        }
      },
      error: (err) => { setError(err.message || 'Failed to parse CSV.'); setIsUploading(false); }
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 bg-slate-950/60 backdrop-blur-sm overflow-y-auto pt-10 md:pt-20" role="dialog" aria-modal="true">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg my-8 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
          <h3 className="text-lg font-bold dark:text-white">Import Assets via CSV</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 rounded-xl">
            <h4 className="text-sm font-bold text-blue-700 dark:text-blue-400 mb-1">CSV Template Guide</h4>
            <p className="text-xs text-blue-600 dark:text-blue-400/80 leading-relaxed">Required: <code className="bg-white/50 px-1 rounded">Employee Name</code>, <code className="bg-white/50 px-1 rounded">Serial Number</code>. Optional: Asset Type, Department, Purchase Date, Warranty Expiry, Disposal Date.</p>
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-500 uppercase">Select CSV File</label>
            <div className="relative group">
              <input type="file" accept=".csv" title="Upload CSV File" aria-label="Upload CSV File" onChange={e => { if (e.target.files?.[0]) { setFile(e.target.files[0]); setError(null); } }} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
              <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${file ? 'border-green-500 bg-green-50 dark:bg-green-900/10' : 'border-slate-200 dark:border-slate-800 group-hover:border-blue-500 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/10'}`}>
                <ICONS.Upload className={`w-8 h-8 mx-auto mb-2 ${file ? 'text-green-500' : 'text-slate-400'}`} />
                <p className="text-sm font-medium dark:text-slate-300">{file ? file.name : 'Click to browse or drag CSV file'}</p>
                <p className="text-[10px] text-slate-400 mt-1">Accepts .csv files only</p>
              </div>
            </div>
          </div>
          {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30 rounded-lg text-xs text-red-600 dark:text-red-400">{error}</div>}
          {importStats && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/30 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-bold text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                Import Complete
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="bg-white/50 dark:bg-slate-800/50 p-2 rounded-lg"><span className="text-slate-500 block">New Assets</span><span className="text-lg font-bold text-green-600">{importStats.imported}</span></div>
                <div className="bg-white/50 dark:bg-slate-800/50 p-2 rounded-lg"><span className="text-slate-500 block">Skipped Rows</span><span className="text-lg font-bold text-amber-600">{importStats.skipped}</span></div>
              </div>
            </div>
          )}
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} disabled={isUploading} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 transition-colors disabled:opacity-50">Cancel</button>
            <button type="button" onClick={handleImport} disabled={!file || isUploading} className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {isUploading ? (<><svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Importing...</>) : 'Start Import'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Assets;
