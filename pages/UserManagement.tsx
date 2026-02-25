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

    useEffect(() => {
        loadUsers();
    }, []);

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
                                    <th className="px-6 py-4">Role</th>
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
                                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-tight ${u.role.toLowerCase() === 'admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                                                u.role.toLowerCase() === 'head administrator' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                                    'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                                }`}>
                                                {u.role.replace('_', ' ')}
                                            </span>
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
                                                    onClick={() => { setEditingUser(u); setIsModalOpen(true); }}
                                                    className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={() => setDeleteConfirm({ isOpen: true, id: u.id, name: u.username })}
                                                    className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                                    </svg>
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

const UserModal: React.FC<{ user: User | null; onClose: () => void; onSave: () => void }> = ({ user, onClose, onSave }) => {
    const [formData, setFormData] = useState<Partial<User>>(
        user || { username: '', fullName: '', role: UserRole.STOCK_TAKER, password: '' }
    );
    const { showToast } = useToast();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const id = user?.id || crypto.randomUUID();
            const newUser = { ...formData, id } as User;
            await storage.put(STORES.USERS, newUser); // Assuming put for users
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
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Full Name</label>
                        <input required type="text" className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm dark:text-white" value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Username</label>
                        <input required type="text" className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm dark:text-white" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} />
                    </div>
                    {!user && (
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Initial Password</label>
                            <input required type="password" placeholder="Min. 8 characters" className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm dark:text-white" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} />
                        </div>
                    )}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Access Level</label>
                        <select className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm dark:text-white" value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}>
                            <option value={UserRole.ADMIN}>Administrator</option>
                            <option value={UserRole.STOCK_TAKER}>Stock Taker</option>
                            <option value={UserRole.ASSET_ADDER}>Asset Adder</option>
                            <option value={UserRole.HEAD_ADMIN}>Head Administrator</option>
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
