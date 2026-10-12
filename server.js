require('dotenv').config();
const express=require('express'),path=require('path'),fs=require('fs');
const app=express();
app.set('trust proxy',1);
app.use(express.json({limit:'20kb'}));
app.use(express.static(path.join(__dirname,'public')));
const services=JSON.parse(fs.readFileSync(path.join(__dirname,'data/services.json'),'utf8')).map(s=>({...s,verification:'demo',source:'Demo dataset',lastConfirmed:null,note:'Demo data — not a verified real provider.'}));
const PURPOSES=['education','job','marriage','other'],ACCOM=['PG','hostel','rental room','other'],DIETS=['','vegetarian','non-vegetarian','vegan','no preference'];
const hasAI=()=>!!process.env.OPENAI_API_KEY;
const bad=(res,m)=>res.status(400).json({ok:false,error:m});

app.get('/api/health',(q,r)=>r.json({ok:true,status:'running',aiConfigured:hasAI()}));


function validateProfile(p){
  if(!p||typeof p!=='object')return'Profile is required.';
  const t=(v,n)=>typeof v==='string'&&v.trim().length>0&&v.length<=n;
  if(!t(p.city,60))return'Enter a city (max 60 characters).';
  if(!PURPOSES.includes(p.purpose))return'Choose a valid purpose.';
  if(p.locality&&(typeof p.locality!=='string'||p.locality.length>60))return'Locality is too long.';
  const b=Number(p.budget);if(!Number.isFinite(b)||b<1000||b>500000)return'Budget must be between ₹1,000 and ₹5,00,000.';
  if(!ACCOM.includes(p.accommodation))return'Choose a valid accommodation type.';
  if(!DIETS.includes(p.diet||''))return'Invalid dietary preference.';
  if(p.moveIn&&!/^\d{4}-\d{2}-\d{2}$/.test(p.moveIn))return'Move-in date is invalid.';
  return null;
}
function buildPlan(p){
  const T=(id,t)=>({id,text:t});
  const s=[
   {id:1,title:'Days 1–3 — Immediate Essentials',tasks:[T('1a',`Confirm your ${p.accommodation} in ${p.locality||p.city}: read the agreement, deposit and notice terms`),T('1b','Arrange basic groceries and first meals'),T('1c','Work out your commute and save the route'),T('1d','Save essential contacts (owner, emergency, one local contact)')]},
   {id:2,title:'Days 4–7 — Daily Setup',tasks:[T('2a',p.diet?`Finalize food arrangements (${p.diet})`:'Finalize food arrangements'),T('2b','Identify nearby pharmacies and healthcare options'),T('2c','Arrange internet and laundry'),T('2d','Learn nearby shops and transport options')]},
   {id:3,title:'Days 8–14 — Routine Building',tasks:[T('3a',`Review first-week spending against your ₹${Number(p.budget).toLocaleString('en-IN')} budget`),T('3b','Optimize your daily commute'),T('3c','Discover suitable local communities'),T('3d','Resolve outstanding utility needs')]},
   {id:4,title:'Days 15–30 — Settle In',tasks:[T('4a','Review how satisfied you are with your accommodation'),T('4b','Check monthly spending'),T('4c','Establish a stable daily routine'),T('4d','Complete remaining relocation tasks')]}];
  const extra={education:[[1,'1e','Keep admission/ID documents ready for hostel or PG verification'],[3,'3e','Find the campus-to-home commute and library/study spots']],
   job:[[1,'1e','Confirm the office address and commute time before peak hours'],[2,'2e','Ask HR about address-proof and joining paperwork needs']],
   marriage:[[1,'1e','Plan household essentials together and agree on a shared budget'],[3,'3e','Update address on important documents when ready']],other:[]}[p.purpose]||[];
  extra.forEach(([st,id,t])=>s[st-1].tasks.push(T(id,t)));
  return {stages:s,generatedFor:{city:p.city,purpose:p.purpose}};
}
app.post('/api/plan',(req,res)=>{const e=validateProfile(req.body);if(e)return bad(res,e);res.json({ok:true,plan:buildPlan(req.body)});});

