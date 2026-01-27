import React, { useState, useEffect } from 'react';
import { storage, STORES } from '../services/storageService';
import { Asset, User } from '../types';
import { ICONS } from '../constants';

interface AssetsProps {
  user: User;
}

const Assets: React.FC<AssetsProps> = ({ user }) => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);

  useEffect(() => {
    loadAssets();
  }, []);

  const loadAssets = async () => {
    const data = await storage.getAll<Asset>(STORES.ASSETS);
    setAssets(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Unregister asset assigned to ${name}?`)) {
      await storage.delete(STORES.ASSETS, id);
      await storage.logActivity(user.id, user.username, 'DELETE_ASSET', `Deleted asset assigned to: ${name}`);
      loadAssets();
    }
  };

  const filteredAssets = assets.filter(a =>
    a.employeeName.toLowerCase().includes(search.toLowerCase()) ||
    a.type.toLowerCase().includes(search.toLowerCase()) ||
    a.srNumber.toLowerCase().includes(search.toLowerCase()) ||
    a.department.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold dark:text-white">Asset Registry</h2>
          <p className="text-slate-500 dark:text-slate-400">Track company hardware assigned to staff members.</p>
        </div>
        <button
          onClick={() => { setEditingAsset(null); setIsModalOpen(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors shadow-sm"
        >
          <ICONS.Plus className="w-5 h-5" />
          Register New Asset
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center gap-3">
          <ICONS.Search className="w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by employee, asset type, SR number, or department..."
            className="bg-transparent border-none focus:ring-0 text-sm w-full dark:text-white placeholder-slate-400"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-xs uppercase tracking-wider font-bold text-slate-500 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4">Employee & Position</th>
                <th className="px-6 py-4">Asset Info</th>
                <th className="px-6 py-4">Department</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Warranty</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredAssets.map(asset => (
                <tr key={asset.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-semibold dark:text-white">{asset.employeeName}</div>
                    <div className="text-xs text-slate-400">{asset.position}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium dark:text-slate-300">{asset.type}</div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-tighter">
                      SR: {asset.srNumber} | SN: {asset.serialNumber}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm dark:text-slate-400">{asset.department}</span>
                    <div className="text-[10px] text-slate-400 italic">{asset.section}</div>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={asset.status} />
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs dark:text-slate-400">
                      {new Date(asset.warrantyExpiry) < new Date() ? (
                        <span className="text-red-500 font-bold">Expired</span>
                      ) : (
                        <span>Exp: {new Date(asset.warrantyExpiry).toLocaleDateString()}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => { setEditingAsset(asset); setIsModalOpen(true); }}
                        className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        title="Edit Asset"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(asset.id, asset.employeeName)}
                        className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
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
          user={user}
          onClose={() => setIsModalOpen(false)}
          onSave={() => { loadAssets(); setIsModalOpen(false); }}
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
  user: User;
  onClose: () => void;
  onSave: () => void;
}

const AssetModal: React.FC<ModalProps> = ({ asset, user, onClose, onSave }) => {
  const [formData, setFormData] = useState<Partial<Asset>>(
    asset || {
      employeeName: '', type: '', srNumber: '', serialNumber: '', extNumber: '', officeNumber: '',
      position: '', department: '', section: '', warrantyExpiry: '', status: 'Active'
    }
  );

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
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm overflow-y-auto">
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
                <input id="department" required type="text" title="Enter Department" placeholder="e.g. Finance" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white" value={formData.department} onChange={(e) => setFormData({ ...formData, department: e.target.value })} />
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
              <div className="col-span-2 md:col-span-1 border-t md:border-t-0 border-slate-100 mt-4 md:mt-0 pt-4 md:pt-0">
                <label htmlFor="srNumber" className="block text-xs font-bold text-slate-500 uppercase mb-1.5">SR Number</label>
                <input id="srNumber" required type="text" title="Enter SR Number" placeholder="e.g. SR-1234" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white" value={formData.srNumber} onChange={(e) => setFormData({ ...formData, srNumber: e.target.value })} />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label htmlFor="serialNumber" className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Serial Number</label>
                <input id="serialNumber" type="text" title="Enter Serial Number" placeholder="Manufacturer Serial" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white" value={formData.serialNumber} onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })} />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label htmlFor="warrantyExpiry" className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Warranty Expiry</label>
                <input id="warrantyExpiry" required type="date" title="Select Warranty Expiry Date" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white" value={formData.warrantyExpiry} onChange={(e) => setFormData({ ...formData, warrantyExpiry: e.target.value })} />
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

export default Assets;
