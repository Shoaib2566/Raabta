// Raabta frontend interactions
// Backend team: configure API base with window.API_BASE_URL before loading this file if needed.
(function(){
'use strict';
const API_BASE_URL = window.API_BASE_URL || 'http://localhost:8000/api';
const pageIds=['pg-home','pg-auth','pg-customer','pg-admin','pg-supervisor'];
const byId=id=>document.getElementById(id);
const nativeScroll=window.scrollTo.bind(window);

window.setPB=function(btn){document.querySelectorAll('.pb-btn').forEach(b=>b.classList.remove('cur')); if(btn)btn.classList.add('cur');};
window.setPBByPage=function(id){const map={'pg-home':0,'pg-auth':1,'pg-customer':2,'pg-admin':3,'pg-supervisor':4}; const btns=document.querySelectorAll('.pb-btn'); btns.forEach(b=>b.classList.remove('cur')); if(map[id]!==undefined&&btns[map[id]])btns[map[id]].classList.add('cur');};
    
window.goPage=function(id){pageIds.forEach(pid=>{const p=byId(pid); if(p)p.classList.toggle('active',pid===id)});setPBByPage(id);nativeScroll({top:0,left:0,behavior:'auto'});};
window.scrollToSection=function(id){goPage('pg-home');setTimeout(()=>{const el=byId(id); if(el)el.scrollIntoView({behavior:'smooth',block:'start'});},80);};
window.scrollTo=function(arg){if(typeof arg==='string')return scrollToSection(arg); return nativeScroll(arg);};
window.authTab=function(mode,btn){document.querySelectorAll('.auth-tab').forEach(b=>b.classList.remove('active'));document.querySelectorAll('.auth-panel').forEach(p=>p.classList.remove('active'));const tabs=document.querySelectorAll('.auth-tab'); if(btn)btn.classList.add('active'); else if(tabs[mode==='login'?0:1])tabs[mode==='login'?0:1].classList.add('active'); byId('ap-'+mode)?.classList.add('active'); if(byId('auth-heading'))byId('auth-heading').textContent=mode==='login'?'Welcome Back':'Create Account'; if(byId('auth-sub'))byId('auth-sub').textContent=mode==='login'?'Sign in to your Raabta account':'Join thousands using Raabta';};

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
            body: JSON.stringify({
                full_name: nameInput,
                email: emailInput,
                password: passwordInput,
                role: roleInput
            })
        });

        const data = await response.json();

        if (response.ok) {
            alert('Account created successfully in the database!');
            localStorage.setItem('raabta_token', data.token);
            
            
            if(data.user.role === 'admin') goPage('pg-admin');
            else if(data.user.role === 'supervisor') goPage('pg-supervisor');
            else goPage('pg-customer');
        } else {
            alert('Signup Failed: ' + data.error);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Could not connect to the backend. Is Port 8000 running?');
    }
};

window.authLogin = async function() {
    const emailInput = document.querySelector('#ap-login input[type="email"]').value;
    const passwordInput = document.querySelector('#ap-login input[type="password"]').value;

    if (!emailInput || !passwordInput) {
        alert("Please enter both email and password.");
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: emailInput, password: passwordInput })
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('raabta_token', data.token);
            
            if(data.user.role === 'admin') goPage('pg-admin');
            else if(data.user.role === 'supervisor') goPage('pg-supervisor');
            else goPage('pg-customer');
        } else {
            alert('Login Failed: ' + data.error);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Could not connect to the backend. Is Port 8000 running?');
    }
};