const hits=new Map();
const allLimiters=[hits];
setInterval(()=>{const n=Date.now();for(const m of allLimiters)for(const[k,a]of m){if(!a.some(t=>n-t<60000))m.delete(k)}},60000).unref();
function limited(ip){const n=Date.now(),a=(hits.get(ip)||[]).filter(t=>n-t<60000);a.push(n);hits.set(ip,a);return a.length>10;}
function demoReply(q,ctx){
  const l=q.toLowerCase();
  if(/budget|expense|₹|rs\b|spend/.test(l))return'To plan expenses: set your total budget, then split it across rent, food/tiffin, transport, utilities/internet, laundry/groceries and miscellaneous. Rent is usually the largest share — keep it within what leaves room for the rest. Use the Budget Planner below; it totals your own entries and warns if you exceed your budget.';
  if(/deposit/.test(l))return'Before paying a deposit: get the amount, refund conditions and notice period in writing, ask for a receipt, check what is included in rent, and visit the place in person. Do not assume a deposit is refundable unless it is confirmed.';
  if(/pg|compare|rent/.test(l))return'To compare PG options, look at move-in cost (first rent + deposit + brokerage + other upfront fees), monthly cost, amenities, commute and who supplied the listing. Use the Accommodation Comparison section; unknown fees are shown as unknown, not zero.';
  if(/tiffin|food|meal/.test(l))return'For tiffin: ask for a trial meal or short plan, confirm the monthly price, delivery area, menu and cancellation terms. Search the Local Services directory for the Tiffin category (demo records only).';
  if(/week|first|start|job|move|moving/.test(l))return`Suggested first steps${ctx&&ctx.city?' for '+ctx.city:''}: confirm accommodation terms, arrange groceries and meals, understand your commute, save essential contacts. In week one, identify pharmacies, set up internet and laundry. See your 30-day plan above.`;
  return'I can help with settling-in checklists, expense planning, comparing PGs, tiffin tips and deposit checks. Try asking one of those, or browse the Local Services directory.';
}
async function llm(q,ctx){
  const base=process.env.OPENAI_BASE_URL||'https://api.openai.com/v1',ac=new AbortController(),to=setTimeout(()=>ac.abort(),15000);
  try{
    const r=await fetch(base+'/chat/completions',{method:'POST',signal:ac.signal,headers:{'Content-Type':'application/json',Authorization:'Bearer '+process.env.OPENAI_API_KEY},
     body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-4o-mini',max_tokens:500,messages:[{role:'system',content:'You are NEXT MOVE, helping newcomers settle into Indore, India. Give practical, concise advice. NEVER invent businesses, prices, addresses, phone numbers or availability; say when information is missing. Do not claim any provider is safe or scam-free.'+(ctx?` Context: city=${ctx.city||'Indore'}, purpose=${ctx.purpose||'unspecified'}, budget=₹${ctx.budget||'unspecified'}.`:'')},{role:'user',content:q}]})});
    if(r.status===429)throw Object.assign(new Error('rate'),{code:429});
    if(!r.ok)throw new Error('upstream '+r.status);
    const j=await r.json(),t=j&&j.choices&&j.choices[0]&&j.choices[0].message&&j.choices[0].message.content;
    if(typeof t!=='string'||!t.trim())throw new Error('invalid response');
    return t.trim();
  }finally{clearTimeout(to);}
}
app.post('/api/chat',async(req,res)=>{
  if(limited(req.ip))return res.status(429).json({ok:false,error:'Too many requests. Please wait a minute.'});
  const q=req.body&&req.body.message;
  if(typeof q!=='string'||!q.trim()||q.length>500)return bad(res,'Message must be 1–500 characters.');
  const c=req.body.context,ctx=c&&typeof c==='object'?{city:String(c.city||'').slice(0,60),purpose:PURPOSES.includes(c.purpose)?c.purpose:'',budget:Number(c.budget)||undefined}:null;
  if(!hasAI())return res.json({ok:true,mode:'demo',reply:demoReply(q,ctx),note:'Demo assistant active — personalized AI responses require API configuration.'});
  try{res.json({ok:true,mode:'ai',reply:await llm(q,ctx)});}
  catch(e){res.json({ok:true,mode:'demo',reply:demoReply(q,ctx),note:e.code===429?'AI provider is rate-limited; showing demo reply.':'AI is temporarily unavailable; showing demo reply.'});}
});

const crypto=require('crypto'),DD=process.env.DATA_DIR||path.join(__dirname,'data');try{fs.mkdirSync(DD,{recursive:true})}catch{}const LF=path.join(DD,'listings.json');
const CATEGORIES=[...new Set(services.map(s=>s.category))];
const readL=()=>{try{const a=JSON.parse(fs.readFileSync(LF,'utf8'));return Array.isArray(a)?a:[]}catch{return[]}};
const wr=(p,a)=>{const t=p+'.tmp';fs.writeFileSync(t,JSON.stringify(a,null,2));fs.renameSync(t,p)};const writeL=a=>wr(LF,a);
const sha=k=>crypto.createHash('sha256').update(String(k)).digest('hex');
const pub=l=>{const{keyHash,...r}=l;return{...r,source:r.source||'Provider-supplied',note:r.verification==='verified'?`Verified by admin on ${r.lastConfirmed||'unknown date'}.`:'Provider-listed — not independently verified. Confirm details before paying.'}};
app.get('/api/services',(q,r)=>r.json({ok:true,services:[...services,...readL().map(pub)]}));
const lh=new Map();allLimiters.push(lh);
const lim=ip=>{const n=Date.now(),a=(lh.get(ip)||[]).filter(t=>n-t<60000);a.push(n);lh.set(ip,a);return a.length>5};
app.post('/api/provider/listings',(req,res)=>{
  if(lim(req.ip))return res.status(429).json({ok:false,error:'Too many submissions. Wait a minute.'});
  const b=req.body||{},t=(v,n,req_)=>typeof v==='string'&&v.trim().length>=(req_?1:0)&&v.length<=n;
  const num=v=>v===''||v==null?null:Number(v);
  if(!t(b.name,80,1))return bad(res,'Name is required (max 80 characters).');
  if(!CATEGORIES.includes(b.category))return bad(res,'Choose a valid category.');
  if(!t(b.locality,60,1))return bad(res,'Locality is required.');
  if(!t(b.description,300,1))return bad(res,'Description is required (max 300 characters).');
  if(!t(b.contact||'',80)||!t(b.source||'',120))return bad(res,'Contact or source is too long.');
  const lo=num(b.priceMin),hi=num(b.priceMax);
  if([lo,hi].some(v=>v!==null&&(!Number.isFinite(v)||v<0||v>1000000))||(lo!==null&&hi!==null&&lo>hi))return bad(res,'Prices must be valid and min ≤ max.');
  const all=readL();if(all.length>=500)return res.status(507).json({ok:false,error:'Listing storage full.'});
  const key=crypto.randomBytes(16).toString('hex');
  const l={id:'p_'+crypto.randomBytes(6).toString('hex'),name:b.name.trim(),category:b.category,locality:b.locality.trim(),priceMin:lo,priceMax:hi===null?lo:hi,description:b.description.trim(),contact:(b.contact||'').trim()||null,source:(b.source||'').trim()||'Provider-supplied',verification:'provider-listed',lastConfirmed:null,createdAt:new Date().toISOString().slice(0,10),keyHash:sha(key)};
  all.push(l);writeL(all);res.status(201).json({ok:true,listing:pub(l),editKey:key});
});
app.delete('/api/provider/listings/:id',(req,res)=>{
  const all=readL(),l=all.find(x=>x.id===req.params.id);
  if(!l)return res.status(404).json({ok:false,error:'Listing not found.'});
  if(sha(req.get('x-edit-key')||'')!==l.keyHash)return res.status(403).json({ok:false,error:'Invalid edit key.'});
  writeL(all.filter(x=>x.id!==l.id));res.json({ok:true});
});
const validDate=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
app.post('/api/admin/verify',(req,res,next)=>adminMw(req,res,next),(req,res)=>{
  const{id,source,lastConfirmed}=req.body||{};
  if(typeof source!=='string'||!source.trim()||source.length>120||!validDate(lastConfirmed))return bad(res,'source and a real lastConfirmed date (YYYY-MM-DD) required.');
  const all=readL(),l=all.find(x=>x.id===id);if(!l)return res.status(404).json({ok:false,error:'Listing not found.'});
  Object.assign(l,{verification:'verified',source:source.trim(),lastConfirmed});writeL(all);res.json({ok:true,listing:pub(l)});
});

const LOCALITIES=['Vijay Nagar','Bhawarkuan','Palasia','Rajendra Nagar','Saket','MR-10','Sudama Nagar','Annapurna','Geeta Bhawan','Nipania','Scheme 54','Mahalakshmi Nagar','Khajrana','Rau','Bengali Square','Tilak Nagar','Super Corridor','Lasudia Mori','Kanadia Road','Indrapuri','Navlakha','Sapna Sangeeta','Rajwada','Manorama Ganj','Sukhliya','Scheme 78','Scheme 74','Mhow','Bicholi Mardana','Ring Road'];
const mkStore=f=>{const p=path.join(DD,f);return{r(){try{const a=JSON.parse(fs.readFileSync(p,'utf8'));return Array.isArray(a)?a:[]}catch{return[]}},w(a){wr(p,a)}}};
const RM=mkStore('roommates.json'),MS=mkStore('messages.json');
const mkLim=n=>{const m=new Map();allLimiters.push(m);return ip=>{const t=Date.now(),a=(m.get(ip)||[]).filter(x=>t-x<60000);a.push(t);m.set(ip,a);return a.length>n}};
const rlR=mkLim(5),rlQ=mkLim(5),rlC=mkLim(3);
const str=(v,n,min=0)=>typeof v==='string'&&v.trim().length>=min&&v.length<=n;
const tooMany=res=>res.status(429).json({ok:false,error:'Too many requests. Please wait a minute.'});
let GUIDE={localities:[],firstWeek:[],local:[],note:''};try{GUIDE=JSON.parse(fs.readFileSync(path.join(__dirname,'data/guide.json'),'utf8'))}catch{}
app.get('/api/guide',(q,r)=>r.json({ok:true,...GUIDE}));
app.get('/api/config',(q,r)=>r.json({ok:true,localities:LOCALITIES,contactEmail:process.env.CONTACT_EMAIL||'hello@nextmove.example',contactPhone:process.env.CONTACT_PHONE||'+91 90000 00000',contactIsDemo:!process.env.CONTACT_EMAIL,aiConfigured:hasAI()}));
const pubR=p=>({id:p.id,name:p.name,type:p.type,locality:p.locality,budget:p.budget,gender:p.gender,bio:p.bio,createdAt:p.createdAt});
const owns=(p,req)=>sha(req.get('x-edit-key')||'')===p.keyHash;
app.get('/api/roommates',(req,res)=>{let a=RM.r();const{locality,type}=req.query;
  if(typeof locality==='string'&&locality)a=a.filter(p=>String(p.locality).toLowerCase()===locality.trim().toLowerCase());
  if(typeof type==='string'&&type)a=a.filter(p=>p.type===type);res.json({ok:true,posts:a.map(pubR)})});
app.post('/api/roommates',(req,res)=>{
  if(rlR(req.ip))return tooMany(res);const b=req.body||{},bud=Number(b.budget);
  if(!str(b.name,40,1))return bad(res,'Display name is required (max 40). Use a first name or nickname.');
  if(!['have-room','need-room'].includes(b.type))return bad(res,'Choose what you are looking for.');
  if(!str(b.locality,60,1))return bad(res,'Locality is required.');
  if(!Number.isFinite(bud)||bud<500||bud>100000)return bad(res,'Budget must be ₹500–₹1,00,000 per month.');
  if(!['any','male','female'].includes(b.gender||'any'))return bad(res,'Invalid roommate preference.');
  if(!str(b.bio,300,1))return bad(res,'Short bio is required (max 300).');
  const all=RM.r();if(all.length>=500)return res.status(507).json({ok:false,error:'Storage full.'});
  const key=crypto.randomBytes(16).toString('hex');
  const p={id:'r_'+crypto.randomBytes(6).toString('hex'),name:b.name.trim(),type:b.type,locality:b.locality.trim(),budget:bud,gender:b.gender||'any',bio:b.bio.trim(),createdAt:new Date().toISOString().slice(0,10),keyHash:sha(key),requests:[]};
  all.push(p);RM.w(all);res.status(201).json({ok:true,post:pubR(p),editKey:key});
});
app.post('/api/roommates/:id/requests',(req,res)=>{
  if(rlQ(req.ip))return tooMany(res);const b=req.body||{};
  if(!str(b.name,40,1)||!str(b.contact,80,3)||!str(b.message,300,1))return bad(res,'Name, contact (max 80) and message (max 300) are required.');
  const all=RM.r(),p=all.find(x=>x.id===req.params.id);if(!p)return res.status(404).json({ok:false,error:'Post not found.'});
  if(p.requests.length>=20)return res.status(409).json({ok:false,error:'This post has reached its request limit.'});
  p.requests.push({id:crypto.randomBytes(4).toString('hex'),name:b.name.trim(),contact:b.contact.trim(),message:b.message.trim(),createdAt:new Date().toISOString().slice(0,10)});
  RM.w(all);res.status(201).json({ok:true});
});
app.get('/api/roommates/:id/requests',(req,res)=>{const p=RM.r().find(x=>x.id===req.params.id);
  if(!p)return res.status(404).json({ok:false,error:'Post not found.'});if(!owns(p,req))return res.status(403).json({ok:false,error:'Invalid edit key.'});res.json({ok:true,requests:p.requests})});
app.delete('/api/roommates/:id',(req,res)=>{const all=RM.r(),p=all.find(x=>x.id===req.params.id);
  if(!p)return res.status(404).json({ok:false,error:'Post not found.'});if(!owns(p,req))return res.status(403).json({ok:false,error:'Invalid edit key.'});
  RM.w(all.filter(x=>x.id!==p.id));res.json({ok:true})});
app.post('/api/contact',(req,res)=>{
  if(rlC(req.ip))return tooMany(res);const b=req.body||{};
  if(!str(b.name,60,1))return bad(res,'Name is required.');
  if(!str(b.email,80,3)||!/^\S+@\S+\.\S+$/.test(b.email))return bad(res,'Enter a valid email.');
  if(!str(b.message,1000,1))return bad(res,'Message is required (max 1000).');
  const all=MS.r();if(all.length>=500)return res.status(507).json({ok:false,error:'Inbox full.'});
  all.push({name:b.name.trim(),email:b.email.trim(),message:b.message.trim(),at:new Date().toISOString()});MS.w(all);res.status(201).json({ok:true});
});

const RP=mkStore('reports.json'),rlA=mkLim(60),rlP=mkLim(5);
app.post('/api/report',(req,res)=>{
  if(rlP(req.ip))return tooMany(res);const b=req.body||{};
  if(!str(b.id,40,1)||!str(b.reason,300,1))return bad(res,'Listing id and a reason (max 300) are required.');
  const all=RP.r();if(all.length>=500)return res.status(507).json({ok:false,error:'Report queue full.'});
  all.push({id:crypto.randomBytes(4).toString('hex'),target:b.id.trim(),reason:b.reason.trim(),at:new Date().toISOString()});RP.w(all);res.status(201).json({ok:true});
});
const admin=(req,res,next)=>{const tok=process.env.ADMIN_TOKEN;
  if(!tok)return res.status(503).json({ok:false,error:'Admin disabled: set ADMIN_TOKEN on the server.'});
  if(rlA(req.ip))return tooMany(res);
  if(!crypto.timingSafeEqual(Buffer.from(sha(req.get('x-admin-token')||'')),Buffer.from(sha(tok))))return res.status(403).json({ok:false,error:'Admin access denied.'});next()};
const adminMw=admin;
app.get('/api/admin/data',admin,(q,r)=>r.json({ok:true,
  listings:readL().map(({keyHash,...x})=>x),
  roommates:RM.r().map(({keyHash,requests,...x})=>({...x,requestCount:requests.length})),
  messages:MS.r(),reports:RP.r()}));
const rm_=(get,set)=>(req,res)=>{const a=get(),n=a.filter(x=>x.id!==req.params.id);if(n.length===a.length)return res.status(404).json({ok:false,error:'Not found.'});set(n);res.json({ok:true})};
app.delete('/api/admin/listings/:id',admin,rm_(readL,writeL));
app.delete('/api/admin/roommates/:id',admin,rm_(()=>RM.r(),a=>RM.w(a)));
app.delete('/api/admin/reports/:id',admin,rm_(()=>RP.r(),a=>RP.w(a)));
app.use('/api',(q,r)=>r.status(404).json({ok:false,error:'Not found'}));
app.use((e,q,r,n)=>r.status(e.status||500).json({ok:false,error:e.status===400?'Invalid JSON body.':e.status===413?'Request too large.':'Server error.'}));
const port=process.env.PORT||3000;
if(require.main===module)app.listen(port,()=>console.log(`NEXT MOVE on http://localhost:${port} (AI ${hasAI()?'configured':'demo mode'})`));
module.exports=app;
