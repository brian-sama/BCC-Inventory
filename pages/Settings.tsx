import React from 'react';
import { User } from '../types';
import PageHeader from '../components/ui/PageHeader';

interface SettingsProps {
    user: User;
}

const Settings: React.FC<SettingsProps> = ({ user }) => (
    <div className="app-page">
        <PageHeader
            title="System Settings"
            subtitle="Manage organizational configurations and security parameters."
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
                <div className="surface-card">
                    <h3 className="text-lg font-semibold text-civic-text dark:text-white mb-6 flex items-center gap-2">
                        <span className="h-6 w-1 rounded-full bg-civic-primary"></span>
                        Profile Settings
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label htmlFor="settings-username" className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">Username</label>
                            <input id="settings-username" type="text" disabled value={user.username} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm text-slate-500 cursor-not-allowed" />
                        </div>
                        <div>
                            <label htmlFor="settings-role" className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">User Role</label>
                            <input id="settings-role" type="text" disabled value={user.role} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm text-slate-500 capitalize cursor-not-allowed" />
                        </div>
                    </div>
                </div>

                <div className="surface-card">
                    <h3 className="text-lg font-semibold text-civic-text dark:text-white mb-6 flex items-center gap-2">
                        <span className="h-6 w-1 rounded-full bg-civic-primary"></span>
                        Cloud Configuration
                    </h3>
                    <div className="space-y-6">
                        <div>
                            <label htmlFor="settings-org" className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">Organization Name</label>
                            <input id="settings-org" type="text" disabled value="Bulawayo City Council" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm text-slate-500 cursor-not-allowed" />
                        </div>
                        <div>
                            <label htmlFor="settings-timeout" className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">Session Timeout</label>
                            <input
                                id="settings-timeout"
                                type="text"
                                disabled
                                readOnly
                                value="24 hours (managed by IT)"
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm text-slate-500 cursor-not-allowed italic"
                            />
                        </div>
                        <div className="pt-6 border-t border-slate-200 dark:border-slate-800">
                            <p className="text-xs text-slate-400 italic flex items-center gap-2">
                                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                                Enterprise settings are managed by BCC central IT. Contact your system administrator for changes.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                <div className="surface-card">
                    <h4 className="text-sm font-semibold text-civic-text dark:text-white mb-4">System Information</h4>
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
                            <span className="text-slate-500">Session TTL</span>
                            <span className="dark:text-slate-300">24 hours</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
);

export default Settings;
