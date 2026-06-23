import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ICONS } from '../constants';

const getStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'active':
    case 'good':
    case 'working':
      return 'bg-green-100 text-green-700 border border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800/30';
    case 'under repair':
    case 'repair':
    case 'aging':
      return 'bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800/30';
    case 'disposed':
    case 'expired':
      return 'bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800/30';
    default:
      return 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
  }
};

const calculateAge = (purchaseDate: string) => {
  if (!purchaseDate) return 'Unknown';
  const start = new Date(purchaseDate);
  const end = new Date();
  const years = end.getFullYear() - start.getFullYear();
  const months = end.getMonth() - start.getMonth();
  const days = end.getDate() - start.getDate();
  if (years > 0) return `${years} year${years > 1 ? 's' : ''}`;
  if (months > 0) return `${months} month${months > 1 ? 's' : ''}`;
  return `${Math.max(0, days)} day${days !== 1 ? 's' : ''}`;
};

const AssetDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [asset, setAsset] = useState<any>(null);
  const [voucher, setVoucher] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAssetData = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/assets/${id}`, { credentials: 'include' });
        const data = await response.json();
        if (data.success) {
          setAsset(data.asset);
          setVoucher(data.voucher);
        }
      } catch (err) {
        console.error('Failed to fetch asset details:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAssetData();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-civic-primary"></div>
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="bg-civic-card p-6 rounded-2xl shadow-civic border border-civic-border text-center">
        <ICONS.AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
        <h2 className="text-xl font-bold mb-2 dark:text-white">Asset Not Found</h2>
        <p className="text-civic-muted mb-4">The asset you are looking for does not exist or has been removed.</p>
        <button
          type="button"
          onClick={() => navigate('/assets')}
          className="bg-civic-primary text-white px-4 py-2 rounded-xl transition-all hover:scale-105"
        >
          Back to Assets
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/assets')}
          className="flex items-center text-civic-muted hover:text-civic-primary transition-colors"
        >
          <ICONS.ArrowLeft className="w-5 h-5 mr-2" />
          Back to Assets
        </button>
        <div className={`px-4 py-1.5 rounded-full text-xs font-semibold ${getStatusColor(asset.condition_status || asset.status || 'active')}`}>
          {asset.condition_status || asset.status || 'Active'}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-civic-card p-6 rounded-2xl shadow-civic border border-civic-border">
            <h2 className="text-xl font-bold mb-6 flex items-center dark:text-white">
              <ICONS.Tag className="w-6 h-6 mr-2 text-civic-primary" />
              Asset Identification
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-sm text-civic-muted block mb-1">Asset Name</label>
                <div className="text-lg font-medium dark:text-white">{asset.asset_name || 'N/A'}</div>
              </div>
              <div>
                <label className="text-sm text-civic-muted block mb-1">SR Number</label>
                <div className="text-lg font-mono font-medium dark:text-white">{asset.sr_number || asset.asset_code || 'N/A'}</div>
              </div>
              <div>
                <label className="text-sm text-civic-muted block mb-1">Serial Number</label>
                <div className="text-lg font-mono dark:text-white">{asset.serial_number || 'N/A'}</div>
              </div>
              <div>
                <label className="text-sm text-civic-muted block mb-1">Brand / Model</label>
                <div className="text-lg dark:text-white">{[asset.brand, asset.model].filter(Boolean).join(' ') || 'N/A'}</div>
              </div>
            </div>
          </div>

          <div className="bg-civic-card p-6 rounded-2xl shadow-civic border border-civic-border">
            <h2 className="text-xl font-bold mb-6 flex items-center dark:text-white">
              <ICONS.User className="w-6 h-6 mr-2 text-civic-primary" />
              Assignment &amp; Location
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-sm text-civic-muted block mb-1">Employee Name</label>
                <div className="text-lg font-medium dark:text-white">{asset.employee_name || 'N/A'}</div>
              </div>
              <div>
                <label className="text-sm text-civic-muted block mb-1">Position</label>
                <div className="text-lg dark:text-white">{asset.position || 'N/A'}</div>
              </div>
              <div>
                <label className="text-sm text-civic-muted block mb-1">Department</label>
                <div className="text-lg flex items-center dark:text-white">
                  <ICONS.Building2 className="w-4 h-4 mr-2 opacity-50" />
                  {asset.department || 'N/A'}
                </div>
              </div>
              <div>
                <label className="text-sm text-civic-muted block mb-1">Location / Office</label>
                <div className="text-lg dark:text-white">
                  {[asset.location, asset.office_number ? `Office ${asset.office_number}` : null].filter(Boolean).join(' / ') || 'N/A'}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-civic-card p-6 rounded-2xl shadow-civic border border-civic-border">
            <h2 className="text-xl font-bold mb-6 flex items-center dark:text-white">
              <ICONS.Calendar className="w-6 h-6 mr-2 text-civic-primary" />
              Lifecycle
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-civic-muted block">Purchase Date</label>
                <div className="font-medium dark:text-white">{asset.purchase_date || 'N/A'}</div>
              </div>
              <div>
                <label className="text-sm text-civic-muted block">Asset Age</label>
                <div className="font-medium dark:text-white">{calculateAge(asset.purchase_date)}</div>
              </div>
              <div>
                <label className="text-sm text-civic-muted block text-red-500">Disposal Date</label>
                <div className="font-medium text-red-500">{asset.disposal_date || 'N/A'}</div>
              </div>
            </div>
          </div>

          {voucher && (
            <div className="bg-civic-card p-6 rounded-2xl shadow-civic border border-civic-border">
              <h2 className="text-xl font-bold mb-6 flex items-center dark:text-white">
                <ICONS.CreditCard className="w-6 h-6 mr-2 text-civic-primary" />
                Voucher Info
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-civic-muted block">Voucher #</label>
                  <div className="font-mono font-medium dark:text-white">{voucher.voucher_number || 'N/A'}</div>
                </div>
                <div>
                  <label className="text-sm text-civic-muted block">Code Number</label>
                  <div className="font-mono dark:text-white">{voucher.code_number || 'N/A'}</div>
                </div>
                <div>
                  <label className="text-sm text-civic-muted block">Vote / Department</label>
                  <div className="font-medium dark:text-white">{asset.vote_number || 'N/A'}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {voucher?.deliveries && voucher.deliveries.length > 0 && (
        <div className="bg-civic-card p-6 rounded-2xl shadow-civic border border-civic-border">
          <h2 className="text-xl font-bold mb-6 flex items-center dark:text-white">
            <ICONS.Truck className="w-6 h-6 mr-2 text-civic-primary" />
            Delivery History
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-civic-border text-left">
                  <th className="pb-3 font-semibold dark:text-white">Delivery Date</th>
                  <th className="pb-3 font-semibold dark:text-white">Quantity</th>
                  <th className="pb-3 font-semibold dark:text-white">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-civic-border">
                {voucher.deliveries.map((delivery: any, idx: number) => (
                  <tr key={idx}>
                    <td className="py-3 dark:text-slate-300">{delivery.delivery_date}</td>
                    <td className="py-3 dark:text-slate-300">{delivery.quantity || 'N/A'}</td>
                    <td className="py-3">
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full dark:bg-green-900/30 dark:text-green-400">
                        Received
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-civic-card p-6 rounded-2xl shadow-civic border border-civic-border">
        <h2 className="text-xl font-bold mb-4 flex items-center dark:text-white">
          <ICONS.FileText className="w-6 h-6 mr-2 text-civic-primary" />
          Notes
        </h2>
        <div className="p-4 bg-civic-bg rounded-xl min-h-[100px] text-civic-muted dark:text-slate-400">
          {asset.notes || 'No notes available for this asset.'}
        </div>
      </div>
    </div>
  );
};

export default AssetDetails;
