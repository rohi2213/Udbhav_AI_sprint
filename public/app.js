const $=s=>document.querySelector(s);
const LS={get(k,d){try{const v=JSON.parse(localStorage.getItem(k));return v??d}catch{return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}}};
const inr=n=>'₹'+Math.round(n).toLocaleString('en-IN');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let profile=LS.get('sm_profile',null),plan=LS.get('sm_plan',null),done=LS.get('sm_done',{}),stage=0,svc=[],sel=[];
if(!plan||!Array.isArray(plan.stages))plan=null;if(typeof done!=='object'||!done)done={};
$('#menuBtn').onclick=e=>{const o=$('#links').classList.toggle('open');e.target.setAttribute('aria-expanded',o)};
$('#links').onclick=()=>$('#links').classList.remove('open');

/* Planner */
function renderPlan(){
  const box=$('#planBox');if(!plan){box.innerHTML='<p class="empty">No plan yet. Complete the form above to generate one.</p>';return}
  const all=plan.stages.flatMap(s=>s.tasks),n=all.filter(t=>done[t.id]).length,pct=all.length?Math.round(n/all.length*100):0;
  const shown=plan.stages.filter(s=>!stage||s.id===stage);
  box.innerHTML=`<div class="card"><p>Plan for <b>${esc(plan.generatedFor.city)}</b> (${esc(plan.generatedFor.purpose)}). <b>${pct}%</b> complete — ${all.length-n} tasks remaining.</p><div class="bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div>
  <div class="stagebtns"><button class="btn ghost" data-s="0">All stages</button>${plan.stages.map(s=>`<button class="btn ghost" data-s="${s.id}">Stage ${s.id}</button>`).join('')}<button class="btn ghost" id="resetPlan">Reset checklist</button></div>
  ${shown.map(s=>`<h3>${esc(s.title)}</h3>${s.tasks.map(t=>`<label class="task ${done[t.id]?'d':''}"><input type="checkbox" data-t="${t.id}" ${done[t.id]?'checked':''}><span>${esc(t.text)}</span></label>`).join('')}`).join('')}</div>`;
}
$('#planBox').onclick=e=>{const b=e.target;if(b.dataset.s!==undefined){stage=+b.dataset.s;renderPlan()}
  else if(b.id==='resetPlan'&&confirm('Reset all checklist progress?')){done={};LS.set('sm_done',done);renderPlan()}};
$('#planBox').onchange=e=>{const id=e.target.dataset.t;if(!id)return;done[id]=e.target.checked;LS.set('sm_done',done);renderPlan()};

