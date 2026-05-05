// Raabta frontend interactions - FULLY CONNECTED TO BACKEND
(function(){
'use strict';
const API_BASE_URL = window.API_BASE_URL || 'http://localhost:5000/api';
const pageIds=['pg-home','pg-auth','pg-customer','pg-admin','pg-supervisor'];
const byId=id=>document.getElementById(id);
const nativeScroll=window.scrollTo.bind(window);

// --- UI Navigation Helpers ---
window.setPB=function(btn){document.querySelectorAll('.pb-btn').forEach(b=>b.classList.remove('cur')); if(btn)btn.classList.add('cur');};
window.setPBByPage=function(id){const map={'pg-home':0,'pg-auth':1,'pg- customer':2,'pg-admin':3,'pg-supervisor':4}; const btns=document.querySelectorAll('.pb-btn'); btns.forEach(b=>b.classList.remove('cur')); if(map[id]!==undefined&&btns[map[id]])btns[map[id]].classList.add('cur');};
window.goPage=function(id){pageIds.forEach(pid=>{const p=byId(pid); if(p)p.classList.toggle('active',pid===id)});setPBByPage(id);nativeScroll({top:0,left:0,behavior:'auto'});};
window.scrollToSection=function(id){goPage('pg-home');setTimeout(()=>{const el=byId(id); if(el)el.scrollIntoView({behavior:'smooth',block:'start'});},80);};
window.scrollTo=function(arg){if(typeof arg==='string')return scrollToSection(arg); return nativeScroll(arg);};
window.authTab=function(mode,btn){document.querySelectorAll('.auth-tab').forEach(b=>b.classList.remove('active'));document.querySelectorAll('.auth-panel').forEach(p=>p.classList.remove('active'));const tabs=document.querySelectorAll('.auth-tab'); if(btn)btn.classList.add('active'); else if(tabs[mode==='login'?0:1])tabs[mode==='login'?0:1].classList.add('active'); byId('ap-'+mode)?.classList.add('active'); if(byId('auth-heading'))byId('auth-heading').textContent=mode==='login'?'Welcome Back':'Create Account'; if(byId('auth-sub'))byId('auth-sub').textContent=mode==='login'?'Sign in to your Raabta account':'Join thousands using Raabta';};

// ==========================================
// API HELPER (Attaches JWT Token)
// ==========================================
async function fetchWithAuth(endpoint, options = {}) {
    const token = localStorage.getItem('raabta_token');
    const headers = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers
    };
    const response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Error: ${response.status}`);
    }
    return response.json();
}

// ==========================================
// UI HELPERS (Dynamic Avatars)
// ==========================================
window.updateAvatars = function() {
    const userStr = localStorage.getItem('raabta_user');
    if (!userStr) return;
    
    try {
        const user = JSON.parse(userStr);
        // Fallback to 'name' or 'full_name' depending on the login/signup response
        const fullName = user.name || user.full_name || 'U'; 
        
        // Split the name by spaces
        const names = fullName.trim().split(' ');
        
        // Get first letter of first name, and first letter of last name
        const initials = names.length > 1 
            ? (names[0][0] + names[names.length - 1][0]).toUpperCase()
            : fullName.substring(0, 2).toUpperCase(); // Fallback if only 1 name is provided

        // Update all three dashboard avatars at once
        ['user-avatar', 'admin-avatar', 'supervisor-avatar'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = initials;
        });
    } catch(e) { console.error("Could not set avatar:", e); }
};


// ==========================================
// AUTHENTICATION LOGIC
// ==========================================
window.authSignup = async function() {
    const nameInput = document.querySelector('#ap-signup input[type="text"]').value;
    const emailInput = document.querySelector('#ap-signup input[type="email"]').value;
    const passwordInput = document.querySelector('#ap-signup input[type="password"]').value;
    const roleInput = document.getElementById('su-role').value;

    if (!nameInput || !emailInput || !passwordInput || !roleInput) {
        alert("Please fill in all fields.");
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ full_name: nameInput, email: emailInput, password: passwordInput, role: roleInput })
        });

        const data = await response.json();
        if (response.ok) {
            localStorage.setItem('raabta_token', data.token);
            localStorage.setItem('raabta_user', JSON.stringify(data.user)); 
            updateAvatars();
            if(data.user.role === 'admin') { goPage('pg-admin'); aShow('a-analytics'); }
            else if(data.user.role === 'supervisor') { goPage('pg-supervisor'); sShow('s-orders'); }
            else { goPage('pg-customer'); cShow('c-dash'); }
        } else {
            alert('Signup Failed: ' + data.error);
        }
    } catch (error) {
        alert('Could not connect to the backend. Is Port 8000 running?');
    }
};

window.authLogin = async function() {
    const emailInput = document.querySelector('#ap-login input[type="email"]').value;
    const passwordInput = document.querySelector('#ap-login input[type="password"]').value;

    if (!emailInput || !passwordInput) { alert("Please enter both email and password."); return; }

    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: emailInput, password: passwordInput })
        });

        const data = await response.json();
        if (response.ok) {
            localStorage.setItem('raabta_token', data.token);
            localStorage.setItem('raabta_user', JSON.stringify(data.user)); 
            updateAvatars();
            if(data.user.role === 'admin') { goPage('pg-admin'); aShow('a-analytics'); }
            else if(data.user.role === 'supervisor') { goPage('pg-supervisor'); sShow('s-orders'); }
            else { goPage('pg-customer'); cShow('c-dash'); }
        } else {
            alert('Login Failed: ' + data.error);
        }
    } catch (error) {
        alert('Could not connect to the backend. Is Port 8000 running?');
    }
};

window.logout = function() {
    localStorage.removeItem('raabta_token');
    localStorage.removeItem('raabta_user');
    window.location.reload();
};

// ==========================================
// CUSTOMER DASHBOARD FETCHERS
// ==========================================
window.loadCustomerDashboard = async function() {
    try {
        // 1. Instantly clear dummy data so user knows it's loading
        const tiles = document.querySelectorAll('#c-dash .tile-val');
        if (tiles.length >= 2) { tiles[0].textContent = '...'; tiles[1].textContent = '...'; }
        const orderList = document.querySelector('#c-dash .order-list');
        if (orderList) orderList.innerHTML = '<p style="color:var(--muted);font-size:0.875rem;">Loading real data from Supabase...</p>';

        // 2. Fetch real data
        const data = await fetchWithAuth('/customer/dashboard');
        
        // 3. Update Welcome Message & Profile
        const welcomeH2 = document.querySelector('#c-dash .welcome h2');
        if (welcomeH2) welcomeH2.innerHTML = `Good afternoon, ${data.profile.full_name.split(' ')[0]} 👋`;
        
        const welcomeSub = document.getElementById('welcome-subtext') || document.querySelector('#c-dash .welcome p');
        if (welcomeSub) welcomeSub.textContent = "Here is your account overview."
        
        const profileInputs = document.querySelectorAll('#c-profile input');
        if (profileInputs.length >= 4) {
            profileInputs[0].value = data.profile.full_name;
            profileInputs[1].value = data.profile.email;
            profileInputs[2].value = 'Add phone number...'; 
            profileInputs[3].value = 'Add city...'; 
        }

        // 4. Update Stats Tiles
        if (tiles.length >= 2) {
            tiles[0].textContent = data.stats.activeCount || '0';
            tiles[1].textContent = data.stats.completedCount || '0';
        }

        // 5. Update Active Orders List
        if (orderList) {
            orderList.innerHTML = ''; 
            if (!data.activeOrders || data.activeOrders.length === 0) {
                orderList.innerHTML = '<p style="color:var(--muted);font-size:0.875rem;padding-bottom:1rem;">No active orders right now.</p>';
            } else {
                data.activeOrders.forEach(order => {
                    const statusColors = { requested: 'b-amber', assigned: 'b-amber', in_progress: 'b-blue', completed: 'b-green' };
                    const statusColor = statusColors[order.status] || 'b-gray';
                    const displayStatus = order.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
                    
                    orderList.innerHTML += `
                        <div class="ord-card">
                            <div>
                                <div class="ord-id">#ORD-${order.order_id}</div>
                                <div class="ord-name">${order.services?.service_name || 'Service'}</div>
                            </div>
                            <span class="badge ${statusColor}">${displayStatus}</span>
                            <button class="btn-outline-sm" onclick="trackOrder('ORD-${order.order_id}')">Track</button>
                        </div>`;
                });
            }
        }
    } catch (error) {
        console.error("Dashboard Load Error:", error);
    }
};

window.loadCustomerOrders = async function() {
    try {
        const tbody = document.querySelector('#c-history tbody');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--muted)">Loading...</td></tr>';

        const orders = await fetchWithAuth('/customer/orders');
        tbody.innerHTML = '';
        
        if (!orders || orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--muted)">No orders found.</td></tr>';
            return;
        }

        orders.forEach(order => {
            const statusClass = order.status === 'completed' ? 'b-green' : (['requested', 'assigned'].includes(order.status) ? 'b-amber' : 'b-blue');
            const displayStatus = order.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
            const actionHtml = order.status === 'completed' 
                ? `<button class="btn-gold-sm" onclick="openRate()">Rate</button>`
                : `<button class="btn-outline-sm" onclick="trackOrder('ORD-${order.order_id}')">Track</button>`;
            const dateStr = new Date(order.requested_at).toLocaleDateString();

            tbody.innerHTML += `
                <tr>
                    <td><strong>#ORD-${order.order_id}</strong></td>
                    <td>${order.services?.service_name || 'Service'}</td>
                    <td>${dateStr}</td>
                    <td><span class="badge ${statusClass}">${displayStatus}</span></td>
                    <td style="text-align:right">${actionHtml}</td>
                </tr>`;
        });
    } catch (error) {
        console.error("History Load Error:", error);
    }
};

// Load services from DB into the New Order dropdown on page load
window.loadServicesDropdown = async function() {
    const select = document.querySelector('#c-neworder select');
    if (!select) return;
    try {
        const services = await fetch(`${API_BASE_URL}/services`).then(r => r.json());
        select.innerHTML = '<option value="">Choose a service…</option>';
        services.forEach(s => {
            select.innerHTML += `<option value="${s.service_id}">${s.service_name}</option>`;
        });
    } catch(e) { console.error('Could not load services:', e); }
};

window.submitNewOrder = async function() {
    const panel = document.querySelector('#c-neworder .card-panel');
    const serviceSelect = panel.querySelector('select');
    const cityInput = panel.querySelectorAll('input[type="text"]')[0].value.trim();
    const dateInput = panel.querySelectorAll('input[type="text"]')[1].value.trim();
    const notesInput = panel.querySelector('textarea').value.trim();

    if (serviceSelect.selectedIndex === 0 || !cityInput) { alert("Please select a service and enter your city."); return; }

    try {
        // Get actual service ID from DB
        const service_id = serviceSelect.value;

        const res = await fetchWithAuth('/orders', {
            method: 'POST',
            body: JSON.stringify({
                service_id: service_id,
                service_address: cityInput,
                scheduled_for: new Date().toISOString(),
                notes: `Preferred Date/Time: ${dateInput} | Notes: ${notesInput}`
            })
        });

        alert(`✅ Order submitted! Your tracking ID is ${res.orderId}.`);
        
        // Reset form & go to dashboard
        serviceSelect.selectedIndex = 0;
        panel.querySelectorAll('input[type="text"]').forEach(i => i.value = '');
        panel.querySelector('textarea').value = '';
        cShow('c-dash'); 
    } catch(e) {
        // --- NEW ERROR HANDLING ---
        if (e.message.includes('free limit reached')) {
            alert('free limit reached upgrade plan to proceed further');
        } else {
            alert("Error submitting order: " + e.message);
        }
    }
};

// ==========================================
// VIEW SWITCHERS & EVENTS
// ==========================================

window.loadCustomerPlan = async function() {
    try {
        const data = await fetchWithAuth('/customer/plan');

        // 1. Update the little tile on the main Dashboard
        if(byId('tile-plan-name')) byId('tile-plan-name').textContent = data.name;
        if(byId('tile-plan-desc')) byId('tile-plan-desc').textContent = `${data.usage} orders this month`;

        // 2. Update the dedicated "My Plan" page
        if(byId('plan-name-display')) byId('plan-name-display').textContent = data.name + ' Plan';
        if(byId('plan-price-display')) byId('plan-price-display').textContent = data.price;
        if(byId('plan-usage')) byId('plan-usage').innerHTML = `<strong style="color:var(--gold2)">${data.usage} / ${data.limit}</strong>`;

        // 3. Animate the progress bar safely (USING CSS CLASSES)
        const bar = byId('plan-usage-bar');
        if (bar) {
            let percentage = (data.usage / data.limit) * 100;
            if (percentage > 100) percentage = 100; // Cap at 100%
            
            // Toggle classes based on limit instead of inline styles
            if (percentage >= 100) {
                bar.classList.remove('usage-bar-normal');
                bar.classList.add('usage-bar-limit');
            } else {
                bar.classList.remove('usage-bar-limit');
                bar.classList.add('usage-bar-normal');
            }
            
            bar.style.width = `${percentage}%`; // Width is the only inline style needed
        }
    } catch (error) {
        console.error('Plan Load Error:', error);
        if(byId('tile-plan-name')) byId('tile-plan-name').textContent = 'Basic';
        if(byId('plan-name-display')) byId('plan-name-display').textContent = 'Basic Plan';
    }
};
function showSection(scope,id,link,titleId,titles){document.querySelectorAll(`#${scope} .dsection`).forEach(s=>s.classList.remove('active'));document.querySelectorAll(`#${scope} .sb-link`).forEach(a=>a.classList.remove('active'));byId(id)?.classList.add('active'); if(link)link.classList.add('active'); if(byId(titleId)&&titles[id])byId(titleId).textContent=titles[id];}

window.cShow=function(id,link){
    const ids=['c-dash','c-neworder','c-services','c-history','c-plans','c-complaints','c-profile']; 
    if(!link){const i=ids.indexOf(id); link=i>=0?document.querySelectorAll('#pg-customer .sb-link')[i]:null} 
    showSection('pg-customer',id,link,'c-title',{'c-dash':'Dashboard','c-neworder':'New Order','c-services':'Services','c-history':'Order History','c-plans':'My Plan','c-complaints':'Complaints','c-profile':'Profile'});
    
    // 🔥 TRIGGER DATA FETCHES 🔥
    if (id === 'c-dash') {
        loadCustomerDashboard();
        loadCustomerPlan(); // Ensure the dashboard tile updates too!
    }
    if (id === 'c-history') loadCustomerOrders();
    if (id === 'c-complaints') loadCustomerComplaints();
    if (id === 'c-plans') loadCustomerPlan(); // Load data when clicking "My Plan"
};

window.aShow=function(id,link){
    const ids=['a-services','a-analytics','a-users','a-logs','a-complaints']; 
    if(!link){const i=ids.indexOf(id); link=i>=0?document.querySelectorAll('#pg-admin .sb-link')[i]:null} 
    showSection('pg-admin',id,link,'a-title',{'a-services':'Services','a-analytics':'Analytics','a-users':'User Management','a-logs':'Activity Logs','a-complaints':'Complaints'});
    
    // Trigger data fetch operations
    if (id === 'a-analytics') loadAdminAnalytics();
    if (id === 'a-users') loadAdminUsers();
    if (id === 'a-logs') loadAdminLogs();
    if (id === 'a-complaints') loadAdminComplaints();
    if (id === 'a-services') loadAdminServices();
};
window.sShow=function(id,link){
    const ids=['s-orders','s-assign','s-status','s-providers']; 
    if(!link){const i=ids.indexOf(id); link=i>=0?document.querySelectorAll('#pg-supervisor .sb-link')[i]:null} 
    showSection('pg-supervisor',id,link,'s-title',{'s-orders':'Orders','s-assign':'Assign Order','s-status':'Update Status','s-providers':'Provider Directory'});

    // Trigger data fetch operations based on tab
    if (id === 's-orders') loadSupervisorOrders();
    if (id === 's-providers') loadSupervisorProviders();
    if (id === 's-assign') { 
        loadSupervisorProviders(); 
        loadSupervisorAssignments(); 
    }
};
window.openRate=()=>byId('rate-modal')?.classList.add('open'); window.closeRate=()=>byId('rate-modal')?.classList.remove('open'); window.setRating=n=>document.querySelectorAll('.star').forEach((s,i)=>s.classList.toggle('lit',i<n)); window.submitRate=function(){closeRate();alert('✅ Thank you! Your rating has been saved.');};

// Guest Order Tracking
window.trackOrder = async function(presetId) {
    const inputVal = byId('track-input')?.value.trim();
    const v = presetId || inputVal;
    if (!v) { alert('Please enter an Order ID.'); return; }

    try {
        const response = await fetch(`${API_BASE_URL}/orders/track/${v}`);
        if (!response.ok) throw new Error('Order not found or invalid ID.');
        const order = await response.json();

        if (byId('tm-id')) byId('tm-id').textContent = `ORD-${order.order_id}`;
        if (byId('tm-title')) byId('tm-title').textContent = `Order Status — ${order.services?.service_name || 'Service'}`;
        
        const stepsContainer = byId('tm-steps');
        if (stepsContainer) {
            const statusLevel = { 'requested': 1, 'assigned': 2, 'in_progress': 3, 'completed': 4 }[order.status] || 1;
            const stepText = ['Requested — Order placed and confirmed','Assigned — Provider identified and contacted','In Progress — Work underway at your location','Completed — Service finished'];

            let stepsHtml = '';
            for (let i = 1; i <= 4; i++) {
                if (i < statusLevel) {
                    stepsHtml += `<div style="display:flex;align-items:center;gap:.75rem;font-size:.875rem"><span style="width:22px;height:22px;background:var(--g500);border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:.7rem;flex-shrink:0">✓</span><span style="color:var(--g700)">${stepText[i-1]}</span></div>`;
                } else if (i === statusLevel) {
                    stepsHtml += `<div style="display:flex;align-items:center;gap:.75rem;font-size:.875rem"><span style="width:22px;height:22px;background:var(--gold);border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--g900);font-size:.7rem;flex-shrink:0;font-weight:700">→</span><span style="color:var(--g800);font-weight:600">${stepText[i-1]}</span></div>`;
                } else {
                    stepsHtml += `<div style="display:flex;align-items:center;gap:.75rem;font-size:.875rem"><span style="width:22px;height:22px;background:var(--border);border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:.7rem;flex-shrink:0">○</span><span style="color:var(--muted)">${stepText[i-1]}</span></div>`;
                }
            }
            stepsContainer.innerHTML = stepsHtml;
        }
        byId('track-modal')?.classList.add('open');
    } catch (error) {
        alert(error.message);
    }
};
window.closeTrack=()=>byId('track-modal')?.classList.remove('open');

// Submit Complaint
window.submitComplaint = async function() {
    const orderInput = (byId('complaint-order')?.value || '').trim();
    const typeInput = (byId('complaint-type')?.value || '').trim();
    const detailsInput = (byId('complaint-details')?.value || '').trim();

    if (!typeInput || !detailsInput) { alert('Please select a complaint type and provide details.'); return; }

    try {
        const data = await fetchWithAuth('/complaints', {
            method: 'POST',
            body: JSON.stringify({ order_id: orderInput, category: typeInput, title: typeInput, description: detailsInput })
        });
        const newId = `CMP-${data.complaint.case_id}`;
        alert(`✅ Complaint submitted. Your reference ID is ${newId}.`);

        const tbody = byId('complaint-list');
        if (tbody) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td><strong>${newId}</strong></td><td>${orderInput || 'N/A'}</td><td>${typeInput}</td><td><span class="badge b-amber">Open</span></td>`;
            tbody.prepend(tr);
        }
        ['complaint-order','complaint-type','complaint-details'].forEach(x => { if(byId(x)) byId(x).value = ''; });
    } catch(e) { alert('Error submitting complaint: ' + e.message); }
};
window.loadCustomerComplaints = async function() {
    try {
        const tbody = byId('complaint-list');
        if (!tbody) return;
        
        // Show loading state and clear dummy data
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--muted)">Loading complaints...</td></tr>';

        const complaints = await fetchWithAuth('/customer/complaints');
        tbody.innerHTML = '';
        
        if (!complaints || complaints.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--muted)">No complaints found.</td></tr>';
            return;
        }

        complaints.forEach(c => {
            const statusClass = c.status === 'open' ? 'b-amber' : 'b-green';
            const orderText = c.order_id ? `#ORD-${c.order_id}` : 'N/A';
            const displayStatus = c.status.charAt(0).toUpperCase() + c.status.slice(1);

            tbody.innerHTML += `
                <tr>
                    <td><strong>CMP-${c.case_id}</strong></td>
                    <td>${orderText}</td>
                    <td>${c.category}</td>
                    <td><span class="badge ${statusClass}">${displayStatus}</span></td>
                </tr>`;
        });
    } catch (error) {
        console.error("Complaints Load Error:", error);
    }
};

