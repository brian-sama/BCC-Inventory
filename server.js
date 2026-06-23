const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const http = require('http');
const db = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const SESSION_COOKIE_NAME = 'sims_session_id';
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS || 24 * 60 * 60 * 1000);
const DEFAULT_ALLOWED_ORIGINS = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'https://bccinventory.netlify.app',
    'https://bccinventory.netlify.app/',
    'https://bccsims.netlify.app',
    'https://bccsims.netlify.app/'
];
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || process.env.FRONTEND_ORIGIN || DEFAULT_ALLOWED_ORIGINS.join(','))
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
const memorySessions = new Map();
let useMemorySessions = false;
let assetsColumnsCache = null;
let io = null;

function emitEvent(event, data) {
    if (io) io.emit(event, data);
}

app.set('trust proxy', 1);

function parseCookies(req) {
    const header = req.headers.cookie;
    if (!header) return {};

    return header.split(';').reduce((cookies, pair) => {
        const [rawKey, ...rest] = pair.split('=');
        const key = rawKey ? rawKey.trim() : '';
        if (!key) return cookies;
        cookies[key] = decodeURIComponent(rest.join('=').trim());
        return cookies;
    }, {});
}

function getSessionCookieOptions() {
    const isProduction = process.env.NODE_ENV === 'production';
    return {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'strict' : 'lax',
        maxAge: SESSION_TTL_MS,
        path: '/'
    };
}

function getSessionIdFromRequest(req) {
    const cookies = parseCookies(req);
    return cookies[SESSION_COOKIE_NAME] || null;
}

function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded && typeof forwarded === 'string') {
        return forwarded.split(',')[0].trim();
    }
    return req.ip || req.socket?.remoteAddress || null;
}

function normalizeUserIdentity(user) {
    const username = `${user?.username || ''}`.toLowerCase();
    if (username === 'admin') {
        return {
            id: user.id,
            username: user.username,
            name: 'System Administrator',
            role: 'Head Administrator',
            initials: user.initials || 'SA'
        };
    }

    return {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        initials: user.initials
    };
}

function isSessionTableMissingError(error) {
    if (!error) return false;
    const errorText = `${error.message || ''} ${error.details || ''}`.toLowerCase();
    return error.code === '42P01' || errorText.includes('user_sessions');
}

function isRelationMissingError(error, relationName) {
    if (!error) return false;
    const errorText = `${error.message || ''} ${error.details || ''}`.toLowerCase();
    return error.code === '42P01' || errorText.includes(relationName.toLowerCase());
}

function getSessionExpiryCutoffIso() {
    return new Date(Date.now() - SESSION_TTL_MS).toISOString();
}

async function createSession(userId, req) {
    const sessionId = crypto.randomBytes(48).toString('hex');
    const nowIso = new Date().toISOString();
    const clientIp = getClientIp(req);
    const userAgent = req.headers['user-agent'] || '';

    if (useMemorySessions) {
        memorySessions.set(sessionId, {
            user_id: userId,
            last_activity: nowIso,
            is_active: true
        });
        return sessionId;
    }

    try {
        await db.query(
            'INSERT INTO user_sessions (user_id, session_token, ip_address, user_agent, is_active, last_activity) VALUES ($1, $2, $3, $4, $5, $6)',
            [userId, sessionId, clientIp, userAgent, true, nowIso]
        );
        return sessionId;
    } catch (error) {
        console.error('Session creation failed:', error.message);
        useMemorySessions = true;
        memorySessions.set(sessionId, {
            user_id: userId,
            last_activity: nowIso,
            is_active: true
        });
        return sessionId;
    }
}

async function getActiveSession(sessionId) {
    if (!sessionId) return null;

    if (useMemorySessions) {
        const session = memorySessions.get(sessionId);
        if (!session || !session.is_active) return null;
        return session;
    }

    try {
        const result = await db.query(
            'SELECT session_token, user_id, last_activity, is_active FROM user_sessions WHERE session_token = $1 AND is_active = true',
            [sessionId]
        );
        return result.rows[0] || null;
    } catch (error) {
        console.error('Fetch session failed:', error.message);
        useMemorySessions = true;
        return memorySessions.get(sessionId) || null;
    }
}

function isSessionExpired(session) {
    if (!session?.last_activity) return true;
    return new Date(session.last_activity).getTime() < Date.now() - SESSION_TTL_MS;
}

async function touchSession(sessionId) {
    const nowIso = new Date().toISOString();
    if (useMemorySessions) {
        const session = memorySessions.get(sessionId);
        if (session) {
            session.last_activity = nowIso;
            memorySessions.set(sessionId, session);
        }
        return;
    }

    await db.query('UPDATE user_sessions SET last_activity = $1 WHERE session_token = $2', [nowIso, sessionId]);
}

async function deactivateSession(sessionId) {
    if (!sessionId) return;

    if (useMemorySessions) {
        memorySessions.delete(sessionId);
        return;
    }

    await db.query('UPDATE user_sessions SET is_active = false WHERE session_token = $1', [sessionId]);
}


