-- Create database if it doesn't exist
CREATE DATABASE IF NOT EXISTS inventory_system;
USE inventory_system;

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role ENUM('admin', 'stock_taker', 'asset_adder') NOT NULL,
    initials VARCHAR(5) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_username (username),
    INDEX idx_role (role)
);

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_name (name)
);

-- Create inventory table
CREATE TABLE IF NOT EXISTS inventory (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_code VARCHAR(50) UNIQUE NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    category_id INT,
    quantity INT NOT NULL DEFAULT 0,
    unit VARCHAR(50) NOT NULL,
    unit_cost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total_cost DECIMAL(10,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
    reorder_level INT DEFAULT 0,
    supplier VARCHAR(255),
    location VARCHAR(255),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    INDEX idx_item_code (item_code),
    INDEX idx_item_name (item_name),
    INDEX idx_category (category_id),
    INDEX idx_quantity (quantity),
    INDEX idx_reorder_level (reorder_level)
);

-- Create assets table
CREATE TABLE IF NOT EXISTS assets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    asset_code VARCHAR(50) UNIQUE NOT NULL,
    asset_name VARCHAR(255) NOT NULL,
    category_id INT,
    employee_name VARCHAR(255) NOT NULL,
    employee_id VARCHAR(50),
    department VARCHAR(100),
    location VARCHAR(255),
    condition_status ENUM('excellent', 'good', 'fair', 'poor', 'damaged') DEFAULT 'good',
    purchase_date DATE,
    purchase_cost DECIMAL(10,2),
    current_value DECIMAL(10,2),
    serial_number VARCHAR(100),
    model VARCHAR(100),
    manufacturer VARCHAR(100),
    warranty_expiry DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    INDEX idx_asset_code (asset_code),
    INDEX idx_asset_name (asset_name),
    INDEX idx_employee_name (employee_name),
    INDEX idx_department (department),
    INDEX idx_location (location),
    INDEX idx_condition (condition_status)
);

-- Create activity_log table
CREATE TABLE IF NOT EXISTS activity_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(50) NOT NULL,
    record_id INT,
    old_values JSON,
    new_values JSON,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user (user_id),
    INDEX idx_action (action),
    INDEX idx_table (table_name),
    INDEX idx_timestamp (timestamp)
);

-- Create system_settings table
CREATE TABLE IF NOT EXISTS system_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    setting_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_setting_key (setting_key)
);

-- Create reports table
CREATE TABLE IF NOT EXISTS reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    report_name VARCHAR(255) NOT NULL,
    report_type ENUM('inventory', 'assets', 'activity', 'custom') NOT NULL,
    parameters JSON,
    generated_by INT,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    file_path VARCHAR(500),
    FOREIGN KEY (generated_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_report_type (report_type),
    INDEX idx_generated_by (generated_by),
    INDEX idx_generated_at (generated_at)
);

-- Create backups table
CREATE TABLE IF NOT EXISTS backups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    backup_name VARCHAR(255) NOT NULL,
    backup_type ENUM('full', 'incremental') DEFAULT 'full',
    file_path VARCHAR(500) NOT NULL,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('pending', 'completed', 'failed') DEFAULT 'pending',
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_backup_type (backup_type),
    INDEX idx_created_by (created_by),
    INDEX idx_status (status)
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type ENUM('info', 'warning', 'error', 'success') DEFAULT 'info',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id),
    INDEX idx_type (type),
    INDEX idx_is_read (is_read),
    INDEX idx_created_at (created_at)
);

-- Create user_sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id),
    INDEX idx_session_token (session_token),
    INDEX idx_is_active (is_active),
    INDEX idx_last_activity (last_activity)
);

-- Insert default categories
INSERT IGNORE INTO categories (name, description) VALUES
('Electronics', 'Electronic devices and components'),
('Furniture', 'Office and general furniture'),
('Software', 'Software licenses and digital assets'),
('Equipment', 'Laboratory and technical equipment'),
('Supplies', 'Office and general supplies'),
('Vehicles', 'Company vehicles and transportation'),
('Real Estate', 'Property and facilities'),
('Other', 'Miscellaneous items');

-- Insert default admin user (password: admin123)
INSERT IGNORE INTO users (username, password, name, role, initials) VALUES
('admin', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'System Administrator', 'admin', 'SA');

-- Insert default system settings
INSERT IGNORE INTO system_settings (setting_key, setting_value, setting_type, description) VALUES
('company_name', 'Inventory Management System', 'string', 'Name of the company/organization'),
('company_address', '', 'string', 'Company address'),
('company_phone', '', 'string', 'Company phone number'),
('company_email', '', 'string', 'Company email address'),
('low_stock_threshold', '10', 'number', 'Default low stock alert threshold'),
('currency', 'USD', 'string', 'Default currency for the system'),
('timezone', 'UTC', 'string', 'System timezone'),
('maintenance_mode', 'false', 'boolean', 'Enable maintenance mode'),
('session_timeout', '3600', 'number', 'Session timeout in seconds'),
('max_login_attempts', '5', 'number', 'Maximum login attempts before lockout'),
('password_min_length', '8', 'number', 'Minimum password length'),
('enable_audit_log', 'true', 'boolean', 'Enable audit logging'),
('backup_frequency', 'daily', 'string', 'Automatic backup frequency'),
('report_retention_days', '365', 'number', 'Report retention period in days'),
('notification_email', '', 'string', 'Email for system notifications');