// Admin/Supervisor specific Modal triggers
window.openAddSvc=()=>byId('addsvc-modal')?.classList.add('open'); window.closeAddSvc=()=>byId('addsvc-modal')?.classList.remove('open');

window.sGoAssign=function(id,svc){if(byId('s-assign-info'))byId('s-assign-info').textContent=`${id} — ${svc}`; sShow('s-assign');};
window.sGoStatus=function(id){if(byId('s-status-info'))byId('s-status-info').textContent=id; sShow('s-status');};
window.doAddSvc = async function() {
    const name = (byId('new-svc')?.value || '').trim();
    if (!name) { alert('Enter a service name.'); return; }
    try {
        await fetchWithAuth('/admin/services', {
            method: 'POST',
            body: JSON.stringify({ service_name: name, category: 'General', description: '', base_price_estimate: 0 })
        });
        byId('new-svc').value = '';
        closeAddSvc();
        loadAdminServices(); // Automatically refresh the table
    } catch(e) { alert('Error adding service: ' + e.message); }
};

window.currentEditingSvcId = null;

window.openEditSvc = function(encodedData) {
    const svc = JSON.parse(decodeURIComponent(encodedData));
    window.currentEditingSvcId = svc.service_id;
    
    document.getElementById('edit-svc-name').value = svc.service_name || '';
    document.getElementById('edit-svc-category').value = svc.category || 'General';
    document.getElementById('edit-svc-desc').value = svc.description || '';
    
    document.getElementById('editsvc-modal').classList.add('open');
};

