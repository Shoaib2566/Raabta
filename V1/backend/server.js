// =============================================================================
// server.js — Raabta Backend
// Express REST API with Supabase, JWT Authentication, and Role-Based Access
// =============================================================================

require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');


// =============================================================================
// App Initialisation
// =============================================================================

const app = express();

app.use(cors());
app.use(express.json());

// Request logger middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
    next();
});


// =============================================================================
// Database & Environment Configuration
// =============================================================================

// Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your .env file
const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key';
const supabase    = createClient(supabaseUrl, supabaseKey);

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-raabta-key-change-in-production';


// =============================================================================
// Middleware — Authentication & Authorisation
// =============================================================================

/**
 * Verifies the JWT Bearer token in the Authorization header.
 * Attaches the decoded user payload to req.user on success.
 */
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

/**
 * Restricts access to users whose role is included in the provided roles array.
 * Must be used after authenticateToken.
 * @param {string[]} roles - Allowed roles (e.g. ['admin', 'supervisor'])
 */
const authorizeRole = (roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Forbidden: Insufficient privileges' });
        }
        next();
    };
};


// =============================================================================
// Health Check
// =============================================================================

// Health check endpoint for Docker, CI/CD, and AWS EC2
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        message: 'Raabta Backend is running'
    });
});


// =============================================================================
// Section 1 — Authentication (Login & Signup)
// =============================================================================