// Audit Log Helper — writes to audit_logs with SHA-256 hash chain for tamper detection
async function logAction(userId, username, action, details) {
    try {
        const timestamp = new Date().toISOString();
        const payload = { userId, username, action, details, timestamp };

        // Fetch previous hash to form the chain (genesis hash is 64 zeros)
        let prevHash = '0'.repeat(64);
        try {
            const lastRow = await db.query(
                'SELECT hash FROM audit_logs WHERE hash IS NOT NULL ORDER BY id DESC LIMIT 1'
            );
            if (lastRow.rows.length > 0 && lastRow.rows[0].hash) prevHash = lastRow.rows[0].hash;
        } catch (_) { /* hash column may not exist yet — chain starts fresh */ }

        const currentHash = crypto.createHash('sha256')
            .update(prevHash + JSON.stringify(payload))
            .digest('hex');

        try {
            await db.query(
                'INSERT INTO audit_logs (user_id, user_name, action, details, hash) VALUES ($1, $2, $3, $4, $5)',
                [userId, username, action, details, currentHash]
            );
        } catch (insertErr) {
            // Gracefully degrade if hash column doesn't exist in DB yet
            if (insertErr.code === '42703') {
                await db.query(
                    'INSERT INTO audit_logs (user_id, user_name, action, details) VALUES ($1, $2, $3, $4)',
                    [userId, username, action, details]
                );
            } else {
                throw insertErr;
            }
        }
        console.log(`Audit Log: ${username} - ${action}`);
    } catch (err) {
        console.error('Failed to log action:', err.message);
    }
}

async function recordActivity(userId, username, action, details, timestamp = new Date().toISOString()) {
    try {
        await db.query(
            'INSERT INTO activity_log (user_id, action, description, timestamp) VALUES ($1, $2, $3, $4)',
            [userId || null, action, details || '', timestamp]
        );
    } catch (error) {
        if (!isRelationMissingError(error, 'activity_log')) {
            throw error;
        }

        await logAction(userId, username || 'System', action, details || '');
    }
}

async function fetchActivityLogs(limit = 50) {
    try {
        const result = await db.query(`
            SELECT a.*, u.name as user_name, u.role as user_role
            FROM activity_log a
            LEFT JOIN users u ON a.user_id = u.id
            ORDER BY a.timestamp DESC
            LIMIT $1
        `, [limit]);
        return result.rows;
    } catch (error) {
        if (!isRelationMissingError(error, 'activity_log')) {
            throw error;
        }

        const result = await db.query(`
            SELECT al.id, al.user_id, al.action, al.details as description, al.timestamp,
                   COALESCE(u.name, al.user_name, u.username, 'System') as user_name,
                   u.role as user_role
            FROM audit_logs al
            LEFT JOIN users u ON al.user_id = u.id
            ORDER BY al.timestamp DESC
            LIMIT $1
        `, [limit]);
        return result.rows;
    }
}

async function deactivateExpiredSessions() {
    if (useMemorySessions) {
        for (const [sessionId, session] of memorySessions.entries()) {
            if (isSessionExpired(session)) {
                memorySessions.delete(sessionId);
            }
        }
        return;
    }

    await db.query(
        'UPDATE user_sessions SET is_active = false WHERE is_active = true AND last_activity < $1',
        [getSessionExpiryCutoffIso()]
    );
}

async function authenticateSession(req, res, next) {
    try {
        const sessionId = getSessionIdFromRequest(req);
        if (!sessionId) {
            return res.status(401).json({ success: false, error: 'Not authenticated' });
        }

        const session = await getActiveSession(sessionId);
        if (!session) {
            res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
            return res.status(401).json({ success: false, error: 'Session is invalid or expired' });
        }

        if (isSessionExpired(session)) {
            await deactivateSession(sessionId);
            res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
            return res.status(401).json({ success: false, error: 'Session expired. Please sign in again.' });
        }

        const result = await db.query(
            'SELECT id, username, name, role, initials, is_active FROM users WHERE id = $1',
            [session.user_id]
        );
        const user = result.rows[0];

        if (!user || !user.is_active) {
            await deactivateSession(sessionId);
            res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
            return res.status(401).json({ success: false, error: 'User account is inactive' });
        }

        const normalizedUser = normalizeUserIdentity(user);
        req.user = {
            userId: normalizedUser.id,
            username: normalizedUser.username,
            name: normalizedUser.name,
            role: normalizedUser.role,
            initials: normalizedUser.initials
        };
        req.sessionId = sessionId;
        await touchSession(sessionId);

        next();
    } catch (error) {
        next(error);
    }
}

// Role-based access control middleware factory
function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) return res.status(401).json({ success: false, error: 'Not authenticated' });
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: `Access denied. Required: ${allowedRoles.join(' or ')}`
            });
        }
        next();
    };
}

// Middleware
app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
        return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

// Initialize Supabase check
async function initializeApp() {
    try {
        console.log('🔧 Checking Neon Database connection...');
        const result = await db.query('SELECT 1 as connected');
        if (result.rows.length === 0) throw new Error('Database ping failed');
        await getAssetsColumns();
        console.log('✅ Neon Database connected successfully');
    } catch (error) {
        console.error('❌ Neon Database connection failed:', error.message);
        console.log('💡 Please check your .env file and Neon project status.');
        process.exit(1);
    }
}