window.closeEditSvc = () => document.getElementById('editsvc-modal').classList.remove('open');

window.saveEditSvc = async function() {
    if (!window.currentEditingSvcId) return;
    
    const name = document.getElementById('edit-svc-name').value.trim();
    const category = document.getElementById('edit-svc-category').value;
    const desc = document.getElementById('edit-svc-desc').value.trim();

    if (!name) return alert("Service Name is required.");

    try {
        await fetchWithAuth(`/admin/services/${window.currentEditingSvcId}`, {
            method: 'PATCH',
            body: JSON.stringify({ service_name: name, category: category, description: desc })
        });
        closeEditSvc();
        loadAdminServices(); // Refresh table
    } catch (error) {
        alert('Error updating service: ' + error.message);
    }
};

window.toggleAdminSvc = async function(id, enable) {
    if(!confirm(`Are you sure you want to ${enable ? 'enable' : 'disable'} this service?`)) return;
    try {
        await fetchWithAuth(`/admin/services/${id}/toggle`, {
            method: 'PATCH',
            body: JSON.stringify({ is_enabled: enable })
        });
        loadAdminServices(); // Refresh table
    } catch (e) {
        alert('Error toggling service: ' + e.message);
    }
};
window.doAssign = async function() {
    const orderText = byId('s-assign-info')?.textContent || '';
    const order_id = orderText.match(/\d+/)?.[0];
    const provider_id = byId('s-provider')?.value;
    const provider_response = (byId('s-prov-response')?.value || '').toLowerCase().replace(' ', '_');
    
    if (!order_id || !provider_id) { alert('Please select an order and a provider.'); return; }
    
    try {
        await fetchWithAuth('/supervisor/assign', {
            method: 'POST',
            body: JSON.stringify({ order_id: parseInt(order_id), provider_id, provider_response })
        });
        alert('Order assigned successfully.');
        sShow('s-orders'); // Redirect to orders list to view update
    } catch(e) { 
        alert('Error assigning order: ' + e.message); 
    }
};