/* Onboarding */
$('#form').onsubmit=async e=>{e.preventDefault();const f=e.target,d=Object.fromEntries(new FormData(f)),msg=$('#formMsg');
  f.querySelectorAll('.err').forEach(x=>x.textContent='');let bad=false;
  if(!d.city.trim()){f.elements.city.nextElementSibling.textContent='Please enter a city.';bad=true}
  const b=Number(d.budget);if(!(b>=1000&&b<=500000)){f.elements.budget.nextElementSibling.textContent='Enter a budget between ₹1,000 and ₹5,00,000.';bad=true}
  if(bad){msg.className='err';msg.textContent='Please fix the highlighted fields.';return}
  d.budget=b;msg.className='';msg.textContent='Building your plan…';
  try{const r=await fetch('/api/plan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}),j=await r.json();
    if(!r.ok||!j.ok)throw new Error(j.error||'Request failed');
    profile=d;plan=j.plan;done={};stage=0;LS.set('sm_profile',d);LS.set('sm_plan',plan);LS.set('sm_done',done);
    budget=defaults(b);LS.set('sm_budget',budget);renderBudget();renderPlan();
    if(d.locality)$('#loc').value=[...$('#loc').options].some(o=>o.value===d.locality)?d.locality:'';filterSvc();
    msg.className='ok';msg.textContent='Plan created!';$('#dashboard').scrollIntoView({behavior:'smooth'});
  }catch(err){msg.className='err';msg.textContent='Could not build plan: '+err.message}};
if(profile)for(const[k,v]of Object.entries(profile)){const el=$('#form').elements[k];if(el)el.value=v}

/* Services */
const old=s=>s.lastConfirmed&&(Date.now()-new Date(s.lastConfirmed))>90*864e5?'<p class="warn">Last confirmed over 90 days ago — may be outdated.</p>':'';
const price=s=>s.priceMin!=null?(s.priceMin===s.priceMax?inr(s.priceMin):inr(s.priceMin)+'–'+inr(s.priceMax)):'Price not available';
function filterSvc(){
  const q=$('#q').value.toLowerCase(),c=$('#cat').value,l=$('#loc').value,mp=Number($('#maxp').value)||0,so=$('#sort').value;
  let r=svc.filter(s=>(!q||(s.name+s.description+s.category).toLowerCase().includes(q))&&(!c||s.category===c)&&(!l||s.locality===l)&&(!$('#vo').checked||s.verification==='verified')&&(!mp||(s.priceMin!=null&&s.priceMin<=mp)));
  if(so)r=r.filter(s=>s.priceMin!=null).sort((a,b)=>so==='asc'?a.priceMin-b.priceMin:b.priceMin-a.priceMin);
  $('#svcList').innerHTML=r.length?r.map(s=>`<article class="card"><span class="badge">${s.verification==='verified'?'Verified':s.verification==='demo'?'Demo':'Provider-listed, unverified'}</span><h3>${esc(s.name)}</h3><p class="mut">${esc(s.category)} · ${esc(s.locality)}</p><p>${esc(s.description)}</p><p><b>Price:</b> ${price(s)}</p><p class="mut">Contact: ${s.contact?esc(s.contact):'not available'} · Source: ${esc(s.source)} · Last confirmed: ${esc(s.lastConfirmed||'not available')}</p><p class="mut">${esc(s.note)}</p>${old(s)}<button class="lnk" data-rep="${esc(s.id)}">Report incorrect info</button></article>`).join(''):'<p class="empty">No services match your filters. Try clearing them.</p>';
}
['q','cat','loc','maxp','sort','vo'].forEach(i=>$('#'+i).addEventListener('input',filterSvc));
$('#clear').onclick=()=>{$('#vo').checked=false;['q','maxp'].forEach(i=>$('#'+i).value='');['cat','loc','sort'].forEach(i=>$('#'+i).selectedIndex=0);filterSvc()};
async function loadSvc(){try{const j=await(await fetch('/api/services')).json();svc=j.services||[]}catch{$('#svcList').innerHTML='<p class="empty">Could not load services. Is the server running?</p>';return}
  const opt=(id,a,label)=>$('#'+id).innerHTML=`<option value="">${label}</option>`+[...new Set(a)].map(x=>`<option>${esc(x)}</option>`).join('');
  opt('cat',svc.map(s=>s.category),'All categories');opt('loc',svc.map(s=>s.locality),'All localities');filterSvc();renderAcc()}

/* Comparison */
function renderAcc(){const a=svc.filter(s=>s.rent!=null);
  $('#accList').innerHTML=a.map(s=>`<label><input type="checkbox" value="${s.id}" ${sel.includes(s.id)?'checked':''}>${esc(s.name)}</label>`).join('');renderCmp()}
$('#accList').onchange=e=>{const id=e.target.value;if(e.target.checked){if(sel.length>=3){e.target.checked=false;alert('You can compare up to 3 options.');return}sel.push(id)}else sel=sel.filter(x=>x!==id);renderCmp()};
function renderCmp(){const a=sel.map(id=>svc.find(s=>s.id===id)).filter(Boolean);
  if(!a.length){$('#cmp').innerHTML='<p class="empty">Select up to 3 demo accommodations to compare.</p>';return}
  const u=v=>v==null?'Unknown':inr(v),k=(s,f)=>f(s);
  const sum=(s,keys)=>{const known=keys.filter(x=>s[x]!=null).reduce((t,x)=>t+s[x],0),unk=keys.filter(x=>s[x]==null);return inr(known)+(unk.length?` + unknown (${unk.join(', ')})`:'')};
  const rows=[['Monthly rent',s=>u(s.rent)],['Security deposit (refundability unconfirmed)',s=>u(s.deposit)],['Brokerage',s=>u(s.brokerage)],['Utilities',s=>u(s.utilities)],['Amenities',s=>esc(s.amenities.join(', '))],['Commute',s=>esc(s.commute)],['Verification','Demo'].slice(0,1).concat([s=>'Demo — not verified']),['Source / last updated',s=>'Demo dataset / not available'],
   ['<b>Move-in cost</b> (rent + deposit + brokerage)',s=>sum(s,['rent','deposit','brokerage'])],['<b>Monthly cost</b> (rent + utilities)',s=>sum(s,['rent','utilities'])]];
  $('#cmp').innerHTML=`<table><tr><th></th>${a.map(s=>`<th>${esc(s.name)}<br><span class="badge">Demo data</span></th>`).join('')}</tr>${rows.map(r=>`<tr><th>${r[0]}</th>${a.map(s=>`<td>${r[1](s)}</td>`).join('')}</tr>`).join('')}</table><p class="mut">Unknown fees are not counted as zero; totals show known amounts plus what is unknown.</p>`}

/* Budget */
const CATS=[['rent','Rent',.4],['food','Food and tiffin',.25],['transport','Transport',.08],['utilities','Utilities and internet',.08],['laundry','Laundry and groceries',.09],['misc','Personal and misc',.1]];
const defaults=t=>{const o={};let used=0;CATS.forEach(([k,,p],i)=>{o[k]=i<CATS.length-1?Math.round(t*p/50)*50:Math.max(0,t-used);used+=o[k]});return o};
let budget=LS.get('sm_budget',null);if(!budget||typeof budget!=='object')budget=defaults(profile?profile.budget:12000);
$('#bFields').innerHTML=CATS.map(([k,l])=>`<label>${l} (₹)<input type="number" min="0" data-k="${k}"></label>`).join('');
function renderBudget(){const lim=profile?profile.budget:12000;let tot=0,max=1;
  CATS.forEach(([k])=>{const v=Math.max(0,Number(budget[k])||0);budget[k]=v;tot+=v;max=Math.max(max,v);const el=document.querySelector(`[data-k=${k}]`);if(document.activeElement!==el)el.value=v});
  $('#bTot').textContent=inr(tot);$('#bRem').textContent=inr(lim-tot)+` of ${inr(lim)} budget${profile?'':' (demo)'}`;
  const w=$('#bWarn');w.hidden=tot<=lim;w.textContent=`Estimated expenses exceed your budget by ${inr(tot-lim)}.`;
  $('#bChart').innerHTML=CATS.map(([k,l])=>`<div class="brow"><span style="width:170px">${l}</span><div style="width:${Math.round(budget[k]/max*100)}%"></div>${inr(budget[k])}</div>`).join('');LS.set('sm_budget',budget)}
$('#bFields').oninput=e=>{const k=e.target.dataset.k;if(k){budget[k]=e.target.value;renderBudget()}};
$('#bReset').onclick=()=>{budget=defaults(profile?profile.budget:12000);renderBudget()};

/* Chat */
const chat=$('#chat');const add=(t,u)=>{const d=document.createElement('div');d.className='m'+(u?' u':'');d.textContent=t;chat.appendChild(d);chat.scrollTop=chat.scrollHeight;return d};
['I am moving to Indore for a job. What should I do first?','Help me plan my monthly expenses.','How can I compare PG options?','What should I check before paying a security deposit?','How do I find an affordable tiffin service?'].forEach(q=>{const b=document.createElement('button');b.type='button';b.textContent=q;b.onclick=()=>{$('#msg').value=q;$('#chatForm').requestSubmit()};$('#sugg').appendChild(b)});
add('Hi! Ask me about settling into Indore. I will not invent businesses, prices or contacts.');
$('#chatForm').onsubmit=async e=>{e.preventDefault();const m=$('#msg').value.trim();if(!m)return;$('#msg').value='';add(m,true);const w=add('Thinking…');
  try{const r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:m,context:profile?{city:profile.city,purpose:profile.purpose,budget:profile.budget}:undefined})}),j=await r.json();
    if(!r.ok||!j.ok)throw new Error(j.error||'Request failed');w.textContent=j.reply;$('#aiNote').textContent=j.mode==='ai'?'AI responses active.':(j.note||'')}
  catch(err){w.textContent='Sorry — '+err.message}};
