(function(){
const L={free:{rm:1,pv:2},normal:{rm:3,pv:5},premium:{rm:10,pv:20}};
window.SM={tier(){try{const t=localStorage.getItem('sm_tier');return L[t]?t:'free'}catch{return'free'}},setTier(t){if(L[t])try{localStorage.setItem('sm_tier',t)}catch{}},limit(k){return L[this.tier()][k]}};
try{const s=JSON.parse(localStorage.getItem('sm_settings'));if(s&&s.largeText)document.documentElement.style.fontSize='130%'}catch{}
document.addEventListener('DOMContentLoaded',()=>{
 const t=document.createElement('nav');t.className='tabs';t.setAttribute('aria-label','Quick');t.innerHTML='<a href="index.html">Home</a><a href="customer.html">Plan</a><a href="roommates.html">Roommates</a><a href="index.html#plans">Plans</a><a href="profile.html">Profile</a>';document.body.appendChild(t);
 if(window.matchMedia&&!matchMedia('(prefers-reduced-motion: reduce)').matches&&window.IntersectionObserver){const o=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');o.unobserve(e.target)}}),{threshold:.1});document.querySelectorAll('.rv,.card').forEach(x=>{x.classList.add('rv');o.observe(x)})}else document.querySelectorAll('.rv').forEach(x=>x.classList.add('in'));
 const h=document.querySelector('header[data-std]');
 if(h)h.innerHTML='<div class="wrap navin"><a class="logo" href="index.html">NEXT MOVE</a><nav class="links" style="display:flex;flex-wrap:wrap" aria-label="Main"><a href="index.html">Home</a><a href="roommates.html">Roommates</a><a href="customer.html">Dashboard</a><a href="provider.html">Providers</a><a href="index.html#plans">Plans</a><a href="profile.html">Profile</a><a href="settings.html">Settings</a></nav></div>';
 fetch('/api/config').then(r=>r.json()).then(c=>{
  const dl=document.getElementById('locs');if(dl)dl.innerHTML=(c.localities||[]).map(l=>`<option value="${l}">`).join('');
  const em=c.contactEmail,ci=document.getElementById('ctcInfo'),cc=document.getElementById('ctc');
  if(ci)ci.textContent='Email: '+em+' · Phone: '+(c.contactPhone||'')+(c.contactIsDemo?' (demo details, not real)':'')+' — or use the form below.';
  if(cc&&em)cc.textContent=em+' · '+(c.contactPhone||'')+(c.contactIsDemo?' (demo)':'');
 }).catch(()=>{});
});})();
