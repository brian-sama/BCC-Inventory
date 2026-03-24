import React, { useState, useEffect } from 'react';
import { storage, STORES } from '../services/storageService';
import { User, UserRole } from '../types';
import { TableSkeleton } from '../components/Skeleton';
import { useToast } from '../components/ToastProvider';
import { ConfirmModal } from '../components/ConfirmModal';
import { ICONS } from '../constants';
import PageHeader from '../components/ui/PageHeader';

const UserManagement: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const { showToast } = useToast();
    const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string; name: string }>({
        isOpen: false,
        id: '',
        name: ''
    });
    const [departments, setDepartments] = useState<any[]>([]);

    useEffect(() => {
        loadUsers();
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

    const loadUsers = async () => {
        try {
            setLoading(true);
            const data = await storage.getAll<User>(STORES.USERS);
            setUsers(data);
        } catch (err) {
            showToast('Failed to load users', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteUser = async () => {
        try {
            await storage.delete(STORES.USERS, deleteConfirm.id);
            showToast(`${deleteConfirm.name} removed successfully`, 'success');
            loadUsers();
        } catch (err) {
            showToast('Failed to delete user', 'error');
        } finally {
            setDeleteConfirm({ isOpen: false, id: '', name: '' });
        }
    };

    return (
        <div className="app-page">
            <PageHeader
                title="Staff Management"
                subtitle="Manage council staff system accounts and access levels."
                actions={
                    <button
                        onClick={() => {
                            setEditingUser(null);
                            setIsModalOpen(true);
                        }}
                        className="civic-button-primary"
                    >
                        <ICONS.Plus className="w-5 h-5" />
                        Create New User
                    </button>
                }
            />

            <div className="surface-card overflow-hidden min-h-[400px] p-0">
                <div className="overflow-x-auto">
                    {loading ? (
                        <TableSkeleton rows={6} cols={5} />
                    ) : (
                        <table className="table-shell text-left">
                            <thead className="table-head text-xs uppercase tracking-wider">
                                <tr>
                                    <th className="px-6 py-4">Full Name</th>
                                    <th className="px-6 py-4">Username</th>
                                    <th className="px-6 py-4">Role / Department</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {users.map((u) => (
                                    <tr key={u.id} className="table-row transition-colors">
                                        <td className="px-6 py-4 font-semibold text-civic-text dark:text-white">{u.fullName}</td>
                                        <td className="px-6 py-4 text-sm text-civic-muted dark:text-slate-400">{u.username}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1">
                                                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-tight w-fit ${u.role.toLowerCase() === 'admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                                                    u.role.toLowerCase() === 'head administrator' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                                        'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                                    }`}>
                                                    {u.role.replace('_', ' ')}
                                                </span>
                                                {u.departmentName && (
                                                    <span className="text-[10px] text-slate-400 font-medium italic">
                                                        Dept: {u.departmentName}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center gap-1.5 text-green-600 text-xs font-bold uppercase">
                                                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                                Active
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    title="Edit User"
                                                    onClick={() => { setEditingUser(u); setIsModalOpen(true); }}
                                                    className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors"
                                                >
                                                    <ICONS.Edit className="w-5 h-5" />
                                                </button>
                                                <button
                                                    title="Delete User"
                                                    onClick={() => setDeleteConfirm({ isOpen: true, id: u.id, name: u.username })}
                                                    className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"
                                                >
                                                    <ICONS.Trash className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {isModalOpen && (
                <UserModal
                    user={editingUser}
                    departments={departments}
                    onClose={() => setIsModalOpen(false)}
                    onSave={() => { loadUsers(); setIsModalOpen(false); }}
                />
            )}

            <ConfirmModal
                isOpen={deleteConfirm.isOpen}
                title="Remove User Access?"
                message={`This will permanently revoke all system access for ${deleteConfirm.name}. Should we proceed?`}
                confirmText="Revoke Access"
                isDanger={true}
                onConfirm={handleDeleteUser}
                onCancel={() => setDeleteConfirm({ isOpen: false, id: '', name: '' })}
            />
        </div>
    );
};

const UserModal: React.FC<{ user: User | null; departments: any[]; onClose: () => void; onSave: () => void }> = ({ user, departments, onClose, onSave }) => {
    const [formData, setFormData] = useState<Partial<User>>(
        user || { username: '', fullName: '', role: UserRole.STOCK_TAKER, password: '', departmentId: '' }
    );
    const { showToast } = useToast();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const id = user?.id || crypto.randomUUID();
            const newUser = { ...formData, id } as User;
            await storage.put(STORES.USERS, newUser);
            showToast(`User ${newUser.username} ${user ? 'updated' : 'created'} successfully`, 'success');
            onSave();
        } catch (err) {
            showToast('Error saving user', 'error');
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-8">
                <h3 className="text-xl font-bold dark:text-white mb-6">{user ? 'Edit Council Account' : 'New Council Account'}</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="fullName" className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Full Name</label>
                        <input id="fullName" required type="text" placeholder="First Last" className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm dark:text-white" value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} />
                    </div>
                    <div>
                        <label htmlFor="username" className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Username</label>
                        <input id="username" required type="text" placeholder="username" className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm dark:text-white" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} />
                    </div>
                    {!user && (
                        <div>
                            <label htmlFor="password" className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Initial Password</label>
                            <input id="password" required type="password" placeholder="Min. 8 characters" className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm dark:text-white" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} />
                        </div>
                    )}
                    <div>
                        <label htmlFor="role" className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Access Level</label>
                        <select id="role" title="Select Role" className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm dark:text-white" value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}>
                            <option value={UserRole.ADMIN}>Administrator</option>
                            <option value={UserRole.STOCK_TAKER}>Stock Taker</option>
                            <option value={UserRole.ASSET_ADDER}>Asset Adder</option>
                            <option value={UserRole.HEAD_ADMIN}>Head Administrator</option>
                        </select>
                    </div>
                    <div>
                        <label htmlFor="department" className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Department Assignment</label>
                        <select 
                            id="department"
                            title="Select Department"
                            className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm dark:text-white" 
                            value={formData.departmentId || ''} 
                            onChange={(e) => {
                                const dept = departments.find(d => d.id === e.target.value);
                                setFormData({ 
                                    ...formData, 
                                    departmentId: e.target.value,
                                    departmentName: dept ? dept.name : ''
                                });
                            }}
                        >
                            <option value="">All Departments (Internal Access)</option>
                            {departments.map(d => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex gap-3 pt-6">
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 font-bold text-slate-500 hover:bg-slate-50 transition-colors">Cancel</button>
                        <button type="submit" className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-lg active:scale-95">Save Account</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default UserManagement;
