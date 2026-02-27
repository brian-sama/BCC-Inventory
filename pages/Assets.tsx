import React, { useState, useEffect } from 'react';
import { storage, STORES } from '../services/storageService';
import { Asset, User, Department } from '../types';
import { ICONS } from '../constants';
import Papa from 'papaparse';
import { format, addYears } from 'date-fns';
import PageHeader from '../components/ui/PageHeader';

interface AssetsProps {
  user: User;
}

const Assets: React.FC<AssetsProps> = ({ user }) => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [repairStatuses, setRepairStatuses] = useState<Record<string, string>>({});

  useEffect(() => {
    loadAssets();
    loadDepartments();
  }, []);

  const loadDepartments = async () => {
    try {
      const response = await fetch('/api/departments', { credentials: 'include' });
      const data = await response.json();
      if (data.success) {
        setDepartments(data.departments);
      }
    } catch (e) {
      console.warn('Failed to load departments');
    }
  };

  const loadAssets = async () => {
    const data = await storage.getAll<Asset>(STORES.ASSETS);
    setAssets(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));

    // Potentially load external repair statuses
    loadRepairStatuses(data);
  };

  const loadRepairStatuses = async (currentAssets: Asset[]) => {
    // Only check status for assets marked as 'Under Repair' to save bandwidth
    const assetsInRepair = currentAssets.filter(a => a.status === 'Under Repair' && a.serialNumber);
    const newStatuses: Record<string, string> = {};

    for (const asset of assetsInRepair) {
      try {
        // Call our internal proxy which talks to the external repairs system
        const response = await fetch(`/api/assets/repair-status/${asset.serialNumber}`, {
          credentials: 'include',
        });
        const result = await response.json();

        if (result.success && result.data?.inRepair) {
          newStatuses[asset.serialNumber] = result.data.status || 'In Shop';
        } else {
          // Fallback if external system says it's not there or fails
          newStatuses[asset.serialNumber] = 'In Shop (Syncing...)';
        }
      } catch (err) {
        console.warn('Failed to load repair status for', asset.serialNumber);
      }
    }
    setRepairStatuses(newStatuses);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!id) {
      console.error('Cannot delete asset: Missing ID');
      return;
    }
    if (confirm(`Unregister asset assigned to ${name}? This cannot be undone.`)) {
      try {
        await storage.delete(STORES.ASSETS, id);
        await storage.logActivity(user.id, user.username, 'DELETE_ASSET', `Deleted asset assigned to: ${name}`);
        loadAssets();
      } catch (error) {
        console.error('Delete failed', error);
        alert('Failed to delete asset. Please try again.');
      }
    }
  };

  const filteredAssets = assets.filter(a =>
    a.employeeName.toLowerCase().includes(search.toLowerCase()) ||
    a.type.toLowerCase().includes(search.toLowerCase()) ||
    a.srNumber.toLowerCase().includes(search.toLowerCase()) ||
    a.department.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="app-page">
      <PageHeader
        title="Asset Registry"
        subtitle="Track company hardware assigned to staff members."
        actions={
          <>
            <button
              onClick={() => {
                setEditingAsset(null);
                setIsModalOpen(true);
              }}
              className="civic-button-primary"
            >
              <ICONS.Plus className="w-5 h-5" />
              Register New Asset
            </button>
            <button onClick={() => setIsImportModalOpen(true)} className="civic-button-secondary">
              <ICONS.Upload className="w-5 h-5" />
              Import Assets (CSV)
            </button>
          </>
        }
      />

      <div className="surface-card overflow-hidden p-0">
        <div className="flex items-center gap-3 border-b border-civic-border bg-slate-50 px-4 py-3 dark:bg-slate-800/70">
          <ICONS.Search className="w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by employee, asset type, SR number, or department..."
            className="w-full border-none bg-transparent text-sm placeholder-slate-400 focus:ring-0 dark:text-white"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="table-shell text-left">
            <thead className="table-head text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Employee & Position</th>
                <th className="px-6 py-4">Asset Info</th>
                <th className="px-6 py-4">Department</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Lifecycle Dates</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredAssets.map(asset => (
                <tr key={asset.id} className="table-row transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-civic-text dark:text-white">{asset.employeeName}</div>
                    <div className="text-xs text-slate-400">{asset.position}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-civic-text dark:text-slate-300">
                      {asset.brand ? `${asset.brand} ` : ''}{asset.type}
                    </div>
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
                        new Date(asset.warrantyExpiry) < new Date() ? (
                          <span className="text-red-500 font-bold">Wty: Expired</span>
                        ) : (
                          <span>Wty Exp: {format(new Date(asset.warrantyExpiry), 'dd/MM/yyyy')}</span>
                        )
                      )}
                      {asset.disposalDate && <span>Dispose: {format(new Date(asset.disposalDate), 'dd/MM/yyyy')}</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => { setEditingAsset(asset); setIsModalOpen(true); }}
                        className="p-1.5 text-slate-400 hover:text-civic-primary transition-colors"
                        title="Edit Asset"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(asset.id, asset.employeeName)}
                        className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"
                        title="Delete Asset"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredAssets.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-slate-400 italic">No assets found matching your criteria.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <AssetModal
          asset={editingAsset}
          departments={departments}
          user={user}
          onClose={() => setIsModalOpen(false)}
          onSave={() => { loadAssets(); setIsModalOpen(false); }}
        />
      )}

      {isImportModalOpen && (
        <ImportModal
          user={user}
          onClose={() => setIsImportModalOpen(false)}
          onSave={() => { loadAssets(); setIsImportModalOpen(false); }}
        />
      )}
    </div>
  );
};

