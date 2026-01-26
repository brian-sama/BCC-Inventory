const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const supabase = require('./supabase-client');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
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

// Simple JWT token generation
function generateToken(user) {
    const payload = {
        userId: user.id,
        username: user.username,
        role: user.role,
        exp: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    };
    return Buffer.from(JSON.stringify(payload)).toString('base64');
}

// Verify token middleware
function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization;
    let token = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.replace('Bearer ', '');
    }

    if (!token) return res.status(401).json({ error: 'No token provided' });

    try {
        const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
        if (Date.now() > decoded.exp) return res.status(401).json({ error: 'Token expired' });
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
}

// ===== ROUTES =====

// Serve index.html for the root or let Vite handle it in dev
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'), err => {
        if (err) {
            // In dev mode, Vite serves the content, so we just provide a health check or minimal response
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
                const token = generateToken(user);
                await supabase.from('users').update({ last_login: new Date().toISOString() }).eq('id', user.id);
                res.json({
                    success: true,
                    user: { id: user.id, username: user.username, name: user.name, role: user.role, initials: user.initials },
                    token
                });
            } else res.status(401).json({ success: false, error: 'Invalid username or password' });
        } else res.status(401).json({ success: false, error: 'Invalid username or password' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/auth/me', verifyToken, async (req, res) => {
    try {
        const { data: user, error } = await supabase.from('users').select('*').eq('id', req.user.userId).single();
        if (error) throw error;
        res.json({ success: true, user: { id: user.id, username: user.username, name: user.name, role: user.role, initials: user.initials } });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/inventory', verifyToken, async (req, res) => {
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

app.post('/api/inventory', verifyToken, async (req, res) => {
    const itemData = req.body;
    try {
        const { data: result, error } = await supabase.from('inventory').insert([{
            item_name: itemData.name,
            description: itemData.description || '',
            quantity: itemData.quantity || 1,
            unit_cost: itemData.price || 0,
            unit: itemData.unit || 'pcs',
            item_code: itemData.serial || `ITEM-${Date.now()}`,
            supplier: itemData.supplier || '',
            location: itemData.location || 'Store',
            added_by: req.user.userId
        }]).select();
        if (error) throw error;
        await supabase.from('activity_log').insert([{ user_id: req.user.userId, action: 'create', table_name: 'inventory', record_id: result[0].id, description: `Added new inventory item: ${itemData.name}` }]);
        res.json({ success: true, itemId: result[0].id, message: 'Item added successfully!' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/assets', verifyToken, async (req, res) => {
    const { search, department, assetStatus } = req.query;
    try {
        let query = supabase.from('assets').select('*');
        if (search) query = query.or(`name.ilike.%${search}%,surname.ilike.%${search}%,serial_number.ilike.%${search}%`);
        if (department) query = query.eq('department', department);
        if (assetStatus) query = query.eq('condition_status', assetStatus);
        const { data: rows, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;
        const assets = rows.map(asset => ({ ...asset, srNumber: asset.sr_number, serialNumber: asset.serial_number, assetStatus: asset.condition_status, addedDate: asset.created_at }));
        res.json({ success: true, assets });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/assets', verifyToken, async (req, res) => {
    const assetData = req.body;
    try {
        const { data: result, error } = await supabase.from('assets').insert([{
            name: assetData.name, surname: assetData.surname || '', sr_number: assetData.srNumber || '',
            serial_number: assetData.serialNumber, department: assetData.department,
            condition_status: assetData.assetStatus || 'excellent', asset_code: `ASSET-${Date.now()}`,
            added_by: req.user.userId, position: assetData.position || '', model: assetData.model || '',
            email: assetData.email || '', asset_type: assetData.assetType || 'other'
        }]).select();
        if (error) throw error;
        await supabase.from('activity_log').insert([{ user_id: req.user.userId, action: 'create', table_name: 'assets', record_id: result[0].id, description: `Added asset for: ${assetData.name}` }]);
        res.json({ success: true, message: 'Asset added successfully!', id: result[0].id });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/stats/dashboard', verifyToken, async (req, res) => {
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

app.get('/api/categories', verifyToken, async (req, res) => {
    try {
        const { data, error } = await supabase.from('categories').select('*').order('name');
        if (error) throw error;
        res.json({ success: true, categories: data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/users', verifyToken, async (req, res) => {
    try {
        const { data, error } = await supabase.from('users').select('id, username, name, role, last_login, is_active').order('name');
        if (error) throw error;
        res.json({ success: true, users: data.map(u => ({ ...u, fullName: u.name })) });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/users', verifyToken, async (req, res) => {
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

app.delete('/api/users/:id', verifyToken, async (req, res) => {
    try {
        const { error } = await supabase.from('users').update({ is_active: false }).eq('id', req.params.id);
        if (error) throw error;
        res.json({ success: true, message: 'User deactivated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/activity-logs', verifyToken, async (req, res) => {
    try {
        const { data, error } = await supabase.from('activity_log').select('*, users(name, role)').order('timestamp', { ascending: false }).limit(50);
        if (error) throw error;
        res.json({ success: true, logs: data.map(l => ({ ...l, user_name: l.users?.name, user_role: l.users?.role })) });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.use((err, req, res, next) => { console.error(err); res.status(500).json({ success: false, error: 'Internal server error' }); });

async function startServer() {
    await initializeApp();
    app.listen(PORT, () => {
        console.log(`🚀 Server running on: http://localhost:${PORT}`);
    });
}

startServer();