import React, { useState, useEffect } from 'react';
import { storage, STORES } from '../services/storageService';
import { InventoryItem, User } from '../types';
import { ICONS } from '../constants';
import PageHeader from '../components/ui/PageHeader';

interface InventoryProps {
  user: User;
}

const Inventory: React.FC<InventoryProps> = ({ user }) => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Pagination, Sort & Filter State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    loadItems();
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

  const loadItems = async () => {
    const data = await storage.getAll<InventoryItem>(STORES.INVENTORY);
    setItems(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    setSelectedIds(new Set());
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete ${name}?`)) {
      await storage.delete(STORES.INVENTORY, id);
      await storage.logActivity(user.id, user.username, 'DELETE_INVENTORY', `Deleted item: ${name}`);
      loadItems();
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    if (confirm(`Are you sure you want to delete ${count} item${count !== 1 ? 's' : ''}? This cannot be undone.`)) {
      try {
        for (const id of selectedIds) {
          await storage.delete(STORES.INVENTORY, id);
        }
        await storage.logActivity(user.id, user.username, 'BULK_DELETE_INVENTORY', `Deleted ${count} inventory items`);
        setSelectedIds(new Set());
        loadItems();
      } catch (error) {
        console.error('Bulk delete failed:', error);
        alert('Failed to delete some items. Please try again.');
      }
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map(item => item.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const filteredItems = items
    .filter(i => {
      const matchesSearch = 
        i.name.toLowerCase().includes(search.toLowerCase()) ||
        i.category.toLowerCase().includes(search.toLowerCase()) ||
        i.serialNumber.toLowerCase().includes(search.toLowerCase());
      
      const matchesCategory = filterCategory === 'all' || i.category === filterCategory;
      const isLowStock = i.quantity <= i.lowStockThreshold;
      const matchesStatus = filterStatus === 'all' || 
                           (filterStatus === 'low' && isLowStock) || 
                           (filterStatus === 'in' && !isLowStock);
      
      return matchesSearch && matchesCategory && matchesStatus;
    })
    .sort((a, b) => {
      let valA: any = a[sortBy as keyof InventoryItem] || '';
      let valB: any = b[sortBy as keyof InventoryItem] || '';
      
      if (sortBy === 'createdAt') {
        valA = new Date(a.createdAt).getTime();
        valB = new Date(b.createdAt).getTime();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const paginatedItems = filteredItems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterCategory, filterStatus, sortBy, sortOrder]);

  return (
    <div className="app-page">
      <PageHeader
        title="Inventory Management"
        subtitle="Track and manage organizational stock items."
        actions={
          <button
            onClick={() => {
              setEditingItem(null);
              setIsModalOpen(true);
            }}
            className="civic-button-primary whitespace-nowrap"
          >
            <ICONS.Plus className="w-5 h-5" />
            Add New Item
          </button>
        }
      />

      <div className="surface-card overflow-hidden p-0">
        <div className="flex items-center gap-3 border-b border-civic-border bg-slate-50 px-4 py-3 dark:bg-slate-800/70">
          <ICONS.Search className="w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search items by name, category, or serial number..."
            className="w-full border-none bg-transparent text-sm placeholder-slate-400 focus:ring-0 dark:text-white"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="flex items-center gap-2 border-l border-civic-border pl-3 whitespace-nowrap">
            <div className="flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md shadow-sm">
              <ICONS.Filter className="w-3.5 h-3.5 text-slate-400" />
              <select 
                className="bg-transparent text-xs border-none focus:ring-0 p-0 pr-6 dark:text-slate-200"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="in">In Stock</option>
                <option value="low">Low Stock</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md shadow-sm">
              <select 
                className="bg-transparent text-xs border-none focus:ring-0 p-0 pr-6 dark:text-slate-200"
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
              >
                <option value="all">All Categories</option>
                <option value="Electronics">Electronics</option>
                <option value="Furniture">Furniture</option>
                <option value="IT Hardware">IT Hardware</option>
                <option value="Stationery">Stationery</option>
                <option value="Vehicle Parts">Vehicle Parts</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md shadow-sm">
              <button 
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="p-0 border-none bg-transparent"
                title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
              >
                {sortOrder === 'asc' ? <ICONS.SortAsc className="w-3.5 h-3.5 text-blue-600" /> : <ICONS.SortDesc className="w-3.5 h-3.5 text-blue-600" />}
              </button>
              <select 
                className="bg-transparent text-xs border-none focus:ring-0 p-0 pr-6 dark:text-slate-200"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="createdAt">Date Added</option>
                <option value="name">Item Name</option>
                <option value="quantity">Quantity</option>
                <option value="price">Price</option>
              </select>
            </div>
          </div>

          {selectedIds.size > 0 && (
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors whitespace-nowrap"
            >
              <ICONS.Trash className="w-4 h-4" />
              Delete {selectedIds.size}
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="table-shell text-left">
            <thead className="table-head text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.size > 0 && selectedIds.size === filteredItems.length}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    title={selectedIds.size === filteredItems.length ? "Deselect all items" : "Select all items"}
                  />
                </th>
                <th className="px-6 py-4">Item Details</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Quantity</th>
                <th className="px-6 py-4">Unit Price</th>
                <th className="px-6 py-4">Total Value</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {paginatedItems.map(item => (
                <tr key={item.id} className={`table-row transition-colors ${selectedIds.has(item.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item.id)}
                      onChange={() => toggleSelect(item.id)}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-semibold text-civic-text dark:text-white">{item.name}</div>
                    <div className="text-xs text-slate-400">SN: {item.serialNumber}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium border border-slate-200">
                      {item.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-medium text-civic-text dark:text-slate-300">{item.quantity}</td>
                  <td className="px-6 py-4 text-slate-500">${item.price.toFixed(2)}</td>
                  <td className="px-6 py-4 font-semibold text-civic-primary">${(item.price * item.quantity).toFixed(2)}</td>
                  <td className="px-6 py-4">
                    {item.quantity <= item.lowStockThreshold ? (
                      <span className="inline-flex items-center gap-1 text-red-600 text-xs font-bold uppercase tracking-tight">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse"></span>
                        Low Stock
                      </span>
                    ) : (
                      <span className="text-green-600 text-xs font-bold uppercase tracking-tight">In Stock</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        title="Edit Item"
                        aria-label="Edit Item"
                        onClick={() => { setEditingItem(item); setIsModalOpen(true); }}
                        className="p-1.5 text-slate-400 hover:text-civic-primary transition-colors"
                      >
                        <ICONS.Edit className="w-5 h-5" />
                      </button>
                      <button
                        title="Delete Item"
                        aria-label="Delete Item"
                        onClick={() => handleDelete(item.id, item.name)}
                        className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"
                      >
                        <ICONS.Trash className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-20 text-center text-slate-400 italic">No inventory items found matching your search.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Toolbar */}
        <div className="px-6 py-4 border-t border-civic-border flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
          <div className="text-xs text-slate-500">
            Showing <span className="font-semibold text-slate-700 dark:text-slate-300">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-semibold text-slate-700 dark:text-slate-300">{Math.min(currentPage * itemsPerPage, filteredItems.length)}</span> of <span className="font-semibold text-slate-700 dark:text-slate-300">{filteredItems.length}</span> items
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-40 transition-colors"
            >
              <ICONS.ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1">
              {[...Array(totalPages)].map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i + 1)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${currentPage === i + 1 ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500'}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <button
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-40 transition-colors"
            >
              <ICONS.ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <InventoryModal
          item={editingItem}
          user={user}
          departments={departments}
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
  departments: any[];
  onClose: () => void;
  onSave: () => void;
}

const InventoryModal: React.FC<ModalProps> = ({ item, user, departments, onClose, onSave }) => {
  const [formData, setFormData] = useState<any>(
    item || { 
      name: '', category: '', quantity: 0, price: 0, serialNumber: '', description: '', lowStockThreshold: 5,
      voucherNumber: '', requisitionNumber: '', codeNumber: '', unit: '', deliveryDate: '',
      departmentId: '', storeCommittee: ''
    }
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Do not generate ID for new items, let backend handle it
    const newItem = {
      ...formData,
      ...(item?.id ? { id: item.id } : {}),
      createdAt: item?.createdAt || new Date().toISOString()
    } as InventoryItem;

    await storage.save(STORES.INVENTORY, newItem);
    await storage.logActivity(
      user.id,
      user.username,
      item ? 'UPDATE_INVENTORY' : 'ADD_INVENTORY',
      `${item ? 'Updated' : 'Added'} item: ${newItem.name}`
    );
    onSave();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
          <h3 className="text-lg font-bold dark:text-white">{item ? 'Edit Inventory Item' : 'Add New Inventory Item'}</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500">
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
                placeholder="Enter item name"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="category" className="block text-xs font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Category</label>
              <select
                id="category"
                title="Select Category"
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
                placeholder="Serial or Code"
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
                placeholder="0"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div>
              <label htmlFor="unitPrice" className="block text-xs font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Unit Price ($)</label>
              <input
                id="unitPrice"
                required
                type="number"
                step="0.01"
                placeholder="0.00"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div>
              <label htmlFor="lowStock" className="block text-xs font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Low Stock Limit</label>
              <input
                id="lowStock"
                required
                type="number"
                placeholder="5"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                value={formData.lowStockThreshold}
                onChange={(e) => setFormData({ ...formData, lowStockThreshold: parseInt(e.target.value) || 0 })}
              />
            </div>

            <div className="col-span-2 border-t border-slate-100 dark:border-slate-800 pt-4 mt-2">
              <h4 className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-4">Procurement Details</h4>
            </div>

            <div>
              <label htmlFor="voucherNum" className="block text-xs font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Voucher Number</label>
              <input
                id="voucherNum"
                type="text"
                placeholder="V-000"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                value={formData.voucherNumber}
                onChange={(e) => setFormData({ ...formData, voucherNumber: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="reqNum" className="block text-xs font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Requisition No.</label>
              <input
                id="reqNum"
                type="text"
                placeholder="R-000"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                value={formData.requisitionNumber}
                onChange={(e) => setFormData({ ...formData, requisitionNumber: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="codeNum" className="block text-xs font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Code Number</label>
              <input
                id="codeNum"
                type="text"
                placeholder="C-000"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                value={formData.codeNumber}
                onChange={(e) => setFormData({ ...formData, codeNumber: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="unit" className="block text-xs font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Unit (e.g. Each, Box)</label>
              <input
                id="unit"
                type="text"
                placeholder="Each"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="deliveryDate" className="block text-xs font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Delivery Date</label>
              <input
                id="deliveryDate"
                type="date"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                value={formData.deliveryDate}
                onChange={(e) => setFormData({ ...formData, deliveryDate: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="department" className="block text-xs font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Department</label>
              <select
                id="department"
                title="Select Department"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                value={formData.departmentId}
                onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
              >
                <option value="">Select Department</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
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
