
import React, { useState, useEffect } from 'react';
import { storage, STORES } from '../services/storageService';
import { Asset, User } from '../types';
import { ICONS } from '../constants';
import { TableSkeleton } from '../components/Skeleton';
import { useToast } from '../components/ToastProvider';
import { ConfirmModal } from '../components/ConfirmModal';

interface AssetsProps {
  user: User;
}

const Assets: React.FC<AssetsProps> = ({ user }) => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string; name: string }>({
    isOpen: false,
    id: '',
    name: ''
  });

  useEffect(() => {
    console.log('Assets component mounted for user:', user.username);
    loadAssets();
  }, []);

  const loadAssets = async () => {
    try {
      setLoading(true);
      console.log('Assets: fetching data...');
      const data = await storage.getAll<Asset>(STORES.ASSETS);
      console.log('Assets: data fetched count:', data.length);
      setAssets(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (err) {
      console.error('Failed to load assets in component:', err);
      showToast('Failed to load asset registry', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await storage.delete(STORES.ASSETS, deleteConfirm.id);
      await storage.logActivity(user.id, user.username, 'DELETE_ASSET', `Deleted asset assigned to: ${deleteConfirm.name}`);
      showToast(`Asset record for ${deleteConfirm.name} removed`, 'success');
      loadAssets();
    } catch (err) {
      showToast('Error removing asset record', 'error');
    } finally {
      setDeleteConfirm({ isOpen: false, id: '', name: '' });
    }
  };

  const filteredAssets = assets.filter(a =>
    a.employeeName.toLowerCase().includes(search.toLowerCase()) ||
    a.type.toLowerCase().includes(search.toLowerCase()) ||
    a.srNumber.toLowerCase().includes(search.toLowerCase()) ||
    a.department.toLowerCase().includes(search.toLowerCase())
  );

  const [detailsAsset, setDetailsAsset] = useState<Asset | null>(null);

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
          {loading ? (
            <TableSkeleton rows={8} cols={6} />
          ) : (
            <table className="w-full text-left">
              <thead className="text-xs uppercase tracking-wider font-bold text-slate-500 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-4">Employee & Position</th>
                  <th className="px-6 py-4">Asset Info</th>
                  <th className="px-6 py-4">Department</th>
                  <th className="px-6 py-4">Status</th>
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
                      <div className="text-[10px] text-slate-400 uppercase tracking-tighter">SR: {asset.srNumber}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm dark:text-slate-400">{asset.department}</span>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={asset.status} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setDetailsAsset(asset)}
                          className="p-1.5 text-slate-400 hover:text-green-600 dark:hover:text-green-400 transition-colors"
                          title="View Details"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => { setEditingAsset(asset); setIsModalOpen(true); }}
                          className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                          aria-label={`Edit ${asset.employeeName}'s asset`}
                          title="Edit Information"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setDeleteConfirm({ isOpen: true, id: asset.id, name: asset.employeeName })}
                          className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                          aria-label={`Delete asset for ${asset.employeeName}`}
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
          )}
        </div>
      </div>

      {detailsAsset && (
        <AssetDetailsModal
          asset={detailsAsset}
          onClose={() => setDetailsAsset(null)}
        />
      )}

      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        title="Remove Asset Record?"
        message={`This will remove the assignment record for ${deleteConfirm.name}. Should we proceed?`}
        confirmText="Remove Record"
        isDanger={true}
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm({ isOpen: false, id: '', name: '' })}
      />

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
      employeeName: '', type: '', srNumber: '', extNumber: '', officeNumber: '',
      position: '', department: '', section: '', warrantyExpiry: '', status: 'Active'
    }
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const id = asset?.id || crypto.randomUUID();
      const newAsset = {
        ...formData,
        id,
        createdAt: asset?.createdAt || new Date().toISOString()
      } as Asset;

      await storage.addAsset(newAsset);
      await storage.logActivity(
        user.id,
        user.username,
        asset ? 'UPDATE_ASSET' : 'ADD_ASSET',
        `${asset ? 'Updated' : 'Assigned'} asset to: ${newAsset.employeeName}`
      );

      showToast(`Asset for ${newAsset.employeeName} ${asset ? 'updated' : 'registered'} successfully`, 'success');
      onSave();
    } catch (err) {
      showToast('Failed to save asset registry data', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl my-8 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
          <h3 className="text-lg font-bold dark:text-white">{asset ? 'Edit Asset Registration' : 'Register New Asset'}</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500"
            aria-label="Close Modal"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-blue-600 uppercase tracking-widest flex items-center gap-2">
              <span className="w-4 h-px bg-blue-600"></span>
              Assigned Staff Details
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label htmlFor="employeeName" className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Staff Name</label>
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
                <input id="department" required type="text" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white" value={formData.department} onChange={(e) => setFormData({ ...formData, department: e.target.value })} />
              </div>
              <div>
                <label htmlFor="officeNumber" className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Office No.</label>
                <input id="officeNumber" type="text" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white" value={formData.officeNumber} onChange={(e) => setFormData({ ...formData, officeNumber: e.target.value })} />
              </div>
            </div>

            <h4 className="text-sm font-bold text-blue-600 uppercase tracking-widest flex items-center gap-2 mt-8">
              <span className="w-4 h-px bg-blue-600"></span>
              Hardware Information
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="assetType" className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Asset Type</label>
                <select id="assetType" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white" value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })}>
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
                <label htmlFor="srNumber" className="block text-xs font-bold text-slate-500 uppercase mb-1.5">SR Number</label>
                <input id="srNumber" required type="text" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white" value={formData.srNumber} onChange={(e) => setFormData({ ...formData, srNumber: e.target.value })} />
              </div>
              <div>
                <label htmlFor="warrantyExpiry" className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Warranty Expiry</label>
                <input id="warrantyExpiry" required type="date" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white" value={formData.warrantyExpiry} onChange={(e) => setFormData({ ...formData, warrantyExpiry: e.target.value })} />
              </div>
              <div>
                <label htmlFor="status" className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Current Status</label>
                <select id="status" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white" value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}>
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

const AssetDetailsModal: React.FC<{ asset: Asset; onClose: () => void }> = ({ asset, onClose }) => {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
    JSON.stringify({ id: asset.id, sr: asset.srNumber, type: asset.type })
  )}`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-8 grid md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div>
              <h3 className="text-2xl font-bold dark:text-white capitalize">Asset Details</h3>
              <p className="text-slate-500 text-sm">Serial Number: <span className="font-mono font-bold text-blue-600">{asset.srNumber}</span></p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Assigned Staff</label>
                <p className="font-bold dark:text-white">{asset.employeeName}</p>
                <p className="text-xs text-slate-500">{asset.position}</p>
              </div>
              <div className="flex justify-between gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Department</label>
                  <p className="text-xs font-bold dark:text-slate-300">{asset.department}</p>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Warranty</label>
                  <p className="text-xs font-bold dark:text-slate-300">{new Date(asset.warrantyExpiry).toLocaleDateString()}</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <a
                href={`https://maintenance.bcc.gov.zw/search?serial=${asset.srNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between w-full p-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-2xl transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.829-5.83m-4.25 4.25-1.153 1.153a8.835 8.835 0 0 1-12.5-12.5l1.153-1.153m3.097 3.097 1.153-1.153a8.835 8.835 0 0 1 12.5 12.5l-1.153 1.153m-1.153-1.153-1.153 1.153a1.875 1.875 0 1 1-2.652-2.652l1.153-1.153m-1.153-1.153-1.153 1.153a1.875 1.875 0 1 1-2.652-2.652l1.153-1.153" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-sm dark:text-white">External Maintenance</p>
                    <p className="text-[10px] text-slate-500">Cross-link to service history website</p>
                  </div>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </a>
              <button
                onClick={onClose}
                className="w-full py-4 rounded-2xl border border-slate-200 dark:border-slate-800 font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
              >
                Close Intelligent View
              </button>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-800/20 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
            <div className="bg-white p-4 rounded-3xl shadow-xl mb-6">
              <img src={qrUrl} alt="Asset QR Code" className="w-48 h-48" />
            </div>
            <div className="text-center">
              <p className="font-bold text-sm dark:text-white mb-2">QR Asset Label</p>
              <p className="text-xs text-slate-500 leading-relaxed max-w-[200px]">
                Scan this tag with the council app to view information or report a fault.
              </p>
              <button
                onClick={() => window.print()}
                className="mt-6 flex items-center gap-2 px-6 py-2.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-xs font-bold hover:scale-105 transition-transform"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.89 2.4 16.233a.45.45 0 0 0-.216.425v2.916a.45.45 0 0 0 .428.424l20.44-.012a.45.45 0 0 0 .428-.424v-2.916a.45.45 0 0 0-.216-.425l-4.32-2.343a4.494 4.494 0 0 1-2.272-3.13l-1.24-5.866a.45.45 0 0 0-.434-.36h-5.414a.45.45 0 0 0-.434.36L8.992 10.76a4.494 4.494 0 0 1-2.272 3.13Z" />
                </svg>
                Print Asset Tag
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Assets;