window.doStatus = async function() {
    const orderText = byId('s-status-info')?.textContent || '';
    const order_id = orderText.match(/\d+/)?.[0];
    const new_status = byId('s-new-status')?.value?.toLowerCase().replace(' ', '_');
    
    // Select the second input field in the s-status section (Supervisor Note)
    const remarks = document.querySelector('#s-status input[type="text"]')?.value || '';

    if (!order_id || !new_status) { alert('Please select an order and a new status.'); return; }
    
    try {
        await fetchWithAuth('/supervisor/status', {
            method: 'POST',
            body: JSON.stringify({ order_id: parseInt(order_id), new_status, remarks })
        });
        alert('Status updated successfully.');
        document.querySelector('#s-status input[type="text"]').value = ''; // Clear notes
        sShow('s-orders'); // Redirect to orders list
    } catch(e) { 
        alert('Error updating status: ' + e.message); 
    }
};

// ==========================================
// SUPERVISOR DASHBOARD FETCHERS
// ==========================================
window.loadSupervisorOrders = async function() {
    try {
        const tbody = document.querySelector('#s-orders tbody');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted)">Loading orders...</td></tr>';

        const orders = await fetchWithAuth('/supervisor/orders');
        
        // 1. Save the orders globally so the filter function can access them
        window._supervisorOrders = orders;

        // Calculate Statistics
        let unassignedCount = 0;
        let inProgressCount = 0;
        let completedTodayCount = 0;
        const todayStr = new Date().toDateString();

        orders.forEach(o => {
            if (o.status === 'requested') unassignedCount++;
            if (o.status === 'in_progress') inProgressCount++;
            if (o.status === 'completed') {
                const updatedDate = new Date(o.requested_at).toDateString(); // Or updated_at if tracked
                if (updatedDate === todayStr) completedTodayCount++;
            }
        });

        // Update Dashboard Tiles
        const tiles = document.querySelectorAll('#s-orders .tile-val');
        if (tiles.length >= 3) {
            tiles[0].textContent = unassignedCount;
            tiles[1].textContent = inProgressCount;
            tiles[2].textContent = completedTodayCount;
        }

        // 2. Trigger the render function (defaults to "All Orders")
        applyOrderFilter();

    } catch (error) {
        console.error("Supervisor Orders Load Error:", error);
    }
};

