const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const db = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const SESSION_COOKIE_NAME = 'sims_session_id';
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS || 24 * 60 * 60 * 1000);
const DEFAULT_ALLOWED_ORIGINS = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://bccinventory.netlify.app',
    'https://bccinventory.netlify.app/'
];
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || process.env.FRONTEND_ORIGIN || DEFAULT_ALLOWED_ORIGINS.join(','))
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
const memorySessions = new Map();
let useMemorySessions = false;

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
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Initialize Supabase check
async function initializeApp() {
    try {
        console.log('🔧 Checking Neon Database connection...');
        const result = await db.query('SELECT 1 as connected');
        if (result.rows.length === 0) throw new Error('Database ping failed');
        console.log('✅ Neon Database connected successfully');
    } catch (error) {
        console.error('❌ Neon Database connection failed:', error.message);
        console.log('💡 Please check your .env file and Neon project status.');
        process.exit(1);
    }
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
    const { search, category } = req.query;
    try {
        let queryText = 'SELECT * FROM inventory WHERE status = $1';
        let queryParams = ['active'];

        if (search) {
            queryParams.push(`%${search}%`);
            queryText += ` AND (item_name ILIKE $${queryParams.length} OR description ILIKE $${queryParams.length})`;
        }
        if (category) {
            queryParams.push(category);
            queryText += ` AND category_id = $${queryParams.length}`;
        }

        queryText += ' ORDER BY created_at DESC';
        const result = await db.query(queryText, queryParams);
        res.json({ success: true, items: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/inventory', authenticateSession, async (req, res) => {
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

        await db.query(
            'INSERT INTO activity_log (user_id, action, table_name, record_id, description) VALUES ($1, $2, $3, $4, $5)',
            [req.user.userId, 'create', 'inventory', newItemId, `Added new inventory item: ${itemData.name}`]
        );

        res.json({ success: true, itemId: newItemId, message: 'Item added successfully!' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/assets', authenticateSession, async (req, res) => {
    const { search, department, assetStatus } = req.query;
    try {
        let queryText = 'SELECT * FROM assets WHERE 1=1';
        let queryParams = [];

        if (search) {
            queryParams.push(`%${search}%`);
            queryText += ` AND (employee_name ILIKE $${queryParams.length} OR serial_number ILIKE $${queryParams.length})`;
        }
        if (department) {
            queryParams.push(department);
            queryText += ` AND department = $${queryParams.length}`;
        }
        if (assetStatus) {
            queryParams.push(assetStatus.toLowerCase());
            queryText += ` AND condition_status = $${queryParams.length}`;
        }

        queryText += ' ORDER BY created_at DESC';
        const result = await db.query(queryText, queryParams);

        const assets = result.rows.map(asset => ({
            ...asset,
            srNumber: asset.sr_number || asset.asset_code,
            serialNumber: asset.serial_number,
            assetStatus: asset.condition_status,
            addedDate: asset.created_at,
            extNumber: asset.ext_number,
            officeNumber: asset.office_number,
            position: asset.position,
            section: asset.section
        }));
        res.json({ success: true, assets });
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

app.post('/api/assets', authenticateSession, async (req, res) => {
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

        const year = new Date().getFullYear();
        const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
        const generatedSR = assetData.srNumber || `BCC-SR-${year}-${suffix}`;

        const queryText = `
            INSERT INTO assets (
                asset_name, employee_name, asset_code, sr_number, serial_number, department, 
                location, condition_status, model, warranty_expiry, notes, 
                ext_number, office_number, position, section
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            RETURNING id
        `;
        const result = await db.query(queryText, [
            assetData.type || 'Asset',
            assetData.employeeName,
            generatedSR,
            generatedSR,
            assetData.serialNumber || '',
            assetData.department || '',
            assetData.location || 'Office',
            (assetData.status || assetData.assetStatus || 'active').toLowerCase(),
            assetData.model || '',
            assetData.warrantyExpiry || null,
            assetData.notes || '',
            assetData.extNumber || '',
            assetData.officeNumber || '',
            assetData.position || '',
            assetData.section || ''
        ]);
        const newAssetId = result.rows[0].id;

        await db.query(
            'INSERT INTO activity_log (user_id, action, table_name, record_id, description) VALUES ($1, $2, $3, $4, $5)',
            [req.user.userId, 'create', 'assets', newAssetId, `Registered asset ${generatedSR} for: ${assetData.employeeName}`]
        );

        res.json({ success: true, message: 'Asset registered successfully!', srNumber: generatedSR, id: newAssetId });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/assets/:id', authenticateSession, async (req, res) => {
    try {
        await db.query('DELETE FROM assets WHERE id = $1', [req.params.id]);

        await db.query(
            'INSERT INTO activity_log (user_id, action, table_name, record_id, description) VALUES ($1, $2, $3, $4, $5)',
            [req.user.userId, 'delete', 'assets', req.params.id, `Deleted asset with ID: ${req.params.id}`]
        );

        res.json({ success: true, message: 'Asset deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/assets/bulk', authenticateSession, async (req, res) => {
    const assetsData = req.body;
    if (!Array.isArray(assetsData)) {
        return res.status(400).json({ success: false, error: 'Data must be an array of assets' });
    }

    try {
        const queryText = `
            INSERT INTO assets (
                asset_name, employee_name, asset_code, sr_number, serial_number, department, 
                location, condition_status, model, warranty_expiry, notes, 
                ext_number, office_number, position, section
            ) VALUES ${assetsData.map((_, i) => `($${i * 15 + 1}, $${i * 15 + 2}, $${i * 15 + 3}, $${i * 15 + 4}, $${i * 15 + 5}, $${i * 15 + 6}, $${i * 15 + 7}, $${i * 15 + 8}, $${i * 15 + 9}, $${i * 15 + 10}, $${i * 15 + 11}, $${i * 15 + 12}, $${i * 15 + 13}, $${i * 15 + 14}, $${i * 15 + 15})`).join(', ')}
            RETURNING id
        `;

        const params = [];
        assetsData.forEach(asset => {
            params.push(
                asset.type || 'Asset',
                asset.employeeName,
                asset.srNumber || `ASSET-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                asset.srNumber,
                asset.serialNumber,
                asset.department || '',
                asset.location || 'Office',
                (asset.status || asset.assetStatus || 'active').toLowerCase(),
                asset.model || '',
                asset.warrantyExpiry || null,
                asset.notes || '',
                asset.extNumber || '',
                asset.officeNumber || '',
                asset.position || '',
                asset.section || ''
            );
        });

        const result = await db.query(queryText, params);

        await db.query(
            'INSERT INTO activity_log (user_id, action, table_name, description) VALUES ($1, $2, $3, $4)',
            [req.user.userId, 'bulk_create', 'assets', `Bulk imported ${result.rows.length} assets`]
        );

        res.json({ success: true, message: `Successfully imported ${result.rows.length} assets`, count: result.rows.length });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/api/assets', authenticateSession, async (req, res) => {
    const assetData = req.body;
    try {
        const queryText = `
            UPDATE assets SET 
                asset_name = $1, employee_name = $2, asset_code = $3, sr_number = $4, 
                serial_number = $5, department = $6, condition_status = $7, model = $8, 
                warranty_expiry = $9, ext_number = $10, office_number = $11, 
                position = $12, section = $13
            WHERE id = $14
        `;
        await db.query(queryText, [
            assetData.type || 'Asset',
            assetData.employeeName,
            assetData.srNumber,
            assetData.srNumber,
            assetData.serialNumber,
            assetData.department,
            (assetData.status || assetData.assetStatus || 'active').toLowerCase(),
            assetData.model || '',
            assetData.warrantyExpiry || null,
            assetData.extNumber,
            assetData.officeNumber,
            assetData.position,
            assetData.section,
            assetData.id
        ]);

        await db.query(
            'INSERT INTO activity_log (user_id, action, table_name, record_id, description) VALUES ($1, $2, $3, $4, $5)',
            [req.user.userId, 'update', 'assets', assetData.id, `Updated asset: ${assetData.employeeName}`]
        );
        res.json({ success: true, message: 'Asset updated successfully!' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/api/inventory', authenticateSession, async (req, res) => {
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

        await db.query(
            'INSERT INTO activity_log (user_id, action, table_name, record_id, description) VALUES ($1, $2, $3, $4, $5)',
            [req.user.userId, 'update', 'inventory', itemData.id, `Updated inventory item: ${itemData.name}`]
        );
        res.json({ success: true, message: 'Item updated successfully!' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/stats/dashboard', authenticateSession, async (req, res) => {
    try {
        const inventoryResult = await db.query('SELECT unit_cost as price, quantity FROM inventory WHERE status = $1', ['active']);
        const lowStockResult = await db.query('SELECT count(*) FROM inventory WHERE quantity <= 10');
        const totalAssetsResult = await db.query('SELECT count(*) FROM assets');
        const activityResult = await db.query(`
            SELECT a.*, u.name as user_name 
            FROM activity_log a 
            LEFT JOIN users u ON a.user_id = u.id 
            ORDER BY a.timestamp DESC 
            LIMIT 10
        `);

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
                recentActivity: activityResult.rows
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

app.post('/api/users', authenticateSession, async (req, res) => {
    const userData = req.body;
    try {
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

app.delete('/api/users/:id', authenticateSession, async (req, res) => {
    try {
        await db.query('UPDATE users SET is_active = false WHERE id = $1', [req.params.id]);
        res.json({ success: true, message: 'User deactivated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/activity-logs', authenticateSession, async (req, res) => {
    try {
        const queryText = `
            SELECT a.*, u.name as user_name, u.role as user_role 
            FROM activity_log a 
            LEFT JOIN users u ON a.user_id = u.id 
            ORDER BY a.timestamp DESC 
            LIMIT 50
        `;
        const result = await db.query(queryText);
        res.json({ success: true, logs: result.rows });
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
    app.listen(PORT, () => {
        console.log(`🚀 Server running on: http://localhost:${PORT}`);
    });
}

// Export the app for serverless deployment
module.exports = app;

// Only start the server if this file is run directly (not required as a module)
if (require.main === module) {
    startServer();
}
