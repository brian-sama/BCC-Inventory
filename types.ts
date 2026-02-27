
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

export interface Department {
  id: string;
  name: string;
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
  departmentId?: string;
  brand?: string;
  purchaseDate?: string;
  disposalDate?: string;
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

export interface KpiMetric {
  key: 'total_inventory' | 'low_stock' | 'out_of_stock' | 'assets_assigned' | 'operational';
  label: string;
  value: number;
  description: string;
  tone: 'blue' | 'amber' | 'red' | 'indigo' | 'green';
}

export interface DashboardFilterState {
  startDate: string;
  endDate: string;
  department: string;
}

export type DashboardAlertSeverity = 'critical' | 'warning' | 'info';

export interface DashboardAlert {
  id: string;
  severity: DashboardAlertSeverity;
  title: string;
  description: string;
  source: string;
  actionLabel: string;
  actionHref: string;
}

export type TrackingMode = 'qr' | 'barcode' | 'rfid';

export interface TrackingResult {
  success: boolean;
  mode: TrackingMode;
  code?: string;
  message: string;
  timestamp: string;
}

export type RfidConnectionState = 'connected' | 'disconnected' | 'unavailable';

export interface RfidStatus {
  state: RfidConnectionState;
  message: string;
  lastChecked: string;
}
