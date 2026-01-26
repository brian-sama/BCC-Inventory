
import React, { useState, useEffect } from 'react';
import { storage, STORES } from '../services/storageService';
import { InventoryItem, User } from '../types';
import { ICONS } from '../constants';

interface InventoryProps {
  user: User;
}

const Inventory: React.FC<InventoryProps> = ({ user }) => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('Inventory component mounted for user:', user.username);
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      console.log('Inventory: fetching items...');
      setLoading(true);
      const data = await storage.getAll<InventoryItem>(STORES.INVENTORY);
      console.log('Inventory: items fetched count:', data.length);
      setItems(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (err) {
      console.error('Failed to load inventory in component:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete ${name}?`)) {
      await storage.delete(STORES.INVENTORY, id);
      await storage.logActivity(user.id, user.username, 'DELETE_INVENTORY', `Deleted item: ${name}`);
      loadItems();
    }
  };

  const filteredItems = items.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.category.toLowerCase().includes(search.toLowerCase()) ||
    i.serialNumber.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold dark:text-white">Inventory Management</h2>
            <p className="text-slate-500 dark:text-slate-400">Track and manage organizational stock items.</p>
            <div className="text-[10px] text-green-500 font-mono mt-1">Component: Inventory | Route: /inventory</div>
          </div>
          <button
            onClick={() => { setEditingItem(null); setIsModalOpen(true); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors shadow-sm"
          >
            <ICONS.Plus className="w-5 h-5" />
            Add New Item
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center">
          <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-slate-400">Loading inventory data...</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden min-h-[400px]">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center gap-3">
            <ICONS.Search className="w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search items by name, category, or serial number..."
              className="bg-transparent border-none focus:ring-0 text-sm w-full dark:text-white placeholder-slate-400"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="text-xs uppercase tracking-wider font-bold text-slate-500 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-4">Item Details</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Quantity</th>
                  <th className="px-6 py-4">Unit Price</th>
                  <th className="px-6 py-4">Total Value</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredItems.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold dark:text-white">{item.name}</div>
                      <div className="text-xs text-slate-400">SN: {item.serialNumber}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-medium border border-slate-200 dark:border-slate-700">
                        {item.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium dark:text-slate-300">{item.quantity}</td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400">${item.price.toFixed(2)}</td>
                    <td className="px-6 py-4 font-bold text-blue-600 dark:text-blue-400">${(item.price * item.quantity).toFixed(2)}</td>
                    <td className="px-6 py-4">
                      {item.quantity <= item.lowStockThreshold ? (
                        <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 text-xs font-bold uppercase tracking-tight">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse"></span>
                          Low Stock
                        </span>
                      ) : (
                        <span className="text-green-600 dark:text-green-400 text-xs font-bold uppercase tracking-tight">In Stock</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => { setEditingItem(item); setIsModalOpen(true); }}
                          className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                          aria-label={`Edit ${item.name}`}
                          title="Edit Item"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(item.id, item.name)}
                          className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                          aria-label={`Delete ${item.name}`}
                          title="Delete Item"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-20 text-center text-slate-400 italic">No inventory items found matching your search.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isModalOpen && (
        <InventoryModal
          item={editingItem}
          user={user}
          onClose={() => setIsModalOpen(false)}
          onSave={() => { loadItems(); setIsModalOpen(false); }}
        />
      )}
    </div>
  );
};

interface ModalProps {
  item: InventoryItem | null;
  user: User;
  onClose: () => void;
  onSave: () => void;
}

const InventoryModal: React.FC<ModalProps> = ({ item, user, onClose, onSave }) => {
  const [formData, setFormData] = useState<Partial<InventoryItem>>(
    item || { name: '', category: '', quantity: 0, price: 0, serialNumber: '', description: '', lowStockThreshold: 5 }
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const id = item?.id || crypto.randomUUID();
      const newItem = {
        ...formData,
        id,
        createdAt: item?.createdAt || new Date().toISOString()
      } as InventoryItem;

      await storage.addInventoryItem(newItem);
      await storage.logActivity(
        user.id,
        user.username,
        item ? 'UPDATE_INVENTORY' : 'ADD_INVENTORY',
        `${item ? 'Updated' : 'Added'} item: ${newItem.name}`
      );

      showToast(`${newItem.name} ${item ? 'updated' : 'added'} successfully`, 'success');
      onSave();
    } catch (err) {
      showToast('Failed to save inventory item', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
          <h3 className="text-lg font-bold dark:text-white">{item ? 'Edit Inventory Item' : 'Add New Inventory Item'}</h3>
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label htmlFor="itemName" className="block text-xs font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Item Name</label>
              <input
                id="itemName"
                required
                type="text"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="category" className="block text-xs font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Category</label>
              <select
                id="category"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              >
                <option value="">Select Category</option>
                <option value="Electronics">Electronics</option>
                <option value="Furniture">Furniture</option>
                <option value="Stationery">Stationery</option>
                <option value="IT Hardware">IT Hardware</option>
                <option value="Vehicle Parts">Vehicle Parts</option>
              </select>
            </div>
            <div>
              <label htmlFor="serialNumber" className="block text-xs font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Serial Number</label>
              <input
                id="serialNumber"
                type="text"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                value={formData.serialNumber}
                onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="quantity" className="block text-xs font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Quantity</label>
              <input
                id="quantity"
                required
                type="number"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div>
              <label htmlFor="price" className="block text-xs font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Unit Price ($)</label>
              <input
                id="price"
                required
                type="number"
                step="0.01"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div>
              <label htmlFor="lowStockThreshold" className="block text-xs font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Low Stock Limit</label>
              <input
                id="lowStockThreshold"
                required
                type="number"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                value={formData.lowStockThreshold}
                onChange={(e) => setFormData({ ...formData, lowStockThreshold: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>
          <div className="flex gap-3 mt-8">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors shadow-lg"
            >
              {item ? 'Save Changes' : 'Create Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Inventory;