// FR3.1.2, FR3.1.4 — User Registration
app.post('/api/auth/signup', async (req, res) => {
    try {
        let { full_name, email, password, role } = req.body;

        // Basic validation
        if (!full_name || !email || !password || !role) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // FIX: Clean the email to prevent invisible space & uppercase errors
        email = email.trim().toLowerCase();

        // FIX: Use maybeSingle() to prevent server crashes if the user doesn't exist yet
        const { data: existingUser } = await supabase
            .from('app_users')
            .select('*')
            .eq('email', email)
            .maybeSingle();

        if (existingUser) {
            return res.status(409).json({ error: 'Email already in use' });
        }

        // Hash the password before storing
        const password_hash = await bcrypt.hash(password, 10);

        // Insert the new user into app_users
        const { data: newUser, error: userError } = await supabase
            .from('app_users')
            .insert([{ full_name, email, password_hash, role, account_status: 'active' }])
            .select('user_id, email, role')
            .single();

        if (userError) throw userError;

        // Insert into the appropriate role-specific table
        if (role === 'customer') {
            await supabase.from('customers').insert([{ customer_id: newUser.user_id, role }]);
        } else if (role === 'supervisor') {
            await supabase.from('supervisors').insert([{ supervisor_id: newUser.user_id, role }]);
        } else if (role === 'admin') {
            await supabase.from('admins').insert([{ admin_id: newUser.user_id, role }]);
        }

        // Issue a JWT for the new user
        const token = jwt.sign(
            { user_id: newUser.user_id, role: newUser.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(201).json({ message: 'User created successfully', token, user: newUser });
    } catch (err) {
        console.error("Signup Error:", err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// FR3.1.2 — User Login
app.post('/api/auth/login', async (req, res) => {
    try {
        let { email, password } = req.body;

        // FIX: Clean the email before checking the database
        email = email.trim().toLowerCase();

        // FIX: Use maybeSingle() to safely handle unregistered emails
        const { data: user, error } = await supabase
            .from('app_users')
            .select('*')
            .eq('email', email)
            .maybeSingle();

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

        const token = jwt.sign(
            { user_id: user.user_id, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Login successful',
            token,
            user: { id: user.user_id, name: user.full_name, role: user.role }
        });
    } catch (err) {
        console.error("Login Error:", err);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// =============================================================================
// Section 2 — Public & Guest Routes
// =============================================================================

// FR3.2.1 — Get available services (public, no auth required)
app.get('/api/services', async (req, res) => {
    try {
        const { data: services, error } = await supabase
            .from('services')
            .select('*')
            .eq('is_enabled', true);

        if (error) throw error;
        res.json(services);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// FR3.3.1, FR3.3.5 — Track an order by ID (guest tracking, no auth required)
app.get('/api/orders/track/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        // Strip the 'ORD-' prefix if sent from the frontend
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


// =============================================================================
// Section 3 — Customer Dashboard (Protected)
// =============================================================================

// FR3.3.6 — Customer dashboard stats
app.get('/api/customer/dashboard', authenticateToken, authorizeRole(['customer']), async (req, res) => {
    try {
        const customerId = req.user.user_id;

        // Fetch the customer's profile
        const { data: profile } = await supabase
            .from('app_users')
            .select('full_name, email')
            .eq('user_id', customerId)
            .single();

        // Count active orders
        const { count: activeCount } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('customer_id', customerId)
            .in('status', ['requested', 'assigned', 'in_progress']);

        // Count completed orders
        const { count: completedCount } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('customer_id', customerId)
            .eq('status', 'completed');

        // Fetch the 5 most recent active orders for the UI
        const { data: activeOrders } = await supabase
            .from('orders')
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

// FR3.3.6 — Customer order history
app.get('/api/customer/orders', authenticateToken, authorizeRole(['customer']), async (req, res) => {
    try {
        const { data: orders, error } = await supabase
            .from('orders')
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

// FR3.3.1 — Create a new order
app.post('/api/orders', authenticateToken, authorizeRole(['customer', 'guest']), async (req, res) => {
    try {
        const { service_id, service_address, notes, scheduled_for } = req.body;
        const customer_id = req.user.user_id;

        // --- Plan Limit Enforcement ---
        if (req.user.role === 'customer') {
            const { data: customerPlan } = await supabase
                .from('customer_plans')
                .select('status')
                .eq('customer_id', customer_id)
                .eq('status', 'active')
                .maybeSingle();

            // Enforce 1-order monthly limit for Basic (non-premium) customers
            if (!customerPlan) {
                const startOfMonth = new Date();
                startOfMonth.setDate(1);
                startOfMonth.setHours(0, 0, 0, 0);

                const { count: ordersThisMonth } = await supabase
                    .from('orders')
                    .select('*', { count: 'exact', head: true })
                    .eq('customer_id', customer_id)
                    .gte('requested_at', startOfMonth.toISOString());

                if (ordersThisMonth >= 1) {
                    return res.status(403).json({ error: 'Free limit reached. Upgrade your plan to continue.' });
                }
            }
        }
        // ------------------------------

        const { data: order, error } = await supabase
            .from('orders')
            .insert([{ customer_id, service_id, service_address, notes, status: 'requested', scheduled_for }])
            .select('order_id')
            .single();

        if (error) throw error;
        res.status(201).json({ message: 'Order created successfully', orderId: `ORD-${order.order_id}` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// FR3.8.1 — Submit a complaint
app.post('/api/complaints', authenticateToken, authorizeRole(['customer']), async (req, res) => {
    try {
        const { order_id, category, title, description } = req.body;

        const { data: complaint, error } = await supabase
            .from('service_cases')
            .insert([{
                case_type: 'complaint',
                customer_id: req.user.user_id,
                order_id: order_id ? order_id.replace(/\D/g, '') : null,
                category,
                title,
                description,
                status: 'open'
            }])
            .select()
            .single();

        if (error) throw error;
        res.status(201).json({ message: 'Complaint submitted successfully', complaint });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// FR3.8 — Get complaints submitted by the authenticated customer
app.get('/api/customer/complaints', authenticateToken, authorizeRole(['customer']), async (req, res) => {
    try {
        const { data: complaints, error } = await supabase
            .from('service_cases')
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

// FR3.3.7 — Customer plan details and monthly usage
app.get('/api/customer/plan', authenticateToken, authorizeRole(['customer']), async (req, res) => {
    try {
        const customerId = req.user.user_id;

        // Attempt to fetch an active premium subscription
        const { data: customerPlan } = await supabase
            .from('customer_plans')
            .select(`
                start_date, end_date, status,
                service_plans (plan_name, price_estimate, description)
            `)
            .eq('customer_id', customerId)
            .eq('status', 'active')
            .maybeSingle();

        // Default to the Basic plan if no active premium subscription exists
        let planData = {
            name: 'Basic',
            price: 'Free first order, then $19/request',
            usage: 0,
            limit: 1
        };

        if (customerPlan && customerPlan.service_plans) {
            planData.name  = customerPlan.service_plans.plan_name || 'Premium';
            planData.price = `$${customerPlan.service_plans.price_estimate} / month`;
            planData.limit = 10; // Premium monthly limit
        }

        // Count orders placed in the current calendar month
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


// =============================================================================
// Section 4 — Supervisor Dashboard (Protected)
// =============================================================================

// FR3.4.1, FR3.4.6 — View all orders (supervisor/admin)
app.get('/api/supervisor/orders', authenticateToken, authorizeRole(['supervisor', 'admin']), async (req, res) => {
    try {
        // Fetch orders with service info
        const { data: orders, error } = await supabase
            .from('orders')
            .select(`
                order_id, status, requested_at, service_address, customer_id,
                services(service_name)
            `)
            .order('requested_at', { ascending: false });

        if (error) throw error;

        // Safely fetch customer names to avoid FK join crashes
        if (orders && orders.length > 0) {
            const customerIds = [...new Set(orders.map(o => o.customer_id))];

            const { data: users } = await supabase
                .from('app_users')
                .select('user_id, full_name')
                .in('user_id', customerIds);

            orders.forEach(order => {
                const user = users?.find(u => u.user_id === order.customer_id);
                // Attach in the shape that the frontend expects
                order.app_users = { full_name: user ? user.full_name : 'Unknown Customer' };
            });
        }

        res.json(orders);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// FR3.4.5 — View active service providers
app.get('/api/supervisor/providers', authenticateToken, authorizeRole(['supervisor', 'admin']), async (req, res) => {
    try {
        const { data: providers, error } = await supabase
            .from('service_providers')
            .select('*')
            .eq('is_active', true);

        if (error) throw error;
        res.json(providers);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// FR3.4.3 — Assign an order to a service provider
app.post('/api/supervisor/assign', authenticateToken, authorizeRole(['supervisor', 'admin']), async (req, res) => {
    try {
        const { order_id, provider_id, provider_response } = req.body;
        const supervisor_id = req.user.user_id;

        // Create the assignment record
        const { error: assignError } = await supabase
            .from('order_assignments')
            .insert([{ order_id, provider_id, supervisor_id, provider_response, is_active: true }]);

        if (assignError) throw assignError;

        // Update the order status to 'assigned'
        const { error: updateError } = await supabase
            .from('orders')
            .update({ status: 'assigned' })
            .eq('order_id', order_id);

        if (updateError) throw updateError;

        res.json({ message: 'Order assigned successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// FR3.4.4 — Update the status of an order
app.post('/api/supervisor/status', authenticateToken, authorizeRole(['supervisor', 'admin']), async (req, res) => {
    try {
        const { order_id, new_status, remarks } = req.body;
        const supervisor_id = req.user.user_id;

        // Capture the existing status before overwriting
        const { data: order } = await supabase
            .from('orders')
            .select('status')
            .eq('order_id', order_id)
            .single();

        // Update the order status
        const { error: updateError } = await supabase
            .from('orders')
            .update({ status: new_status })
            .eq('order_id', order_id);

        if (updateError) throw updateError;

        // Append a record to the status history log
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

// FR3.4.6 — View recent assignments for the authenticated supervisor
app.get('/api/supervisor/assignments', authenticateToken, authorizeRole(['supervisor', 'admin']), async (req, res) => {
    try {
        const { data: assignments, error } = await supabase
            .from('order_assignments')
            .select(`
                assignment_id, assigned_at, provider_response,
                orders(order_id, status, services(service_name)),
                service_providers(provider_name)
            `)
            .eq('supervisor_id', req.user.user_id)
            .order('assigned_at', { ascending: false })
            .limit(10);

        if (error) throw error;
        res.json(assignments);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// FR3.4.5 — Add a new service provider
app.post('/api/supervisor/providers', authenticateToken, authorizeRole(['supervisor', 'admin']), async (req, res) => {
    try {
        const { provider_name, phone, whatsapp_no, service_area } = req.body;

        const { data: provider, error } = await supabase
            .from('service_providers')
            .insert([{
                provider_name,
                phone,
                whatsapp_no,
                service_area,
                availability_status: 'available',
                is_active: true,
                primary_supervisor_id: req.user.user_id
            }])
            .select()
            .single();

        if (error) throw error;
        res.status(201).json({ message: 'Provider added successfully', provider });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// FR3.4.5 — Update an existing service provider
app.patch('/api/supervisor/providers/:id', authenticateToken, authorizeRole(['supervisor', 'admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { provider_name, phone, whatsapp_no, service_area, availability_status } = req.body;

        const { data: provider, error } = await supabase
            .from('service_providers')
            .update({ provider_name, phone, whatsapp_no, service_area, availability_status })
            .eq('provider_id', id)
            .select()
            .single();

        if (error) throw error;
        res.json({ message: 'Provider updated successfully', provider });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// FR3.4 — Supervisor notifications (unassigned orders + newly assigned providers)
app.get('/api/supervisor/notifications', authenticateToken, authorizeRole(['supervisor', 'admin']), async (req, res) => {
    try {
        const supervisor_id = req.user.user_id;
        let notifications = [];

        // 1. Unassigned orders awaiting assignment
        const { data: requestedOrders } = await supabase
            .from('orders')
            .select('order_id, requested_at, services(service_name)')
            .eq('status', 'requested')
            .order('requested_at', { ascending: false })
            .limit(5);

        (requestedOrders || []).forEach(o => {
            notifications.push({
                title: 'New Order Request',
                message: `Order #ORD-${o.order_id} for ${o.services?.service_name || 'a service'} is awaiting assignment.`,
                time: o.requested_at,
                iconClass: 'b-amber',
                icon: '📦'
            });
        });

        // 2. Providers recently assigned to this supervisor by an admin
        const { data: newProviders } = await supabase
            .from('service_providers')
            .select('provider_id, provider_name, created_at, service_area')
            .eq('primary_supervisor_id', supervisor_id)
            .order('created_at', { ascending: false })
            .limit(5);

        (newProviders || []).forEach(p => {
            notifications.push({
                title: 'New Provider Assigned',
                message: `Admin added ${p.provider_name} (${p.service_area || 'General'}) to your directory.`,
                time: p.created_at,
                iconClass: 'b-green',
                icon: '👤'
            });
        });

        // Sort by most recent first, return top 8
        notifications.sort((a, b) => new Date(b.time) - new Date(a.time));
        res.json(notifications.slice(0, 8));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// =============================================================================
// Section 5 — Admin Dashboard (Protected)
// =============================================================================

// FR3.5.1, FR3.5.2 — Admin analytics dashboard
app.get('/api/admin/dashboard', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        // Fetch all raw data in parallel
        const [
            { data: allOrders },
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

        // Aggregate counts by status and by service
        const statusCounts  = { completed: 0, in_progress: 0, requested: 0, assigned: 0, cancelled: 0 };
        const serviceCounts = {};

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

        // Combine 'requested' and 'assigned' into a single 'Pending' bucket for the UI
        const pendingCount = (statusCounts.requested || 0) + (statusCounts.assigned || 0);
        const orderStatusBreakdown = [
            { label: 'Completed',   count: statusCounts.completed   || 0 },
            { label: 'In Progress', count: statusCounts.in_progress || 0 },
            { label: 'Pending',     count: pendingCount },
            { label: 'Cancelled',   count: statusCounts.cancelled   || 0 }
        ];

        // Map service IDs to names and sort highest to lowest
        const ordersByService = (servicesData || [])
            .map(s => ({ name: s.service_name, count: serviceCounts[s.service_id] || 0 }))
            .sort((a, b) => b.count - a.count);

        res.json({
            analytics: {
                totalOrders,
                activeUsers,
                totalProviders,
                revenueEstimate: '2.4M' // Static placeholder
            },
            ordersByService,
            orderStatusBreakdown
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// FR3.1.5 — Get all users (admin)
app.get('/api/admin/users', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const { data: users, error } = await supabase
            .from('app_users')
            .select('user_id, full_name, email, role, account_status, created_at')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// FR3.1.5 — Update a user's details (admin)
app.patch('/api/admin/users/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { full_name, email, role, account_status } = req.body;

        // Note: changing a user's role typically requires additional logic
        // to sync role-specific tables; this updates the core record only.
        const { error } = await supabase
            .from('app_users')
            .update({ full_name, email, role, account_status })
            .eq('user_id', id);

        if (error) throw error;
        res.json({ message: 'User updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// FR3.2.1 — Get all services with order counts (admin)
app.get('/api/admin/services', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const { data: services, error: svcError } = await supabase.from('services').select('*');
        if (svcError) throw svcError;

        const { data: orders, error: ordError } = await supabase.from('orders').select('service_id');
        if (ordError) throw ordError;

        // Build a per-service order count map
        const orderCounts = {};
        orders.forEach(o => {
            orderCounts[o.service_id] = (orderCounts[o.service_id] || 0) + 1;
        });

        // Merge counts into service objects and sort by popularity
        const formattedServices = services
            .map(s => ({ ...s, order_count: orderCounts[s.service_id] || 0 }))
            .sort((a, b) => b.order_count - a.order_count);

        res.json(formattedServices);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// FR3.2.4 — Edit full service data (admin)
app.patch('/api/admin/services/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { service_name, category, description } = req.body;

        const { error } = await supabase
            .from('services')
            .update({ service_name, category, description })
            .eq('service_id', id);

        if (error) throw error;
        res.json({ message: 'Service updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// FR3.2.2 — Add a new service (admin)
app.post('/api/admin/services', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const { service_name, category, description, base_price_estimate } = req.body;

        const { data: service, error } = await supabase
            .from('services')
            .insert([{ service_name, category, description, base_price_estimate, is_enabled: true }])
            .select()
            .single();

        if (error) throw error;
        res.status(201).json({ message: 'Service added', service });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// FR3.2.3 — Toggle a service's enabled/disabled status (admin)
app.patch('/api/admin/services/:id/toggle', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { is_enabled } = req.body;

        const { error } = await supabase
            .from('services')
            .update({ is_enabled })
            .eq('service_id', id);

        if (error) throw error;
        res.json({ message: `Service ${is_enabled ? 'enabled' : 'disabled'} successfully` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// FR3.5.3 — Admin activity logs (aggregated from orders, status history, and assignments)
app.get('/api/admin/logs', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        // 1. Fetch recent records from the relevant tables
        const { data: orders }      = await supabase.from('orders').select('order_id, requested_at, customer_id, service_id').order('requested_at', { ascending: false }).limit(15);
        const { data: history }     = await supabase.from('order_status_history').select('order_id, updated_at, new_status, updated_by_supervisor_id').order('updated_at', { ascending: false }).limit(15);
        const { data: assignments } = await supabase.from('order_assignments').select('order_id, assigned_at, supervisor_id, provider_id').order('assigned_at', { ascending: false }).limit(15);

        // 2. Collect all referenced IDs so we can look up names in one query each
        const userIds = new Set([
            ...(orders?.map(o => o.customer_id) || []),
            ...(history?.map(h => h.updated_by_supervisor_id) || []),
            ...(assignments?.map(a => a.supervisor_id) || [])
        ]);
        const serviceIds  = new Set(orders?.map(o => o.service_id) || []);
        const providerIds = new Set(assignments?.map(a => a.provider_id) || []);

        const { data: users }     = await supabase.from('app_users').select('user_id, full_name, role').in('user_id', Array.from(userIds));
        const { data: services }  = await supabase.from('services').select('service_id, service_name').in('service_id', Array.from(serviceIds));
        const { data: providers } = await supabase.from('service_providers').select('provider_id, provider_name').in('provider_id', Array.from(providerIds));

        // 3. Build a unified log array from all three sources
        let logs = [];

        (orders || []).forEach(o => {
            const user = users?.find(u => u.user_id === o.customer_id);
            const svc  = services?.find(s => s.service_id === o.service_id);
            logs.push({
                timestamp: o.requested_at,
                event:     'Order Created',
                actor:     user ? user.full_name : 'Customer',
                details:   `#ORD-${o.order_id} — ${svc ? svc.service_name : 'Service'}`
            });
        });

        (history || []).forEach(h => {
            const user      = users?.find(u => u.user_id === h.updated_by_supervisor_id);
            const statusStr = h.new_status
                ? h.new_status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
                : 'Updated';
            const eventType = h.new_status === 'completed' ? 'Order Completed' : 'Status Updated';

            logs.push({
                timestamp: h.updated_at,
                event:     eventType,
                actor:     user
                    ? `${user.full_name} (${user.role.charAt(0).toUpperCase() + user.role.slice(1)})`
                    : 'System',
                details: h.new_status === 'completed'
                    ? `#ORD-${h.order_id} marked Completed`
                    : `#ORD-${h.order_id} → ${statusStr}`
            });
        });

        (assignments || []).forEach(a => {
            const user = users?.find(u => u.user_id === a.supervisor_id);
            const prov = providers?.find(p => p.provider_id === a.provider_id);
            logs.push({
                timestamp: a.assigned_at,
                event:     'Order Assigned',
                actor:     user
                    ? `${user.full_name} (${user.role.charAt(0).toUpperCase() + user.role.slice(1)})`
                    : 'Supervisor',
                details: `#ORD-${a.order_id} → ${prov ? prov.provider_name : 'Provider'}`
            });
        });

        // 4. Sort by timestamp descending and return the top 40 events
        logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        res.json(logs.slice(0, 40));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// FR3.8 — View all complaints (admin)
app.get('/api/admin/complaints', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        // Fetch all complaints
        const { data: complaints, error } = await supabase
            .from('service_cases')
            .select('*')
            .eq('case_type', 'complaint')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Safely attach customer names to each complaint record
        if (complaints && complaints.length > 0) {
            const customerIds = [...new Set(complaints.map(c => c.customer_id).filter(Boolean))];

            if (customerIds.length > 0) {
                const { data: users } = await supabase
                    .from('app_users')
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

// FR3.8 — Resolve a complaint (admin)
app.patch('/api/admin/complaints/:id/resolve', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from('service_cases')
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


// =============================================================================
// Server Startup
// =============================================================================

const PORT = process.env.PORT || 5000;

if (require.main === module) {
    app.listen(PORT, "0.0.0.0", () => {
        console.log(`🚀 Raabta Backend running on http://localhost:${PORT}`);
        console.log(`   Make sure your .env has SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set.`);
    });
}

module.exports = app;
