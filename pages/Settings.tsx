
import React from 'react';
import { User } from '../types';

interface SettingsProps {
    user: User;
}

const Settings: React.FC<SettingsProps> = ({ user }) => (
    <div className="space-y-6">
        <div className="border-b border-slate-200 dark:border-slate-800 pb-4 mb-6">
            <h2 className="text-2xl font-bold dark:text-white">System Settings</h2>
            <p className="text-slate-500 dark:text-slate-400">Manage organizational configurations and security parameters.</p>
            <div className="text-[10px] text-blue-500 font-mono mt-1">Component: Settings | Route: /settings</div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
                <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <h3 className="text-lg font-bold dark:text-white mb-6 flex items-center gap-2">
                        <span className="w-1 h-6 bg-blue-600 rounded-full"></span>
                        Profile Settings
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label htmlFor="username" className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">Username</label>
                            <input id="username" type="text" disabled value={user.username} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm text-slate-500 cursor-not-allowed" />
                        </div>
                        <div>
                            <label htmlFor="role" className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">User Role</label>
                            <input id="role" type="text" disabled value={user.role} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm text-slate-500 capitalize cursor-not-allowed" />
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <h3 className="text-lg font-bold dark:text-white mb-6 flex items-center gap-2">
                        <span className="w-1 h-6 bg-blue-600 rounded-full"></span>
                        Cloud Configuration
                    </h3>
                    <div className="space-y-6">
                        <div>
                            <label htmlFor="orgName" className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">Organization Name</label>
                            <input id="orgName" type="text" disabled value="Bulawayo City Council" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm text-slate-500 cursor-not-allowed" />
                        </div>
                        <div>
                            <label htmlFor="timeout" className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">Session Timeout (Minutes)</label>
                            <input id="timeout" type="number" defaultValue={60} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white" />
                        </div>
                        <div className="pt-6 border-t border-slate-200 dark:border-slate-800">
                            <button className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 transition-all opacity-50 cursor-not-allowed active:scale-[0.98]">
                                Save System Configurations
                            </button>
                            <p className="text-[10px] text-slate-400 mt-3 italic flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                Enterprise settings are currently managed by BCC central IT. Contact sys-admin for changes.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <h4 className="text-sm font-bold dark:text-white mb-4">System Information</h4>
                    <div className="space-y-3">
                        <div className="flex justify-between text-xs">
                            <span className="text-slate-500">Version</span>
                            <span className="font-mono dark:text-slate-300">2.1.0-cloud</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-slate-500">Node Environment</span>
                            <span className="text-green-500 font-bold uppercase tracking-tighter">Production-Ready</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-slate-500">Last Synced</span>
                            <span className="dark:text-slate-300">{new Date().toLocaleString()}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
);

export default Settings;
