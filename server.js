const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const supabase = require('./supabase-client');
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
    const sessionRecord = {
        user_id: userId,
        session_token: sessionId,
        ip_address: getClientIp(req),
        user_agent: req.headers['user-agent'] || '',
        is_active: true,
        last_activity: nowIso
    };

    if (useMemorySessions) {
        memorySessions.set(sessionId, {
            user_id: userId,
            last_activity: nowIso,
            is_active: true
        });
        return sessionId;
    }

    const { error } = await supabase.from('user_sessions').insert([sessionRecord]);
    if (error) {
        if (isSessionTableMissingError(error)) {
            useMemorySessions = true;
            memorySessions.set(sessionId, {
                user_id: userId,
                last_activity: nowIso,
                is_active: true
            });
            console.warn('user_sessions table missing. Falling back to in-memory sessions.');
            return sessionId;
        }
        throw error;
    }

    return sessionId;
}

async function getActiveSession(sessionId) {
    if (!sessionId) return null;

    if (useMemorySessions) {
        const session = memorySessions.get(sessionId);
        if (!session || !session.is_active) return null;
        return session;
    }

    const { data: session, error } = await supabase
        .from('user_sessions')
        .select('session_token, user_id, last_activity, is_active')
        .eq('session_token', sessionId)
        .eq('is_active', true)
        .maybeSingle();

    if (error) {
        if (isSessionTableMissingError(error)) {
            useMemorySessions = true;
            return memorySessions.get(sessionId) || null;
        }
        throw error;
    }

    return session;
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

    await supabase
        .from('user_sessions')
        .update({ last_activity: nowIso })
        .eq('session_token', sessionId);
}

async function deactivateSession(sessionId) {
    if (!sessionId) return;

    if (useMemorySessions) {
        memorySessions.delete(sessionId);
        return;
    }

    await supabase
        .from('user_sessions')
        .update({ is_active: false })
        .eq('session_token', sessionId);
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

    await supabase
        .from('user_sessions')
        .update({ is_active: false })
        .eq('is_active', true)
        .lt('last_activity', getSessionExpiryCutoffIso());
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

        const { data: user, error } = await supabase
            .from('users')
            .select('id, username, name, role, initials, is_active')
            .eq('id', session.user_id)
            .maybeSingle();

        if (error) throw error;

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
        console.log('🔧 Checking Supabase connection...');
        const { data, error } = await supabase.from('users').select('id').limit(1);
        if (error) throw error;
        console.log('✅ Supabase connected successfully');
    } catch (error) {
        console.error('❌ Supabase connection failed:', error.message);
        console.log('💡 Please check your .env file and Supabase project status.');
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
        const { count: userCount } = await supabase.from('users').select('*', { count: 'exact', head: true });
        const { count: inventoryCount } = await supabase.from('inventory').select('*', { count: 'exact', head: true });
        const { count: assetCount } = await supabase.from('assets').select('*', { count: 'exact', head: true });

        res.json({
            status: 'Server is running',
            timestamp: new Date().toISOString(),
            database: { usersCount: userCount, inventoryCount: inventoryCount, assetsCount: assetCount, connectionStatus: 'Connected (Supabase)' }
        });
    } catch (error) {
        res.status(500).json({ status: 'Server error', error: error.message });
    }
});