function showSection(scope,id,link,titleId,titles){document.querySelectorAll(`#${scope} .dsection`).forEach(s=>s.classList.remove('active'));document.querySelectorAll(`#${scope} .sb-link`).forEach(a=>a.classList.remove('active'));byId(id)?.classList.add('active'); if(link)link.classList.add('active'); if(byId(titleId)&&titles[id])byId(titleId).textContent=titles[id];}
window.cShow=function(id,link){const ids=['c-dash','c-neworder','c-services','c-history','c-plans','c-complaints','c-profile']; if(!link){const i=ids.indexOf(id); link=i>=0?document.querySelectorAll('#pg-customer .sb-link')[i]:null} showSection('pg-customer',id,link,'c-title',{'c-dash':'Dashboard','c-neworder':'New Order','c-services':'Services','c-history':'Order History','c-plans':'My Plan','c-complaints':'Complaints','c-profile':'Profile'});};
window.aShow=function(id,link){const ids=['a-services','a-analytics','a-users','a-logs','a-complaints']; if(!link){const i=ids.indexOf(id); link=i>=0?document.querySelectorAll('#pg-admin .sb-link')[i]:null} showSection('pg-admin',id,link,'a-title',{'a-services':'Services','a-analytics':'Analytics','a-users':'User Management','a-logs':'Activity Logs','a-complaints':'Complaints'});};
window.sShow=function(id,link){const ids=['s-orders','s-assign','s-status','s-providers']; if(!link){const i=ids.indexOf(id); link=i>=0?document.querySelectorAll('#pg-supervisor .sb-link')[i]:null} showSection('pg-supervisor',id,link,'s-title',{'s-orders':'Orders','s-assign':'Assign Order','s-status':'Update Status','s-providers':'Provider Directory'});};
window.openRate=()=>byId('rate-modal')?.classList.add('open'); window.closeRate=()=>byId('rate-modal')?.classList.remove('open'); window.setRating=n=>document.querySelectorAll('.star').forEach((s,i)=>s.classList.toggle('lit',i<n)); window.submitRate=function(){closeRate();alert('✅ Thank you! Your rating has been saved.');};
window.trackOrder=function(){const v=(byId('track-input')?.value||'').trim(); if(!v){alert('Please enter an Order ID.');return} if(byId('tm-id'))byId('tm-id').textContent=v; if(byId('tm-title'))byId('tm-title').textContent='Order Status — '+v; byId('track-modal')?.classList.add('open');}; window.closeTrack=()=>byId('track-modal')?.classList.remove('open');
window.submitComplaint=function(){const order=(byId('complaint-order')?.value||'').trim()||'N/A'; const type=(byId('complaint-type')?.value||'').trim(); const details=(byId('complaint-details')?.value||'').trim(); if(!type){alert('Please select a complaint type.');return} if(!details){alert('Please add complaint details.');return} const id='CMP-'+Math.floor(100+Math.random()*900); const tr=document.createElement('tr'); tr.innerHTML=`<td><strong>${id}</strong></td><td>${order}</td><td>${type}</td><td><span class="badge b-amber">Open</span></td>`; byId('complaint-list')?.prepend(tr); ['complaint-order','complaint-type','complaint-details'].forEach(x=>{if(byId(x))byId(x).value=''}); alert(`✅ Complaint submitted. Your complaint ID is ${id}.`);};
window.openAddSvc=()=>byId('addsvc-modal')?.classList.add('open'); window.closeAddSvc=()=>byId('addsvc-modal')?.classList.remove('open');
window.doAddSvc=function(){const input=byId('new-svc');const name=(input?.value||'').trim(); if(!name){alert('Enter a service name.');return} const tr=document.createElement('tr');tr.innerHTML=`<td><strong>${name}</strong></td><td>General</td><td>0</td><td><span class="badge b-green">Active</span></td><td><div class="td-actions"><button class="btn-outline-sm" onclick="editSvc(this)">Edit</button><button class="btn-danger-sm" onclick="toggleSvc(this)">Disable</button></div></td>`; byId('a-svc-tbody')?.appendChild(tr); if(input)input.value=''; closeAddSvc();};
window.editSvc=function(btn){const s=btn.closest('tr')?.querySelector('strong'); if(!s)return; const n=prompt('Edit service name:',s.textContent); if(n)s.textContent=n;};
window.toggleSvc=function(btn){const b=btn.closest('tr')?.querySelector('.badge'); if(!b)return; const on=b.classList.contains('b-green'); b.className='badge '+(on?'b-amber':'b-green'); b.textContent=on?'Inactive':'Active'; btn.textContent=on?'Enable':'Disable'; btn.className=on?'btn-g':'btn-danger-sm';};
window.sGoAssign=function(id,svc){if(byId('s-assign-info'))byId('s-assign-info').textContent=`${id} — ${svc}`; sShow('s-assign');};
window.sGoStatus=function(id){if(byId('s-status-info'))byId('s-status-info').textContent=id; sShow('s-status');};
window.doAssign=function(){alert('Assignment saved in demo mode. Connect PATCH /orders/:id/assign for backend integration.');};
window.doStatus=function(){alert('Status updated in demo mode. Connect PATCH /orders/:id/status for backend integration.');};
function bindNavigation(){document.querySelectorAll('.nav-links a').forEach(a=>{const t=a.textContent.toLowerCase(); if(t.includes('about'))a.onclick=e=>{e.preventDefault();scrollToSection('about-anchor')}; if(t.includes('services'))a.onclick=e=>{e.preventDefault();scrollToSection('services-anchor')}; if(t.includes('pricing'))a.onclick=e=>{e.preventDefault();scrollToSection('pricing-anchor')};}); 
    document.querySelectorAll('.preview-bar .pb-btn').forEach(btn=>btn.onclick=e=>{e.preventDefault();const t=btn.textContent;if(t.includes('Home'))goPage('pg-home');else if(t.includes('Auth'))goPage('pg-auth');else if(t.includes('Customer'))goPage('pg-customer');else if(t.includes('Admin'))goPage('pg-admin');else if(t.includes('Supervisor'))goPage('pg-supervisor');});
     const explore=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Explore Services')); if(explore)explore.onclick=e=>{e.preventDefault();scrollToSection('services-anchor')};}
document.addEventListener('click',e=>{const target=e.target.closest('button,a,.sb-link'); if(!target)return; const txt=target.textContent.trim(); if(target.closest('#pg-customer .sb-nav')){const links=[...document.querySelectorAll('#pg-customer .sb-link')],ids=['c-dash','c-neworder','c-services','c-history','c-plans','c-complaints','c-profile'],i=links.indexOf(target); if(i>=0){e.preventDefault();cShow(ids[i],target);return}} if(target.closest('#pg-admin .sb-nav')){const links=[...document.querySelectorAll('#pg-admin .sb-link')],ids=['a-services','a-analytics','a-users','a-logs','a-complaints'],i=links.indexOf(target); if(i>=0){e.preventDefault();aShow(ids[i],target);return}} if(target.closest('#pg-supervisor .sb-nav')){const links=[...document.querySelectorAll('#pg-supervisor .sb-link')],ids=['s-orders','s-assign','s-status','s-providers'],i=links.indexOf(target); if(i>=0){e.preventDefault();sShow(ids[i],target);return}} if(txt==='Submit Complaint'){e.preventDefault();submitComplaint();}});
document.addEventListener('DOMContentLoaded',bindNavigation); if(document.readyState!=='loading')bindNavigation();
})();
