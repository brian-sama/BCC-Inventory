
export enum UserRole {
  ADMIN = 'Admin',
  STOCK_TAKER = 'Stock Taker',
  ASSET_ADDER = 'Asset Adder',
  HEAD_ADMIN = 'Head Administrator'
}

export interface User {
  id: string;
  username: string;
  fullName: string;
  password?: string;
  role: UserRole | string;
  lastLogin?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  price: number;
  serialNumber: string;
  description: string;
  lowStockThreshold: number;
  createdAt: string;
}

export interface Asset {
  id: string;
  employeeName: string;
  type: string; // Laptop, Desktop, Printer, etc.
  srNumber: string;
  extNumber: string;
  officeNumber: string;
  position: string;
  department: string;
  section: string;
  warrantyExpiry: string;
  status: 'Active' | 'Under Repair' | 'Disposed';
  serialNumber: string;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  userId: string;
  username: string;
  action: string;
  details: string;
}

export interface SystemStats {
  totalInventoryValue: number;
  totalItems: number;
  totalAssets: number;
  lowStockCount: number;
}