app.get('/api/health', async (req, res) => {
    try {
        const { error } = await supabase.from('users').select('id').limit(1);
        if (error) throw error;
        res.json({ status: 'healthy', database: 'connected (Supabase)', timestamp: new Date().toISOString() });
    } catch (error) {
        res.status(500).json({ status: 'unhealthy', error: error.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const { data: users, error } = await supabase.from('users').select('*').eq('username', username).eq('is_active', true);
        if (error) throw error;

        if (users && users.length > 0) {
            const user = users[0];
            const isValidPassword = await bcrypt.compare(password, user.password);
            if (isValidPassword) {
                const sessionId = await createSession(user.id, req);
                await supabase.from('users').update({ last_login: new Date().toISOString() }).eq('id', user.id);
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
        let query = supabase.from('inventory').select('*').eq('status', 'active');
        if (search) query = query.or(`item_name.ilike.%${search}%,description.ilike.%${search}%`);
        if (category) query = query.eq('category_id', category);
        const { data: items, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;
        res.json({ success: true, items });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/inventory', authenticateSession, async (req, res) => {
    const itemData = req.body;
    try {
        const { data: result, error } = await supabase.from('inventory').insert([{
            item_name: itemData.name,
            description: itemData.description || '',
            quantity: itemData.quantity || 0,
            unit_cost: itemData.price || 0,
            unit: itemData.unit || 'pcs',
            item_code: itemData.serialNumber || itemData.serial || `ITEM-${Date.now()}`,
            supplier: itemData.supplier || '',
            location: itemData.location || 'Store',
            reorder_level: itemData.lowStockThreshold || 10
            // Removed added_by as it's missing from schema
        }]).select();
        if (error) throw error;

        // Tracking is done in activity_log which has user_id
        await supabase.from('activity_log').insert([{
            user_id: req.user.userId,
            action: 'create',
            table_name: 'inventory',
            record_id: result[0].id,
            description: `Added new inventory item: ${itemData.name}`
        }]);

        res.json({ success: true, itemId: result[0].id, message: 'Item added successfully!' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/assets', authenticateSession, async (req, res) => {
    const { search, department, assetStatus } = req.query;
    try {
        let query = supabase.from('assets').select('*');
        if (search) query = query.or(`name.ilike.%${search}%,surname.ilike.%${search}%,serial_number.ilike.%${search}%`);
        if (department) query = query.eq('department', department);
        if (assetStatus) query = query.eq('condition_status', assetStatus);
        const { data: rows, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;
        const assets = rows.map(asset => ({
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

    // Simple API Key check (You should ideally store this in .env)
    if (apiKey !== process.env.EXTERNAL_API_KEY && apiKey !== 'BCC_REPAIRS_SYNC_2024') {
        return res.status(401).json({ success: false, error: 'Unauthorized integration access' });
    }

    try {
        const { data, error } = await supabase
            .from('assets')
            .select('asset_code, sr_number, employee_name, department')
            .eq('serial_number', serial)
            .maybeSingle();

        if (error) throw error;
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
        // Validation: Check for duplicate serial number if provided
        if (assetData.serialNumber) {
            const { data: existing, error: checkError } = await supabase
                .from('assets')
                .select('id')
                .eq('serial_number', assetData.serialNumber)
                .maybeSingle();

            if (existing) {
                return res.status(400).json({
                    success: false,
                    error: `An asset with Serial Number "${assetData.serialNumber}" is already registered.`
                });
            }
        }

        // Generate a unique SR number if not provided (now standard for new registrations)
        const year = new Date().getFullYear();
        const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
        const generatedSR = assetData.srNumber || `BCC-SR-${year}-${suffix}`;

        const { data: result, error } = await supabase.from('assets').insert([{
            asset_name: assetData.type || 'Asset',
            employee_name: assetData.employeeName,
            asset_code: generatedSR,
            sr_number: generatedSR,
            serial_number: assetData.serialNumber || '',
            department: assetData.department || '',
            location: assetData.location || 'Office',
            condition_status: (assetData.status || assetData.assetStatus || 'active').toLowerCase(),
            model: assetData.model || '',
            warranty_expiry: assetData.warrantyExpiry || null,
            notes: assetData.notes || '',
            ext_number: assetData.extNumber || '',
            office_number: assetData.officeNumber || '',
            position: assetData.position || '',
            section: assetData.section || ''
        }]).select();
        if (error) throw error;

        await supabase.from('activity_log').insert([{
            user_id: req.user.userId,
            action: 'create',
            table_name: 'assets',
            record_id: result[0].id,
            description: `Registered asset ${generatedSR} for: ${assetData.employeeName}`
        }]);

        res.json({ success: true, message: 'Asset registered successfully!', srNumber: generatedSR, id: result[0].id });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/assets/:id', authenticateSession, async (req, res) => {
    try {
        const { error } = await supabase.from('assets').delete().eq('id', req.params.id);
        if (error) throw error;
        
        await supabase.from('activity_log').insert([{
             user_id: req.user.userId, 
             action: 'delete', 
             table_name: 'assets', 
             record_id: req.params.id, 
             description: `Deleted asset with ID: ${req.params.id}` 
        }]);
        
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
        const formattedAssets = assetsData.map(assetData => ({
            asset_name: assetData.type || 'Asset',
            employee_name: assetData.employeeName,
            asset_code: assetData.srNumber || `ASSET-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            sr_number: assetData.srNumber,
            serial_number: assetData.serialNumber,
            department: assetData.department || '',
            location: assetData.location || 'Office',
            condition_status: (assetData.status || assetData.assetStatus || 'active').toLowerCase(),
            model: assetData.model || '',
            warranty_expiry: assetData.warrantyExpiry || null,
            notes: assetData.notes || '',
            ext_number: assetData.extNumber || '',
            office_number: assetData.officeNumber || '',
            position: assetData.position || '',
            section: assetData.section || ''
        }));

        const { data: result, error } = await supabase.from('assets').insert(formattedAssets).select();
        if (error) throw error;

        await supabase.from('activity_log').insert([{
            user_id: req.user.userId,
            action: 'bulk_create',
            table_name: 'assets',
            description: `Bulk imported ${result.length} assets`
        }]);

        res.json({ success: true, message: `Successfully imported ${result.length} assets`, count: result.length });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/api/assets', authenticateSession, async (req, res) => {
    const assetData = req.body;
    try {
        const { data: result, error } = await supabase.from('assets').update({
            asset_name: assetData.type || 'Asset',
            employee_name: assetData.employeeName,
            asset_code: assetData.srNumber,
            sr_number: assetData.srNumber,
            serial_number: assetData.serialNumber,
            department: assetData.department,
            condition_status: (assetData.status || assetData.assetStatus || 'active').toLowerCase(),
            model: assetData.model || '',
            warranty_expiry: assetData.warrantyExpiry || null,
            ext_number: assetData.extNumber,
            office_number: assetData.officeNumber,
            position: assetData.position,
            section: assetData.section
        }).eq('id', assetData.id).select();

        if (error) throw error;
        await supabase.from('activity_log').insert([{ user_id: req.user.userId, action: 'update', table_name: 'assets', record_id: assetData.id, description: `Updated asset: ${assetData.employeeName}` }]);
        res.json({ success: true, message: 'Asset updated successfully!' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/api/inventory', authenticateSession, async (req, res) => {
    const itemData = req.body;
    try {
        const { data: result, error } = await supabase.from('inventory').update({
            item_name: itemData.name,
            description: itemData.description || '',
            quantity: itemData.quantity || 0,
            unit_cost: itemData.price || 0,
            item_code: itemData.serialNumber || '',
            reorder_level: itemData.lowStockThreshold || 10,
            category: itemData.category
        }).eq('id', itemData.id).select();

        if (error) throw error;
        await supabase.from('activity_log').insert([{ user_id: req.user.userId, action: 'update', table_name: 'inventory', record_id: itemData.id, description: `Updated inventory item: ${itemData.name}` }]);
        res.json({ success: true, message: 'Item updated successfully!' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/stats/dashboard', authenticateSession, async (req, res) => {
    try {
        const { data: inventory } = await supabase.from('inventory').select('price:unit_cost, quantity').eq('status', 'active');
        const { count: lowStock } = await supabase.from('inventory').select('*', { count: 'exact', head: true }).lte('quantity', 10);
        const { count: totalAssets } = await supabase.from('assets').select('*', { count: 'exact', head: true });
        const { data: activity } = await supabase.from('activity_log').select('*, users(name)').order('timestamp', { ascending: false }).limit(10);

        const totalValue = inventory.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        res.json({
            success: true,
            stats: {
                inventory: { totalItems: inventory.length, totalValue, lowStockItems: lowStock },
                assets: { totalAssets, activeAssets: totalAssets },
                recentActivity: activity.map(a => ({ ...a, user_name: a.users?.name }))
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/categories', authenticateSession, async (req, res) => {
    try {
        const { data, error } = await supabase.from('categories').select('*').order('name');
        if (error) throw error;
        res.json({ success: true, categories: data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/users', authenticateSession, async (req, res) => {
    try {
        const { data, error } = await supabase.from('users').select('id, username, name, role, last_login, is_active').order('name');
        if (error) throw error;
        res.json({
            success: true,
            users: data.map(u => {
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
        const { data: result, error } = await supabase.from('users').insert([{
            username: userData.username,
            name: userData.fullName,
            password: hashedPassword,
            role: userData.role || 'Stock Taker',
            is_active: true,
            initials: userData.fullName.split(' ').map(n => n[0]).join('').toUpperCase()
        }]).select();
        if (error) throw error;
        res.json({ success: true, message: 'User created successfully', userId: result[0].id });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/users/:id', authenticateSession, async (req, res) => {
    try {
        const { error } = await supabase.from('users').update({ is_active: false }).eq('id', req.params.id);
        if (error) throw error;
        res.json({ success: true, message: 'User deactivated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/activity-logs', authenticateSession, async (req, res) => {
    try {
        const { data, error } = await supabase.from('activity_log').select('*, users(name, role)').order('timestamp', { ascending: false }).limit(50);
        if (error) throw error;
        res.json({ success: true, logs: data.map(l => ({ ...l, user_name: l.users?.name, user_role: l.users?.role })) });
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