// --- NEW FUNCTION TO HANDLE FILTERING ---
window.applyOrderFilter = function() {
    const tbody = document.querySelector('#s-orders tbody');
    if (!tbody) return;

    // Grab the current value from the dropdown
    const filterVal = document.getElementById('s-order-filter')?.value || 'all';
    
    // Filter the stored orders
    let displayOrders = window._supervisorOrders || [];
    if (filterVal !== 'all') {
        displayOrders = displayOrders.filter(o => o.status === filterVal);
    }

    // Render the table with the filtered results
    tbody.innerHTML = '';
    if (displayOrders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted)">No orders found for this status.</td></tr>';
        return;
    }

    displayOrders.forEach(order => {
        const statusClass = {
            'requested': 'b-amber', 'assigned': 'b-amber', 'in_progress': 'b-blue', 'completed': 'b-green', 'cancelled': 'b-gray'
        }[order.status] || 'b-gray';
        const displayStatus = order.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
        const customerName = order.app_users?.full_name || 'Unknown';
        const serviceName = order.services?.service_name || 'Service';

        let actionHtml = '';
        if (order.status !== 'completed' && order.status !== 'cancelled') {
            const assignBtnText = order.status === 'requested' ? 'Assign' : 'Reassign';
            const btnClass = order.status === 'requested' ? 'btn-gold-sm' : 'btn-g';
            actionHtml = `
                <div class="td-actions">
                    <button class="${btnClass}" onclick="sGoAssign('ORD-${order.order_id}', '${serviceName}')">${assignBtnText}</button>
                    <button class="btn-outline-sm" onclick="sGoStatus('ORD-${order.order_id}')">Status</button>
                </div>`;
        } else {
            actionHtml = `<span style="font-size:.78rem;color:var(--muted)">Done</span>`;
        }

        tbody.innerHTML += `
            <tr>
                <td><strong>#ORD-${order.order_id}</strong></td>
                <td>${customerName}</td>
                <td>${serviceName}</td>
                <td>${order.service_address || 'N/A'}</td>
                <td><span class="badge ${statusClass}">${displayStatus}</span></td>
                <td style="text-align:right">${actionHtml}</td>
            </tr>`;
    });
};
window.loadSupervisorProviders = async function() {
    try {
        const directoryContainer = document.querySelector('#s-providers');
        const assignSelect = document.getElementById('s-provider');

        // 1. Ensure we have a dedicated, safe container just for the cards
        let cardContainer = document.getElementById('prov-card-container');
        if (directoryContainer && !cardContainer) {
            
            // AGGRESSIVE CLEANUP: Destroy all old "Loading..." text and dummy HTML
            Array.from(directoryContainer.children).forEach(child => {
                // If the element does NOT contain the Add Provider button, it's dummy data. Delete it.
                if (!child.innerHTML?.includes('+ Add Provider')) {
                    child.remove();
                }
            });
            // Also wipe out any stray bare text nodes (just in case)
            Array.from(directoryContainer.childNodes).forEach(node => {
                if (node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0) {
                    node.remove();
                }
            });

            // Create our new, easily clearable container
            cardContainer = document.createElement('div');
            cardContainer.id = 'prov-card-container';
            cardContainer.style.display = 'flex';
            cardContainer.style.flexDirection = 'column';
            cardContainer.style.gap = '1rem';
            cardContainer.style.marginTop = '1.5rem';
            directoryContainer.appendChild(cardContainer);
        }

        // 2. Put it in a loading state INSIDE the safe zone
        if (cardContainer) cardContainer.innerHTML = '<p style="color:var(--muted); font-style:italic;">Loading providers...</p>';
        if (assignSelect) assignSelect.innerHTML = '<option value="">Loading providers...</option>';

        // 3. Wait for the database
        const providers = await fetchWithAuth('/supervisor/providers');

        // 4. THE FIX: Wipe the container completely clean AFTER the fetch finishes
        if (cardContainer) cardContainer.innerHTML = ''; 
        if (assignSelect) assignSelect.innerHTML = '<option value="">Choose a provider…</option>';

        if (!providers || providers.length === 0) {
            if (cardContainer) cardContainer.innerHTML = '<p style="color:var(--muted)">No active providers found in database.</p>';
            return;
        }

        // 5. Safely print the results
        providers.forEach(p => {
            const isAvail = p.availability_status !== 'busy';
            const statusClass = isAvail ? 'b-green' : 'b-amber';
            const statusText = isAvail ? 'Available' : 'Busy';
            const whatsAppHtml = p.whatsapp_no ? ' · WhatsApp ✓' : '';
            const area = p.service_area || 'General Area';

            // Pass the provider data to the edit function safely
            const pData = encodeURIComponent(JSON.stringify(p));
            
            if (cardContainer) {
                cardContainer.innerHTML += `
                    <div class="provider-card">
                        <div>
                            <div class="prov-name">${p.provider_name}</div>
                            <div class="prov-detail">${area} · ${p.phone}${whatsAppHtml}</div>
                        </div>
                        <div style="display:flex;gap:.5rem;align-items:center">
                            <span class="badge ${statusClass}">${statusText}</span>
                            <button class="btn-outline-sm" onclick="openEditProvider('${pData}')">Edit</button>
                        </div>
                    </div>`;
            }

            // Populate the dropdown for the Assignment tab
            if (assignSelect) {
                // If they are not available, add the 'disabled' attribute
                const disabledAttr = isAvail ? '' : 'disabled';
                const statusLabel = isAvail ? '✅' : '🔴 (Busy)';
                
                assignSelect.innerHTML += `<option value="${p.provider_id}" ${disabledAttr}>${p.provider_name} — ${area} ${statusLabel}</option>`;
            }
        });
    } catch (error) {
        console.error("Supervisor Providers Load Error:", error);
    }
};

window.loadSupervisorAssignments = async function() {
    try {
        const tbody = document.getElementById('s-assign-log');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted)">Loading assignments...</td></tr>';

        const assignments = await fetchWithAuth('/supervisor/assignments');
        tbody.innerHTML = '';

        if (!assignments || assignments.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted)">No recent assignments found.</td></tr>';
            return;
        }

        assignments.forEach(a => {
            const orderId = a.orders?.order_id || 'N/A';
            const serviceName = a.orders?.services?.service_name || 'N/A';
            const providerName = a.service_providers?.provider_name || 'N/A';
            const response = a.provider_response ? a.provider_response.replace('_', ' ') : 'Pending';
            const respClass = response.toLowerCase() === 'accepted' ? 'b-green' : (response.toLowerCase() === 'declined' ? 'b-red' : 'b-amber');
            const time = new Date(a.assigned_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            const status = a.orders?.status ? a.orders.status.replace('_', ' ') : 'N/A';

            tbody.innerHTML += `
                <tr>
                    <td><strong>#ORD-${orderId}</strong></td>
                    <td>${serviceName}</td>
                    <td>${providerName}</td>
                    <td><span class="badge ${respClass}" style="text-transform:capitalize">${response}</span></td>
                    <td>${time}</td>
                    <td><span class="badge b-blue" style="text-transform:capitalize">${status}</span></td>
                </tr>
            `;
        });
    } catch (error) {
        console.error("Assignments Load Error:", error);
    }
};



// ==========================================
// INITIALIZATION & EVENT LISTENERS
// ==========================================
function bindNavigation(){
    document.querySelectorAll('.nav-links a').forEach(a=>{const t=a.textContent.toLowerCase(); if(t.includes('about'))a.onclick=e=>{e.preventDefault();scrollToSection('about-anchor')}; if(t.includes('services'))a.onclick=e=>{e.preventDefault();scrollToSection('services-anchor')}; if(t.includes('pricing'))a.onclick=e=>{e.preventDefault();scrollToSection('pricing-anchor')};}); 
    document.querySelectorAll('.preview-bar .pb-btn').forEach(btn=>btn.onclick=e=>{e.preventDefault();const t=btn.textContent;if(t.includes('Home'))goPage('pg-home');else if(t.includes('Auth'))goPage('pg-auth');else if(t.includes('Customer'))goPage('pg-customer');else if(t.includes('Admin'))goPage('pg-admin');else if(t.includes('Supervisor'))goPage('pg-supervisor');});
    const explore=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Explore Services')); if(explore)explore.onclick=e=>{e.preventDefault();scrollToSection('services-anchor')};
}

