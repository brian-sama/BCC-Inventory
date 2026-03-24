import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Asset, User } from '../types';
import { storage } from '../services/storageService';
import { ICONS } from '../constants';

interface AssetDetailsProps {
  user: User;
}

const AssetDetails: React.FC<AssetDetailsProps> = ({ user }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [asset, setAsset] = useState<any>(null);
  const [voucher, setVoucher] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAssetData = async () => {
      try {
        setLoading(true);
        // In a real app, this would be a single API call to /api/assets/:id
        // We'll simulate it using storage for now or fetch from API if available
        const response = await fetch(`/api/assets/${id}`);
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
        <ICONS.AlertCircle className="mx-auto h-12 w-12 text-civic-danger mb-4" />
        <h2 className="text-xl font-bold mb-2">Asset Not Found</h2>
        <p className="text-civic-muted mb-4">The asset you are looking for does not exist or has been removed.</p>
        <button 
          onClick={() => navigate('/assets')}
          className="bg-civic-primary text-white px-4 py-2 rounded-xl transition-all hover:scale-105"
        >
          Back to Assets
        </button>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active': return 'bg-success/20 text-success border-success/30';
      case 'aging': return 'bg-warning/20 text-warning border-warning/30';
      case 'expired': return 'bg-danger/20 text-danger border-danger/30';
      default: return 'bg-civic-muted/20 text-civic-muted border-civic-muted/30';
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
    return `${days} day${days > 1 ? 's' : ''}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button 
          onClick={() => navigate('/assets')}
          className="flex items-center text-civic-muted hover:text-civic-primary transition-colors"
        >
          <ICONS.ArrowLeft className="w-5 h-5 mr-2" />
          Back to Assets
        </button>
        <div className={`px-4 py-1.5 rounded-full text-xs font-semibold border ${getStatusColor(asset.status || 'Active')}`}>
          {asset.status || 'Active'}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Basic Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-civic-card p-6 rounded-2xl shadow-civic border border-civic-border">
            <h2 className="text-xl font-bold mb-6 flex items-center">
              <ICONS.Tag className="w-6 h-6 mr-2 text-civic-primary" />
              Asset Identification
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-sm text-civic-muted block mb-1">Asset Name</label>
                <div className="text-lg font-medium">{asset.asset_name || 'N/A'}</div>
              </div>
              <div>
                <label className="text-sm text-civic-muted block mb-1">SR Number</label>
                <div className="text-lg font-mono font-medium">{asset.sr_number || asset.asset_code || 'N/A'}</div>
              </div>
              <div>
                <label className="text-sm text-civic-muted block mb-1">Serial Number</label>
                <div className="text-lg font-mono">{asset.serial_number || 'N/A'}</div>
              </div>
              <div>
                <label className="text-sm text-civic-muted block mb-1">Brand/Model</label>
                <div className="text-lg">{asset.brand} {asset.model}</div>
              </div>
            </div>
          </div>

          <div className="bg-civic-card p-6 rounded-2xl shadow-civic border border-civic-border">
            <h2 className="text-xl font-bold mb-6 flex items-center">
              <ICONS.User className="w-6 h-6 mr-2 text-civic-primary" />
              Assignment & Location
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-sm text-civic-muted block mb-1">Employee Name</label>
                <div className="text-lg font-medium">{asset.employee_name || 'N/A'}</div>
              </div>
              <div>
                <label className="text-sm text-civic-muted block mb-1">Position</label>
                <div className="text-lg">{asset.position || 'N/A'}</div>
              </div>
              <div>
                <label className="text-sm text-civic-muted block mb-1">Department</label>
                <div className="text-lg flex items-center">
                  <Building2 className="w-4 h-4 mr-2 opacity-50" />
                  {asset.department || 'N/A'}
                </div>
              </div>
              <div>
                <label className="text-sm text-civic-muted block mb-1">Location / Office</label>
                <div className="text-lg">{asset.location} {asset.office_number ? `/ ${asset.office_number}` : ''}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Financial & Lifecycle */}
        <div className="space-y-6">
          <div className="bg-civic-card p-6 rounded-2xl shadow-civic border border-civic-border">
            <h2 className="text-xl font-bold mb-6 flex items-center">
              <ICONS.Calendar className="w-6 h-6 mr-2 text-civic-primary" />
              Lifecycle
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-civic-muted block">Purchase Date</label>
                <div className="font-medium">{asset.purchase_date || 'N/A'}</div>
              </div>
              <div>
                <label className="text-sm text-civic-muted block">Asset Age</label>
                <div className="font-medium">{calculateAge(asset.purchase_date)}</div>
              </div>
              <div>
                <label className="text-sm text-civic-muted block text-civic-danger">Disposal Date</label>
                <div className="font-medium text-civic-danger">{asset.disposal_date || 'N/A'}</div>
              </div>
            </div>
          </div>

          {voucher && (
            <div className="bg-civic-card p-6 rounded-2xl shadow-civic border border-civic-border">
              <h2 className="text-xl font-bold mb-6 flex items-center">
                <ICONS.CreditCard className="w-6 h-6 mr-2 text-civic-primary" />
                Voucher Info
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-civic-muted block">Voucher #</label>
                  <div className="font-mono font-medium">{voucher.voucher_number || 'N/A'}</div>
                </div>
                <div>
                  <label className="text-sm text-civic-muted block">Code Number</label>
                  <div className="font-mono">{voucher.code_number || 'N/A'}</div>
                </div>
                <div>
                  <label className="text-sm text-civic-muted block">Vote / Department</label>
                  <div className="font-medium">{asset.vote_number || 'N/A'}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {voucher?.deliveries && voucher.deliveries.length > 0 && (
        <div className="bg-civic-card p-6 rounded-2xl shadow-civic border border-civic-border">
          <h2 className="text-xl font-bold mb-6 flex items-center">
            <ICONS.Truck className="w-6 h-6 mr-2 text-civic-primary" />
            Delivery History
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-civic-border text-left">
                  <th className="pb-3 font-semibold">Delivery Date</th>
                  <th className="pb-3 font-semibold">Quantity</th>
                  <th className="pb-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-civic-border">
                {voucher.deliveries.map((delivery: any, idx: number) => (
                  <tr key={idx}>
                    <td className="py-3">{delivery.delivery_date}</td>
                    <td className="py-3">{delivery.quantity || 'N/A'}</td>
                    <td className="py-3">
                      <span className="px-2 py-1 bg-success/20 text-success text-xs rounded-full">
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
        <h2 className="text-xl font-bold mb-4 flex items-center">
          <ICONS.FileText className="w-6 h-6 mr-2 text-civic-primary" />
          Notes
        </h2>
        <div className="p-4 bg-civic-bg rounded-xl min-h-[100px] text-civic-muted">
          {asset.notes || 'No notes available for this asset.'}
        </div>
      </div>
    </div>
  );
};

export default AssetDetails;
