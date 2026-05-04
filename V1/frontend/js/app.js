// Raabta frontend interactions - FULLY CONNECTED TO BACKEND
(function(){
'use strict';
const API_BASE_URL = window.API_BASE_URL || 'http://localhost:8000/api';
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
        alert("Error submitting order: " + e.message);
    }
};

// ==========================================
// VIEW SWITCHERS & EVENTS
// ==========================================
function showSection(scope,id,link,titleId,titles){document.querySelectorAll(`#${scope} .dsection`).forEach(s=>s.classList.remove('active'));document.querySelectorAll(`#${scope} .sb-link`).forEach(a=>a.classList.remove('active'));byId(id)?.classList.add('active'); if(link)link.classList.add('active'); if(byId(titleId)&&titles[id])byId(titleId).textContent=titles[id];}

window.cShow=function(id,link){
    const ids=['c-dash','c-neworder','c-services','c-history','c-plans','c-complaints','c-profile']; 
    if(!link){const i=ids.indexOf(id); link=i>=0?document.querySelectorAll('#pg-customer .sb-link')[i]:null} 
    showSection('pg-customer',id,link,'c-title',{'c-dash':'Dashboard','c-neworder':'New Order','c-services':'Services','c-history':'Order History','c-plans':'My Plan','c-complaints':'Complaints','c-profile':'Profile'});
    
    // 🔥 THIS TRIGGERS THE DATA FETCH 🔥
    if (id === 'c-dash') loadCustomerDashboard();
    if (id === 'c-history') loadCustomerOrders();
    if (id === 'c-complaints') loadCustomerComplaints(); // <-- Add this line
};

window.aShow=function(id,link){const ids=['a-services','a-analytics','a-users','a-logs','a-complaints']; if(!link){const i=ids.indexOf(id); link=i>=0?document.querySelectorAll('#pg-admin .sb-link')[i]:null} showSection('pg-admin',id,link,'a-title',{'a-services':'Services','a-analytics':'Analytics','a-users':'User Management','a-logs':'Activity Logs','a-complaints':'Complaints'});};
window.sShow=function(id,link){const ids=['s-orders','s-assign','s-status','s-providers']; if(!link){const i=ids.indexOf(id); link=i>=0?document.querySelectorAll('#pg-supervisor .sb-link')[i]:null} showSection('pg-supervisor',id,link,'s-title',{'s-orders':'Orders','s-assign':'Assign Order','s-status':'Update Status','s-providers':'Provider Directory'});};

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
window.doAddSvc = async function() {
    const name = (byId('new-svc')?.value || '').trim();
    if (!name) { alert('Enter a service name.'); return; }
    try {
        const data = await fetchWithAuth('/admin/services', {
            method: 'POST',
            body: JSON.stringify({ service_name: name, category: 'General', description: '', base_price_estimate: 0 })
        });
        const tr = document.createElement('tr');
        tr.innerHTML = `<td><strong>${name}</strong></td><td>General</td><td>0</td><td><span class="badge b-green">Active</span></td><td><div class="td-actions"><button class="btn-outline-sm" onclick="editSvc(this)">Edit</button><button class="btn-danger-sm" onclick="toggleSvc(this)">Disable</button></div></td>`;
        byId('a-svc-tbody')?.appendChild(tr);
        byId('new-svc').value = '';
        closeAddSvc();
    } catch(e) { alert('Error adding service: ' + e.message); }
};

window.editSvc=function(btn){const s=btn.closest('tr')?.querySelector('strong'); if(!s)return; const n=prompt('Edit service name:',s.textContent); if(n)s.textContent=n;};
window.toggleSvc=function(btn){const b=btn.closest('tr')?.querySelector('.badge'); if(!b)return; const on=b.classList.contains('b-green'); b.className='badge '+(on?'b-amber':'b-green'); b.textContent=on?'Inactive':'Active'; btn.textContent=on?'Enable':'Disable'; btn.className=on?'btn-g':'btn-danger-sm';};
window.sGoAssign=function(id,svc){if(byId('s-assign-info'))byId('s-assign-info').textContent=`${id} — ${svc}`; sShow('s-assign');};
window.sGoStatus=function(id){if(byId('s-status-info'))byId('s-status-info').textContent=id; sShow('s-status');};

window.doAssign = async function() {
    const orderText = byId('s-assign-info')?.textContent || '';
    const order_id = orderText.match(/\d+/)?.[0];
    const provider_id = byId('s-provider')?.value;
    const provider_response = byId('s-prov-response')?.value;
    if (!order_id || !provider_id) { alert('Select an order and a provider.'); return; }
    try {
        await fetchWithAuth('/supervisor/assign', {
            method: 'POST',
            body: JSON.stringify({ order_id: parseInt(order_id), provider_id, provider_response })
        });
        alert('✅ Order assigned successfully.');
    } catch(e) { alert('Error assigning order: ' + e.message); }
};
window.doStatus = async function() {
    const orderText = byId('s-status-info')?.textContent || '';
    const order_id = orderText.match(/\d+/)?.[0];
    const new_status = byId('s-new-status')?.value?.toLowerCase().replace(' ', '_');
    if (!order_id || !new_status) { alert('Select an order and a new status.'); return; }
    try {
        await fetchWithAuth('/supervisor/status', {
            method: 'POST',
            body: JSON.stringify({ order_id: parseInt(order_id), new_status })
        });
        alert('✅ Status updated successfully.');
    } catch(e) { alert('Error updating status: ' + e.message); }
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
        if(i>=0){e.preventDefault();sShow(ids[i],target);return}
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

})();