document.addEventListener('click',e=>{
    const target=e.target.closest('button,a,.sb-link'); 
    if(!target)return; 
    const txt=target.textContent.trim(); 
    
    if(target.closest('#pg-customer .sb-nav')){
        const links=[...document.querySelectorAll('#pg-customer .sb-link')],ids=['c-dash','c-neworder','c-services','c-history','c-plans','c-complaints','c-profile'],i=links.indexOf(target); 
        if(i>=0){e.preventDefault();cShow(ids[i],target);return}
    } 
    if(target.closest('#pg-admin .sb-nav')){
        const links=[...document.querySelectorAll('#pg-admin .sb-link')],ids=['a-services','a-analytics','a-users','a-logs','a-complaints'],i=links.indexOf(target); 
        if(i>=0){e.preventDefault();aShow(ids[i],target);return}
    } 
    if(target.closest('#pg-supervisor .sb-nav')){
        const links=[...document.querySelectorAll('#pg-supervisor .sb-link')],ids=['s-orders','s-assign','s-status','s-providers'],i=links.indexOf(target); 
        if(i>=0){
            e.preventDefault();
            
            // 🔥 The Reset Logic 🔥
            if (ids[i] === 's-assign' && byId('s-assign-info')) {
                byId('s-assign-info').textContent = 'No order selected — go to Orders and click Assign';
            }
            if (ids[i] === 's-status' && byId('s-status-info')) {
                byId('s-status-info').textContent = 'No order selected — go to Orders and click Status';
            }
            
            sShow(ids[i],target);
            return;
        }
    }
    if(txt === '+ Add Provider') {
        e.preventDefault();
        openAddProvider();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    bindNavigation();
    
    // OVERRIDE FAKE BUTTONS IN HTML
    const submitBtn = document.querySelector('#c-neworder button.btn-g');
    if(submitBtn) {
        submitBtn.removeAttribute('onclick');
        submitBtn.onclick = (e) => { e.preventDefault(); submitNewOrder(); };
    }
    loadServicesDropdown();
    const authBtn = document.querySelector('.nav-auth-btn');
    if(authBtn && localStorage.getItem('raabta_token')) {
        authBtn.textContent = 'Dashboard';
        authBtn.onclick = () => {
            const u = JSON.parse(localStorage.getItem('raabta_user')||'{}');
            if(u.role==='admin'){goPage('pg-admin'); aShow('a-analytics');}
            else if(u.role==='supervisor'){goPage('pg-supervisor'); sShow('s-orders');}
            else {goPage('pg-customer'); cShow('c-dash');}
        };
    }
    document.querySelectorAll('.sb-footer button').forEach(btn => {
        btn.onclick = (e) => { e.preventDefault(); window.logout(); };
    });

    // AUTO-LOGIN CHECK
    const token = localStorage.getItem('raabta_token');
    const userString = localStorage.getItem('raabta_user');
    
    if (token && userString) {
        updateAvatars();
        const user = JSON.parse(userString);
        if(user.role === 'admin') {
            goPage('pg-admin'); aShow('a-analytics');
        } else if(user.role === 'supervisor') {
            goPage('pg-supervisor'); sShow('s-orders');
        } else {
            goPage('pg-customer'); cShow('c-dash'); // This immediately forces the data fetch!
        }
    }
}); 

// Change Top Nav to "Dashboard" if logged in



// Change Top Nav to "Dashboard" if logged in

// --- Provider Management ---
window.openAddProvider = function() {
    document.getElementById('add-provider-name').value = '';
    document.getElementById('add-provider-category').selectedIndex = 0;
    document.getElementById('add-provider-city').value = '';
    document.getElementById('add-provider-phone').value = '';
    document.getElementById('add-provider-status').value = 'Active';
    document.getElementById('addprovider-modal').classList.add('open');
};
window.closeAddProvider = () => document.getElementById('addprovider-modal').classList.remove('open');

window.saveAddProvider = async function() {
    const name = document.getElementById('add-provider-name').value.trim();
    const city = document.getElementById('add-provider-city').value.trim();
    const phone = document.getElementById('add-provider-phone').value.trim();
    const status = document.getElementById('add-provider-status').value;

    if (!name || !phone) return alert("Provider Name and Phone are required.");

    try {
        await fetchWithAuth('/supervisor/providers', {
            method: 'POST',
            body: JSON.stringify({ 
                provider_name: name, 
                phone: phone, 
                whatsapp_no: phone, 
                service_area: city,
                availability_status: status === 'Active' ? 'available' : 'busy'
            })
        });
        closeAddProvider();
        loadSupervisorProviders(); 
    } catch (error) {
        alert('Error adding provider: ' + error.message);
    }
};

window.currentEditingProviderId = null;

window.openEditProvider = function(encodedData) {
    const p = JSON.parse(decodeURIComponent(encodedData));
    window.currentEditingProviderId = p.provider_id;
    
    document.getElementById('edit-provider-name').value = p.provider_name || '';
    document.getElementById('edit-provider-city').value = p.service_area || '';
    document.getElementById('edit-provider-phone').value = p.phone || '';
    document.getElementById('edit-provider-status').value = (p.availability_status === 'available') ? 'Active' : 'Inactive';
    
    document.getElementById('editprovider-modal').classList.add('open');
};
window.closeEditProvider = () => document.getElementById('editprovider-modal').classList.remove('open');

window.saveEditProvider = async function() {
    if (!window.currentEditingProviderId) return;
    
    const name = document.getElementById('edit-provider-name').value.trim();
    const city = document.getElementById('edit-provider-city').value.trim();
    const phone = document.getElementById('edit-provider-phone').value.trim();
    const status = document.getElementById('edit-provider-status').value;

    try {
        await fetchWithAuth(`/supervisor/providers/${window.currentEditingProviderId}`, {
            method: 'PATCH',
            body: JSON.stringify({ 
                provider_name: name, 
                phone: phone, 
                whatsapp_no: phone, 
                service_area: city,
                availability_status: status === 'Active' ? 'available' : 'busy'
            })
        });
        closeEditProvider();
        loadSupervisorProviders(); 
    } catch (error) {
        alert('Error updating provider: ' + error.message);
    }
};
// --- User Management ---
window.openAddUser = function() {
    document.getElementById('add-user-name').value = '';
    document.getElementById('add-user-email').value = '';
    document.getElementById('add-user-role').value = 'Customer';
    document.getElementById('add-user-status').value = 'Active';
    document.getElementById('adduser-modal').classList.add('open');
};
window.closeAddUser = () => document.getElementById('adduser-modal').classList.remove('open');

window.saveAddUser = async function() {
    const name = document.getElementById('add-user-name').value.trim();
    const email = document.getElementById('add-user-email').value.trim();
    const role = document.getElementById('add-user-role').value.toLowerCase();
    
    if (!name || !email) return alert("Name and Email are required.");

    try {
        // We reuse the auth/signup endpoint so passwords map correctly behind the scenes
        await fetchWithAuth('/auth/signup', {
            method: 'POST',
            body: JSON.stringify({ full_name: name, email: email, password: 'defaultPassword123', role: role })
        });
        closeAddUser();
        loadAdminUsers();
    } catch (error) {
        alert('Error adding user: ' + error.message);
    }
};

window.currentEditingUserId = null;

window.openEditUser = function(encodedData) {
    const u = JSON.parse(decodeURIComponent(encodedData));
    window.currentEditingUserId = u.user_id;
    
    document.getElementById('edit-user-name').value = u.full_name || '';
    document.getElementById('edit-user-email').value = u.email || '';
    document.getElementById('edit-user-role').value = u.role.charAt(0).toUpperCase() + u.role.slice(1);
    document.getElementById('edit-user-status').value = u.account_status.charAt(0).toUpperCase() + u.account_status.slice(1);
    
    document.getElementById('edituser-modal').classList.add('open');
};
window.closeEditUser = () => document.getElementById('edituser-modal').classList.remove('open');

window.saveEditUser = async function() {
    if (!window.currentEditingUserId) return;
    
    const name = document.getElementById('edit-user-name').value.trim();
    const email = document.getElementById('edit-user-email').value.trim();
    const role = document.getElementById('edit-user-role').value.toLowerCase();
    const status = document.getElementById('edit-user-status').value.toLowerCase();

    try {
        await fetchWithAuth(`/admin/users/${window.currentEditingUserId}`, {
            method: 'PATCH',
            body: JSON.stringify({ full_name: name, email: email, role: role, account_status: status })
        });
        closeEditUser();
        loadAdminUsers();
    } catch (error) {
        alert('Error updating user: ' + error.message);
    }
};
// ==========================================
// ADMIN DASHBOARD FETCHERS
// ==========================================
window.loadAdminAnalytics = async function() {
    try {
        const data = await fetchWithAuth('/admin/dashboard');

        // 1. Update Top Tiles
        const formatNum = num => new Intl.NumberFormat().format(num);
        if(byId('analytics-total-orders')) byId('analytics-total-orders').textContent = formatNum(data.analytics.totalOrders);
        if(byId('analytics-active-users')) byId('analytics-active-users').textContent = formatNum(data.analytics.activeUsers);
        if(byId('analytics-providers')) byId('analytics-providers').textContent = formatNum(data.analytics.totalProviders);
        
        // Custom styling for the "M" in Revenue
        if(byId('analytics-revenue')) {
            const rev = data.analytics.revenueEstimate.replace('M', '<span style="font-size:1.6rem; margin-left: 2px;">M</span>');
            byId('analytics-revenue').innerHTML = rev;
        }

        // 2. Orders by Service (Horizontal Bars)
        const serviceBarsContainer = byId('analytics-chart-bars');
        if (serviceBarsContainer && data.ordersByService) {
            serviceBarsContainer.innerHTML = '';
            
            // Find max count to scale the bars relative to the most popular service
            const maxCount = Math.max(...data.ordersByService.map(s => s.count), 1);

            data.ordersByService.forEach(svc => {
                const percentage = (svc.count / maxCount) * 100;
                serviceBarsContainer.innerHTML += `
                    <div style="display:flex; align-items:center; margin-bottom: 1rem; gap: 1rem;">
                        <div style="width: 140px; font-size: 0.85rem; color: var(--g700); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${svc.name}</div>
                        <div style="flex-grow: 1; height: 10px; background: #E4E5E0; border-radius: 6px; overflow: hidden;">
                            <div style="width: ${percentage}%; height: 100%; background: #235234; border-radius: 6px; transition: width 1s ease-out;"></div>
                        </div>
                        <div style="width: 35px; font-size: 0.9rem; font-weight: 700; text-align: right; color: var(--g900);">${svc.count}</div>
                    </div>
                `;
            });
        }

        // 3. Order Status Breakdown (Separated Stacked Bars)
        const statusBarsContainer = byId('analytics-status-bars');
        if (statusBarsContainer && data.orderStatusBreakdown) {
            statusBarsContainer.innerHTML = '';
            const totalOrders = data.analytics.totalOrders || 1; 

            data.orderStatusBreakdown.forEach(status => {
                const percentage = Math.round((status.count / totalOrders) * 100);
                
                // Color mapping matching your screenshot design
                const colors = {
                    'Completed': '#00B67A',      // Bright Green
                    'In Progress': '#235234',    // Dark Green
                    'Pending': '#D4B254',        // Gold
                    'Cancelled': '#EF4444'       // Red
                };
                const color = colors[status.label] || '#999';

                statusBarsContainer.innerHTML += `
                    <div style="margin-bottom: 1.4rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                            <span style="font-size: 0.85rem; color: var(--g700);">${status.label}</span>
                            <span style="font-size: 0.85rem; font-weight: 700; color: var(--g900);">${percentage}%</span>
                        </div>
                        <div style="width: 100%; height: 8px; background: #E4E5E0; border-radius: 4px; overflow: hidden;">
                            <div style="width: ${percentage}%; height: 100%; background: ${color}; border-radius: 4px; transition: width 1s ease-out;"></div>
                        </div>
                    </div>
                `;
            });
        }

    } catch (e) {
        console.error('Analytics load error:', e);
        if(byId('analytics-chart-bars')) byId('analytics-chart-bars').innerHTML = '<div style="color:var(--muted)">Failed to load data</div>';
    }
};
window.loadAdminUsers = async function() {
    try {
        const tbody = document.getElementById('a-users-tbody');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:1.5rem">Loading users...</td></tr>';

        const users = await fetchWithAuth('/admin/users');
        
        // 1. Save the users globally so the filter function can access them without re-fetching
        window._adminUsers = users;
        
        // 2. Trigger the initial render (defaults to "All Users")
        applyUserFilter();

    } catch (error) {
        console.error("Users Load Error:", error);
        if (document.getElementById('a-users-tbody')) {
            document.getElementById('a-users-tbody').innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:1.5rem">Failed to load data. Is the backend running?</td></tr>';
        }
    }
};

// --- NEW FUNCTION TO HANDLE USER FILTERING ---
window.applyUserFilter = function() {
    const tbody = document.getElementById('a-users-tbody');
    if (!tbody) return;

    // Grab the current value from the dropdown
    const filterVal = document.getElementById('a-user-filter')?.value || 'all';
    
    // Filter the stored users
    let displayUsers = window._adminUsers || [];
    
    if (filterVal !== 'all') {
        displayUsers = displayUsers.filter(u => {
            if (filterVal === 'active_customer') return u.role === 'customer' && u.account_status === 'active';
            if (filterVal === 'suspended_customer') return u.role === 'customer' && u.account_status !== 'active';
            if (filterVal === 'supervisor') return u.role === 'supervisor';
            if (filterVal === 'admin') return u.role === 'admin';
            return true;
        });
    }

    // Render the table with the filtered results
    tbody.innerHTML = '';
    
    if (displayUsers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:1.5rem">No users found for this filter.</td></tr>';
        return;
    }

    // This is your exact original formatting logic!
    displayUsers.forEach(u => {
        // Determine badge colors based on role and status
        const roleClass = u.role === 'admin' ? 'b-red' : (u.role === 'supervisor' ? 'b-blue' : 'b-gray');
        const roleDisplay = u.role.charAt(0).toUpperCase() + u.role.slice(1);
        
        const statusClass = u.account_status === 'active' ? 'b-green' : 'b-amber';
        const statusDisplay = u.account_status.charAt(0).toUpperCase() + u.account_status.slice(1);
        
        const dateStr = new Date(u.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

        // Safely encode user data for the modal
        const uData = encodeURIComponent(JSON.stringify(u));

        tbody.innerHTML += `
            <tr>
                <td>
                    <strong>${u.full_name}</strong><br>
                    <span style="font-size:0.75rem;color:var(--muted)">Joined ${dateStr}</span>
                </td>
                <td>${u.email}</td>
                <td><span class="badge ${roleClass}">${roleDisplay}</span></td>
                <td><span style="color:var(--muted)">Standard</span></td>
                <td><span class="badge ${statusClass}">${statusDisplay}</span></td>
                <td style="text-align:right">
                    <button class="btn-outline-sm" onclick="openEditUser('${uData}')">Manage</button>
                </td>
            </tr>
        `;
    });
};

window.loadAdminLogs = async function() {
    try {
        const tbody = byId('a-logs-tbody');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:1.5rem">Loading logs...</td></tr>';

        const logs = await fetchWithAuth('/admin/logs');
        tbody.innerHTML = '';

        if (!logs || logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:1.5rem">No recent activity.</td></tr>';
            return;
        }

        logs.forEach(log => {
            // Format timestamp to look like "2026-05-02 14:32"
            const d = new Date(log.timestamp);
            const dateStr = d.getFullYear() + '-' +
                            String(d.getMonth() + 1).padStart(2, '0') + '-' +
                            String(d.getDate()).padStart(2, '0') + ' ' +
                            String(d.getHours()).padStart(2, '0') + ':' +
                            String(d.getMinutes()).padStart(2, '0');

            // Map the event to the correct badge color based on your screenshot
            let badgeHtml = '';
            if (log.event === 'Order Created') badgeHtml = '<span class="badge b-blue">Order Created</span>';
            else if (log.event === 'Order Assigned') badgeHtml = '<span class="badge" style="background:#F3E8FF; color:#4F46E5">Order Assigned</span>';
            else if (log.event === 'Status Updated') badgeHtml = '<span class="badge b-amber">Status Updated</span>';
            else if (log.event === 'Order Completed') badgeHtml = '<span class="badge b-green">Order Completed</span>';
            else badgeHtml = `<span class="badge b-gray">${log.event}</span>`;

            tbody.innerHTML += `
                <tr>
                    <td style="color:var(--g600)">${dateStr}</td>
                    <td>${badgeHtml}</td>
                    <td>${log.actor}</td>
                    <td style="color:var(--g800)">${log.details}</td>
                </tr>
            `;
        });
    } catch (error) {
        console.error("Logs Load Error:", error);
        if (byId('a-logs-tbody')) {
            byId('a-logs-tbody').innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:1.5rem">Failed to load logs. Is the backend running?</td></tr>';
        }
    }
};

window.loadAdminComplaints = async function() {
    try {
        const tbody = byId('a-complaints-tbody');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:1.5rem">Loading complaints...</td></tr>';

        const complaints = await fetchWithAuth('/admin/complaints');
        tbody.innerHTML = '';

        if (!complaints || complaints.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:1.5rem">No complaints found.</td></tr>';
            return;
        }

        complaints.forEach(c => {
            const isResolved = c.status === 'resolved' || c.status === 'closed';
            
            // Badge styling matching the screenshot
            const statusClass = isResolved ? 'b-green' : 'b-amber';
            const statusDisplay = c.status.charAt(0).toUpperCase() + c.status.slice(1);
            
            // Action column mapping
            const actionHtml = isResolved 
                ? `<span style="font-size:.85rem;color:var(--muted)">Closed</span>`
                : `<button class="btn-gold-sm" onclick="resolveAdminComplaint(${c.case_id})">Resolve</button>`;

            const orderRef = c.order_id ? `#ORD-${c.order_id}` : 'N/A';

            tbody.innerHTML += `
                <tr>
                    <td><strong>CMP-${String(c.case_id).padStart(3, '0')}</strong></td>
                    <td>${c.customer_name || 'Unknown'}</td>
                    <td>${c.category || 'General'}</td>
                    <td>${orderRef}</td>
                    <td><span class="badge ${statusClass}">${statusDisplay}</span></td>
                    <td style="text-align:right">${actionHtml}</td>
                </tr>
            `;
        });
    } catch (error) {
        console.error("Admin Complaints Load Error:", error);
        if (byId('a-complaints-tbody')) {
            byId('a-complaints-tbody').innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:1.5rem">Failed to load complaints. Is the backend running?</td></tr>';
        }
    }
};

window.resolveAdminComplaint = async function(id) {
    if (!confirm('Mark this complaint as resolved?')) return;
    try {
        await fetchWithAuth(`/admin/complaints/${id}/resolve`, { method: 'PATCH' });
        loadAdminComplaints(); // Refresh the table
    } catch (e) {
        alert('Error resolving complaint: ' + e.message);
    }
};

window.loadAdminServices = async function() {
    try {
        const tbody = byId('a-svc-tbody');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:1.5rem">Loading services...</td></tr>';

        const services = await fetchWithAuth('/admin/services');
        tbody.innerHTML = '';

        if (!services || services.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:1.5rem">No services found.</td></tr>';
            return;
        }

        services.forEach(svc => {
            const isActive = svc.is_enabled;
            const statusClass = isActive ? 'b-green' : 'b-amber';
            const statusText = isActive ? 'Active' : 'Inactive';
            
            // Assign CSS classes instead of inline style strings
            const btnClass = isActive ? 'btn-outline-sm btn-svc-disable' : 'btn-outline-sm btn-svc-enable';
            const btnText = isActive ? 'Disable' : 'Enable';

            // Safely encode service data for the modal
            const svcData = encodeURIComponent(JSON.stringify(svc));

            tbody.innerHTML += `
                <tr>
                    <td><strong>${svc.service_name}</strong></td>
                    <td>${svc.category || 'General'}</td>
                    <td>${svc.order_count || 0}</td>
                    <td><span class="badge ${statusClass}">${statusText}</span></td>
                    <td style="text-align:right">
                        <div style="display:flex; gap:0.5rem; justify-content:flex-end">
                            <button class="btn-outline-sm" onclick="openEditSvc('${svcData}')">Edit</button>
                            <button class="${btnClass}" onclick="toggleAdminSvc(${svc.service_id}, ${!isActive})">${btnText}</button>
                        </div>
                    </td>
                </tr>
            `;
        });
    } catch (error) {
        console.error("Admin Services Load Error:", error);
        if (byId('a-svc-tbody')) {
            byId('a-svc-tbody').innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:1.5rem">Failed to load services. Is the backend running?</td></tr>';
        }
    }
};

// ==========================================
// SUPERVISOR NOTIFICATIONS
// ==========================================
window.toggleSupNotifs = function() {
    const drop = document.getElementById('s-notif-dropdown');
    if (!drop) return;
    
    drop.classList.toggle('show');
    
    if (drop.classList.contains('show')) {
        loadSupervisorNotifications();
    }
};

// Close dropdown if clicking anywhere else
document.addEventListener('click', e => {
    if (!e.target.closest('.notif-wrap')) {
        const drop = document.getElementById('s-notif-dropdown');
        if (drop) drop.classList.remove('show');
    }
});

window.loadSupervisorNotifications = async function() {
    const list = document.getElementById('s-notif-list');
    const badge = document.getElementById('s-notif-count');
    if (!list) return;

    try {
        const notifs = await fetchWithAuth('/supervisor/notifications');
        
        if (badge) badge.textContent = notifs.length > 0 ? `${notifs.length} New` : '0';

        list.innerHTML = '';
        
        // Handle empty state
        if (!notifs || notifs.length === 0) {
            list.innerHTML = '<div style="padding:1.5rem;text-align:center;color:var(--muted);font-size:.85rem">No new notifications.</div>';
            return;
        }

        notifs.forEach(n => {
            const timeObj = new Date(n.time);
            const timeStr = isNaN(timeObj) ? 'Recently' : timeObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            
            list.innerHTML += `
                <div class="notif-item">
                    <div class="notif-icon ${n.iconClass}">${n.icon}</div>
                    <div>
                        <div style="font-size:0.8rem;font-weight:700;color:var(--g900)">${n.title}</div>
                        <div class="notif-text">${n.message}</div>
                        <div class="notif-time">${timeStr}</div>
                    </div>
                </div>
            `;
        });
    } catch (e) {
        console.error("Notifications Error:", e);
        // Fallback safely if there is a network error
        if (list) {
            list.innerHTML = '<div style="padding:1.5rem;text-align:center;color:var(--muted);font-size:.85rem">No new notifications.</div>';
        }
    }
};


})(); 