async function getAssetsColumns() {
    if (assetsColumnsCache instanceof Set) {
        return assetsColumnsCache;
    }

    try {
        const result = await db.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = 'assets'
        `);
        assetsColumnsCache = new Set((result.rows || []).map(row => row.column_name));
    } catch (error) {
        console.warn('Could not inspect assets columns. Falling back to default column compatibility set.', error.message);
        assetsColumnsCache = new Set([
            'asset_name',
            'employee_name',
            'asset_code',
            'sr_number',
            'serial_number',
            'department',
            'department_id',
            'location',
            'condition_status',
            'model',
            'warranty_expiry',
            'notes',
            'ext_number',
            'office_number',
            'position',
            'section',
            'brand',
            'purchase_date',
            'disposal_date',
            'section_id',
            'status'
        ]);
    }

    return assetsColumnsCache;
}

// ===== ROUTES =====

// Serve index.html for the root or let Vite handle it in dev
// Serve index.html for any non-API route to support SPA routing
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(__dirname, 'dist', 'index.html'), err => {
        if (err) {
            // In dev mode, Vite serves the content
            res.json({ message: "BCC SIMS API Server is running. Frontend is served by Vite on port 3000." });
        }
    });
});


// ===== API ROUTES =====

app.get('/api/debug/db-status', async (req, res) => {
    try {
        const userCount = (await db.query('SELECT count(*) FROM users')).rows[0].count;
        const inventoryCount = (await db.query('SELECT count(*) FROM inventory')).rows[0].count;
        const assetCount = (await db.query('SELECT count(*) FROM assets')).rows[0].count;

        res.json({
            status: 'Server is running',
            timestamp: new Date().toISOString(),
            database: {
                usersCount: parseInt(userCount),
                inventoryCount: parseInt(inventoryCount),
                assetsCount: parseInt(assetCount),
                connectionStatus: 'Connected (Neon Postgres)'
            }
        });
    } catch (error) {
        res.status(500).json({ status: 'Server error', error: error.message });
    }
});

app.get('/api/health', async (req, res) => {
    try {
        await db.query('SELECT 1');
        res.json({ status: 'healthy', database: 'connected (Neon Postgres)', timestamp: new Date().toISOString() });
    } catch (error) {
        res.status(500).json({ status: 'unhealthy', error: error.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await db.query('SELECT * FROM users WHERE username = $1 AND is_active = true', [username]);
        const users = result.rows;

        if (users && users.length > 0) {
            const user = users[0];
            const isValidPassword = await bcrypt.compare(password, user.password);
            if (isValidPassword) {
                const sessionId = await createSession(user.id, req);
                await db.query('UPDATE users SET last_login = $1 WHERE id = $2', [new Date().toISOString(), user.id]);
                res.cookie(SESSION_COOKIE_NAME, sessionId, getSessionCookieOptions());
                const normalizedUser = normalizeUserIdentity(user);
                res.json({
                    success: true,
                    user: normalizedUser
                });
            } else res.status(401).json({ success: false, error: 'Invalid username or password' });
        } else res.status(401).json({ success: false, error: 'Invalid username or password' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/auth/logout', authenticateSession, async (req, res) => {
    try {
        await deactivateSession(req.sessionId);
        res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
        res.json({ success: true, message: 'Signed out successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/auth/me', authenticateSession, async (req, res) => {
    try {
        res.json({
            success: true,
            user: {
                id: req.user.userId,
                username: req.user.username,
                name: req.user.name,
                role: req.user.role,
                initials: req.user.initials
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/inventory', authenticateSession, async (req, res) => {
    const { search, category, page = 1, limit = 25, sort = 'created_at', order = 'DESC' } = req.query;
    try {
        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(200, Math.max(1, parseInt(limit) || 25));
        const offset = (pageNum - 1) * limitNum;
        const ALLOWED_SORT = new Set(['item_name', 'quantity', 'unit_cost', 'created_at', 'category_id']);
        const sortCol = ALLOWED_SORT.has(sort) ? sort : 'created_at';
        const sortDir = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        let baseWhere = 'WHERE status = $1';
        let queryParams = ['active'];

        if (search) {
            queryParams.push(`%${search}%`);
            baseWhere += ` AND (item_name ILIKE $${queryParams.length} OR description ILIKE $${queryParams.length})`;
        }
        if (category) {
            queryParams.push(category);
            baseWhere += ` AND category_id = $${queryParams.length}`;
        }

        const countResult = await db.query(`SELECT COUNT(*) FROM inventory ${baseWhere}`, queryParams);
        const total = parseInt(countResult.rows[0].count);

        const dataParams = [...queryParams, limitNum, offset];
        const itemsResult = await db.query(
            `SELECT * FROM inventory ${baseWhere} ORDER BY ${sortCol} ${sortDir} LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
            dataParams
        );

        res.json({ success: true, items: itemsResult.rows, total, page: pageNum, totalPages: Math.ceil(total / limitNum) });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/inventory', authenticateSession, requireRole('Admin', 'Head Administrator', 'Asset Adder'), async (req, res) => {
    const itemData = req.body;
    try {
        const itemCode = itemData.serialNumber || itemData.serial || `ITEM-${Date.now()}`;
        const queryText = `
            INSERT INTO inventory (item_name, description, quantity, unit_cost, unit, item_code, supplier, location, reorder_level)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id
        `;
        const result = await db.query(queryText, [
            itemData.name,
            itemData.description || '',
            itemData.quantity || 0,
            itemData.price || 0,
            itemData.unit || 'pcs',
            itemCode,
            itemData.supplier || '',
            itemData.location || 'Store',
            itemData.lowStockThreshold || 10
        ]);
        const newItemId = result.rows[0].id;

        await logAction(req.user.userId, req.user.username, 'ADD_INVENTORY', `Added inventory item: ${itemData.name || itemCode}`);
        emitEvent('inventory:added', { id: newItemId, name: itemData.name });

        res.json({ success: true, itemId: newItemId, message: 'Item added successfully!' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/assets', authenticateSession, async (req, res) => {
    const { search, department, assetStatus, page = 1, limit = 25, sort = 'created_at', order = 'DESC' } = req.query;
    try {
        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(200, Math.max(1, parseInt(limit) || 25));
        const offset = (pageNum - 1) * limitNum;
        const ALLOWED_SORT = new Set(['asset_name', 'employee_name', 'department', 'condition_status', 'created_at', 'purchase_date']);
        const sortCol = ALLOWED_SORT.has(sort) ? sort : 'created_at';
        const sortDir = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        let baseWhere = 'WHERE 1=1';
        let queryParams = [];

        if (search) {
            queryParams.push(`%${search}%`);
            baseWhere += ` AND (employee_name ILIKE $${queryParams.length} OR serial_number ILIKE $${queryParams.length})`;
        }
        if (department) {
            queryParams.push(department);
            baseWhere += ` AND department = $${queryParams.length}`;
        }
        if (assetStatus) {
            queryParams.push(assetStatus.toLowerCase());
            baseWhere += ` AND condition_status = $${queryParams.length}`;
        }

        const countResult = await db.query(`SELECT COUNT(*) FROM assets ${baseWhere}`, queryParams);
        const total = parseInt(countResult.rows[0].count);

        const dataParams = [...queryParams, limitNum, offset];
        const result = await db.query(
            `SELECT * FROM assets ${baseWhere} ORDER BY ${sortCol} ${sortDir} LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
            dataParams
        );

        const assets = result.rows.map(asset => ({
            ...asset,
            srNumber: asset.sr_number || asset.asset_code,
            serialNumber: asset.serial_number,
            assetStatus: asset.condition_status,
            addedDate: asset.created_at,
            extNumber: asset.ext_number,
            officeNumber: asset.office_number,
            position: asset.position,
            section: asset.section,
            brand: asset.brand,
            purchaseDate: asset.purchase_date,
            disposalDate: asset.disposal_date,
            departmentId: asset.department_id,
            warrantyExpiry: asset.warranty_expiry
        }));
        res.json({ success: true, assets, total, page: pageNum, totalPages: Math.ceil(total / limitNum) });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// External Integration Endpoint (for Repairs System)
app.get('/api/external/asset/:serial', async (req, res) => {
    const { serial } = req.params;
    const apiKey = req.headers['x-api-key'];

    if (apiKey !== process.env.EXTERNAL_API_KEY && apiKey !== 'BCC_REPAIRS_SYNC_2024') {
        return res.status(401).json({ success: false, error: 'Unauthorized integration access' });
    }

    try {
        const result = await db.query(
            'SELECT asset_code, sr_number, employee_name, department FROM assets WHERE serial_number = $1',
            [serial]
        );
        const data = result.rows[0];

        if (!data) return res.status(404).json({ success: false, error: 'Asset not found' });

        res.json({
            success: true,
            srNumber: data.sr_number || data.asset_code,
            owner: data.employee_name,
            department: data.department
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Proxy for fetching status FROM Repairs System
app.get('/api/assets/repair-status/:serial', authenticateSession, async (req, res) => {
    const { serial } = req.params;
    const repairsUrl = process.env.REPAIRS_SYSTEM_URL || 'https://[your-netlify-site].netlify.app';

    try {
        // Use native fetch (Node 18+)
        const response = await fetch(`${repairsUrl}/api/external/repair-status/${serial}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            // Can handle silent fail if system is down
            return res.json({ success: false, message: 'Status unavailable' });
        }

        const data = await response.json();
        res.json({ success: true, data });
    } catch (error) {
        console.error('Failed to fetch repair status:', error);
        res.json({ success: false, message: 'Integration unavailable' });
    }
});

app.post('/api/assets', authenticateSession, requireRole('Admin', 'Head Administrator', 'Asset Adder'), async (req, res) => {
    const assetData = req.body;
    try {
        if (assetData.serialNumber) {
            const check = await db.query('SELECT id FROM assets WHERE serial_number = $1', [assetData.serialNumber]);
            if (check.rows.length > 0) {
                return res.status(400).json({
                    success: false,
                    error: `An asset with Serial Number "${assetData.serialNumber}" is already registered.`
                });
            }
        }

        let purchaseDateVal = null;
        let warrantyExpiryVal = null;
        let disposalDateVal = null;

        if (assetData.purchaseDate) {
            const pd = new Date(assetData.purchaseDate);
            if (!isNaN(pd.getTime())) {
                purchaseDateVal = pd.toISOString().split('T')[0];

                // Auto-calculate if not explicitly provided
                const wExp = new Date(pd);
                wExp.setFullYear(wExp.getFullYear() + 1);
                warrantyExpiryVal = assetData.warrantyExpiry || wExp.toISOString().split('T')[0];

                const dDate = new Date(pd);
                dDate.setFullYear(dDate.getFullYear() + 3);
                disposalDateVal = assetData.disposalDate || dDate.toISOString().split('T')[0];
            }
        } else if (assetData.warrantyExpiry) {
            // If only warranty is provided
            warrantyExpiryVal = assetData.warrantyExpiry;
        }

        const year = new Date().getFullYear();
        const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
        const generatedSR = assetData.srNumber || `BCC-SR-${year}-${suffix}`;

        const assetsColumns = await getAssetsColumns();
        const insertEntries = [
            ['asset_name', assetData.type || 'Asset'],
            ['employee_name', assetData.employeeName],
            ['asset_code', generatedSR],
            ['sr_number', generatedSR],
            ['serial_number', assetData.serialNumber || ''],
            ['department', assetData.department || ''],
            ['department_id', assetData.departmentId || null],
            ['location', assetData.location || 'Office'],
            ['condition_status', (assetData.status || assetData.assetStatus || 'active').toLowerCase()],
            ['model', assetData.model || ''],
            ['warranty_expiry', warrantyExpiryVal],
            ['notes', assetData.notes || ''],
            ['ext_number', assetData.extNumber || ''],
            ['office_number', assetData.officeNumber || ''],
            ['position', assetData.position || ''],
            ['section', assetData.section || ''],
            ['brand', assetData.brand || ''],
            ['purchase_date', purchaseDateVal],
            ['disposal_date', disposalDateVal]
        ].filter(([column]) => assetsColumns.has(column));
        if (insertEntries.length === 0) {
            throw new Error('No compatible columns found for assets insert.');
        }
        const insertColumns = insertEntries.map(([column]) => column);
        const insertValues = insertEntries.map(([, value]) => value);
        const placeholders = insertValues.map((_, i) => `$${i + 1}`).join(', ');
        const queryText = `
            INSERT INTO assets (${insertColumns.join(', ')})
            VALUES (${placeholders})
            RETURNING id
        `;
        const result = await db.query(queryText, insertValues);
        const newAssetId = result.rows[0].id;

        await logAction(req.user.userId, req.user.username, 'ADD_ASSET', `Registered asset ${generatedSR} for ${assetData.employeeName || 'unknown employee'}`);
        emitEvent('assets:added', { id: newAssetId, srNumber: generatedSR });

        res.json({ success: true, message: 'Asset registered successfully!', srNumber: generatedSR, id: newAssetId });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/assets/:id', authenticateSession, requireRole('Admin', 'Head Administrator'), async (req, res) => {
    try {
        await db.query('DELETE FROM assets WHERE id = $1', [req.params.id]);

        await logAction(req.user.userId, req.user.username, 'DELETE_ASSET', `Deleted asset id ${req.params.id}`);
        emitEvent('assets:deleted', { id: req.params.id });

        res.json({ success: true, message: 'Asset deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/assets/expired', authenticateSession, async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const result = await db.query(
            'SELECT * FROM assets WHERE disposal_date < $1 ORDER BY disposal_date ASC',
            [today]
        );
        res.json({ success: true, assets: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/assets/:id', authenticateSession, async (req, res) => {
    const { id } = req.params;
    try {
        const assetResult = await db.query('SELECT * FROM assets WHERE id = $1', [id]);
        if (assetResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Asset not found' });
        }
        const asset = assetResult.rows[0];

        // Fetch voucher if it exists
        let voucher = null;
        if (asset.voucher_id) {
            const voucherResult = await db.query('SELECT * FROM vouchers WHERE id = $1', [asset.voucher_id]);
            voucher = voucherResult.rows[0] || null;
            
            if (voucher) {
                const itemsResult = await db.query('SELECT * FROM voucher_items WHERE voucher_id = $1', [voucher.id]);
                voucher.items = itemsResult.rows;
                
                const deliveriesResult = await db.query('SELECT * FROM deliveries WHERE voucher_id = $1', [voucher.id]);
                voucher.deliveries = deliveriesResult.rows;
            }
        }

        res.json({ success: true, asset, voucher });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/audit-logs', authenticateSession, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT al.*, COALESCE(u.username, al.user_name) as username, COALESCE(u.name, al.user_name) as "fullName"
            FROM audit_logs al
            LEFT JOIN users u ON al.user_id = u.id
            ORDER BY al.timestamp DESC
            LIMIT 500
        `);
        res.json({ success: true, logs: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/audit-logs/verify', authenticateSession, requireRole('Head Administrator', 'Admin'), async (req, res) => {
    try {
        const result = await db.query('SELECT id, user_id, user_name, action, details, timestamp, hash FROM audit_logs ORDER BY id ASC');
        const rows = result.rows;

        if (rows.length === 0) return res.json({ success: true, valid: true, message: 'No log entries to verify.' });

        let prevHash = '0'.repeat(64);
        let firstBrokenId = null;

        for (const row of rows) {
            if (!row.hash) continue; // skip rows before hash chain was enabled
            const payload = { userId: row.user_id, username: row.user_name, action: row.action, details: row.details, timestamp: new Date(row.timestamp).toISOString() };
            const expectedHash = crypto.createHash('sha256').update(prevHash + JSON.stringify(payload)).digest('hex');
            if (expectedHash !== row.hash) {
                firstBrokenId = row.id;
                break;
            }
            prevHash = row.hash;
        }

        if (firstBrokenId) {
            res.json({ success: true, valid: false, message: `Chain broken at log entry id ${firstBrokenId}` });
        } else {
            res.json({ success: true, valid: true, message: `All ${rows.filter(r => r.hash).length} hashed log entries verified.` });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/assets/bulk', authenticateSession, requireRole('Admin', 'Head Administrator', 'Asset Adder'), async (req, res) => {
    const assetsData = req.body;
    if (!Array.isArray(assetsData)) {
        return res.status(400).json({ success: false, error: 'Data must be an array of assets' });
    }
    if (assetsData.length === 0) {
        return res.status(400).json({ success: false, error: 'No assets supplied for import' });
    }

    try {
        const serials = assetsData
            .map(asset => `${asset.serialNumber || ''}`.trim())
            .filter(Boolean);
        const existingSerials = new Set();
        if (serials.length > 0) {
            const existingResult = await db.query(
                'SELECT lower(serial_number) as serial_number FROM assets WHERE lower(serial_number) = ANY($1)',
                [serials.map(serial => serial.toLowerCase())]
            );
            existingResult.rows.forEach(row => existingSerials.add(row.serial_number));
        }

        const seenSerials = new Set();
        let skippedCount = 0;
        const validAssetsData = assetsData.filter(asset => {
            const employeeName = `${asset.employeeName || ''}`.trim();
            const serial = `${asset.serialNumber || ''}`.trim();
            const normalizedSerial = serial.toLowerCase();
            if (!employeeName || !normalizedSerial) {
                skippedCount++;
                return false;
            }
            if (existingSerials.has(normalizedSerial) || seenSerials.has(normalizedSerial)) {
                skippedCount++;
                return false;
            }
            seenSerials.add(normalizedSerial);
            return true;
        });

        if (validAssetsData.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No valid new asset rows found. Required fields may be missing or serial numbers may already exist.',
                skipped: skippedCount
            });
        }

        const assetsColumns = await getAssetsColumns();
        const candidateColumns = [
            'asset_name',
            'employee_name',
            'asset_code',
            'sr_number',
            'serial_number',
            'department',
            'department_id',
            'location',
            'condition_status',
            'model',
            'warranty_expiry',
            'notes',
            'ext_number',
            'office_number',
            'position',
            'section',
            'brand',
            'purchase_date',
            'disposal_date'
        ];
        const insertColumns = candidateColumns.filter(column => assetsColumns.has(column));
        if (insertColumns.length === 0) {
            throw new Error('No compatible columns found for bulk assets insert.');
        }

        const queryText = `
            INSERT INTO assets (${insertColumns.join(', ')})
            VALUES ${validAssetsData.map((_, rowIndex) => `(${insertColumns.map((__, colIndex) => `$${rowIndex * insertColumns.length + colIndex + 1}`).join(', ')})`).join(', ')}
            RETURNING id
        `;
        const params = [];
        validAssetsData.forEach(asset => {
            let purchaseDateVal = null;
            let warrantyExpiryVal = null;
            let disposalDateVal = null;

            if (asset.purchaseDate) {
                const pd = new Date(asset.purchaseDate);
                if (!isNaN(pd.getTime())) {
                    purchaseDateVal = pd.toISOString().split('T')[0];
                    const wExp = new Date(pd);
                    wExp.setFullYear(wExp.getFullYear() + 1);
                    warrantyExpiryVal = asset.warrantyExpiry || wExp.toISOString().split('T')[0];
                    const dDate = new Date(pd);
                    dDate.setFullYear(dDate.getFullYear() + 3);
                    disposalDateVal = asset.disposalDate || dDate.toISOString().split('T')[0];
                }
            } else if (asset.warrantyExpiry) {
                warrantyExpiryVal = asset.warrantyExpiry;
            }

            const year = new Date().getFullYear();
            const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
            const generatedSR = asset.srNumber || `BCC-SR-${year}-${suffix}`;
            const rowValues = {
                asset_name: asset.type || 'Asset',
                employee_name: asset.employeeName,
                asset_code: generatedSR,
                sr_number: generatedSR,
                serial_number: asset.serialNumber || '',
                department: asset.department || '',
                department_id: asset.departmentId || null,
                location: asset.location || 'Office',
                condition_status: (asset.status || asset.assetStatus || 'active').toLowerCase(),
                model: asset.model || '',
                warranty_expiry: warrantyExpiryVal,
                notes: asset.notes || '',
                ext_number: asset.extNumber || '',
                office_number: asset.officeNumber || '',
                position: asset.position || '',
                section: asset.section || '',
                brand: asset.brand || '',
                purchase_date: purchaseDateVal,
                disposal_date: disposalDateVal
            };

            insertColumns.forEach(column => params.push(rowValues[column]));
        });

        const result = await db.query(queryText, params);

        await logAction(req.user.userId, req.user.username, 'IMPORT_ASSETS', `Imported ${result.rows.length} assets, skipped ${skippedCount} rows.`);
        emitEvent('assets:bulk_added', { count: result.rows.length });

        res.json({ success: true, message: `Successfully imported ${result.rows.length} assets`, count: result.rows.length, skipped: skippedCount });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/api/assets', authenticateSession, requireRole('Admin', 'Head Administrator'), async (req, res) => {
    const assetData = req.body;
    try {
        let purchaseDateVal = null;
        let warrantyExpiryVal = null;
        let disposalDateVal = null;

        if (assetData.purchaseDate) {
            const pd = new Date(assetData.purchaseDate);
            if (!isNaN(pd.getTime())) {
                purchaseDateVal = pd.toISOString().split('T')[0];

                // Auto-calculate if not explicitly provided
                const wExp = new Date(pd);
                wExp.setFullYear(wExp.getFullYear() + 1);
                warrantyExpiryVal = assetData.warrantyExpiry || wExp.toISOString().split('T')[0];

                const dDate = new Date(pd);
                dDate.setFullYear(dDate.getFullYear() + 3);
                disposalDateVal = assetData.disposalDate || dDate.toISOString().split('T')[0];
            }
        } else if (assetData.warrantyExpiry) {
            warrantyExpiryVal = assetData.warrantyExpiry;
        }

        const assetsColumns = await getAssetsColumns();
        const updateEntries = [
            ['asset_name', assetData.type || 'Asset'],
            ['employee_name', assetData.employeeName],
            ['asset_code', assetData.srNumber],
            ['sr_number', assetData.srNumber],
            ['serial_number', assetData.serialNumber],
            ['department', assetData.department],
            ['department_id', assetData.departmentId || null],
            ['condition_status', (assetData.status || assetData.assetStatus || 'active').toLowerCase()],
            ['model', assetData.model || ''],
            ['warranty_expiry', warrantyExpiryVal],
            ['ext_number', assetData.extNumber],
            ['office_number', assetData.officeNumber],
            ['position', assetData.position],
            ['section', assetData.section],
            ['brand', assetData.brand || ''],
            ['purchase_date', purchaseDateVal],
            ['disposal_date', disposalDateVal]
        ].filter(([column]) => assetsColumns.has(column));
        if (updateEntries.length === 0) {
            throw new Error('No compatible columns found for assets update.');
        }
        const setClause = updateEntries.map(([column], idx) => `${column} = $${idx + 1}`).join(', ');
        const queryText = `UPDATE assets SET ${setClause} WHERE id = $${updateEntries.length + 1}`;
        const params = updateEntries.map(([, value]) => value);
        params.push(assetData.id);
        await db.query(queryText, params);

        await logAction(req.user.userId, req.user.username, 'UPDATE_ASSET', `Updated asset id ${assetData.id}`);
        emitEvent('assets:updated', { id: assetData.id });
        res.json({ success: true, message: 'Asset updated successfully!' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/api/inventory', authenticateSession, requireRole('Admin', 'Head Administrator'), async (req, res) => {
    const itemData = req.body;
    try {
        const queryText = `
            UPDATE inventory SET 
                item_name = $1, description = $2, quantity = $3, unit_cost = $4, 
                item_code = $5, reorder_level = $6, category_id = $7
            WHERE id = $8
        `;
        await db.query(queryText, [
            itemData.name,
            itemData.description || '',
            itemData.quantity || 0,
            itemData.price || 0,
            itemData.serialNumber || '',
            itemData.lowStockThreshold || 10,
            itemData.category,
            itemData.id
        ]);

        await logAction(req.user.userId, req.user.username, 'UPDATE_INVENTORY', `Updated inventory item: ${itemData.name || itemData.id}`);
        emitEvent('inventory:updated', { id: itemData.id, name: itemData.name });
        res.json({ success: true, message: 'Item updated successfully!' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/inventory/:id', authenticateSession, requireRole('Admin', 'Head Administrator'), async (req, res) => {
    try {
        await db.query('UPDATE inventory SET status = $1 WHERE id = $2', ['inactive', req.params.id]);
        await logAction(req.user.userId, req.user.username, 'DELETE_INVENTORY', `Deleted inventory item id ${req.params.id}`);
        emitEvent('inventory:deleted', { id: req.params.id });
        res.json({ success: true, message: 'Inventory item deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/stats/dashboard', authenticateSession, async (req, res) => {
    try {
        const inventoryResult = await db.query('SELECT unit_cost as price, quantity FROM inventory WHERE status = $1', ['active']);
        const lowStockResult = await db.query('SELECT count(*) FROM inventory WHERE quantity <= 10');
        const totalAssetsResult = await db.query('SELECT count(*) FROM assets');
        const recentActivity = await fetchActivityLogs(10);

        const inventory = inventoryResult.rows;
        const totalValue = inventory.reduce((sum, item) => sum + (parseFloat(item.price) * parseInt(item.quantity)), 0);

        res.json({
            success: true,
            stats: {
                inventory: {
                    totalItems: inventory.length,
                    totalValue,
                    lowStockItems: parseInt(lowStockResult.rows[0].count)
                },
                assets: {
                    totalAssets: parseInt(totalAssetsResult.rows[0].count),
                    activeAssets: parseInt(totalAssetsResult.rows[0].count)
                },
                recentActivity
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/categories', authenticateSession, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM categories ORDER BY name');
        res.json({ success: true, categories: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/departments', authenticateSession, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM departments ORDER BY name');
        res.json({ success: true, departments: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/users', authenticateSession, async (req, res) => {
    try {
        const result = await db.query('SELECT id, username, name, role, last_login, is_active FROM users ORDER BY name');
        res.json({
            success: true,
            users: result.rows.map(u => {
                const normalizedUser = normalizeUserIdentity(u);
                return { ...u, ...normalizedUser, fullName: normalizedUser.name };
            })
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/users', authenticateSession, requireRole('Head Administrator'), async (req, res) => {
    const userData = req.body;
    try {
        if (!userData.username || !userData.fullName) {
            return res.status(400).json({ success: false, error: 'Username and full name are required' });
        }
        const hashedPassword = await bcrypt.hash(userData.password || 'Bcc12345!', 10);
        const initials = userData.fullName.split(' ').map(n => n[0]).join('').toUpperCase();
        const queryText = `
            INSERT INTO users (username, name, password, role, is_active, initials)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
        `;
        const result = await db.query(queryText, [
            userData.username,
            userData.fullName,
            hashedPassword,
            userData.role || 'Stock Taker',
            true,
            initials
        ]);
        res.json({ success: true, message: 'User created successfully', userId: result.rows[0].id });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/api/users/:id', authenticateSession, requireRole('Head Administrator'), async (req, res) => {
    const userData = req.body;
    try {
        await db.query(
            'UPDATE users SET username = $1, name = $2, role = $3 WHERE id = $4',
            [userData.username, userData.fullName, userData.role, req.params.id]
        );
        res.json({ success: true, message: 'User updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/users/:id', authenticateSession, requireRole('Head Administrator'), async (req, res) => {
    try {
        await db.query('UPDATE users SET is_active = false WHERE id = $1', [req.params.id]);
        res.json({ success: true, message: 'User deactivated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/activity-logs', authenticateSession, async (req, res) => {
    try {
        const logs = await fetchActivityLogs(50);
        res.json({ success: true, logs });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/activity-logs', authenticateSession, async (req, res) => {
    const { action, details, timestamp } = req.body;
    if (!action) {
        return res.status(400).json({ success: false, error: 'Activity action is required' });
    }

    try {
        await recordActivity(req.user.userId, req.user.username, action, details || '', timestamp);
        res.json({ success: true, message: 'Activity logged' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.use((err, req, res, next) => {
    console.error('Unhandled Error:', err);
    res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
        details: err.message
    });
});

setInterval(() => {
    deactivateExpiredSessions().catch(error => console.error('Session cleanup failed:', error.message));
}, 15 * 60 * 1000);

async function startServer() {
    await initializeApp();

    const httpServer = http.createServer(app);

    // Real-time Socket.io (gracefully skipped if package not installed)
    try {
        const { Server } = require('socket.io');
        io = new Server(httpServer, {
            cors: { origin: ALLOWED_ORIGINS, credentials: true }
        });
        io.on('connection', socket => {
            console.log(`Socket client connected: ${socket.id}`);
            socket.on('disconnect', () => console.log(`Socket client disconnected: ${socket.id}`));
        });
        console.log('✅ Real-time (Socket.io) enabled');
    } catch (_) {
        console.log('ℹ️  Socket.io not available — real-time push disabled');
    }

    // Low-stock email alerts (requires ALERT_EMAIL + SMTP_HOST in .env)
    if (process.env.ALERT_EMAIL && process.env.SMTP_HOST) {
        try {
            const cron = require('node-cron');
            const nodemailer = require('nodemailer');
            const transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: parseInt(process.env.SMTP_PORT || '587'),
                secure: process.env.SMTP_SECURE === 'true',
                auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
            });

            cron.schedule('0 8 * * *', async () => {
                try {
                    const result = await db.query(
                        "SELECT item_name, quantity, reorder_level FROM inventory WHERE quantity <= reorder_level AND status = 'active' ORDER BY quantity ASC"
                    );
                    if (result.rows.length === 0) return;

                    const rows = result.rows.map(r => `  • ${r.item_name}: ${r.quantity} remaining (reorder at ${r.reorder_level})`).join('\n');
                    await transporter.sendMail({
                        from: `"BCC SIMS" <${process.env.SMTP_USER}>`,
                        to: process.env.ALERT_EMAIL,
                        subject: `⚠️ Low Stock Alert — ${result.rows.length} item(s) need restocking`,
                        text: `The following inventory items are at or below reorder level:\n\n${rows}\n\nPlease log in to BCC SIMS to take action.`
                    });
                    console.log(`Low-stock alert sent for ${result.rows.length} item(s)`);
                } catch (err) {
                    console.error('Low-stock cron error:', err.message);
                }
            });
            console.log('✅ Low-stock email alerts scheduled (daily 08:00)');
        } catch (_) {
            console.log('ℹ️  node-cron / nodemailer not available — email alerts disabled');
        }
    }

    httpServer.listen(PORT, () => {
        console.log(`🚀 Server running on: http://localhost:${PORT}`);
    });
}

// Export the app for serverless deployment
module.exports = app;

// Only start the server if this file is run directly (not required as a module)
if (require.main === module) {
    startServer();
}