const StatusBadge: React.FC<{ status: Asset['status'] }> = ({ status }) => {
  const styles = {
    Active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    'Under Repair': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    Disposed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
  };
  return (
    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-tight ${styles[status]}`}>
      {status}
    </span>
  );
};

interface ModalProps {
  asset: Asset | null;
  departments: Department[];
  user: User;
  onClose: () => void;
  onSave: () => void;
}

const AssetModal: React.FC<ModalProps> = ({ asset, departments, user, onClose, onSave }) => {
  const [formData, setFormData] = useState<Partial<Asset>>(
    asset || {
      employeeName: '', type: '', srNumber: '', serialNumber: '', extNumber: '', officeNumber: '',
      position: '', departmentId: '', department: '', section: '', warrantyExpiry: '', status: 'Active',
      brand: '', purchaseDate: new Date().toISOString().split('T')[0], disposalDate: ''
    }
  );

  useEffect(() => {
    // Force re-initialization of values when editing, especially dates
    if (asset) {
      setFormData({
        ...asset,
        purchaseDate: asset.purchaseDate || new Date().toISOString().split('T')[0]
      });
    }
  }, [asset]);

  // Client-side auto-calculation for visual feedback (Backend does the actual DB saving)
  useEffect(() => {
    if (formData.purchaseDate) {
      try {
        const pd = new Date(formData.purchaseDate);
        if (!isNaN(pd.getTime())) {
          setFormData(prev => ({
            ...prev,
            warrantyExpiry: addYears(pd, 1).toISOString().split('T')[0],
            disposalDate: addYears(pd, 3).toISOString().split('T')[0]
          }));
        }
      } catch (e) {
        // invalid date
      }
    }
  }, [formData.purchaseDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Do not generate ID for new assets, let backend handle it
    const newAsset = {
      ...formData,
      ...(asset?.id ? { id: asset.id } : {}),
      createdAt: asset?.createdAt || new Date().toISOString()
    } as Asset;

    await storage.save(STORES.ASSETS, newAsset);
    await storage.logActivity(
      user.id,
      user.username,
      asset ? 'UPDATE_ASSET' : 'ADD_ASSET',
      `${asset ? 'Updated' : 'Assigned'} asset to: ${newAsset.employeeName}`
    );
    onSave();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 bg-slate-950/60 backdrop-blur-sm overflow-y-auto pt-10 md:pt-20">
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl my-8 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
          <h3 className="text-lg font-bold dark:text-white">{asset ? 'Edit Asset Registration' : 'Register New Asset'}</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500" title="Close">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-blue-600 uppercase tracking-widest flex items-center gap-2">
              <span className="w-4 h-px bg-blue-600"></span>
              Custodian Details
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label htmlFor="employeeName" className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Employee Name</label>
                <input id="employeeName" required type="text" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white" value={formData.employeeName} onChange={(e) => setFormData({ ...formData, employeeName: e.target.value })} />
              </div>
              <div>
                <label htmlFor="position" className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Position</label>
                <input id="position" required type="text" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white" value={formData.position} onChange={(e) => setFormData({ ...formData, position: e.target.value })} />
              </div>
              <div>
                <label htmlFor="extNumber" className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Ext Number</label>
                <input id="extNumber" type="text" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white" value={formData.extNumber} onChange={(e) => setFormData({ ...formData, extNumber: e.target.value })} />
              </div>
              <div>
                <label htmlFor="department" className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Department</label>
                <select
                  id="department"
                  required
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                  value={formData.departmentId || ''}
                  onChange={(e) => {
                    const selectedDept = departments.find(d => d.id === e.target.value);
                    setFormData({
                      ...formData,
                      departmentId: e.target.value,
                      department: selectedDept ? selectedDept.name : ''
                    });
                  }}
                >
                  <option value="">Select Department</option>
                  {departments.map(dep => (
                    <option key={dep.id} value={dep.id}>{dep.name}</option>
                  ))}
                  {/* Fallback for legacy data */}
                  {formData.department && !formData.departmentId && <option value="" disabled>Current: {formData.department}</option>}
                </select>
              </div>
              <div>
                <label htmlFor="section" className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Section</label>
                <input id="section" type="text" title="Enter Section" placeholder="e.g. Accounts" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white" value={formData.section} onChange={(e) => setFormData({ ...formData, section: e.target.value })} />
              </div>
              <div>
                <label htmlFor="officeNumber" className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Office No.</label>
                <input id="officeNumber" type="text" title="Enter Office Number" placeholder="e.g. 101" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white" value={formData.officeNumber} onChange={(e) => setFormData({ ...formData, officeNumber: e.target.value })} />
              </div>
            </div>

            <h4 className="text-sm font-bold text-blue-600 uppercase tracking-widest flex items-center gap-2 mt-8">
              <span className="w-4 h-px bg-blue-600"></span>
              Hardware Information
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="assetType" className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Asset Type</label>
                <select id="assetType" title="Select Asset Type" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white" value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })}>
                  <option value="">Select Type</option>
                  <option value="Laptop">Laptop</option>
                  <option value="Desktop">Desktop</option>
                  <option value="Printer">Printer</option>
                  <option value="Scanner">Scanner</option>
                  <option value="Tablet">Tablet</option>
                  <option value="Mobile Phone">Mobile Phone</option>
                </select>
              </div>
              <div>
                <label htmlFor="brand" className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Brand / Make</label>
                <input id="brand" type="text" placeholder="e.g. HP, Dell, Apple" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white" value={formData.brand || ''} onChange={(e) => setFormData({ ...formData, brand: e.target.value })} />
              </div>
              <div className="col-span-2 md:col-span-1 border-t md:border-t-0 border-slate-100 mt-4 md:mt-0 pt-4 md:pt-0">
                <label htmlFor="serialNumber" className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Manufacturer Serial No.</label>
                <input id="serialNumber" required type="text" title="Enter Serial Number" placeholder="e.g. 5CD20..." className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white" value={formData.serialNumber} onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })} />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label htmlFor="srNumber" className="block text-xs font-bold text-slate-500 uppercase mb-1.5">SR Number (Internal)</label>
                <input
                  id="srNumber"
                  disabled={!asset}
                  readOnly={!asset}
                  type="text"
                  title="Internal SR Number"
                  placeholder="System Generated"
                  className={`w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm outline-none dark:text-white ${!asset ? 'cursor-not-allowed italic text-slate-400' : ''}`}
                  value={formData.srNumber}
                  onChange={(e) => setFormData({ ...formData, srNumber: e.target.value })}
                />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label htmlFor="purchaseDate" className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Date of Purchase</label>
                <input id="purchaseDate" required type="date" title="Select Purchase Date" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white" value={formData.purchaseDate || ''} onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })} />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label htmlFor="warrantyExpiry" className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Warranty Expiry (Auto)</label>
                <input id="warrantyExpiry" readOnly type="date" className="w-full bg-gray-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm outline-none dark:text-slate-400 cursor-not-allowed" value={formData.warrantyExpiry || ''} />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label htmlFor="disposalDate" className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Disposal Date (Auto)</label>
                <input id="disposalDate" readOnly type="date" className="w-full bg-gray-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm outline-none dark:text-slate-400 cursor-not-allowed" value={formData.disposalDate || ''} />
              </div>
              <div>
                <label htmlFor="currentStatus" className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Current Status</label>
                <select id="currentStatus" title="Select Current Status" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white" value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}>
                  <option value="Active">Active</option>
                  <option value="Under Repair">Under Repair</option>
                  <option value="Disposed">Disposed</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-8">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Cancel</button>
            <button type="submit" className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors shadow-lg">Save Asset Data</button>
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
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importStats, setImportStats] = useState<{ imported: number, skipped: number } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setIsUploading(true);
    setError(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const rawData = results.data as any[];

          // 1. Fetch current assets to check for duplicates
          const currentAssets = await storage.getAssets();
          const existingSerials = new Set(
            currentAssets
              .map(a => a.serialNumber?.trim().toLowerCase())
              .filter(sn => sn && sn !== '')
          );

          let skippedCount = 0;

          // 2. Map and Filter CSV columns
          const assetsToImport: Partial<Asset>[] = rawData.map(row => {
            const serial = (row.SerialNumber || row.serialNumber || row['Serial Number'] || '').toString().trim();
            const normalizedSerial = serial.toLowerCase();

            // Check if duplicate
            if (normalizedSerial && existingSerials.has(normalizedSerial)) {
              skippedCount++;
              return null;
            }

            return {
              employeeName: row.EmployeeName || row.employeeName || row['Employee Name'] || '',
              type: row.AssetType || row.type || row['Asset Type'] || 'Other',
              serialNumber: serial,
              extNumber: row.ExtNumber || row.extNumber || row['Ext Number'] || '',
              officeNumber: row.OfficeNumber || row.officeNumber || row['Office Number'] || '',
              position: row.Position || row.position || '',
              department: row.Department || row.department || '',
              section: row.Section || row.section || '',
              warrantyExpiry: row.WarrantyExpiry || row.warrantyExpiry || row['Warranty Expiry'] || new Date().toISOString().split('T')[0],
              status: (row.Status || row.status || 'Active') as any,
              createdAt: new Date().toISOString()
            };
          }).filter(a => a !== null && a.employeeName) as Partial<Asset>[];

          if (assetsToImport.length === 0 && skippedCount === 0) {
            throw new Error('No valid asset data found in file. Ensure "Employee Name" column exists.');
          }

          if (assetsToImport.length > 0) {
            for (const asset of assetsToImport) {
              await storage.save(STORES.ASSETS, asset);
            }

            await storage.logActivity(
              user.id,
              user.username,
              'IMPORT_ASSETS',
              `Imported ${assetsToImport.length} assets, skipped ${skippedCount} duplicates.`
            );
          }

          setImportStats({ imported: assetsToImport.length, skipped: skippedCount });
          setIsUploading(false);

          // Wait a moment for the user to see the success message before closing or reloading
          setTimeout(() => {
            onSave();
          }, 2500);
        } catch (err: any) {
          setError(err.message || 'Failed to import assets');
          setIsUploading(false);
        }
      },
      error: (err) => {
        setError(err.message || 'Failed to parse CSV file');
        setIsUploading(false);
      }
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 bg-slate-950/60 backdrop-blur-sm overflow-y-auto pt-10 md:pt-20">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg my-8 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
          <h3 className="text-lg font-bold dark:text-white">Import Assets via CSV</h3>
          <button onClick={onClose} aria-label="Close" title="Close Import Modal" className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 rounded-xl">
            <h4 className="text-sm font-bold text-blue-700 dark:text-blue-400 mb-1">CSV Template Guide</h4>
            <p className="text-xs text-blue-600 dark:text-blue-400/80 leading-relaxed">
              Ensure your CSV has these headers: <code className="bg-white/50 dark:bg-black/20 px-1 rounded">Employee Name</code>, <code className="bg-white/50 dark:bg-black/20 px-1 rounded">Serial Number</code>, <code className="bg-white/50 dark:bg-black/20 px-1 rounded">Asset Type</code>, <code className="bg-white/50 dark:bg-black/20 px-1 rounded">Department</code>.
            </p>
            <p className="text-[10px] text-blue-500 mt-2 font-medium">Internal SR numbers will be automatically assigned upon arrival.</p>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-500 uppercase">Select CSV File</label>
            <div className="relative group">
              <input
                type="file"
                accept=".csv"
                title="Upload CSV File"
                aria-label="Upload CSV File"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${file ? 'border-green-500 bg-green-50 dark:bg-green-900/10' : 'border-slate-200 dark:border-slate-800 group-hover:border-blue-500 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/10'}`}>
                <ICONS.Upload className={`w-8 h-8 mx-auto mb-2 ${file ? 'text-green-500' : 'text-slate-400'}`} />
                <p className="text-sm font-medium dark:text-slate-300">
                  {file ? file.name : 'Click to browse or drag and drop CSV file'}
                </p>
                <p className="text-[10px] text-slate-400 mt-1">Accepts .csv files only</p>
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30 rounded-lg text-xs text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {importStats && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/30 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-bold text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                Import Complete
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="bg-white/50 dark:bg-slate-800/50 p-2 rounded-lg">
                  <span className="text-slate-500 block">New Assets</span>
                  <span className="text-lg font-bold text-green-600">{importStats.imported}</span>
                </div>
                <div className="bg-white/50 dark:bg-slate-800/50 p-2 rounded-lg">
                  <span className="text-slate-500 block">Skipped Dilly-Dally</span>
                  <span className="text-lg font-bold text-amber-600">{importStats.skipped}</span>
                </div>
              </div>
              <p className="text-[10px] text-green-600/70 italic text-center pt-1">Refreshing your registry...</p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              disabled={isUploading}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={!file || isUploading}
              className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isUploading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Importing...
                </>
              ) : 'Start Import'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Assets;
