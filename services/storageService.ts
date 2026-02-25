import { InventoryItem, Asset, User, UserRole, ActivityLog, SystemStats } from '../types';

const API_BASE = '/api';

class StorageService {
  private async fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `API error: ${response.status}`);
    }

    return response.json();
  }

  async init(): Promise<void> {
    try {
      await fetch(`${API_BASE}/health`, { credentials: 'include' });
      console.log('API Server is healthy');
    } catch (err) {
      console.warn('API Server unreachable. Ensure Node.js server is running on port 3001.');
    }
  }

  private mapUser(user: any): User {
    const isSystemAdmin = (user?.username || '').toLowerCase() === 'admin';
    return {
      id: user.id,
      username: user.username,
      fullName: user.full_name || user.fullName || user.name || user.username,
      role: isSystemAdmin ? UserRole.HEAD_ADMIN : this.normalizeRole(user.role),
      lastLogin: user.lastLogin,
    };
  }

  // Authentication
  async login(username: string, password: string): Promise<{ success: boolean; user: User }> {
    const response = await this.fetchApi<{ success: boolean; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });

    return {
      success: response.success,
      user: this.mapUser(response.user),
    };
  }

  async getCurrentUser(): Promise<User | null> {
    try {
      const response = await fetch(`${API_BASE}/auth/me`, {
        credentials: 'include',
      });

      if (response.status === 401) {
        return null;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      const data = await response.json();
      if (!data?.success || !data?.user) return null;
      return this.mapUser(data.user);
    } catch (err) {
      console.warn('Failed to resolve current session:', err);
      return null;
    }
  }

  async logout(): Promise<void> {
    try {
      await this.fetchApi('/auth/logout', {
        method: 'POST',
      });
    } catch (err) {
      console.warn('Logout request failed:', err);
    }
  }

  // Inventory
  async getInventory(): Promise<InventoryItem[]> {
    try {
      const data = await this.fetchApi<{ success: boolean; items: any[] }>('/inventory');
      if (!data || !data.items) return [];

      return data.items.map(item => ({
        id: (item.id || item.ID || '').toString(),
        name: item.item_name || item.name || 'Unknown Item',
        category: item.category || 'Uncategorized',
        quantity: parseInt(item.quantity, 10) || 0,
        price: parseFloat(item.unit_cost || item.price) || 0,
        serialNumber: item.item_code || item.serial || '',
        description: item.description || '',
        lowStockThreshold: 10,
        createdAt: item.created_at || new Date().toISOString(),
      }));
    } catch (err) {
      console.error('getInventory failed:', err);
      return [];
    }
  }

  async addInventoryItem(item: Partial<InventoryItem>): Promise<void> {
    await this.fetchApi('/inventory', {
      method: 'POST',
      body: JSON.stringify({
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        price: item.price,
        serial: item.serialNumber,
        category: item.category,
      }),
    });
  }

  // Assets
  async getAssets(): Promise<Asset[]> {
    try {
      const data = await this.fetchApi<{ success: boolean; assets: any[] }>('/assets');
      if (!data || !data.assets) return [];

      return data.assets.map(asset => ({
        id: (asset.id || asset.ID || '').toString(),
        employeeName: asset.employee_name || asset.name || 'Unknown Employee',
        type: asset.asset_name || asset.asset_type || asset.type || 'Other',
        srNumber: asset.sr_number || asset.asset_code || asset.serial || '',
        serialNumber: asset.serial_number || '',
        extNumber: asset.ext_number || '',
        officeNumber: asset.office_number || '',
        position: asset.position || '',
        department: asset.department || '',
        section: asset.section || '',
        warrantyExpiry: asset.warranty_expiry || new Date().toISOString(),
        status: this.mapStatus(asset.condition_status),
        createdAt: asset.created_at || new Date().toISOString(),
      }));
    } catch (err) {
      console.error('getAssets failed:', err);
      return [];
    }
  }

  private mapStatus(status: string): 'Active' | 'Under Repair' | 'Disposed' {
    const s = (status || '').toLowerCase();
    if (s === 'good' || s === 'active' || s === 'working') return 'Active';
    if (s === 'repair' || s === 'under repair' || s === 'maintenance') return 'Under Repair';
    return 'Disposed';
  }

  async addAsset(asset: Partial<Asset>): Promise<void> {
    await this.fetchApi('/assets', {
      method: 'POST',
      body: JSON.stringify({
        employeeName: asset.employeeName,
        srNumber: asset.srNumber,
        serialNumber: asset.serialNumber,
        type: asset.type,
        department: asset.department,
        status: (asset.status || 'Active').toLowerCase(),
        position: asset.position,
        extNumber: asset.extNumber,
        officeNumber: asset.officeNumber,
        section: asset.section,
        warrantyExpiry: asset.warrantyExpiry,
        notes: '',
      }),
    });
  }

  async bulkAddAssets(assets: Partial<Asset>[]): Promise<void> {
    await this.fetchApi('/assets/bulk', {
      method: 'POST',
      body: JSON.stringify(assets),
    });
  }

  // General Actions
  async delete(storeName: string, id: string): Promise<void> {
    await this.fetchApi(`/${storeName}/${id}`, {
      method: 'DELETE',
    });
  }

  // Dashboard Stats
  async getDashboardStats(): Promise<SystemStats> {
    try {
      const data = await this.fetchApi<{ success: boolean; stats: any }>('/stats/dashboard');
      return {
        totalInventoryValue: data.stats?.inventory?.totalValue || 0,
        totalItems: data.stats?.inventory?.totalItems || 0,
        totalAssets: data.stats?.assets?.totalAssets || 0,
        lowStockCount: data.stats?.inventory?.lowStockItems || 0,
      };
    } catch (err) {
      console.error('getDashboardStats failed:', err);
      return { totalInventoryValue: 0, totalItems: 0, totalAssets: 0, lowStockCount: 0 };
    }
  }

  // Activity Logs
  async getActivityLogs(): Promise<ActivityLog[]> {
    try {
      const data = await this.fetchApi<{ success: boolean; logs: any[] }>('/activity-logs');
      if (!data || !data.logs) return [];
      return data.logs.map(log => ({
        id: log.id.toString(),
        timestamp: log.timestamp || log.created_at || new Date().toISOString(),
        userId: log.user_id?.toString() || '',
        username: log.user_name || 'System',
        action: log.action || 'ACTIVITY',
        details: log.description || log.details || '',
      }));
    } catch (err) {
      console.error('getActivityLogs failed:', err);
      return [];
    }
  }

  // Generic methods map to existing API
  async getAll<T>(storeName: string): Promise<T[]> {
    if (storeName === 'inventory') return await this.getInventory() as T[];
    if (storeName === 'assets') return await this.getAssets() as T[];
    if (storeName === 'logs') return await this.getActivityLogs() as T[];
    return [];
  }

  private normalizeRole(role: string): UserRole | string {
    const r = (role || '').toLowerCase();
    if (r === 'head administrator' || r === 'head_admin' || r === 'super_admin' || r === 'super admin' || r === 'system administrator') return UserRole.HEAD_ADMIN;
    if (r === 'admin') return UserRole.ADMIN;
    if (r === 'stock taker' || r === 'stock_taker' || r === 'stock') return UserRole.STOCK_TAKER;
    if (r === 'asset adder' || r === 'asset_adder' || r === 'asset') return UserRole.ASSET_ADDER;
    return UserRole.STOCK_TAKER;
  }

  async logActivity(userId: string, username: string, action: string, details: string): Promise<void> {
    try {
      await this.fetchApi('/activity-logs', {
        method: 'POST',
        body: JSON.stringify({ userId, username, action, details, timestamp: new Date().toISOString() }),
      });
    } catch (err) {
      console.warn('Logging failed:', err);
    }
  }

  // Support for generic save/put used in new UI
  async save(storeName: string, data: any): Promise<void> {
    const endpoint = storeName === STORES.INVENTORY ? '/inventory' : (storeName === STORES.ASSETS ? '/assets' : `/${storeName}`);
    await this.fetchApi(endpoint, {
      method: data.id ? 'PUT' : 'POST',
      body: JSON.stringify(data),
    });
  }

  async put(storeName: string, data: any): Promise<void> {
    await this.save(storeName, data);
  }
}

export const STORES = {
  INVENTORY: 'inventory',
  ASSETS: 'assets',
  USERS: 'users',
  LOGS: 'logs',
  ACTIVITY_LOGS: 'logs',
  SETTINGS: 'settings'
};

export const storage = new StorageService();
