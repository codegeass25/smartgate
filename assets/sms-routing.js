/* SMARTGATE admin-only dynamic routing UI. Calls protected backend APIs. */
'use strict';
let routeView={mode:'1:2',mapping:{},senderIds:[],profiles:[],routes:[]};
const er=escapeHTML;
function selector(profiles,value,name){
 return `<select class="select" name="${er(name)}" required><option value="">Choose sender SIM…</option>${profiles.map(p=>`<option value="${p.id}" ${Number(value)===p.id?'selected':''}>${er(p.label)} — ${er(p.sender_mobile_masked)} ${p.enabled?'':'(Disabled)'}</option>`).join('')}</select>`;
}
async function smsRoutingUI(){
 const root=$('#sms-routing-manager');if(!root)return;
 const [data,status]=await Promise.all([api('/api/sms/routing'),api('/api/sms/status')]);
 routeView.profiles=data.senders;routeView.routes=data.routes;routeView.mode=data.mode||'1:2';routeView.senderIds=[];
 root.innerHTML=`<div class="card stack" style="margin:0 0 18px">
 <div class="toolbar"><div><h2>Multi-Device SMSGate Routing</h2><p class="small-note">Routing is based on the learner's grade, NOT the RFID station. Credentials are private in backend .env.</p></div>${pill(status.mode==='mock'?'Mock / no real SMS':status.live_enabled?'Live SMSGate':'Live unavailable')}</div>
 <div class="grid-two">
 <div class="card" style="padding:13px"><strong>${data.senders.length} sender SIM profiles</strong><small style="display:block">${data.senders.filter(p=>p.enabled).length} enabled</small></div>
 <div class="card" style="padding:13px"><strong>${data.routes.length}/6 grades assigned</strong><small style="display:block">SMSGate login: ${data.credentials_configured?'Configured':'Not configured'}</small></div>
 </div>
 <div class="toolbar"><h3>Android Devices & Sender SIMs</h3><div class="row"><button class="btn outline small" id="sms-discover" type="button">Check SMSGate Devices</button><button class="btn primary small" id="sms-add" type="button">+ Add Sender SIM</button></div></div>
 <div id="sms-discovery"></div>
 <div id="sms-sender-form"></div>
 ${data.senders.length?`<div class="table-wrap"><table><thead><tr><th>SIM Profile</th><th>Device</th><th>SIM / Number</th><th>Safety Caps</th><th>Backup</th><th>Action</th></tr></thead><tbody>${data.senders.map(p=>`<tr><td><strong>${er(p.label)}</strong><small style="display:block">${p.enabled?'Active':'Disabled'}</small></td><td><code>${er(p.device_id)}</code></td><td>Slot ${p.sim_number} · ${er(p.sender_mobile_masked)}</td><td>${p.per_minute}/min · ${p.per_day}/day</td><td>${p.allow_failover?'Enabled → SIM #'+p.backup_sender_id:'Queue only'}</td><td><div class="row"><button class="btn outline small" data-sms-edit="${p.id}">Edit</button><button class="btn small ${p.enabled?'red':'outline'}" data-sms-toggle="${p.id}">${p.enabled?'Disable':'Enable'}</button></div></td></tr>`).join('')}</tbody></table></div>`:'<p class="small-note">No SIM profiles registered. Add your Android SMSGate device ID, SIM slot and sender number first.</p>'}
 <div class="section-row"><h3>Grade-Level Routing</h3></div>
 <p class="small-note">1:1 = 6 SIMs · 1:2 = 3 SIMs (recommended) · 1:3 = 2 SIMs · Custom = assign any grade to any registered SIM. Changes apply to jobs not yet sent; already-started jobs stay locked to their sender.</p>
 <form id="sms-route-form" class="stack"><div class="form-row"><label>Assignment mode</label><select class="select" id="sms-route-mode"><option value="1:1">1 SIM : 1 grade</option><option value="1:2">1 SIM : 2 grades</option><option value="1:3">1 SIM : 3 grades</option><option value="custom">Custom grade routing</option></select></div><div id="sms-route-choices"></div><button class="btn primary" type="submit">Save Grade Assignments</button></form>
 <div class="auth-note">Offline/unknown SIM: queue automatically, never use a random device. Failover is permitted ONLY to the explicitly assigned backup before the first provider submission. Unknown delivery outcome is never auto-retried.</div>
 </div>`;
 $('#sms-route-mode').value=routeView.mode;
 const map=Object.fromEntries(data.routes.map(x=>[String(x.grade),x.sender_id]));
 routeView.mapping=map;
 const chosen=routeView.mode==='1:1'?[7,8,9,10,11,12]:routeView.mode==='1:2'?[7,9,11]:[7,10];
 if(!routeView.senderIds.length)routeView.senderIds=chosen.map(g=>map[g]||'');
 renderRouteSelectors();
 $('#sms-route-mode').onchange=e=>{routeView.mode=e.target.value;routeView.senderIds=[];renderRouteSelectors();};
 $('#sms-route-form').onsubmit=async e=>{
  e.preventDefault();try{let b,fd=new FormData(e.target);if(routeView.mode==='custom')b={mode:'custom',routes:Object.fromEntries([7,8,9,10,11,12].map(g=>[g,Number(fd.get('grade_'+g))]))};
  else{const n=routeView.mode==='1:1'?6:routeView.mode==='1:2'?3:2;b={mode:routeView.mode,sender_ids:Array.from({length:n},(_,i)=>Number(fd.get('sender_'+i)))};}
  await api('/api/sms/routing',{method:'POST',body:b});toast('Grade-to-SIM routing saved');await smsRoutingUI();
  }catch(err){toast(err.message);}
 };
 $('#sms-add').onclick=()=>senderForm();
 $$('[data-sms-edit]').forEach(b=>b.onclick=()=>senderForm(data.senders.find(x=>x.id===Number(b.dataset.smsEdit))));
 $$('[data-sms-toggle]').forEach(b=>b.onclick=async()=>{const p=data.senders.find(x=>x.id===Number(b.dataset.smsToggle));if(!confirm((p.enabled?'Disable':'Enable')+' sender '+p.label+'?'))return;try{await api('/api/sms/senders/'+p.id+'/status',{method:'POST',body:{enabled:!p.enabled}});toast('Sender changed');await smsRoutingUI();}catch(err){toast(err.message);}});
 $('#sms-discover').onclick=async()=>{const box=$('#sms-discovery');box.textContent='Checking SMSGate Android devices…';try{const r=await api('/api/sms/devices');box.innerHTML=`<div class="table-wrap"><table><thead><tr><th>Android device ID</th><th>Name</th><th>Connection</th><th>Visible SIM slots</th></tr></thead><tbody>${r.devices.map(d=>`<tr><td><code>${er(d.id)}</code></td><td>${er(d.name)}</td><td>${pill(d.online)}</td><td>${er(d.sims.map(s=>`SIM ${s.sim_number} ${s.phone_masked}`).join(' · ')||'SIM permission unavailable')}</td></tr>`).join('')||'<tr><td colspan="4">No SMSGate device returned</td></tr>'}</tbody></table></div>`;}catch(err){box.textContent=err.message;}};
}
function renderRouteSelectors(){
 const box=$('#sms-route-choices');if(!box)return;
 const mode=routeView.mode,p=routeView.profiles,map=routeView.mapping;
 let grades=mode==='1:1'?[{t:'Grade 7',g:[7]},{t:'Grade 8',g:[8]},{t:'Grade 9',g:[9]},{t:'Grade 10',g:[10]},{t:'Grade 11',g:[11]},{t:'Grade 12',g:[12]}]:mode==='1:2'?[{t:'Grades 7–8',g:[7,8]},{t:'Grades 9–10',g:[9,10]},{t:'Grades 11–12',g:[11,12]}]:mode==='1:3'?[{t:'Grades 7–9',g:[7,8,9]},{t:'Grades 10–12',g:[10,11,12]}]:[7,8,9,10,11,12].map(g=>({t:'Grade '+g,g:[g]}));
 box.innerHTML=`<div class="grid-two">${grades.map((group,i)=>`<div class="form-row"><label>${group.t}</label>${selector(p,mode==='custom'?map[group.g[0]]:routeView.senderIds[i]||map[group.g[0]],mode==='custom'?'grade_'+group.g[0]:'sender_'+i)}</div>`).join('')}</div>`;
}
function senderForm(profile=null){
 const wrap=$('#sms-sender-form');if(!wrap)return;
 const p=profile||{label:'',device_id:'',sim_number:1,sender_mobile_masked:'',enabled:true,per_minute:10,per_day:3000,backup_sender_id:null,allow_failover:false};
 wrap.innerHTML=`<form class="card stack" id="sms-sender-editor" style="margin:12px 0"><div class="toolbar"><h3>${profile?'Edit':'Register'} SMSGate Sender Profile</h3><button type="button" class="btn outline small" id="sms-sender-cancel">Close</button></div>
 <div class="grid-two">
 <div class="form-row"><label>Sender label</label><input class="input" name="label" maxlength="75" required value="${er(p.label)}" placeholder="Grades 7-8 SMS"></div>
 <div class="form-row"><label>Exact SMSGate device ID</label><input class="input" name="device_id" maxlength="150" required value="${er(p.device_id)}" placeholder="Android Device ID"></div>
 <div class="form-row"><label>Physical SIM slot</label><select class="select" name="sim_number">${[1,2,3,4].map(n=>`<option value="${n}" ${p.sim_number===n?'selected':''}>SIM ${n}</option>`).join('')}</select></div>
 <div class="form-row"><label>Sender SIM mobile ${profile?'(blank = keep '+er(p.sender_mobile_masked)+')':''}</label><input class="input" name="sender_mobile" type="tel" placeholder="0917XXXXXXX" ${profile?'':'required'} autocomplete="off"></div>
 <div class="form-row"><label>Max messages per minute (per SIM)</label><input class="input" type="number" name="per_minute" min="1" max="60" required value="${p.per_minute}"></div>
 <div class="form-row"><label>Max messages per day (per SIM)</label><input class="input" type="number" name="per_day" min="1" max="20000" required value="${p.per_day}"></div>
 <div class="form-row"><label>Backup SIM (optional)</label><select class="select" name="backup_sender_id"><option value="">None — queue until available</option>${routeView.profiles.filter(x=>x.id!==p.id).map(x=>`<option value="${x.id}" ${p.backup_sender_id===x.id?'selected':''}>${er(x.label)}</option>`).join('')}</select></div>
 <div class="form-row"><label>When primary is offline</label><select class="select" name="allow_failover"><option value="false">Queue (default)</option><option value="true" ${p.allow_failover?'selected':''}>Use selected backup before first attempt</option></select></div>
 <div class="form-row"><label>Profile enabled</label><select class="select" name="enabled"><option value="true">Enabled</option><option value="false" ${!p.enabled?'selected':''}>Disabled</option></select></div>
 </div><button class="btn primary" type="submit">Save Sender Profile</button><p class="small-note">Server will verify the exact device ID, slot, SIM number suffix and online signal from SMSGate before each send. Live API credentials never appear here.</p></form>`;
 $('#sms-sender-cancel').onclick=()=>wrap.innerHTML='';
 $('#sms-sender-editor').onsubmit=async e=>{e.preventDefault();let b=Object.fromEntries(new FormData(e.target));if(profile)b.id=profile.id;
 b.sim_number=Number(b.sim_number);b.per_minute=Number(b.per_minute);b.per_day=Number(b.per_day);b.backup_sender_id=b.backup_sender_id?Number(b.backup_sender_id):null;b.enabled=b.enabled==='true';b.allow_failover=b.allow_failover==='true';
 try{await api('/api/sms/senders',{method:'POST',body:b});toast('Sender SIM saved');await smsRoutingUI();}catch(err){toast(err.message);}};
}
