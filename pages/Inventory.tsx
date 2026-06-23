import React, { useState, useEffect, useCallback } from 'react';
import { storage, STORES } from '../services/storageService';
import { InventoryItem, User } from '../types';
import { ICONS } from '../constants';
import PageHeader from '../components/ui/PageHeader';
import { TableSkeleton } from '../components/Skeleton';
import { useToast } from '../components/ToastProvider';
import { ConfirmModal } from '../components/ConfirmModal';
import Pagination from '../components/ui/Pagination';

interface InventoryProps {
  user: User;
}

const Inventory: React.FC<InventoryProps> = ({ user }) => {
  const { showToast } = useToast();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string; name: string } | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const loadItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await storage.getAll<InventoryItem>(STORES.INVENTORY);
      setItems(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setSelectedIds(new Set());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
    (async () => {
      try {
        const [deptRes, catRes] = await Promise.all([
          fetch('/api/departments', { credentials: 'include' }),
          fetch('/api/categories', { credentials: 'include' }),
        ]);
        const deptData = await deptRes.json();
        const catData = await catRes.json();
        if (deptData.success) setDepartments(deptData.departments);
        if (catData.success) setCategories(catData.categories);
      } catch {
        console.warn('Failed to load departments/categories');
      }
    })();
  }, [loadItems]);

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await storage.delete(STORES.INVENTORY, deleteConfirm.id);
      await storage.logActivity(user.id, user.username, 'DELETE_INVENTORY', `Deleted item: ${deleteConfirm.name}`);
      showToast(`"${deleteConfirm.name}" deleted.`, 'success');
      loadItems();
    } catch {
      showToast('Failed to delete item.', 'error');
    } finally {
      setDeleteConfirm(null);
    }
  };

  const handleBulkDelete = async () => {
    const count = selectedIds.size;
    try {
      for (const id of selectedIds) await storage.delete(STORES.INVENTORY, id);
      await storage.logActivity(user.id, user.username, 'BULK_DELETE_INVENTORY', `Deleted ${count} inventory items`);
      showToast(`${count} item${count !== 1 ? 's' : ''} deleted.`, 'success');
      setSelectedIds(new Set());
      loadItems();
    } catch {
      showToast('Failed to delete some items.', 'error');
    } finally {
      setBulkDeleteConfirm(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredItems.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredItems.map(i => i.id)));
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedIds(next);
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
        (filterStatus === 'low' && isLowStock && i.quantity > 0) ||
        (filterStatus === 'out' && i.quantity === 0) ||
        (filterStatus === 'in' && !isLowStock);
      return matchesSearch && matchesCategory && matchesStatus;
    })
    .sort((a, b) => {
      let valA: any = sortBy === 'createdAt' ? new Date(a.createdAt).getTime() : (a as any)[sortBy] || '';
      let valB: any = sortBy === 'createdAt' ? new Date(b.createdAt).getTime() : (b as any)[sortBy] || '';
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

  useEffect(() => { setCurrentPage(1); }, [search, filterCategory, filterStatus, sortBy, sortOrder]);

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const paginatedItems = filteredItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const categoryOptions = categories.length > 0
    ? categories
    : [
        { id: 'Electronics', name: 'Electronics' },
        { id: 'Furniture', name: 'Furniture' },
        { id: 'IT Hardware', name: 'IT Hardware' },
        { id: 'Stationery', name: 'Stationery' },
        { id: 'Vehicle Parts', name: 'Vehicle Parts' },
      ];

  return (
    <div className="app-page">
      <PageHeader
        title="Inventory Management"
        subtitle="Track and manage organizational stock items."
        actions={
          <button
            type="button"
            onClick={() => { setEditingItem(null); setIsModalOpen(true); }}
            className="civic-button-primary whitespace-nowrap"
          >
            <ICONS.Plus className="w-5 h-5" />
            Add New Item
          </button>
        }
      />

      <div className="surface-card overflow-hidden p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-civic-border bg-slate-50 px-4 py-3 dark:bg-slate-800/70">
          <ICONS.Search className="w-5 h-5 text-slate-400 flex-shrink-0" />
          <div className="relative flex-1 min-w-[160px]">
            <input
              type="text"
              placeholder="Search items..."
              className="w-full border-none bg-transparent text-sm placeholder-slate-400 focus:ring-0 dark:text-white pr-7"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-0 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                aria-label="Clear search"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 border-l border-civic-border pl-3 whitespace-nowrap flex-wrap">
            <div className="flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md shadow-sm">
              <ICONS.Filter className="w-3.5 h-3.5 text-slate-400" />
              <select title="Filter by status" aria-label="Filter by status" className="bg-transparent text-xs border-none focus:ring-0 p-0 pr-6 dark:text-slate-200" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <option value="all">All Status</option>
                <option value="in">In Stock</option>
                <option value="low">Low Stock</option>
                <option value="out">Out of Stock</option>
              </select>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md shadow-sm">
              <select title="Filter by category" aria-label="Filter by category" className="bg-transparent text-xs border-none focus:ring-0 p-0 pr-6 dark:text-slate-200" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                <option value="all">All Categories</option>
                {categoryOptions.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md shadow-sm">
              <button type="button" onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')} title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}>
                {sortOrder === 'asc' ? <ICONS.SortAsc className="w-3.5 h-3.5 text-blue-600" /> : <ICONS.SortDesc className="w-3.5 h-3.5 text-blue-600" />}
              </button>
              <select title="Sort by field" aria-label="Sort by field" className="bg-transparent text-xs border-none focus:ring-0 p-0 pr-6 dark:text-slate-200" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="createdAt">Date Added</option>
                <option value="name">Item Name</option>
                <option value="quantity">Quantity</option>
                <option value="price">Price</option>
              </select>
            </div>
          </div>

          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={() => setBulkDeleteConfirm(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors whitespace-nowrap"
            >
              <ICONS.Trash className="w-4 h-4" />
              Delete {selectedIds.size}
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <TableSkeleton rows={8} cols={8} />
          ) : (
            <table className="table-shell text-left">
              <thead className="table-head text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 w-10">
                    <input type="checkbox" checked={selectedIds.size > 0 && selectedIds.size === filteredItems.length} onChange={toggleSelectAll} className="w-4 h-4 rounded border-slate-300 text-blue-600 cursor-pointer" title="Select all" />
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
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {paginatedItems.map(item => (
                  <tr key={item.id} className={`table-row transition-colors ${selectedIds.has(item.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                    <td className="px-6 py-4">
                      <input type="checkbox" aria-label={`Select ${item.name}`} checked={selectedIds.has(item.id)} onChange={() => toggleSelect(item.id)} className="w-4 h-4 rounded border-slate-300 text-blue-600 cursor-pointer" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-civic-text dark:text-white">{item.name}</div>
                      <div className="text-xs text-slate-400">SN: {item.serialNumber}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
                        {item.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-civic-text dark:text-slate-300">{item.quantity}</td>
                    <td className="px-6 py-4 text-slate-500">${item.price.toFixed(2)}</td>
                    <td className="px-6 py-4 font-semibold text-civic-primary">${(item.price * item.quantity).toFixed(2)}</td>
                    <td className="px-6 py-4">
                      {item.quantity === 0 ? (
                        <span className="inline-flex items-center gap-1 text-red-700 text-xs font-bold uppercase">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse"></span>Out of Stock
                        </span>
                      ) : item.quantity <= item.lowStockThreshold ? (
                        <span className="inline-flex items-center gap-1 text-amber-700 text-xs font-bold uppercase">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>Low Stock
                        </span>
                      ) : (
                        <span className="text-green-600 text-xs font-bold uppercase">In Stock</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button type="button" title="Edit Item" aria-label="Edit Item" onClick={() => { setEditingItem(item); setIsModalOpen(true); }} className="p-1.5 text-slate-400 hover:text-civic-primary transition-colors">
                          <ICONS.Edit className="w-5 h-5" />
                        </button>
                        <button type="button" title="Delete Item" aria-label="Delete Item" onClick={() => setDeleteConfirm({ isOpen: true, id: item.id, name: item.name })} className="p-1.5 text-slate-400 hover:text-red-600 transition-colors">
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
          )}
        </div>

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredItems.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          itemLabel="items"
        />
      </div>

      {isModalOpen && (
        <InventoryModal
          item={editingItem}
          user={user}
          departments={departments}
          categories={categoryOptions}
          onClose={() => setIsModalOpen(false)}
          onSave={() => { loadItems(); setIsModalOpen(false); }}
        />
      )}

      <ConfirmModal
        isOpen={!!deleteConfirm?.isOpen}
        title="Delete Inventory Item?"
        message={`Are you sure you want to delete "${deleteConfirm?.name}"? This cannot be undone.`}
        confirmText="Delete"
        isDanger
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(null)}
      />

      <ConfirmModal
        isOpen={bulkDeleteConfirm}
        title={`Delete ${selectedIds.size} Item${selectedIds.size !== 1 ? 's' : ''}?`}
        message="This will permanently delete all selected inventory items. This cannot be undone."
        confirmText="Delete All"
        isDanger
        onConfirm={handleBulkDelete}
        onCancel={() => setBulkDeleteConfirm(false)}
      />
    </div>
  );
};

interface ModalProps {
  item: InventoryItem | null;
  user: User;
  departments: any[];
  categories: { id: string; name: string }[];
  onClose: () => void;
  onSave: () => void;
}

const InventoryModal: React.FC<ModalProps> = ({ item, user, departments, categories, onClose, onSave }) => {
  const { showToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<any>(
    item || {
      name: '', category: '', quantity: 0, price: 0, serialNumber: '', description: '', lowStockThreshold: 5,
      voucherNumber: '', requisitionNumber: '', codeNumber: '', unit: '', deliveryDate: '',
      departmentId: '', storeCommittee: ''
    }
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const newItem = { ...formData, ...(item?.id ? { id: item.id } : {}), createdAt: item?.createdAt || new Date().toISOString() } as InventoryItem;
      await storage.save(STORES.INVENTORY, newItem);
      await storage.logActivity(user.id, user.username, item ? 'UPDATE_INVENTORY' : 'ADD_INVENTORY', `${item ? 'Updated' : 'Added'} item: ${newItem.name}`);
      showToast(`Item "${newItem.name}" ${item ? 'updated' : 'created'} successfully.`, 'success');
      onSave();
    } catch (err: any) {
      showToast(err.message || 'Failed to save item.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const field = (label: string, id: string, node: React.ReactNode) => (
    <div>
      <label htmlFor={id} className="block text-xs font-bold text-slate-500 uppercase mb-1.5 tracking-wider">{label}</label>
      {node}
    </div>
  );

  const inputCls = "w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
          <h3 className="text-lg font-bold dark:text-white">{item ? 'Edit Inventory Item' : 'Add New Inventory Item'}</h3>
          <button type="button" onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500" aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">{field('Item Name', 'inv-name', <input id="inv-name" required type="text" placeholder="Enter item name" className={inputCls} value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />)}</div>
            <div>{field('Category', 'inv-cat', <select id="inv-cat" title="Select Category" className={inputCls} value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}><option value="">Select Category</option>{categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select>)}</div>
            <div>{field('Serial Number', 'inv-sn', <input id="inv-sn" type="text" placeholder="Serial or Code" className={inputCls} value={formData.serialNumber} onChange={e => setFormData({ ...formData, serialNumber: e.target.value })} />)}</div>
            <div>{field('Quantity', 'inv-qty', <input id="inv-qty" required type="number" min="0" placeholder="0" className={inputCls} value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })} />)}</div>
            <div>{field('Unit Price ($)', 'inv-price', <input id="inv-price" required type="number" step="0.01" min="0" placeholder="0.00" className={inputCls} value={formData.price} onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })} />)}</div>
            <div>{field('Low Stock Limit', 'inv-low', <input id="inv-low" required type="number" min="0" placeholder="5" className={inputCls} value={formData.lowStockThreshold} onChange={e => setFormData({ ...formData, lowStockThreshold: parseInt(e.target.value) || 0 })} />)}</div>
            <div>{field('Unit', 'inv-unit', <input id="inv-unit" type="text" placeholder="Each" className={inputCls} value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })} />)}</div>

            <div className="col-span-2 border-t border-slate-100 dark:border-slate-800 pt-4">
              <h4 className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-4">Procurement Details</h4>
            </div>
            <div>{field('Voucher Number', 'inv-vn', <input id="inv-vn" type="text" placeholder="V-000" className={inputCls} value={formData.voucherNumber} onChange={e => setFormData({ ...formData, voucherNumber: e.target.value })} />)}</div>
            <div>{field('Requisition No.', 'inv-rn', <input id="inv-rn" type="text" placeholder="R-000" className={inputCls} value={formData.requisitionNumber} onChange={e => setFormData({ ...formData, requisitionNumber: e.target.value })} />)}</div>
            <div>{field('Code Number', 'inv-cn', <input id="inv-cn" type="text" placeholder="C-000" className={inputCls} value={formData.codeNumber} onChange={e => setFormData({ ...formData, codeNumber: e.target.value })} />)}</div>
            <div>{field('Delivery Date', 'inv-dd', <input id="inv-dd" type="date" className={inputCls} value={formData.deliveryDate} onChange={e => setFormData({ ...formData, deliveryDate: e.target.value })} />)}</div>
            <div className="col-span-2">{field('Department', 'inv-dept', <select id="inv-dept" title="Select Department" className={inputCls} value={formData.departmentId} onChange={e => setFormData({ ...formData, departmentId: e.target.value })}><option value="">Select Department</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select>)}</div>
          </div>
          <div className="flex gap-3 mt-8">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 transition-colors">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors shadow-lg disabled:opacity-60 disabled:cursor-not-allowed">
              {isSubmitting ? 'Saving...' : item ? 'Save Changes' : 'Create Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Inventory;
