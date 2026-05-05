require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
    console.log(`[${new Date().toLocaleTimeString()}] incoming request: ${req.method} ${req.url}`);
    next();
});

// Health check endpoint for Docker, CI/CD, and AWS EC2
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        message: 'Raabta Backend is running'
    });
});

// --- Database Configuration ---
// Ensure you have SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file
const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key';
const supabase = createClient(supabaseUrl, supabaseKey);

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-raabta-key-change-in-production';

// --- Authentication Middleware ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Access token required' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token' });
        req.user = user;
        next();
    });
};

const authorizeRole = (roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Forbidden: Insufficient privileges' });
        }
        next();
    };
};

// ==========================================
// 1. AUTHENTICATION (Login & Signup)
// ==========================================

// FR3.1.2, FR3.1.4 - User Registration
app.post('/api/auth/signup', async (req, res) => {
    try {
        const { full_name, email, password, role } = req.body;
        
        // Basic validation
        if (!full_name || !email || !password || !role) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Check if user already exists
        const { data: existingUser } = await supabase.from('app_users').select('*').eq('email', email).single();
        if (existingUser) {
            return res.status(409).json({ error: 'Email already in use' });
        }

        // Hash password
        const password_hash = await bcrypt.hash(password, 10);

        // Insert into app_users
        const { data: newUser, error: userError } = await supabase.from('app_users')
            .insert([{ full_name, email, password_hash, role, account_status: 'active' }])
            .select('user_id, email, role')
            .single();

        if (userError) throw userError;

        // Insert into role-specific tables
        if (role === 'customer') {
            await supabase.from('customers').insert([{ customer_id: newUser.user_id, role }]);
        } else if (role === 'supervisor') {
            await supabase.from('supervisors').insert([{ supervisor_id: newUser.user_id, role }]);
        } else if (role === 'admin') {
            await supabase.from('admins').insert([{ admin_id: newUser.user_id, role }]);
        }

        // Generate Token
        const token = jwt.sign({ user_id: newUser.user_id, role: newUser.role }, JWT_SECRET, { expiresIn: '24h' });

        res.status(201).json({ message: 'User created successfully', token, user: newUser });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// FR3.1.2 - User Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const { data: user, error } = await supabase.from('app_users').select('*').eq('email', email).single();
        
        if (error || !user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        if (user.account_status !== 'active') {
            return res.status(403).json({ error: 'Account is suspended or inactive' });
        }

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const token = jwt.sign({ user_id: user.user_id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });

        res.json({ message: 'Login successful', token, user: { id: user.user_id, name: user.full_name, role: user.role } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// ==========================================
// 2. PUBLIC & GUEST ROUTES
// ==========================================

// FR3.2.1 - Get available services (Public)
app.get('/api/services', async (req, res) => {
    try {
        const { data: services, error } = await supabase.from('services').select('*').eq('is_enabled', true);
        if (error) throw error;
        res.json(services);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// FR3.3.1, FR3.3.5 - Track order by ID (Guest tracking)
app.get('/api/orders/track/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        // Strip out 'ORD-' prefix if sent from frontend
        const id = orderId.replace(/\D/g, ''); 

        const { data: order, error } = await supabase
            .from('orders')
            .select(`
                order_id, status, requested_at, service_address,
                services(service_name)
            `)
            .eq('order_id', id)
            .single();

        if (error || !order) return res.status(404).json({ error: 'Order not found' });
        res.json(order);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ==========================================
// 3. CUSTOMER DASHBOARD (Protected)
// ==========================================

// FR3.3.6 - Customer Dashboard Stats
app.get('/api/customer/dashboard', authenticateToken, authorizeRole(['customer']), async (req, res) => {
    try {
        const customerId = req.user.user_id;

        // Fetch user profile
        const { data: profile } = await supabase.from('app_users').select('full_name, email').eq('user_id', customerId).single();

        // Fetch active orders count
        const { count: activeCount } = await supabase.from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('customer_id', customerId)
            .in('status', ['requested', 'assigned', 'in_progress']);

        // Fetch completed orders count
        const { count: completedCount } = await supabase.from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('customer_id', customerId)
            .eq('status', 'completed');

        // Fetch recent active orders for the UI
        const { data: activeOrders } = await supabase.from('orders')
            .select('order_id, status, services(service_name)')
            .eq('customer_id', customerId)
            .in('status', ['requested', 'assigned', 'in_progress'])
            .order('requested_at', { ascending: false })
            .limit(5);

        res.json({
            profile,
            stats: { activeCount, completedCount },
            activeOrders
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// FR3.3.6 - Customer Order History
app.get('/api/customer/orders', authenticateToken, authorizeRole(['customer']), async (req, res) => {
    try {
        const { data: orders, error } = await supabase.from('orders')
            .select(`
                order_id, status, requested_at, scheduled_for,
                services(service_name)
            `)
            .eq('customer_id', req.user.user_id)
            .order('requested_at', { ascending: false });

        if (error) throw error;
        res.json(orders);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// FR3.3.1 - Create a New Order
app.post('/api/orders', authenticateToken, authorizeRole(['customer', 'guest']), async (req, res) => {
    try {
        const { service_id, service_address, notes, scheduled_for } = req.body;
        
        // Use authenticated user ID
        const customer_id = req.user.user_id;

        // --- PLAN LIMIT ENFORCEMENT ---
        if (req.user.role === 'customer') {
            const { data: customerPlan } = await supabase
                .from('customer_plans')
                .select('status')
                .eq('customer_id', customer_id)
                .eq('status', 'active')
                .maybeSingle();

            // If they do NOT have an active premium plan (meaning they are Basic)
            if (!customerPlan) { 
                const startOfMonth = new Date();
                startOfMonth.setDate(1); 
                startOfMonth.setHours(0, 0, 0, 0);

                // Count how many orders they've placed this month
                const { count: ordersThisMonth } = await supabase
                    .from('orders')
                    .select('*', { count: 'exact', head: true })
                    .eq('customer_id', customer_id)
                    .gte('requested_at', startOfMonth.toISOString());

                // Reject if they exceed 1 order
                if (ordersThisMonth >= 1) {
                    return res.status(403).json({ error: 'free limit reached upgrade plan to proceed further' });
                }
            }
        }
        // ------------------------------

        const { data: order, error } = await supabase.from('orders').insert([{
            customer_id,
            service_id,
            service_address,
            notes,
            status: 'requested',
            scheduled_for
        }]).select('order_id').single();

        if (error) throw error;
        res.status(201).json({ message: 'Order created successfully', orderId: `ORD-${order.order_id}` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// FR3.8.1 - Submit Complaint
app.post('/api/complaints', authenticateToken, authorizeRole(['customer']), async (req, res) => {
    try {
        const { order_id, category, title, description } = req.body;
        
        const { data: complaint, error } = await supabase.from('service_cases').insert([{
            case_type: 'complaint',
            customer_id: req.user.user_id,
            order_id: order_id ? order_id.replace(/\D/g, '') : null,
            category,
            title,
            description,
            status: 'open'
        }]).select().single();

        if (error) throw error;
        res.status(201).json({ message: 'Complaint submitted successfully', complaint });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Customer Complaints
app.get('/api/customer/complaints', authenticateToken, authorizeRole(['customer']), async (req, res) => {
    try {
        const { data: complaints, error } = await supabase.from('service_cases')
            .select('case_id, order_id, category, status')
            .eq('customer_id', req.user.user_id)
            .eq('case_type', 'complaint')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(complaints);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// FR3.3.7 - Customer Plan Details & Usage
app.get('/api/customer/plan', authenticateToken, authorizeRole(['customer']), async (req, res) => {
    try {
        const customerId = req.user.user_id;

        // 1. Try to fetch an active subscription plan
        const { data: customerPlan } = await supabase
            .from('customer_plans')
            .select(`
                start_date, end_date, status,
                service_plans (plan_name, price_estimate, description)
            `)
            .eq('customer_id', customerId)
            .eq('status', 'active')
            .maybeSingle();

        // Default to 'Basic' if they don't have an active premium subscription
        let planData = { 
            name: 'Basic', 
            price: 'Free first order, then $19/request', 
            usage: 0, 
            limit: 1 
        };

        if (customerPlan && customerPlan.service_plans) {
            planData.name = customerPlan.service_plans.plan_name || 'Premium';
            planData.price = `$${customerPlan.service_plans.price_estimate} / month`;
            planData.limit = 10; // Premium limit for UI purposes
        }

        // 2. Calculate how many orders they've placed this month
        const startOfMonth = new Date();
        startOfMonth.setDate(1); 
        startOfMonth.setHours(0, 0, 0, 0);

        const { count: ordersThisMonth } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('customer_id', customerId)
            .gte('requested_at', startOfMonth.toISOString());

        planData.usage = ordersThisMonth || 0;

        res.json(planData);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ==========================================
// 4. SUPERVISOR DASHBOARD (Protected)
// ==========================================

// FR3.4.1, FR3.4.6 - View Orders for Supervisor
app.get('/api/supervisor/orders', authenticateToken, authorizeRole(['supervisor', 'admin']), async (req, res) => {
    try {
        // 1. Fetch orders and services (safe join)
        const { data: orders, error } = await supabase.from('orders')
            .select(`
                order_id, status, requested_at, service_address, customer_id,
                services(service_name)
            `)
            .order('requested_at', { ascending: false });

        if (error) throw error;

        // 2. Safely fetch customer names manually to prevent Foreign Key crashes
        if (orders && orders.length > 0) {
            const customerIds = [...new Set(orders.map(o => o.customer_id))];
            
            const { data: users } = await supabase.from('app_users')
                .select('user_id, full_name')
                .in('user_id', customerIds);
            
            orders.forEach(order => {
                const user = users?.find(u => u.user_id === order.customer_id);
                // Attach to order object so app.js can read it exactly as expected
                order.app_users = { full_name: user ? user.full_name : 'Unknown Customer' }; 
            });
        }

        res.json(orders);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// FR3.4.5 - View Providers
app.get('/api/supervisor/providers', authenticateToken, authorizeRole(['supervisor', 'admin']), async (req, res) => {
    try {
        const { data: providers, error } = await supabase.from('service_providers')
            .select('*')
            .eq('is_active', true);
            
        if (error) throw error;
        res.json(providers);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// FR3.4.3 - Assign Order
app.post('/api/supervisor/assign', authenticateToken, authorizeRole(['supervisor', 'admin']), async (req, res) => {
    try {
        const { order_id, provider_id, provider_response } = req.body;
        const supervisor_id = req.user.user_id;

        // 1. Create Assignment Record
        const { error: assignError } = await supabase.from('order_assignments').insert([{
            order_id, provider_id, supervisor_id, provider_response, is_active: true
        }]);

        if (assignError) throw assignError;

        // 2. Update Order Status
        const { error: updateError } = await supabase.from('orders')
            .update({ status: 'assigned' })
            .eq('order_id', order_id);

        if (updateError) throw updateError;

        res.json({ message: 'Order assigned successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// FR3.4.4 - Update Order Status
app.post('/api/supervisor/status', authenticateToken, authorizeRole(['supervisor', 'admin']), async (req, res) => {
    try {
        const { order_id, new_status, remarks } = req.body;
        const supervisor_id = req.user.user_id;

        // Get old status
        const { data: order } = await supabase.from('orders').select('status').eq('order_id', order_id).single();

        // Update orders table
        const { error: updateError } = await supabase.from('orders')
            .update({ status: new_status })
            .eq('order_id', order_id);

        if (updateError) throw updateError;

        // Log history
        await supabase.from('order_status_history').insert([{
            order_id,
            updated_by_supervisor_id: supervisor_id,
            old_status: order.status,
            new_status,
            remarks
        }]);

        res.json({ message: 'Status updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// FR3.4.6 - View Recent Assignments for Supervisor
app.get('/api/supervisor/assignments', authenticateToken, authorizeRole(['supervisor', 'admin']), async (req, res) => {
    try {
        const { data: assignments, error } = await supabase.from('order_assignments')
            .select(`
                assignment_id, assigned_at, provider_response,
                orders(order_id, status, services(service_name)),
                service_providers(provider_name)
            `)
            .eq('supervisor_id', req.user.user_id)
            .order('assigned_at', { ascending: false })
            .limit(10); // Fetch top 10 most recent

        if (error) throw error;
        res.json(assignments);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// FR3.4.5 - Add a New Provider
app.post('/api/supervisor/providers', authenticateToken, authorizeRole(['supervisor', 'admin']), async (req, res) => {
    try {
        const { provider_name, phone, whatsapp_no, service_area } = req.body;
        
        const { data: provider, error } = await supabase.from('service_providers').insert([{
            provider_name,
            phone,
            whatsapp_no,
            service_area,
            availability_status: 'available',
            is_active: true,
            primary_supervisor_id: req.user.user_id 
        }]).select().single();

        if (error) throw error;
        res.status(201).json({ message: 'Provider added successfully', provider });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// FR3.4.5 - Update an Existing Provider
app.patch('/api/supervisor/providers/:id', authenticateToken, authorizeRole(['supervisor', 'admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { provider_name, phone, whatsapp_no, service_area, availability_status } = req.body;

        const { data: provider, error } = await supabase.from('service_providers')
            .update({ provider_name, phone, whatsapp_no, service_area, availability_status })
            .eq('provider_id', id)
            .select().single();

        if (error) throw error;
        res.json({ message: 'Provider updated successfully', provider });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// 5. ADMIN DASHBOARD (Protected)
// ==========================================

// FR3.5.1, FR3.5.2 - Admin Analytics Dashboard
// FR3.5.1, FR3.5.2 - Admin Analytics Dashboard
app.get('/api/admin/dashboard', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        // Fetch all the raw data we need to construct the charts
        const [
            { data: allOrders }, // Fetch all statuses and service IDs
            { count: activeUsers },
            { count: totalProviders },
            { data: servicesData }
        ] = await Promise.all([
            supabase.from('orders').select('status, service_id'),
            supabase.from('app_users').select('*', { count: 'exact', head: true }).eq('account_status', 'active'),
            supabase.from('service_providers').select('*', { count: 'exact', head: true }),
            supabase.from('services').select('service_id, service_name')
        ]);

        const totalOrders = allOrders ? allOrders.length : 0;
        
        // Setup counting dictionaries
        const statusCounts = { completed: 0, in_progress: 0, requested: 0, assigned: 0, cancelled: 0 };
        const serviceCounts = {};

        // Aggregate the data
        if (allOrders) {
            allOrders.forEach(o => {
                if (statusCounts[o.status] !== undefined) {
                    statusCounts[o.status]++;
                } else {
                    statusCounts[o.status] = 1;
                }
                
                serviceCounts[o.service_id] = (serviceCounts[o.service_id] || 0) + 1;
            });
        }

        // Format: Order Status Breakdown (Combine Requested/Assigned into 'Pending' for UI)
        const pendingCount = (statusCounts.requested || 0) + (statusCounts.assigned || 0);
        const orderStatusBreakdown = [
            { label: 'Completed', count: statusCounts.completed || 0 },
            { label: 'In Progress', count: statusCounts.in_progress || 0 },
            { label: 'Pending', count: pendingCount },
            { label: 'Cancelled', count: statusCounts.cancelled || 0 }
        ];

        // Format: Orders by Service (Map service IDs to actual names)
        const ordersByService = (servicesData || []).map(s => ({
            name: s.service_name,
            count: serviceCounts[s.service_id] || 0
        })).sort((a, b) => b.count - a.count); // Sort highest to lowest

        res.json({
            analytics: {
                totalOrders,
                activeUsers,
                totalProviders,
                revenueEstimate: "2.4M" // Static placeholder for now
            },
            ordersByService,
            orderStatusBreakdown
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// FR3.1.5 - Get All Users (Admin)
app.get('/api/admin/users', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const { data: users, error } = await supabase.from('app_users')
            .select('user_id, full_name, email, role, account_status, created_at')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// FR3.2.1 - Get All Services (Admin View with Order Counts)
app.get('/api/admin/services', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        // Fetch all services
        const { data: services, error: svcError } = await supabase.from('services').select('*');
        if (svcError) throw svcError;

        // Fetch all orders to count them
        const { data: orders, error: ordError } = await supabase.from('orders').select('service_id');
        if (ordError) throw ordError;

        // Calculate order counts per service
        const orderCounts = {};
        orders.forEach(o => { 
            orderCounts[o.service_id] = (orderCounts[o.service_id] || 0) + 1; 
        });

        // Merge the counts into the services array and sort by most popular
        const formattedServices = services.map(s => ({ 
            ...s, 
            order_count: orderCounts[s.service_id] || 0 
        }));
        formattedServices.sort((a, b) => b.order_count - a.order_count);

        res.json(formattedServices);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// FR3.2.4 - Edit Service Name
app.patch('/api/admin/services/:id/name', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { service_name } = req.body;
        
        const { error } = await supabase.from('services')
            .update({ service_name })
            .eq('service_id', id);
            
        if (error) throw error;
        res.json({ message: 'Service renamed successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// FR3.2.2 - Add New Service
app.post('/api/admin/services', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const { service_name, category, description, base_price_estimate } = req.body;

        const { data: service, error } = await supabase.from('services').insert([{
            service_name, category, description, base_price_estimate, is_enabled: true
        }]).select().single();

        if (error) throw error;
        res.status(201).json({ message: 'Service added', service });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// FR3.2.3 - Toggle Service Status
app.patch('/api/admin/services/:id/toggle', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { is_enabled } = req.body;

        const { error } = await supabase.from('services')
            .update({ is_enabled })
            .eq('service_id', id);

        if (error) throw error;
        res.json({ message: `Service ${is_enabled ? 'enabled' : 'disabled'} successfully` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// FR3.5.3 - Admin Activity Logs
app.get('/api/admin/logs', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        // 1. Fetch recent data from multiple tables safely
        const { data: orders } = await supabase.from('orders').select('order_id, requested_at, customer_id, service_id').order('requested_at', { ascending: false }).limit(15);
        const { data: history } = await supabase.from('order_status_history').select('order_id, updated_at, new_status, updated_by_supervisor_id').order('updated_at', { ascending: false }).limit(15);
        const { data: assignments } = await supabase.from('order_assignments').select('order_id, assigned_at, supervisor_id, provider_id').order('assigned_at', { ascending: false }).limit(15);

        // 2. Fetch related names manually to prevent strict Foreign Key crashes
        const userIds = new Set([
            ...(orders?.map(o => o.customer_id) || []),
            ...(history?.map(h => h.updated_by_supervisor_id) || []),
            ...(assignments?.map(a => a.supervisor_id) || [])
        ]);
        const serviceIds = new Set(orders?.map(o => o.service_id) || []);
        const providerIds = new Set(assignments?.map(a => a.provider_id) || []);

        const { data: users } = await supabase.from('app_users').select('user_id, full_name, role').in('user_id', Array.from(userIds));
        const { data: services } = await supabase.from('services').select('service_id, service_name').in('service_id', Array.from(serviceIds));
        const { data: providers } = await supabase.from('service_providers').select('provider_id, provider_name').in('provider_id', Array.from(providerIds));

        // 3. Format into a unified log array
        let logs = [];

        (orders || []).forEach(o => {
            const user = users?.find(u => u.user_id === o.customer_id);
            const svc = services?.find(s => s.service_id === o.service_id);
            logs.push({
                timestamp: o.requested_at,
                event: 'Order Created',
                actor: user ? user.full_name : 'Customer',
                details: `#ORD-${o.order_id} — ${svc ? svc.service_name : 'Service'}`
            });
        });

        (history || []).forEach(h => {
            const user = users?.find(u => u.user_id === h.updated_by_supervisor_id);
            const statusStr = h.new_status ? h.new_status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Updated';
            let eventType = h.new_status === 'completed' ? 'Order Completed' : 'Status Updated';
            
            logs.push({
                timestamp: h.updated_at,
                event: eventType,
                actor: user ? `${user.full_name} (${user.role.charAt(0).toUpperCase() + user.role.slice(1)})` : 'System',
                details: h.new_status === 'completed' ? `#ORD-${h.order_id} marked Completed` : `#ORD-${h.order_id} → ${statusStr}`
            });
        });

        (assignments || []).forEach(a => {
            const user = users?.find(u => u.user_id === a.supervisor_id);
            const prov = providers?.find(p => p.provider_id === a.provider_id);
            logs.push({
                timestamp: a.assigned_at,
                event: 'Order Assigned',
                actor: user ? `${user.full_name} (${user.role.charAt(0).toUpperCase() + user.role.slice(1)})` : 'Supervisor',
                details: `#ORD-${a.order_id} → ${prov ? prov.provider_name : 'Provider'}`
            });
        });

        // 4. Sort everything by timestamp descending (newest first)
        logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        res.json(logs.slice(0, 40)); // Send the top 40 most recent events
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// FR3.8 - Admin View Complaints
app.get('/api/admin/complaints', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        // 1. Fetch complaints
        const { data: complaints, error } = await supabase.from('service_cases')
            .select('*')
            .eq('case_type', 'complaint')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // 2. Safely fetch customer names manually
        if (complaints && complaints.length > 0) {
            const customerIds = [...new Set(complaints.map(c => c.customer_id).filter(Boolean))];
            
            if (customerIds.length > 0) {
                const { data: users } = await supabase.from('app_users')
                    .select('user_id, full_name')
                    .in('user_id', customerIds);
                
                complaints.forEach(c => {
                    const user = users?.find(u => u.user_id === c.customer_id);
                    c.customer_name = user ? user.full_name : 'Unknown Customer';
                });
            }
        }

        res.json(complaints || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// FR3.8 - Admin Resolve Complaint
app.patch('/api/admin/complaints/:id/resolve', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        
        const { error } = await supabase.from('service_cases')
            .update({ 
                status: 'resolved', 
                handled_by_admin_id: req.user.user_id,
                resolved_at: new Date().toISOString()
            })
            .eq('case_id', id);

        if (error) throw error;
        res.json({ message: 'Complaint resolved successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Server Startup ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Raabta Backend running on http://localhost:${PORT}`);
    console.log(`Ensure you have created a .env file with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY`);
});