fetch('/api/health').then(r=>r.json()).then(j=>$('#aiNote').textContent=j.aiConfigured?'AI responses active.':'Demo assistant active — personalized AI responses require API configuration.').catch(()=>{});

renderPlan();renderBudget();renderCmp();loadSvc();

/* Transport */
let trVal=0;
$('#trForm').onsubmit=e=>{e.preventDefault();const f=e.target.elements,o=$('#trOut'),t=Number(f.trips.value),r=Number(f.fare.value),d=Number(f.days.value);
  if(!f.fare.value||![t,r,d].every(x=>Number.isFinite(x)&&x>=0)){o.className='err';o.textContent='Enter valid non-negative numbers, including a fare you have checked locally.';$('#trUse').hidden=true;return}
  trVal=t*r*d;o.className='';o.textContent='Estimated monthly commute: '+inr(trVal);$('#trUse').hidden=false};
$('#trUse').onclick=()=>{budget.transport=trVal;renderBudget();$('#trOut').textContent='Added '+inr(trVal)+' to your budget planner (Transport).'};
/* Contact */
$('#ctForm').onsubmit=async e=>{e.preventDefault();const m=$('#ctMsg'),d=Object.fromEntries(new FormData(e.target));m.className='';m.textContent='Sending…';
  try{const r=await fetch('/api/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}),j=await r.json();if(!r.ok)throw new Error(j.error);e.target.reset();m.className='ok';m.textContent='Message sent.'}catch(x){m.className='err';m.textContent=x.message}};

$('#svcList').onclick=async e=>{const id=e.target.dataset.rep;if(!id)return;const r=prompt('What is incorrect or misleading? (max 300 characters)');if(!r||!r.trim())return;
  try{const x=await fetch('/api/report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,reason:r.trim().slice(0,300)})}),j=await x.json();alert(x.ok?'Thanks — your report was sent to the admin.':j.error)}catch{alert('Could not send report.')}};
const showTier=()=>{document.querySelectorAll('[data-tier]').forEach(b=>{b.textContent=b.dataset.tier===SM.tier()?'Current plan':'Select '+b.dataset.tier[0].toUpperCase()+b.dataset.tier.slice(1)})};
document.querySelectorAll('[data-tier]').forEach(b=>b.onclick=()=>{SM.setTier(b.dataset.tier);showTier();$('#tierMsg').textContent='Plan set to '+b.dataset.tier+' (demo — no payment taken).'});showTier();

/* Locality guide */
(async()=>{let g;try{g=await(await fetch('/api/guide')).json()}catch{$('#gNote').textContent='Could not load the guide.';return}
 $('#gNote').textContent=g.note||'';const L=g.localities||[];let tag='';
 const tags=[...new Set(L.flatMap(x=>x.tags||[]))].sort();
 const draw=()=>{$('#gTags').innerHTML=['all',...tags].map(t=>`<button type="button" class="${(t==='all'&&!tag)||t===tag?'on':''}" data-g="${esc(t)}">${esc(t)}</button>`).join('');
  $('#gList').innerHTML=L.filter(x=>!tag||(x.tags||[]).includes(tag)).map(x=>`<article class="card gcard"><h3>${esc(x.name)}</h3><p class="mut">${esc(x.vibe)}</p><div class="chips">${(x.tags||[]).map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div><p><b>Good for:</b> ${esc(x.goodFor)}</p><p><b>Watch out:</b> ${esc(x.watchOut)}</p><p class="mut"><b>Ask before renting:</b></p><ul>${(x.ask||[]).map(a=>`<li>${esc(a)}</li>`).join('')}</ul><button class="btn ghost" type="button" data-use="${esc(x.name)}">Use as my locality</button></article>`).join('')};
 draw();
 $('#gWeek').innerHTML=(g.firstWeek||[]).map((x,i)=>`<div class="card"><span class="tag">${i+1}</span><h3>${esc(x.title)}</h3><p>${esc(x.text)}</p></div>`).join('');
 $('#gLocal').innerHTML=(g.local||[]).map(x=>`<div class="card"><h3>${esc(x.name)}</h3><p>${esc(x.what)}</p></div>`).join('');
 $('#gTags').onclick=e=>{if(e.target.dataset.g!==undefined){tag=e.target.dataset.g==='all'?'':e.target.dataset.g;draw()}};
 $('#gList').onclick=e=>{const n=e.target.dataset.use;if(!n)return;$('#form').elements.locality.value=n;$('#start').scrollIntoView({behavior:'smooth'})};
})();
