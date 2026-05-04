'use strict';
// ══════════════════════════════════════════════
//  اي ام سبيشل — app.js v5
//  بدون قسم الطلبات — PIN Login — Bottom Nav
// ══════════════════════════════════════════════

// ═══ MAINT CODE ═══
const MCODE=`0x4C4F4144494E47 SYSTEM_BOOT
IMS_CORE_v5.0.0 BUILD:20250426
INIT:auth.handler INIT:complaint.engine
INIT:portal.gateway INIT:pin.authenticator
0xF3A1B2C4D5E6F708 SESSION_TOKEN
MODULE:StatusEngine LOADED
MODULE:AuditTrail LOADED
MODULE:BranchResolver LOADED
MODULE:WarningSystem LOADED
MODULE:PinAuth LOADED
0xDEADBEEF HEARTBEAT:OK
READY_FOR_INPUT`;

// ═══ بيانات افتراضية ═══
const DEFAULT_USERS=[
  {id:'o1', name:'المالك',              role:'owner',  pass:'2701', branch:null},
  {id:'a1', name:'سارة العتيبي',        role:'admin',  pass:'4321', branch:null},
  {id:'a2', name:'نورة الشمري',         role:'admin',  pass:'4321', branch:null},
  {id:'b1', name:'اسمهان',              role:'branch', pass:'5678', branch:'فرع القصر'},
  {id:'b2', name:'مها',                 role:'branch', pass:'5678', branch:'فرع الرياض جاليري'},
  {id:'c1', name:'موظف خدمة العملاء',   role:'cs',     pass:'9999', branch:null},
];
const DEFAULT_EMP={
  'فرع القصر':          [{id:'e1',name:'اسمهان (المديرة)'}],
  'فرع سلام مول':      [{id:'e2',name:'المديرة'}],
  'فرع الرياض جاليري': [{id:'e3',name:'مها (المديرة)'}],
  'فرع ذا ڤيو مول':    [{id:'e4',name:'المديرة'}],
  'فرع مركز المملكة':  [{id:'e5',name:'المديرة'}],
  'فرع شرق بلازا':     [{id:'e6',name:'المديرة'}],
};

// ═══ حالة التطبيق ═══
let users      = JSON.parse(localStorage.getItem('ims_u')||'null') || DEFAULT_USERS;
let complaints = JSON.parse(localStorage.getItem('ims_c')||'[]');
let messages   = JSON.parse(localStorage.getItem('ims_m')||'[]');
let branchMsgs = JSON.parse(localStorage.getItem('ims_bm')||'[]');
let warnings   = JSON.parse(localStorage.getItem('ims_w')||'[]');
let ctypes     = JSON.parse(localStorage.getItem('ims_ct')||'null') || ['السياسات','الأسلوب','السلامة','الجودة'];
let sentiments = JSON.parse(localStorage.getItem('ims_sent')||'null') || ['غاضب','محبط','قلق','محايد','هادئ'];
let demos      = JSON.parse(localStorage.getItem('ims_demo')||'null') || ['أسرة','أم','أب','أخرى'];
let employees  = JSON.parse(localStorage.getItem('ims_emp')||'null') || DEFAULT_EMP;
let branchWA   = JSON.parse(localStorage.getItem('ims_bwa')||'{}') || {};
let adminWANum = localStorage.getItem('ims_adminwa')||'';
let maintPass  = localStorage.getItem('ims_mp')||'010';
let signatureBase64 = localStorage.getItem('ims_sig')||'';
let session    = JSON.parse(localStorage.getItem('ims_s')||'null');
let pageSeen   = JSON.parse(localStorage.getItem('ims_ps')||'{}');

// ═══ حالة UI ═══
let currentRef=null, prevTxt='', pendingC=null;
let gC='m', gK='m', currentTab='all';

// ═══ حفظ البيانات ═══
const sv   = ()=>{ localStorage.setItem('ims_u',JSON.stringify(users)); localStorage.setItem('ims_ct',JSON.stringify(ctypes)); localStorage.setItem('ims_sent',JSON.stringify(sentiments)); localStorage.setItem('ims_demo',JSON.stringify(demos)); localStorage.setItem('ims_emp',JSON.stringify(employees)); localStorage.setItem('ims_bwa',JSON.stringify(branchWA)); };
const saveC= ()=>localStorage.setItem('ims_c',JSON.stringify(complaints));
const saveM= ()=>localStorage.setItem('ims_m',JSON.stringify(messages));
const saveBM=()=>localStorage.setItem('ims_bm',JSON.stringify(branchMsgs));
const saveS= s=>localStorage.setItem('ims_s',JSON.stringify(s));
const savePSeen=()=>localStorage.setItem('ims_ps',JSON.stringify(pageSeen));

// ═══ أدوات ═══
const pad=(n,l)=>String(n).padStart(l,'0');
const MO=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const fmtShort=iso=>{const d=new Date(iso);return`${d.getDate()} ${MO[d.getMonth()]}`;};
const fmtTime=iso=>{const d=new Date(iso),h=d.getHours(),m=pad(d.getMinutes(),2);return`${h>12?h-12:(h===0?12:h)}:${m} ${h>=12?'مساء':'صباحاً'}`;};
const nowISO=()=>new Date().toISOString();
function genRef(){const d=new Date(),dd=pad(d.getDate(),2),mm=pad(d.getMonth()+1,2),yr=d.getFullYear(),key=`${dd}${mm}${yr}`;return{ref:`S${mm}${dd}${pad(complaints.filter(c=>c.dateKey===key).length+1,2)}`,todayKey:key};}

// ═══ حالات الشكاوى ═══
const SMAP={'تحت المعالجة':'btl','جارية حاليا':'bb','تمت المعالجة':'bg','معاد فتحها':'bp','مستبعدة':'bgr'};
const USER_ST=['تحت المعالجة','تمت المعالجة','معاد فتحها','مستبعدة'];
const SPERMS={'تحت المعالجة':['owner','admin','cs','maint'],'تمت المعالجة':['owner','admin','cs','maint'],'معاد فتحها':['owner','cs','maint'],'مستبعدة':['owner','cs','maint']};
const statusesFor=r=>USER_ST.filter(s=>{if(r==='admin'&&s==='مستبعدة')return false;return(SPERMS[s]||[]).includes(r);});
const sBadge=s=>`<span class="badge ${SMAP[s]||'bgr'}">${s}</span>`;
const isActive=c=>(Date.now()-new Date(c.createdAt).getTime())<3600000&&c.status==='جارية حاليا';
const isDone=c=>c.status==='تمت المعالجة'||c.status==='مستبعدة';
const isExcluded=c=>c.status==='مستبعدة';

// ═══ تشغيل تلقائي ═══
function runAuto(){
  let ch=false;
  complaints.forEach(c=>{
    if(c.status==='جارية حاليا'&&(Date.now()-new Date(c.createdAt).getTime())>=3600000){
      c.status='تحت المعالجة';
      c.audit.push({who:'النظام',uid:'sys',role:'system',ts:nowISO(),body:'تم تغيير الحالة إلى "تحت المعالجة" تلقائياً'});
      ch=true;
    }
  });
  if(ch)saveC();
}
setInterval(runAuto,60000);

// ═══ بناء النصوص ═══
function buildClientMsg(c){
  if(isDone(c))return`عميلنا العزيز ${c.client} تمت معالجة الشكوى رقم (${c.ref}). شكرًا لتواصلكم. ادارة اي ام سبيشل`;
  return`عميلنا العزيز ${c.client} تم استلام الشكوى برقم ${c.ref} شكرا لتواصلكم. ادارة اي ام سبيشل`;
}
function buildSummary(c,withComments=false){
  const isMc=c.gC==='m',isMk=c.gK==='m';
  const clientLabel=isMc?'العميل':'العميلة',parentLabel=isMc?'والد':'والدة',childLabel=isMk?'الطفل':'الطفلة';
  const phoneLabel=isMc?'جواله':'جوالها',saidLabel=isMc?'قال العميل':'قالت العميلة',demandLabel=isMc?'طلب العميل':'طلبت العميلة',looksVerb=isMc?'يبدو':'تبدو';
  const genderedSentiment=s=>{if(!s||isMc)return s;const m={'غاضب':'غاضبة','محبط':'محبطة','قلق':'قلقة','هادئ':'هادئة','محايد':'محايدة','مضطرب':'مضطربة'};return m[s]||s;};
  let t=`شكوى قدمها ${clientLabel} ${c.client} ${parentLabel} ${childLabel} ${c.child} من رقم ${phoneLabel} ${c.mobile}`;
  t+=`\n${saidLabel}: ${c.desc}`;
  t+=`\nو${demandLabel} ${c.demand}`;
  if(c.hdA)t+=`\nويتضمن سياق الشكوى مطلباً غير معلن قد يكون ${c.hdA}`;
  if(c.origin&&c.origin.trim())t+=`\nويبدو أن مصدر المشكلة هو ${c.origin}`;
  if(c.csnote&&c.csnote.trim()){t+=`\nعلّق الموظف الذي استلم الشكوى على نبرة ${clientLabel}: ${c.csnote}`;if(c.sentiment)t+=`\nوأوضح أن ${clientLabel} ${looksVerb} ${genderedSentiment(c.sentiment)}`;}
  if(withComments){
    if(c.branchComment&&c.branchComment.trim()){t+=`\nوأفادت مديرة الفرع: ${c.branchComment}`;if(c.hasEmp&&c.branchEmployee)t+=`\nوحددت الموظفة المشار إليها: ${c.branchEmployee}`;}
    if(c.adminComment&&c.adminComment.trim()){const au=users.find(u=>u.role==='admin');t+=`\nووضحت الإدارية ${au?au.name:'الإدارة'}: ${c.adminComment}`;}
  }
  if(c.negative&&c.negText)t+=`\nقام ${clientLabel} بكتابة تقييم سلبي: ${c.negText}`;
  return t;
}
const auditWho=a=>{if(!a.role||a.role==='system')return a.who;const u=users.find(x=>x.id===a.uid);const nm=u?u.name:a.who;if(a.role==='owner')return`المالك (${nm})`;if(a.role==='admin')return`${nm} (الإدارة)`;if(a.role==='branch'){const u2=users.find(x=>x.id===a.uid);return`${nm} (مديرة ${u2?u2.branch:''})`;}if(a.role==='cs')return`${nm} (خدمة العملاء)`;return nm;};

// ═══════════════════════════════════════
//  PIN — نظام كلمة المرور الأربعة خانات
// ═══════════════════════════════════════
let pinTarget=null; // {user, callback}

function openPinOverlay(user, onSuccess){
  pinTarget={user,onSuccess};
  // مسح الخانات
  for(let i=0;i<4;i++){const c=document.getElementById('pc'+i);c.value='';c.classList.remove('filled','error');}
  document.getElementById('pin-err').textContent='';
  const roles={owner:'المالك',admin:'الإدارة',branch:'مديرة الفرع',cs:'خدمة العملاء',maint:'الصيانة'};
  const avatars={owner:'👑',admin:'🌸',branch:'🌿',cs:'💬',maint:'⚙️'};
  document.getElementById('pin-name').textContent=user.name;
  document.getElementById('pin-role').textContent=roles[user.role]||user.role;
  document.getElementById('pin-avatar').textContent=avatars[user.role]||'👤';
  document.getElementById('pin-overlay').classList.add('on');
  setTimeout(()=>document.getElementById('pc0').focus(),100);
}

function closePinOverlay(){
  document.getElementById('pin-overlay').classList.remove('on');
  pinTarget=null;
}

function pinInput(idx,el){
  if(!pinTarget)return;
  const v=el.value.replace(/\D/g,'');
  el.value=v.slice(-1);
  el.classList.toggle('filled',el.value!=='');
  el.classList.remove('error');
  document.getElementById('pin-err').textContent='';
  if(el.value&&idx<3){
    document.getElementById('pc'+(idx+1)).focus();
  }
  if(idx===3&&el.value){
    setTimeout(()=>checkPin(),80);
  }
}

function pinKey(idx,e){
  if(e.key==='Backspace'&&!document.getElementById('pc'+idx).value&&idx>0){
    const prev=document.getElementById('pc'+(idx-1));
    prev.value='';prev.classList.remove('filled');prev.focus();
  }
  if(e.key==='Enter') checkPin();
}

function checkPin(){
  if(!pinTarget)return;
  const pin=[0,1,2,3].map(i=>document.getElementById('pc'+i).value).join('');
  if(pin.length<4){document.getElementById('pin-err').textContent='يرجى إدخال 4 أرقام';return;}
  if(pin===pinTarget.user.pass){
    // ← احفظ الـ callback قبل إغلاق الـ overlay لأن closePinOverlay تُصفّر pinTarget
    const cb = pinTarget.onSuccess;
    closePinOverlay();
    cb();
  } else {
    for(let i=0;i<4;i++){const c=document.getElementById('pc'+i);c.classList.add('error');}
    document.getElementById('pin-err').textContent='كلمة المرور غير صحيحة';
    setTimeout(()=>{
      for(let i=0;i<4;i++){const c=document.getElementById('pc'+i);c.value='';c.classList.remove('filled','error');}
      document.getElementById('pin-err').textContent='';
      document.getElementById('pc0').focus();
    },900);
  }
}

// ═══════════════════════════════════════
//  AUTH — تسجيل الدخول
// ═══════════════════════════════════════
let loginRole=null;
const BRANCHES_LIST=['فرع القصر','فرع سلام مول','فرع الرياض جاليري','فرع ذا ڤيو مول','فرع مركز المملكة','فرع شرق بلازا'];
const BRANCHES_LABELS=['القصر','سلام مول','الرياض جاليري','ذا ڤيو','المملكة','شرق بلازا'];

function getOwnerPass(){const d=new Date();return pad(d.getDate(),2)+pad(d.getMonth()+1,2);}

function buildRoleGrid(){
  document.getElementById('role-grid').innerHTML=`
    <div class="rc rc-owner" onclick="selRole('owner',this)"><div class="rn">المالك</div></div>
    <div class="rc-row">
      ${BRANCHES_LIST.map((br,i)=>`<div class="rc" onclick="openBranchEmpLogin('${br}',this)"><div class="rn">${BRANCHES_LABELS[i]}</div></div>`).join('')}
    </div>`;
}

function selRole(role,el){
  loginRole=role;
  document.querySelectorAll('.rc').forEach(c=>c.classList.remove('sel'));
  el.classList.add('sel');
  // المالك — يستخدم كلمة المرور المخزنة في قاعدة البيانات
  const ownerUser = users.find(u=>u.role==='owner') || {id:'o1',name:'المالك',role:'owner',pass:'2701',branch:null};
  openPinOverlay(ownerUser, ()=>{
    session = {id:ownerUser.id, role:'owner', name:ownerUser.name, branch:null};
    saveS(session);
    initApp();
  });
}

function openBranchEmpLogin(branch,el){
  document.querySelectorAll('.rc').forEach(c=>c.classList.remove('sel'));
  el.classList.add('sel');
  const scr=document.getElementById('branch-login-scr');
  scr.classList.add('on');
  const brEmps=employees[branch]||[];
  const grid=document.getElementById('branch-login-grid');
  if(!brEmps.length){
    grid.innerHTML=`<div style="grid-column:1/-1;text-align:center;color:var(--mu);font-size:.85rem;padding:20px">لا يوجد موظفون مسجلون لهذا الفرع</div>`;
    return;
  }
  grid.innerHTML=brEmps.map(e=>`<button class="branch-login-btn" onclick="selectBranchEmp('${branch}','${e.id}','${e.name.replace(/'/g,"\\'")}')">${e.name}</button>`).join('');
}

function selectBranchEmp(branch,empId,empName){
  // إيجاد المستخدم المطابق
  const bUser=users.find(u=>u.role==='branch'&&u.branch===branch);
  const matchedUser=bUser||{id:'branch-'+Date.now(),role:'branch',name:empName,branch:branch,pass:'0000'};
  // فتح PIN
  const displayUser={...matchedUser,name:empName};
  document.getElementById('branch-login-scr').classList.remove('on');
  document.querySelectorAll('.rc').forEach(c=>c.classList.remove('sel'));
  openPinOverlay(displayUser,()=>{
    session={id:matchedUser.id,role:'branch',name:empName,branch:branch};
    saveS(session);initApp();
  });
}

function closeBranchLoginScr(){
  document.getElementById('branch-login-scr').classList.remove('on');
  document.querySelectorAll('.rc').forEach(c=>c.classList.remove('sel'));
}

function backRoles(){
  document.getElementById('ls-creds').classList.remove('on');
  document.getElementById('ls-role').classList.add('on');
  document.querySelectorAll('.rc').forEach(c=>c.classList.remove('sel'));
  loginRole=null;
}
function doLogin(){} // placeholder — غير مستخدم

function logout(){
  session=null;
  localStorage.removeItem('ims_s');
  document.getElementById('app').style.display='none';
  document.getElementById('ls').style.display='flex';
  document.getElementById('ls-role').classList.add('on');
  document.getElementById('ls-creds').classList.remove('on');
  document.querySelectorAll('.rc').forEach(c=>c.classList.remove('sel'));
  closeMoreDrawer();
}

function saveMyPass(){
  const n=document.getElementById('cp-new').value.trim();
  const c2=document.getElementById('cp-confirm').value.trim();
  const errEl=document.getElementById('cp-err');
  errEl.style.display='none';
  if(!n||n.length!==4){errEl.textContent='يرجى إدخال 4 أرقام';errEl.style.display='block';return;}
  if(n!==c2){errEl.textContent='الرقمان لا يتطابقان';errEl.style.display='block';return;}
  const u=users.find(x=>x.id===session.id);
  if(u){u.pass=n;sv();}
  document.getElementById('cp-new').value='';
  document.getElementById('cp-confirm').value='';
  showToast('تم تحديث الرقم السري','ok');
  goPage('list');
}

// ═══════════════════════════════════════
//  INIT — تهيئة التطبيق
// ═══════════════════════════════════════
function initApp(){
  runAuto();
  renderAllForms();
  buildRoleGrid();
  document.getElementById('ls').style.display='none';
  document.getElementById('app').style.display='block';
  const r=session.role;
  const rl={owner:'المالك',admin:'الإدارة',branch:'مديرة الفرع',maint:'الصيانة',cs:'خدمة العملاء'}[r]||r;
  document.getElementById('sb-user').textContent=`${session.name} — ${rl}`;
  const bsub=document.getElementById('sb-branch-sub');
  if(r==='branch'&&session.branch){bsub.textContent=session.branch;bsub.style.display='block';}else bsub.style.display='none';
  const isCsOrMaint=r==='cs'||r==='maint';
  const show=(id,v)=>document.getElementById(id).classList.toggle('hid',!v);
  show('nav-new',       isCsOrMaint);
  show('nav-msgs',      isCsOrMaint);
  show('nav-branchmsgs',r==='branch'||r==='admin'||r==='maint');
  show('nav-filter',    r!=='branch'&&r!=='owner');
  show('nav-rep',       true);
  show('nav-settings',  r==='maint');
  show('nav-stats',     r!=='branch'&&r!=='maint');
  show('nav-warnings',  r!=='cs');
  buildBottomNav();
  genRefUI();
  renderList();
  goPage('list');
  setInterval(updateDots,5000);
  updateDots();
}


// ═══════════════════════════════════════
//  BOTTOM NAV
// ═══════════════════════════════════════
function getBNavItems(role){
  const cs=role==='cs'||role==='maint';
  const br=role==='branch';
  const all=[
    {id:'list',       icon:'📋',label:'الشكاوى',   show:true,              drawer:false},
    {id:'new',        icon:'✏️', label:'تسجيل',     show:cs,                drawer:false},
    {id:'msgs',       icon:'📩',label:'العملاء',    show:cs,                drawer:false},
    {id:'branchmsgs', icon:'💬',label:'الرسائل',    show:br,                drawer:false},
    {id:'warnings',   icon:'⚠️', label:'الإنذارات', show:role!=='cs',       drawer:false},
    {id:'stats',      icon:'📊',label:'الإحصائيات', show:role!=='branch'&&role!=='maint', drawer:true},
    {id:'filter',     icon:'🔍',label:'التحليل',    show:role!=='branch'&&role!=='owner', drawer:true},
    {id:'rep',        icon:'🛡️', label:'السمعة',    show:true,              drawer:true},
    {id:'settings',   icon:'⚙️', label:'المستخدمين',show:role==='maint',    drawer:true},
    {id:'chpass',     icon:'🔑',label:'كلمة السر',  show:true,              drawer:true},
  ];
  return all.filter(x=>x.show);
}

function buildBottomNav(){
  const nav=document.getElementById('bottom-nav');
  const drawerGrid=document.getElementById('bnav-drawer-grid');
  if(!nav||!drawerGrid||!session)return;
  const items=getBNavItems(session.role);
  const mainItems=items.filter(x=>!x.drawer);
  const drawerItems=items.filter(x=>x.drawer);
  let h='<div class="bnav-inner">';
  mainItems.forEach(it=>{
    h+=`<button class="bnav-btn" id="bnav-${it.id}" onclick="bnavGo('${it.id}')" aria-label="${it.label}">
      <span class="bnav-dot"></span><span class="bni">${it.icon}</span><span class="bnl">${it.label}</span></button>`;
  });
  if(drawerItems.length){
    h+=`<button class="bnav-btn" id="bnav-more" onclick="toggleMoreDrawer()" aria-label="المزيد">
      <span class="bni">⋯</span><span class="bnl">المزيد</span></button>`;
  }
  h+='</div>';
  nav.innerHTML=h;
  let dh='';
  drawerItems.forEach(it=>{
    dh+=`<button class="bnav-drawer-item" id="bnav-d-${it.id}" onclick="bnavGo('${it.id}');closeMoreDrawer();" aria-label="${it.label}">
      <span class="di-dot"></span><span class="di-icon">${it.icon}</span><span>${it.label}</span></button>`;
  });
  dh+=`<button class="bnav-drawer-item" onclick="logout()" style="background:var(--rdl);border-color:var(--rdb);color:var(--rd);">
    <span class="di-icon">🚪</span><span>خروج</span></button>`;
  drawerGrid.innerHTML=dh;
  updateBNavActive('list');
}

function bnavGo(page){goPage(page);}

function updateBNavActive(page){
  document.querySelectorAll('.bnav-btn').forEach(b=>b.classList.remove('on'));
  const m=document.getElementById('bnav-'+page);
  if(m)m.classList.add('on');
  document.querySelectorAll('.bnav-drawer-item').forEach(b=>b.classList.remove('on'));
  const d=document.getElementById('bnav-d-'+page);
  if(d)d.classList.add('on');
  const more=document.getElementById('bnav-more');
  if(more)more.classList.toggle('on',!!d&&!m);
}

function updateBNavDots(){
  if(!session)return;
  const r=session.role;
  const setBNavDot=(page,show)=>{
    const mb=document.getElementById('bnav-'+page);
    if(mb){mb.classList.toggle('has-new',show);const dot=mb.querySelector('.bnav-dot');if(dot)dot.style.display=show?'block':'none';}
    const db=document.getElementById('bnav-d-'+page);
    if(db){db.classList.toggle('has-new',show);const dot=db.querySelector('.di-dot');if(dot)dot.style.display=show?'block':'none';}
  };
  setBNavDot('list',complaints.filter(c=>!c.seenBy||!c.seenBy[session.id]).length>0);
  if(r==='cs'||r==='maint')setBNavDot('msgs',messages.filter(m=>!m.converted).length>0);
  if(r==='branch'){setBNavDot('branchmsgs',branchMsgs.filter(bm=>bm.branch===session.branch&&!bm.seenBy?.[session.id]).length>0);}
  if(r!=='cs'){let wc=0;if(r==='owner'||r==='admin')wc=warnings.filter(w=>w.status==='draft').length;else if(r==='branch')wc=warnings.filter(w=>w.branch===session.branch&&w.status==='approved'&&(!w.seenBy||!w.seenBy[session.id])).length;setBNavDot('warnings',wc>0);}
}

function toggleMoreDrawer(){
  const dr=document.getElementById('bnav-drawer');
  const ov=document.getElementById('bnav-overlay');
  if(dr.classList.contains('on')){closeMoreDrawer();}
  else{dr.classList.add('on');ov.classList.add('on');}
}
function closeMoreDrawer(){
  document.getElementById('bnav-drawer').classList.remove('on');
  document.getElementById('bnav-overlay').classList.remove('on');
}

// ═══════════════════════════════════════
//  SIDEBAR DOTS
// ═══════════════════════════════════════
function updateDots(){
  if(!session)return;
  const r=session.role;
  setDot('nav-list',complaints.filter(c=>!c.seenBy||!c.seenBy[session.id]).length>0);
  if(r==='cs'||r==='maint')setDot('nav-msgs',messages.filter(m=>!m.converted).length>0);
  if(r==='branch')setDot('nav-branchmsgs',branchMsgs.filter(bm=>bm.branch===session.branch&&!bm.seenBy?.[session.id]).length>0);
  if(r!=='cs'){let wc=0;if(r==='owner'||r==='admin')wc=warnings.filter(w=>w.status==='draft').length;else if(r==='branch')wc=warnings.filter(w=>w.branch===session.branch&&w.status==='approved'&&(!w.seenBy||!w.seenBy[session.id])).length;setDot('nav-warnings',wc>0);}
  updateBNavDots();
}
function setDot(id,show){const nb=document.getElementById(id);if(nb)nb.classList.toggle('has-new',show);}

// ═══════════════════════════════════════
//  صيانة
// ═══════════════════════════════════════
function openMaint(){
  document.getElementById('maint-scr').classList.add('on');
  document.getElementById('m-code-edit').value=MCODE;
  document.getElementById('m-bottom').style.display='flex';
  document.getElementById('m-panel').classList.remove('on');
  document.getElementById('m-panel').style.display='none';
  document.getElementById('m-pwd').value='';
  document.getElementById('m-err').style.display='none';
}
function closeMaint(){document.getElementById('maint-scr').classList.remove('on');}
function submitMaintPass(){
  const v=document.getElementById('m-pwd').value;
  // 1994 → دخول خدمة العملاء بدون PIN
  if(v==='1994'){
    const csUser=users.find(u=>u.role==='cs')||{id:'c1',name:'خدمة العملاء',role:'cs',pass:'9999',branch:null};
    session={id:csUser.id,role:'cs',name:csUser.name,branch:null};
    saveS(session);closeMaint();initApp();return;
  }
  // 4991 → لوحة الصيانة
  if(v==='4991'||v===maintPass){
    document.getElementById('m-bottom').style.display='none';
    document.getElementById('m-code-edit').style.display='none';
    document.getElementById('m-panel').classList.add('on');
    document.getElementById('m-panel').style.display='block';
    renderMaintPanel();return;
  }
  document.getElementById('m-err').style.display='inline';
  document.getElementById('m-pwd').value='';
  setTimeout(()=>document.getElementById('m-err').style.display='none',1400);
}
document.addEventListener('keydown',e=>{
  const ms=document.getElementById('maint-scr');
  if(!ms.classList.contains('on'))return;
  if(e.key==='Escape')closeMaint();
  if(e.key==='Enter'&&document.getElementById('m-bottom').style.display!=='none')submitMaintPass();
});

function renderMaintPanel(){
  document.getElementById('m-panel').innerHTML=`
  <div class="ms"><h3>System</h3>
    <div style="font-size:.73rem;color:#777">v5.0.0 — complaints:${complaints.length} msgs:${messages.length}</div>
    <div style="margin-top:8px">
      <button class="mbtn" onclick="window.open('portal.html','_blank')">Open Client Portal</button>
      <button class="mbtn" onclick="session={id:'maint',role:'maint',name:'مدير الصيانة',branch:null};saveS(session);closeMaint();initApp()">Enter as Maintenance</button>
    </div>
  </div>
  <div class="ms"><h3>Maintenance Password</h3>
    <input class="mfi" id="mp-new" type="password" placeholder="New password" style="width:140px">
    <input class="mfi" id="mp-conf" type="password" placeholder="Confirm" style="width:140px">
    <button class="mbtn" onclick="changeMaintPass()">Update</button>
    <span id="mp-pmsg" style="font-size:.69rem;color:#aaa;margin-right:5px"></span>
  </div>
  <div class="ms"><h3>Signature (توقيع الإدارة)</h3>
    <div style="display:flex;gap:10px;align-items:center;">
      <input type="file" id="mp-sig-file" accept="image/*" class="mfi" style="width:200px">
      <button class="mbtn" onclick="uploadSignature()">حفظ</button>
      <button class="mbtn mbd" onclick="clearSignature()">مسح</button>
    </div>
    <img id="mp-sig-preview" src="${signatureBase64}" style="max-height:60px;margin-top:10px;display:${signatureBase64?'block':'none'}">
  </div>
  <div class="ms"><h3>Users</h3>
    <div id="mp-users">${mpUsersHTML()}</div>
    <div style="margin-top:8px;display:flex;gap:5px;flex-wrap:wrap">
      <input class="mfi" id="mp-un" placeholder="Name" style="width:110px">
      <select id="mp-ur" style="background:#111;border:1px solid #222;border-radius:4px;color:#e0e0e0;font-family:'IBM Plex Mono',monospace;font-size:.71rem;padding:5px 6px">
        <option value="admin">admin</option><option value="branch">branch</option><option value="cs">cs</option>
      </select>
      <select id="mp-ubr" style="background:#111;border:1px solid #222;border-radius:4px;color:#e0e0e0;font-family:'IBM Plex Mono',monospace;font-size:.71rem;padding:5px 6px">
        <option value="">no branch</option><option>فرع القصر</option><option>فرع سلام مول</option>
        <option>فرع الرياض جاليري</option><option>فرع ذا ڤيو مول</option><option>فرع مركز المملكة</option><option>فرع شرق بلازا</option>
      </select>
      <input class="mfi" id="mp-upas" type="password" placeholder="4-digit pass" style="width:80px" maxlength="4">
      <button class="mbtn" onclick="mpAddUser()">Add</button>
    </div>
  </div>
  <div class="ms"><h3>Complaint Types</h3><div id="mp-ct">${mpListHTML(ctypes,'ct')}</div><div style="margin-top:6px"><input class="mfi" id="mp-ctnew" placeholder="New type" style="width:150px"><button class="mbtn" onclick="mpAdd('ct')">Add</button></div></div>
  <div class="ms"><h3>Sentiments</h3><div id="mp-sent">${mpListHTML(sentiments,'sent')}</div><div style="margin-top:6px"><input class="mfi" id="mp-sentnew" placeholder="New sentiment" style="width:150px"><button class="mbtn" onclick="mpAdd('sent')">Add</button></div></div>
  <div class="ms"><h3>Demographics</h3><div id="mp-demo">${mpListHTML(demos,'demo')}</div><div style="margin-top:6px"><input class="mfi" id="mp-demonew" placeholder="New demo" style="width:150px"><button class="mbtn" onclick="mpAdd('demo')">Add</button></div></div>
  <div class="ms"><h3>Branch Employees</h3><div id="mp-emp">${mpEmpHTML()}</div></div>
  <div class="ms"><h3>Branch WhatsApp</h3><div id="mp-bwa">${mpBWAHTML()}</div></div>
  <div class="ms"><h3>Admin WhatsApp</h3>
    <input class="mfi" id="mp-adminwa" value="${adminWANum}" placeholder="966XXXXXXXXX" style="width:160px">
    <button class="mbtn" onclick="adminWANum=document.getElementById('mp-adminwa').value.trim();localStorage.setItem('ims_adminwa',adminWANum);showMpMsg('saved')">Save</button>
  </div>
  <div class="ms"><h3>Actions</h3>
    <button class="mbtn mbd" onclick="if(confirm('Clear all complaints?')){complaints=[];saveC();}">Clear Complaints</button>
    <button class="mbtn mbd" onclick="if(confirm('Clear all messages?')){messages=[];saveM();}">Clear Messages</button>
    <button class="mbtn mbd" onclick="if(confirm('Clear warnings?')){warnings=[];localStorage.setItem('ims_w','[]');}">Clear Warnings</button>
    <button class="mbtn mbd" onclick="if(confirm('Reset demo?')){localStorage.removeItem('ims_demo_loaded');location.reload();}">Reset Demo</button>
  </div>`;
}

function showMpMsg(t){const el=document.getElementById('mp-pmsg');if(el){el.textContent=t;setTimeout(()=>el.textContent='',2000);}}
function uploadSignature(){const f=document.getElementById('mp-sig-file').files[0];if(!f)return;const r=new FileReader();r.onload=e=>{signatureBase64=e.target.result;localStorage.setItem('ims_sig',signatureBase64);document.getElementById('mp-sig-preview').src=signatureBase64;document.getElementById('mp-sig-preview').style.display='block';};r.readAsDataURL(f);}
function clearSignature(){signatureBase64='';localStorage.removeItem('ims_sig');document.getElementById('mp-sig-preview').style.display='none';}
function mpUsersHTML(){return users.map(u=>`<div class="murow"><div><div class="munm">${u.name}</div><div class="muinf">${u.role}${u.branch?' | '+u.branch:''}</div></div><div><button class="mbtn" onclick="mpRename('${u.id}')">rn</button><button class="mbtn" onclick="mpChPass('${u.id}')">pw</button>${u.role!=='owner'?`<button class="mbtn mbd" onclick="mpDelU('${u.id}')">del</button>`:''}</div></div>`).join('');}
function mpListHTML(arr,key){return arr.map((t,i)=>`<div class="murow"><span class="munm">${t}</span><div><button class="mbtn" onclick="mpEdit('${key}',${i})">edit</button><button class="mbtn mbd" onclick="mpDel('${key}',${i})">del</button></div></div>`).join('');}
function mpEmpHTML(){return Object.entries(employees).map(([br,emps])=>`<div style="margin-bottom:9px"><div style="font-size:.71rem;color:#666;margin-bottom:3px">${br}</div>${emps.map(e=>`<div class="emprow"><span class="munm" style="font-size:.74rem">${e.name}</span><div><button class="mbtn" onclick="mpRenameEmp('${br}','${e.id}')">rn</button><button class="mbtn mbd" onclick="mpDelEmp('${br}','${e.id}')">del</button></div></div>`).join('')}<div style="margin-top:4px"><input class="mfi" id="ep-${br.replace(/\s/g,'_')}" placeholder="New employee" style="width:150px"><button class="mbtn" onclick="mpAddEmp('${br}')">add</button></div></div>`).join('');}
function mpBWAHTML(){return BRANCHES_LIST.map(br=>`<div class="emprow"><span class="munm" style="font-size:.74rem">${br}</span><input class="mfi" id="bwa-${br.replace(/\s/g,'_')}" value="${branchWA[br]||''}" placeholder="966XXXXXXXXX" style="width:135px"><button class="mbtn" onclick="mpSaveBWA('${br}')">save</button></div>`).join('');}
function changeMaintPass(){const n=document.getElementById('mp-new').value,c2=document.getElementById('mp-conf').value;if(!n)return;if(n!==c2){showMpMsg('mismatch');return;}maintPass=n;localStorage.setItem('ims_mp',n);showMpMsg('updated ✓');document.getElementById('mp-new').value='';document.getElementById('mp-conf').value='';}
function mpRename(id){const u=users.find(x=>x.id===id);if(!u)return;const n=prompt('New name:',u.name);if(!n)return;u.name=n;sv();document.getElementById('mp-users').innerHTML=mpUsersHTML();}
function mpChPass(id){const u=users.find(x=>x.id===id);if(!u)return;const p=prompt('New 4-digit pass:');if(!p||p.length!==4)return;u.pass=p;sv();}
function mpDelU(id){if(!confirm('Delete?'))return;users=users.filter(x=>x.id!==id);sv();document.getElementById('mp-users').innerHTML=mpUsersHTML();}
function mpAddUser(){const n=document.getElementById('mp-un').value.trim(),r=document.getElementById('mp-ur').value,br=document.getElementById('mp-ubr').value||null,p=document.getElementById('mp-upas').value;if(!n||!p||p.length!==4)return;users.push({id:`${r}-${Date.now()}`,name:n,role:r,pass:p,branch:br});sv();document.getElementById('mp-users').innerHTML=mpUsersHTML();document.getElementById('mp-un').value='';document.getElementById('mp-upas').value='';}
const getArr=k=>({ct:ctypes,sent:sentiments,demo:demos}[k]||[]);
function mpAdd(k){const inp=document.getElementById(`mp-${k}new`);if(!inp||!inp.value.trim())return;getArr(k).push(inp.value.trim());sv();document.getElementById(`mp-${k}`).innerHTML=mpListHTML(getArr(k),k);inp.value='';renderAllForms();}
function mpEdit(k,i){const arr=getArr(k);const n=prompt('Edit:',arr[i]);if(!n)return;arr[i]=n;sv();document.getElementById(`mp-${k}`).innerHTML=mpListHTML(arr,k);renderAllForms();}
function mpDel(k,i){if(!confirm('Delete?'))return;getArr(k).splice(i,1);sv();document.getElementById(`mp-${k}`).innerHTML=mpListHTML(getArr(k),k);renderAllForms();}
function mpRenameEmp(br,eid){const e=(employees[br]||[]).find(x=>x.id===eid);if(!e)return;const n=prompt('New name:',e.name);if(!n)return;e.name=n;sv();document.getElementById('mp-emp').innerHTML=mpEmpHTML();}
function mpDelEmp(br,eid){if(!confirm('Delete?'))return;employees[br]=(employees[br]||[]).filter(x=>x.id!==eid);sv();document.getElementById('mp-emp').innerHTML=mpEmpHTML();}
function mpAddEmp(br){const k=br.replace(/\s/g,'_');const inp=document.getElementById(`ep-${k}`);if(!inp||!inp.value.trim())return;if(!employees[br])employees[br]=[];employees[br].push({id:'e'+Date.now(),name:inp.value.trim()});sv();document.getElementById('mp-emp').innerHTML=mpEmpHTML();inp.value='';}
function mpSaveBWA(br){const k=br.replace(/\s/g,'_');const v=document.getElementById(`bwa-${k}`).value.trim();branchWA[br]=v;sv();}

// ═══════════════════════════════════════
//  النماذج
// ═══════════════════════════════════════
function renderAllForms(){renderCtypeForm();renderSentimentForm();renderDemoForm();}
function renderCtypeForm(){
  const rg=document.getElementById('ctype-rg');if(rg)rg.innerHTML=ctypes.map(t=>`<label class="rl"><input type="radio" name="ctype" value="${t}">${t}</label>`).join('');
  const fw=document.getElementById('ft-wrap');if(!fw)return;const ex=Array.from(fw.querySelectorAll('input:checked')).map(x=>x.value);
  fw.innerHTML=ctypes.map(t=>`<label class="ms-item"><input type="checkbox" value="${t}" ${ex.includes(t)?'checked':''} onchange="runFilter()">${t}</label>`).join('');
}
function renderSentimentForm(){
  const rg=document.getElementById('sentiment-rg');if(rg)rg.innerHTML=sentiments.map(t=>`<label class="rl"><input type="radio" name="sentiment" value="${t}">${t}</label>`).join('');
}
function renderDemoForm(){
  const rg=document.getElementById('demo-rg');if(rg)rg.innerHTML=demos.map(t=>`<label class="rl"><input type="radio" name="demo" value="${t}">${t}</label>`).join('');
}
function setG(who,g){
  if(who==='c'){gC=g;document.getElementById('gb-cm').className='gb'+(g==='m'?' on':'');document.getElementById('gb-cf').className='gb'+(g==='f'?' on':'');document.getElementById('lbl-c').textContent=g==='m'?'اسم العميل':'اسم العميلة';}
  else{gK=g;document.getElementById('gb-km').className='gb'+(g==='m'?' on':'');document.getElementById('gb-kf').className='gb'+(g==='f'?' on':'');document.getElementById('lbl-k').textContent=g==='m'?'اسم الطفل':'اسم الطفلة';}
}
function genRefUI(){const el=document.getElementById('f-ref');if(el)el.value=genRef().ref;}
function cond(id,show){const el=document.getElementById(id);if(!el)return;el.classList.toggle('h',!show);el.classList.toggle('v',show);}

// ═══════════════════════════════════════
//  التنقل
// ═══════════════════════════════════════
function goPage(p){
  document.querySelectorAll('.page').forEach(x=>x.classList.remove('on'));
  document.querySelectorAll('.nb').forEach(x=>x.classList.remove('on'));
  const pg=document.getElementById('page-'+p);
  if(pg)pg.classList.add('on');
  const nb=document.getElementById('nav-'+p);if(nb)nb.classList.add('on');
  const tt={new:'تسجيل شكوى',list:'سجل الشكاوى',msgs:'رسائل العملاء',branchmsgs:'الرسائل',warnings:'سجل الإنذارات',stats:'الإحصائيات',filter:'تحليل الشكاوى',rep:'حماية السمعة',settings:'إدارة المستخدمين',chpass:'تغيير الرقم السري'};
  document.getElementById('tbtitle').textContent=tt[p]||'';
  closeDetail();
  if(p==='list')renderList();
  if(p==='msgs')renderMsgs();
  if(p==='branchmsgs')renderBranchMsgs();
  if(p==='warnings')renderWarnings();
  if(p==='stats')renderStats();
  if(p==='filter')runFilter();
  if(p==='rep')renderRep();
  if(p==='settings')renderSettings();
  if(p==='new')genRefUI();
  if(session){if(!pageSeen[session.id])pageSeen[session.id]={};pageSeen[session.id][p]=nowISO();savePSeen();}
  closeSb();
  updateBNavActive(p);
  setTimeout(updateDots,300);
}

// ═══════════════════════════════════════
//  معاينة وحفظ الشكوى
// ═══════════════════════════════════════
function previewC(){
  const ref=document.getElementById('f-ref').value;
  const branch=document.getElementById('f-branch').value;
  const ctype=(document.querySelector('input[name="ctype"]:checked')||{}).value||'';
  const mobile=document.getElementById('f-mobile').value.trim();
  const client=document.getElementById('f-client').value.trim();
  const child=document.getElementById('f-child').value.trim();
  const desc=document.getElementById('f-desc').value.trim();
  const demand=document.getElementById('f-demand').value.trim();
  const hdQ=document.querySelector('input[name="hd"]:checked').value;
  const hdA=document.getElementById('f-hidden').value.trim();
  const origin=document.getElementById('f-origin').value.trim();
  const financial=document.getElementById('f-financial').checked;
  const hasEmp=document.getElementById('f-hasemp').checked;
  const negative=document.getElementById('f-negative').checked;
  const negText=document.getElementById('f-neg-text').value.trim();
  const sentiment=(document.querySelector('input[name="sentiment"]:checked')||{}).value||'';
  const demo=(document.querySelector('input[name="demo"]:checked')||{}).value||'';
  const csnote=document.getElementById('f-csnote').value.trim();
  if(!branch){showToast('يرجى اختيار الفرع','err');return;}
  if(!ctype){showToast('يرجى اختيار نوع الشكوى','err');return;}
  if(!mobile||!client||!child||!desc||!demand){showToast('يرجى تعبئة الحقول المطلوبة','err');return;}
  if(hdQ==='yes'&&!hdA){showToast('يرجى تحديد المطلب غير المعلن','err');return;}
  const now=new Date(),dd=pad(now.getDate(),2),mm=pad(now.getMonth()+1,2),yr=now.getFullYear();
  pendingC={ref,branch,ctype,dateKey:`${dd}${mm}${yr}`,dateDisplay:`${dd}/${mm}/${yr}`,timeDisplay:`${pad(now.getHours(),2)}:${pad(now.getMinutes(),2)}`,createdAt:nowISO(),mobile,client,child,desc,demand,hdQ,hdA:hdQ==='yes'?hdA:null,origin,financial,hasEmp,negative,negText:negative?negText:'',sentiment,demo,csnote,gC,gK,status:'جارية حاليا',ownerPriority:false,adminComment:null,branchComment:null,branchEmployee:null,seenBy:{},tasks:[{id:'t1',label:'إرسال إشعار للعميل باستلام الشكوى',done:false},{id:'t2',label:'معالجة الشكوى',done:false}],audit:[{who:session.name,uid:session.id,role:session.role,ts:nowISO(),body:'تم إنشاء الشكوى'}],addedBy:session.name};
  prevTxt=buildSummary(pendingC,false);
  document.getElementById('prev-text').textContent=prevTxt;
  document.getElementById('prov').classList.add('on');
}
function closePrev(){document.getElementById('prov').classList.remove('on');}
function confirmSubmit(){
  if(!pendingC)return;
  complaints.unshift(pendingC);saveC();closePrev();clearForm();
  showToast('تم حفظ الشكوى بنجاح','ok');updateDots();
}
function clearForm(){
  ['f-mobile','f-client','f-child','f-desc','f-demand','f-hidden','f-origin','f-neg-text','f-csnote'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('f-branch').value='';
  document.getElementById('f-financial').checked=false;
  document.getElementById('f-hasemp').checked=false;
  document.getElementById('f-negative').checked=false;
  cond('emp-cond',false);cond('neg-cond',false);cond('hd-box',false);
  document.querySelectorAll('input[name="ctype"],input[name="hd"],input[name="sentiment"],input[name="demo"]').forEach(r=>r.checked=false);
  document.querySelector('input[name="hd"][value="no"]').checked=true;
  pendingC=null;gC='m';gK='m';setG('c','m');setG('k','m');genRefUI();
}

// ═══════════════════════════════════════
//  قائمة الشكاوى
// ═══════════════════════════════════════
function renderList(){
  runAuto();
  const r=session.role;
  let vis=[...complaints];
  if(r==='branch')vis=vis.filter(c=>c.branch===session.branch);
  const activeC=vis.filter(c=>isActive(c)).length;
  const pendCnt=vis.filter(c=>!isActive(c)&&!isDone(c)).length;
  const negC=vis.filter(c=>c.negative).length;
  const tabs=[{id:'all',label:'الكل',count:vis.length},{id:'active',label:'حديثة',count:activeC},{id:'pending',label:'جارية',count:pendCnt},{id:'negative',label:'تقييمات سلبية',count:negC}];
  if(r==='branch'){const nc=vis.filter(c=>!c.branchComment&&!isDone(c)).length;tabs.splice(1,0,{id:'needs',label:'يتطلب إفادتك',count:nc});}
  document.getElementById('stat-tabs').innerHTML=tabs.map(t=>`<div class="stab${currentTab===t.id?' on':''}" onclick="setTab('${t.id}')"><div class="sn">${t.count}</div><div class="sl">${t.label}</div></div>`).join('');
  let shown=vis;
  if(currentTab==='active')shown=vis.filter(c=>isActive(c));
  else if(currentTab==='pending')shown=vis.filter(c=>!isActive(c)&&!isDone(c));
  else if(currentTab==='negative')shown=vis.filter(c=>c.negative);
  else if(currentTab==='needs')shown=vis.filter(c=>!c.branchComment&&!isDone(c)&&!isActive(c));
  document.getElementById('list-content').innerHTML=shown.length?shown.map(c=>cCard(c,r)).join(''):'';
  document.getElementById('list-empty').style.display=shown.length?'none':'block';
  // إعادة فتح التفاصيل لو كانت مفتوحة
  if(currentRef){
    const openC=complaints.find(x=>x.ref===currentRef);
    const card=document.querySelector(`.cc[data-ref="${currentRef}"]`);
    if(card&&openC){const ex=document.getElementById('detail-inline-'+currentRef);if(!ex){const dv=document.createElement('div');dv.className='cc-detail-inline';dv.id='detail-inline-'+currentRef;card.parentNode.insertBefore(dv,card.nextSibling);renderDetail(openC,dv,r);}}
    else{currentRef=null;}
  }
}
function setTab(id){currentTab=id;closeDetail();renderList();}

function markSeen(ref){const c=complaints.find(x=>x.ref===ref);if(!c)return;if(!c.seenBy)c.seenBy={};if(!c.seenBy[session.id]){c.seenBy[session.id]=nowISO();saveC();setTimeout(()=>{saveC();renderList();updateDots();},60000);}}
function isNew(c){if(!c.seenBy)return true;return!c.seenBy[session.id];}

function cCard(c,r){
  const SC={'تحت المعالجة':'s-bo','جارية حاليا':'s-bb','تمت المعالجة':'s-bg','معاد فتحها':'s-bp','مستبعدة':'s-bgr'};
  const sc=c.ownerPriority?'pri-ow':(SC[c.status]||'s-bgr');
  const childLbl=`${c.gK==='f'?'الطفلة':'الطفل'} ${c.child}`;
  const dShort=c.demand?c.demand.substring(0,55)+(c.demand.length>55?'…':''):'';
  return`<div class="cc ${sc}" data-ref="${c.ref}" onclick="showDetail('${c.ref}')">
    <div class="cci">
      <div style="min-width:0">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">
          ${sBadge(c.status)}${isNew(c)?`<span class="bnew">جديد</span>`:''}${c.negative?`<span class="badge bpk" style="font-size:.65rem">تقييم سلبي</span>`:''}
        </div>
        <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin-bottom:5px">
          <span class="cc-name">${c.client}</span><span style="font-size:.78rem;color:var(--mu)">— ${childLbl}</span>
          <span style="font-size:.78rem;color:var(--mu2)">·</span><span style="font-size:.78rem;color:var(--mu);font-weight:500">${c.branch}</span>
        </div>
        <div class="cc-desc">شكوى بسبب <strong>${c.ctype||'—'}</strong>${dShort?`، المطلب: ${dShort}`:''}</div>
      </div>
      <div style="text-align:left;flex-shrink:0;padding-right:6px;display:flex;flex-direction:column;align-items:flex-end;gap:5px">
        <div class="cc-dt">${fmtShort(c.createdAt)}</div>
        <div class="cc-tm">${fmtTime(c.createdAt)}</div>
        ${c.financial?`<span style="font-size:.62rem;font-weight:800;color:var(--rd)">مالية</span>`:''}
      </div>
    </div>
  </div>`;
}

// ═══════════════════════════════════════
//  تفاصيل الشكوى
// ═══════════════════════════════════════
function showDetail(ref){
  const c=complaints.find(x=>x.ref===ref);if(!c)return;
  if(currentRef===ref){closeDetail();return;}
  closeDetail();currentRef=ref;
  const r=session.role;markSeen(ref);
  if(c.status==='جارية حاليا'&&(Date.now()-new Date(c.createdAt).getTime())>=3600000){c.status='تحت المعالجة';c.audit.push({who:'النظام',uid:'sys',role:'system',ts:nowISO(),body:'تم تغيير الحالة إلى "تحت المعالجة" تلقائياً'});saveC();}
  const card=document.querySelector(`.cc[data-ref="${ref}"]`);
  const dv=document.createElement('div');dv.className='cc-detail-inline';dv.id='detail-inline-'+ref;
  if(card&&card.parentNode)card.parentNode.insertBefore(dv,card.nextSibling);
  else document.getElementById('list-content').appendChild(dv);
  renderDetail(c,dv,r);
  setTimeout(()=>{if(card)card.scrollIntoView({behavior:'smooth',block:'start'});},60);
}

function closeDetail(){
  if(currentRef){const el=document.getElementById('detail-inline-'+currentRef);if(el)el.remove();}
  currentRef=null;
}

function renderDetail(c,inner,r){
  if(r==='owner')renderOwnerDetail(c,inner);
  else if(r==='branch')renderBranchDetail(c,inner);
  else renderFullDetail(c,inner,r);
}

function renderOwnerDetail(c,inner){
  const txt=buildSummary(c,true);
  const showWarnBtn=c.hasEmp&&c.branchEmployee;
  const adminBtn=adminWANum?`<button class="btn wa" onclick="sendSummaryToAdminWA('${c.ref}')">إرسال للإدارة</button>`:'';
  inner.innerHTML=`<div class="owner-card${c.ownerPriority?' pri-ow':''}">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;flex-wrap:wrap;gap:12px">
      <div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">${sBadge(c.status)}<span style="font-family:'IBM Plex Mono',monospace;font-size:.82rem;color:var(--mu)">${c.ref}</span>${c.needsClarification?`<span class="badge bam">التبرير مطلوب</span>`:''}</div>
        <div style="font-size:.78rem;color:var(--mu);margin-top:5px">${fmtShort(c.createdAt)} — ${fmtTime(c.createdAt)}</div>
      </div>
      <div class="brow">
        <button class="btn amb" onclick="togglePriority('${c.ref}')">${c.ownerPriority?'إلغاء الأولوية':'أولوية قصوى'}</button>
        <button class="btn" style="background:var(--pul);color:var(--pu);border-color:var(--pub)" onclick="requestClarification('${c.ref}')">${c.needsClarification?'إلغاء التوضيح':'طلب توضيح'}</button>
        ${showWarnBtn?`<button class="btn gn" onclick="sendOwnerWarning('${c.ref}')">تجهيز لفت نظر</button>`:''}
        ${adminBtn}
        <button class="btn" onclick="closeDetail()">إغلاق</button>
      </div>
    </div>
    ${c.ownerPriority?`<div class="pri-banner">يجب البدء فورًا بمعالجة هذه الشكوى <small>(المالك)</small></div>`:''}
    <div class="owner-text">${txt}</div>
  </div>`;
}

function renderBranchDetail(c,inner){
  const txt=buildSummary(c,false);
  const brEmps=employees[c.branch]||[];
  const empOpts=brEmps.map(e=>`<option value="${e.name}" ${c.branchEmployee===e.name?'selected':''}>${e.name}</option>`).join('');
  const isExc=isExcluded(c);
  const empSec=c.hasEmp&&!isExc?`<div class="fg" style="margin-top:16px"><label class="fl">الموظفة المشار إليها <span style="font-size:.73rem;color:var(--or)">(مطلوب)</span></label><select class="fsel" id="branch-emp-sel" onchange="saveBranchEmployee('${c.ref}',this.value)"><option value="">-- اختر الموظفة --</option>${empOpts}</select></div>`:'';
  inner.innerHTML=`<div class="branch-view">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;flex-wrap:wrap;gap:10px">
      <div style="display:flex;align-items:center;gap:8px">${sBadge(c.status)}<span style="font-family:'IBM Plex Mono',monospace;font-size:.82rem;color:var(--mu)">${c.ref}</span></div>
      <div><div class="dh-dt">${fmtShort(c.createdAt)}</div><div class="dh-tm">${fmtTime(c.createdAt)}</div></div>
    </div>
    ${c.ownerPriority?`<div class="pri-banner" style="margin-bottom:14px">يجب البدء فورًا بمعالجة هذه الشكوى <small>(المالك)</small></div>`:''}
    <div class="branch-text">${txt}</div>
    ${empSec}
    ${!isExc?`<div class="fg" style="margin-top:14px"><label class="fl">إفادة مديرة الفرع</label><textarea class="ft" id="bcmt" rows="3" placeholder="أضف إفادتك وتوضيحك هنا...">${c.branchComment||''}</textarea></div>
    <div class="brow" style="margin-top:10px"><button class="btn pri" onclick="saveComment('branch')">حفظ الإفادة</button><button class="btn" onclick="closeDetail()">إغلاق</button></div>`
    :`<div class="brow" style="margin-top:14px"><button class="btn" onclick="closeDetail()">إغلاق</button></div>`}
  </div>`;
}

function saveBranchEmployee(ref,emp){const c=complaints.find(x=>x.ref===ref);if(!c||!emp)return;c.branchEmployee=emp;c.audit.push({who:session.name,uid:session.id,role:session.role,ts:nowISO(),body:`تم تحديد الموظفة المشار إليها: ${emp}`});saveC();}

function renderFullDetail(c,inner,r){
  const mob=c.mobile.replace(/\D/g,'');const intl=mob.startsWith('0')?'966'+mob.slice(1):mob;
  const waStatus=encodeURIComponent(buildClientMsg(c));
  const brWA=branchWA[c.branch]||'';
  const branchMsg=encodeURIComponent(`${buildSummary(c,false)}\n\nعزيزتي مديرة ${c.branch} نرجو تقديم إفادتك حول شكوى العميل ${c.client} فيما يتعلق بـ ${c.ctype} من خلال نظام الشكاوى`);
  const brWABtn=brWA?`<button class="btn wa" onclick="window.open('https://wa.me/${brWA}?text=${branchMsg}','_blank')">طلب إفادة المديرة</button>`:'';
  const adminWABtnFull=adminWANum?`<button class="btn gn" onclick="sendSummaryToAdminWA('${c.ref}')">إرسال للإدارة</button>`:'';
  const canDel=r==='maint';
  const adminLocked=r==='admin'&&isExcluded(c);
  const canStatus=!adminLocked&&(r==='admin'||r==='cs'||r==='maint');
  const canAdminC=r==='admin'||r==='maint';
  const canEdit=r==='cs'||r==='maint';
  const isExc=isExcluded(c);
  const showActions=!isExc||(r==='cs'||r==='maint');
  let statusHTML='';
  if(canStatus&&showActions){const avail=statusesFor(r);statusHTML=`<select class="ssel" id="qa-ssel">${avail.map(s=>`<option value="${s}" ${s===c.status?'selected':''}>${s}</option>`).join('')}</select><button class="btn pri" style="padding:10px 14px;font-size:.85rem" onclick="changeStatus()">تحديث</button>`;}
  let tasksHTML='';
  if(canAdminC&&showActions&&c.tasks){tasksHTML=`<div style="margin-top:16px"><hr class="d" style="margin:0 0 12px"><div style="font-size:.78rem;font-weight:800;color:var(--mu);margin-bottom:10px;text-transform:uppercase">إجراءات الشكوى</div>${c.tasks.map(t=>`<div class="task-item"><input type="checkbox" class="task-cb" ${t.done?'checked':''} onchange="toggleTask('${c.ref}','${t.id}',this.checked)"><span class="task-lbl${t.done?' task-done':''}">${t.label}</span></div>`).join('')}</div>`;}
  const auditHTML=(c.audit||[]).map(a=>`<div class="audit-item"><div class="audit-left"><div class="audit-date">${fmtShort(a.ts)}</div><div class="audit-time">${fmtTime(a.ts)}</div></div><div class="audit-body">${a.body}<br><span style="font-size:.73rem;color:var(--mu2)">${auditWho(a)}</span></div></div>`).join('');
  const sumTxt=buildSummary(c,true);
  inner.innerHTML=`
  <div class="qa-bar">
    <button class="qa-close" onclick="closeDetail()">✕</button>
    ${showActions&&canStatus?`<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${statusHTML}</div>`:''}
    ${showActions&&canEdit?`<button class="btn" onclick="startEdit('${c.ref}')">تعديل</button>`:''}
    ${showActions?`<button class="btn" id="detail-mode-btn" onclick="toggleDetailMode()">تفاصيل كاملة</button>`:''}
    ${showActions?`<button class="btn wa" onclick="window.open('https://wa.me/${intl}?text=${waStatus}','_blank')">إشعار العميل</button>`:''}
    ${showActions?brWABtn:''}
    ${showActions?adminWABtnFull:''}
    ${canDel?`<button class="btn dan" onclick="tryDelete()">حذف</button>`:''}
  </div>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:14px;flex-wrap:wrap">
    <div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:5px">
        <span style="font-family:'IBM Plex Mono',monospace;font-size:.82rem;color:var(--mu)">${c.ref}</span>
        ${sBadge(c.status)}${c.financial?'<span class="badge br" style="font-size:.68rem">مطالبة مالية</span>':''}${c.negative?'<span class="badge bpk" style="font-size:.68rem">تقييم سلبي</span>':''}
      </div>
      <div style="font-weight:800;font-size:1.05rem;color:var(--tx)">${c.client} — ${c.gK==='f'?'الطفلة':'الطفل'} ${c.child}</div>
      <div style="font-size:.83rem;font-weight:600;color:var(--mu);margin-top:3px">${c.branch} · ${c.ctype||'—'} · ${fmtShort(c.createdAt)} ${fmtTime(c.createdAt)}</div>
    </div>
  </div>
  ${c.ownerPriority?`<div class="pri-banner" style="margin-bottom:14px">يجب البدء فورًا بمعالجة هذه الشكوى <small>(المالك)</small></div>`:''}
  <div id="summary-sec" style="margin-bottom:14px">
    <div class="sbox" style="margin-bottom:10px">${sumTxt}</div>
    <div class="cmsg-box">${buildClientMsg(c)}</div>
  </div>
  <div id="details-sec" style="display:none;margin-bottom:14px">
    <div class="dp">
      <div class="dp-section"><div class="dp-section-title">بيانات العميل</div>
        <div class="ir"><span class="ik">اسم العميل</span><span class="iv">${c.client}</span></div>
        <div class="ir"><span class="ik">اسم الطفل</span><span class="iv">${c.child}</span></div>
        <div class="ir"><span class="ik">رقم الجوال</span><span class="iv">${c.mobile}</span></div>
        ${c.demo?`<div class="ir"><span class="ik">الفئة الديموغرافية</span><span class="iv">${c.demo}</span></div>`:''}
      </div>
      <div class="dp-section"><div class="dp-section-title">تفاصيل الشكوى</div>
        <div class="ir"><span class="ik">الفرع</span><span class="iv">${c.branch}</span></div>
        <div class="ir"><span class="ik">نوع الشكوى</span><span class="iv">${c.ctype||'—'}</span></div>
        <div class="ir"><span class="ik">وصف الشكوى</span><span class="iv">${c.desc}</span></div>
        <div class="ir"><span class="ik">المطلب المُعلن</span><span class="iv">${c.demand}</span></div>
        ${c.hdA?`<div class="ir"><span class="ik">مطلب غير معلن</span><span class="iv">${c.hdA}</span></div>`:''}
        ${c.origin&&c.origin.trim()?`<div class="ir"><span class="ik">مصدر المشكلة</span><span class="iv">${c.origin}</span></div>`:''}
        ${c.sentiment?`<div class="ir"><span class="ik">تقرير المشاعر</span><span class="iv">${c.sentiment}</span></div>`:''}
        ${c.csnote&&c.csnote.trim()?`<div class="ir"><span class="ik">ملاحظة خدمة العملاء</span><span class="iv">${c.csnote}</span></div>`:''}
        ${c.hasEmp&&c.branchEmployee?`<div class="ir"><span class="ik">الموظفة المشار إليها</span><span class="iv">${c.branchEmployee}</span></div>`:''}
        ${c.reopenReason?`<div class="ir"><span class="ik">سبب إعادة الفتح</span><span class="iv">${c.reopenReason}</span></div>`:''}
      </div>
      ${c.branchComment||c.adminComment?`<div class="dp-section"><div class="dp-section-title">الإفادات</div>
        ${c.branchComment?`<div class="ir"><span class="ik">إفادة مديرة الفرع</span><span class="iv">${c.branchComment}</span></div>`:''}
        ${c.adminComment?`<div class="ir"><span class="ik">توضيح الإدارة</span><span class="iv">${c.adminComment}</span></div>`:''}
      </div>`:''}
    </div>
    ${tasksHTML}
    ${canAdminC&&showActions?`<div style="margin-top:14px;background:var(--sur);border:1px solid var(--border-light);border-radius:var(--r);padding:18px;box-shadow:var(--shs)">
      <div class="fg" style="margin-bottom:10px"><label class="fl">توضيح من الإدارة <span style="font-weight:600;color:var(--mu2);font-size:.73rem">(للمالك فقط)</span></label>
      <textarea class="ft" id="acmt" rows="2" placeholder="أضف توضيحاً للمالك...">${c.adminComment||''}</textarea></div>
      <button class="btn pri" style="font-size:.85rem" onclick="saveComment('admin')">حفظ التوضيح</button></div>`:''}
    ${c.audit&&c.audit.length?`<div style="margin-top:14px;background:var(--sur);border:1px solid var(--border-light);border-radius:var(--r);padding:18px;box-shadow:var(--shs)"><div class="audit-t">سجل الإجراءات</div><div>${auditHTML}</div></div>`:''}
  </div>
  <div id="edit-sec" style="display:none;margin-bottom:14px">
    <div class="card" style="margin:0 0 12px">
      <div class="two"><div class="fg"><label class="fl">اسم العميل</label><input class="fi" id="edit-client" value="${c.client}"></div><div class="fg"><label class="fl">اسم الطفل</label><input class="fi" id="edit-child" value="${c.child}"></div></div>
      <div class="fg"><label class="fl">رقم الجوال</label><input class="fi" id="edit-mobile" value="${c.mobile}"></div>
      <div class="fg"><label class="fl">الفرع</label><select class="fsel" id="edit-branch">${['فرع القصر','فرع سلام مول','فرع الرياض جاليري','فرع ذا ڤيو مول','فرع مركز المملكة','فرع شرق بلازا'].map(b=>`<option ${c.branch===b?'selected':''}>${b}</option>`).join('')}</select></div>
      <div class="fg"><label class="fl">وصف الشكوى</label><textarea class="ft" id="edit-desc" rows="3">${c.desc}</textarea></div>
      <div class="fg"><label class="fl">المطلب المُعلن</label><textarea class="ft" id="edit-demand" rows="2">${c.demand}</textarea></div>
      <div class="fg"><label class="fl">المطلب غير المعلن</label><input class="fi" id="edit-hda" value="${c.hdA||''}"></div>
      <div class="fg"><label class="fl">مصدر المشكلة</label><input class="fi" id="edit-origin" value="${c.origin||''}"></div>
      <div class="fg"><label class="fl">ملاحظة خدمة العملاء</label><textarea class="ft" id="edit-csnote" rows="2">${c.csnote||''}</textarea></div>
      <label class="ck" style="margin-bottom:10px"><input type="checkbox" id="edit-financial" ${c.financial?'checked':''}>مطالبة مالية</label>
      <label class="ck" style="margin-bottom:10px"><input type="checkbox" id="edit-hasemp" ${c.hasEmp?'checked':''}>إشارة إلى موظفة</label>
      <label class="ck" style="margin-bottom:10px"><input type="checkbox" id="edit-neg" ${c.negative?'checked':''} onchange="cond('edit-neg-cond',this.checked)">تقييم سلبي</label>
      <div class="cond ${c.negative?'v':'h'}" id="edit-neg-cond"><textarea class="ft" id="edit-neg-text" rows="2">${c.negText||''}</textarea></div>
      <div class="brow" style="margin-top:12px">
        <button class="btn pri" onclick="saveEdit('${c.ref}')">حفظ التعديلات</button>
        <button class="btn" onclick="document.getElementById('edit-sec').style.display='none'">إلغاء</button>
      </div>
    </div>
  </div>`;
}

function toggleDetailMode(){
  const ss=document.getElementById('summary-sec');const ds=document.getElementById('details-sec');const btn=document.getElementById('detail-mode-btn');
  if(!ss||!ds)return;
  if(ss.style.display!=='none'){ss.style.display='none';ds.style.display='block';if(btn)btn.textContent='العودة للنص';}
  else{ds.style.display='none';ss.style.display='block';if(btn)btn.textContent='تفاصيل كاملة';}
}
function startEdit(ref){const sec=document.getElementById('edit-sec');if(!sec)return;sec.style.display=sec.style.display==='none'?'block':'none';}
function saveEdit(ref){
  const c=complaints.find(x=>x.ref===ref);if(!c)return;
  c.client=document.getElementById('edit-client').value.trim()||c.client;
  c.child=document.getElementById('edit-child').value.trim()||c.child;
  c.mobile=document.getElementById('edit-mobile').value.trim()||c.mobile;
  c.branch=document.getElementById('edit-branch').value||c.branch;
  c.desc=document.getElementById('edit-desc').value.trim()||c.desc;
  c.demand=document.getElementById('edit-demand').value.trim()||c.demand;
  c.hdA=document.getElementById('edit-hda').value.trim()||null;
  c.origin=document.getElementById('edit-origin').value.trim()||null;
  c.csnote=document.getElementById('edit-csnote').value.trim()||'';
  c.financial=document.getElementById('edit-financial').checked;
  c.hasEmp=document.getElementById('edit-hasemp').checked;if(!c.hasEmp)c.branchEmployee=null;
  c.negative=document.getElementById('edit-neg').checked;
  c.negText=document.getElementById('edit-neg-text').value.trim()||'';
  c.audit.push({who:session.name,uid:session.id,role:session.role,ts:nowISO(),body:'تم تعديل بيانات الشكوى'});
  saveC();closeDetail();showDetail(ref);showToast('تم حفظ التعديلات','ok');
}
function sendSummaryToAdminWA(ref){
  if(!adminWANum){showToast('لم يتم إدخال رقم الإدارة','err');return;}
  const c=complaints.find(x=>x.ref===ref);if(!c)return;
  const msg=encodeURIComponent(buildSummary(c,true));
  const adm=adminWANum.replace(/\D/g,'');
  const admIntl=adm.startsWith('0')?'966'+adm.slice(1):adm;
  window.open(`https://wa.me/${admIntl}?text=${msg}`,'_blank');
}
function tryDelete(){
  if(session.role!=='maint'&&session.role!=='owner'){showModal('','ليس لديك صلاحية الحذف');return;}
  if(!confirm('هل أنت متأكد من حذف هذه الشكوى نهائياً؟'))return;
  complaints=complaints.filter(c=>c.ref!==currentRef);saveC();closeDetail();renderList();showToast('تم الحذف','ok');
}
function changeStatus(){
  const c=complaints.find(x=>x.ref===currentRef);if(!c)return;
  const r=session.role;if(r==='admin'&&isExcluded(c)){showToast('لا يمكن تغيير حالة مستبعدة','err');return;}
  const sel=document.getElementById('qa-ssel');if(!sel)return;const nv=sel.value;
  if(nv==='معاد فتحها'){const reason=prompt('يرجى كتابة سبب إعادة فتح الشكوى:');if(!reason)return;c.reopenReason=reason;}
  if(!(SPERMS[nv]||[]).includes(r)){showToast('ليس لديك صلاحية لهذه الحالة','err');return;}
  const old=c.status;c.status=nv;if(nv==='تمت المعالجة')c.ownerPriority=false;
  c.audit.push({who:session.name,uid:session.id,role:session.role,ts:nowISO(),body:`تم تغيير الحالة من "${old}" إلى "${nv}"`+(c.reopenReason&&nv==='معاد فتحها'?` — السبب: ${c.reopenReason}`:'')});
  saveC();closeDetail();showDetail(c.ref);renderList();showToast('تم تحديث الحالة','ok');
}
function saveComment(type){
  const c=complaints.find(x=>x.ref===currentRef);if(!c)return;
  const inp=document.getElementById(type==='admin'?'acmt':'bcmt');if(!inp){showToast('حقل التعليق غير موجود','err');return;}
  const txt=inp.value.trim();if(!txt){showToast('الحقل فارغ','err');return;}
  if(type==='admin'){c.adminComment=txt;}
  else{c.branchComment=txt;const empNote=c.hasEmp&&c.branchEmployee?` وحددت الموظفة: ${c.branchEmployee}`:'';c.audit.push({who:session.name,uid:session.id,role:session.role,ts:nowISO(),body:`أضافت ${session.name} إفادة على الشكوى${empNote}`});}
  saveC();closeDetail();showDetail(c.ref);showToast('تم الحفظ','ok');
}
function toggleTask(ref,tid,done){
  const c=complaints.find(x=>x.ref===ref);if(!c)return;
  const t=(c.tasks||[]).find(x=>x.id===tid);if(!t)return;
  t.done=done;if(t.id==='t2'&&done){c.status='تمت المعالجة';c.ownerPriority=false;}
  c.audit.push({who:session.name,uid:session.id,role:session.role,ts:nowISO(),body:`${done?'تم إتمام':'تم إلغاء'} المهمة: ${t.label}`});
  saveC();closeDetail();showDetail(ref);
}
function togglePriority(ref){
  const c=complaints.find(x=>x.ref===ref);if(!c)return;
  c.ownerPriority=!c.ownerPriority;
  const ownerName=users.find(u=>u.role==='owner')?.name||session.name;
  c.audit.push({who:session.name,uid:session.id,role:session.role,ts:nowISO(),body:c.ownerPriority?`قام المالك (${ownerName}) بتعيين الشكوى كأولوية قصوى`:`قام المالك (${ownerName}) بإلغاء الأولوية القصوى`});
  saveC();closeDetail();showDetail(ref);renderList();
  showToast(c.ownerPriority?'تم تعيين أولوية قصوى':'تم إلغاء الأولوية','ok');
}
function requestClarification(ref){
  const c=complaints.find(x=>x.ref===ref);if(!c)return;
  const ownerName=users.find(u=>u.role==='owner')?.name||session.name;
  c.needsClarification=!c.needsClarification;
  if(c.needsClarification){
    c.audit.push({who:session.name,uid:session.id,role:session.role,ts:nowISO(),body:'طلب المالك توضيح وتبرير للشكوى'});
    const msgText=`طلب المالك إفادتكم فيما يتعلق بالشكوى رقم (${ref})`;
    branchMsgs.unshift({id:'bm-'+Date.now(),branch:c.branch,complaintRef:ref,from:ownerName,ts:nowISO(),seenBy:{},text:msgText,type:'clarification'});
    branchMsgs.unshift({id:'am-'+Date.now(),branch:'admin',complaintRef:ref,from:ownerName,ts:nowISO(),seenBy:{},text:msgText,type:'clarification'});
    saveBM();
  }else{c.audit.push({who:session.name,uid:session.id,role:session.role,ts:nowISO(),body:'تم إلغاء طلب التوضيح'});}
  saveC();closeDetail();showDetail(ref);updateDots();
  showToast(c.needsClarification?'تم إرسال طلب التوضيح':'تم إلغاء طلب التوضيح','ok');
}

// ═══════════════════════════════════════
//  رسائل العملاء
// ═══════════════════════════════════════
function renderMsgs(){
  const el=document.getElementById('msgs-content');
  if(!messages.length){el.innerHTML=`<div class="empty"><p>لا توجد رسائل من العملاء</p></div>`;return;}
  el.innerHTML=messages.map(m=>`<div class="msg-card">
    <div class="msg-meta">${fmtShort(m.ts)} — ${fmtTime(m.ts)} | ${m.mobile}${m.branch?' | '+m.branch:''}</div>
    <div class="msg-text">${m.text}</div>
    ${m.converted?`<div class="msg-info">تم التحويل بواسطة ${m.convertedBy} إلى شكوى</div>`
    :`<div class="brow"><button class="btn pri" onclick="convertMsg('${m.id}')">تحويلها إلى شكوى</button></div>`}
  </div>`).join('');
}

function convertMsg(id){
  const m=messages.find(x=>x.id===id);if(!m||m.converted)return;
  const now=new Date(),dd=pad(now.getDate(),2),mm2=pad(now.getMonth()+1,2),yr=now.getFullYear();
  const dateKey=`${dd}${mm2}${yr}`;
  const {ref}=genRef();
  const c={ref,branch:m.branch||'',ctype:'',dateKey,dateDisplay:`${dd}/${mm2}/${yr}`,timeDisplay:`${pad(now.getHours(),2)}:${pad(now.getMinutes(),2)}`,createdAt:nowISO(),mobile:m.mobile,client:'غير محدد',child:'غير محدد',desc:m.text,demand:'',hdQ:'no',hdA:null,origin:'رسالة العميل عبر البوابة',financial:false,hasEmp:false,negative:false,negText:'',sentiment:'',demo:'',csnote:'',gC:'m',gK:'m',status:'جارية حاليا',ownerPriority:false,adminComment:null,branchComment:null,branchEmployee:null,seenBy:{},tasks:[{id:'t1',label:'إرسال إشعار للعميل',done:false},{id:'t2',label:'معالجة الشكوى',done:false}],audit:[{who:session.name,uid:session.id,role:session.role,ts:nowISO(),body:'تم تحويل رسالة العميل إلى شكوى'}],addedBy:session.name};
  complaints.unshift(c);saveC();
  m.converted=true;m.convertedBy=session.name;saveM();
  renderMsgs();goPage('list');
  showToast('تم تحويل الرسالة إلى شكوى — يرجى إكمال البيانات','ok');
  setTimeout(()=>showDetail(ref),300);
  updateDots();
}

// ═══════════════════════════════════════
//  رسائل الفرع
// ═══════════════════════════════════════
function renderBranchMsgs(){
  const el=document.getElementById('branch-msgs-content');const r=session.role;
  let myMsgs=[];
  if(r==='branch')myMsgs=branchMsgs.filter(bm=>bm.branch===session.branch);
  else if(r==='admin'||r==='maint')myMsgs=branchMsgs.filter(bm=>bm.branch==='admin'||bm.type==='clarification');
  if(!myMsgs.length){el.innerHTML=`<div class="empty"><p>لا توجد رسائل</p></div>`;return;}
  el.innerHTML=myMsgs.map(bm=>{
    if(!bm.seenBy)bm.seenBy={};if(!bm.seenBy[session.id]){bm.seenBy[session.id]=nowISO();saveBM();}
    const title=bm.type==='warning'?'رسالة نظام':bm.type==='clarification'?'طلب توضيح من المالك':'رسالة إدارية';
    const navBtn=bm.complaintRef?`<button class="btn" style="font-size:.8rem;padding:6px 14px;margin-top:10px" onclick="goToComplaintFromMsg('${bm.complaintRef}')">الانتقال إلى الشكوى</button>`:'';
    return`<div class="branch-msg-card"><div class="bm-title">${title}</div><div class="bm-body">${bm.text}</div>${bm.complaintRef?`<div class="bm-meta">مرتبطة بالشكوى: ${bm.complaintRef} | ${fmtShort(bm.ts)} — ${fmtTime(bm.ts)}</div>`:''}${navBtn}</div>`;
  }).join('');
  setTimeout(updateDots,200);
}
function goToComplaintFromMsg(ref){
  goPage('list');
  setTimeout(()=>{showDetail(ref);},120);
}

// ═══════════════════════════════════════
//  الإنذارات
// ═══════════════════════════════════════
function renderWarnings(){
  const el=document.getElementById('warnings-content');const r=session.role;
  let vis=[...warnings];
  if(r==='branch')vis=warnings.filter(w=>w.branch===session.branch&&w.status==='approved');
  else if(r!=='owner'&&r!=='admin'&&r!=='maint')vis=vis.filter(w=>w.status!=='excluded');
  if(!vis.length){el.innerHTML=`<div class="empty"><p>لا توجد إنذارات مسجلة</p></div>`;return;}
  vis.forEach(w=>{if(!w.seenBy)w.seenBy={};if(!w.seenBy[session.id])w.seenBy[session.id]=nowISO();});
  localStorage.setItem('ims_w',JSON.stringify(warnings));
  el.innerHTML=vis.map(w=>{
    const badges={draft:'<span class="badge bam">بانتظار المراجعة ⏳</span>',approved:'<span class="badge bg">معتمد ✔️</span>',revoked:'<span class="badge bo">مسحوب ↩️</span>',excluded:'<span class="badge bgr">مستبعد ❌</span>'};
    const borders={draft:'border-right:5px solid var(--am)',approved:'border-right:5px solid var(--gn)',revoked:'border-right:5px solid var(--or)',excluded:'border-right:5px solid var(--mu2)'};
    return`<div class="card" style="margin-bottom:12px;padding:18px;${borders[w.status]||''}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">
        <div>
          <div style="font-weight:800;font-size:1.05rem;color:var(--tx)">${w.emp} <span style="font-size:.82rem;color:var(--mu);font-weight:600">(${w.branch})</span></div>
          <div style="font-size:.88rem;color:var(--tx2);margin-top:3px;font-weight:600">${w.title} — الشكوى: ${w.ref}</div>
          <div style="font-size:.78rem;color:var(--mu);margin-top:7px;display:flex;gap:10px;align-items:center">${badges[w.status]||''}<span>${fmtShort(w.ts)}</span></div>
        </div>
        <button class="btn pri" onclick="reviewA4('${w.id}',false)">معاينة المستند</button>
      </div>
    </div>`;
  }).join('');
  setTimeout(updateDots,200);
}

function sendOwnerWarning(ref){
  const c=complaints.find(x=>x.ref===ref);if(!c||!c.branchEmployee)return;
  const emp=c.branchEmployee;
  const existing=warnings.find(w=>w.ref===ref&&w.emp===emp);
  if(existing){showToast('يوجد إنذار مسجل مسبقاً!','err');goPage('warnings');setTimeout(()=>reviewA4(existing.id),500);return;}
  const prevWarns=warnings.filter(w=>w.emp===emp&&w.status!=='excluded');
  let wType='first';
  if(prevWarns.length>0){wType=prevWarns.some(w=>w.ctype===c.ctype)?'repeat':'different';}
  const title=wType==='first'?'لفت نظر إداري':wType==='repeat'?'إنذار كتابي - تكرار مخالفة':'إنذار كتابي - تعدد مخالفات';
  let text=`إلى الموظفة: <strong>${emp}</strong> المحترمة،<br><br>تحية طيبة وبعد،<br><br>`;
  if(wType==='first'){text+=`بناءً على الشكوى الواردة إلينا برقم (<strong>${c.ref}</strong>) وتاريخ <strong>${fmtShort(c.createdAt)}</strong> بخصوص (<strong>${c.ctype||'مخالفة لسياسات العمل'}</strong>)، وبعد التحقق من التفاصيل الآتية:<br><br><span style="color:#475569;font-style:italic;">"${c.desc}"</span><br><br>فإننا نوجه إليكم <strong>لفت النظر هذا</strong>، مؤكدين على أهمية الالتزام التام بسياسات العمل ومعايير الجودة المعتمدة لدينا.`;}
  else if(wType==='repeat'){text+=`نظراً لورود شكوى جديدة برقم (<strong>${c.ref}</strong>) تتعلق <strong>بنفس المخالفة السابقة</strong> (<strong>${c.ctype}</strong>)، فإننا نوجه إليكم هذا <strong>الإنذار الكتابي</strong> لتكرار نفس المخالفة رغم التوجيهات السابقة.`;}
  else{text+=`لوحظ تعدد الملاحظات على أدائكم، وآخرها الشكوى برقم (<strong>${c.ref}</strong>) بخصوص (<strong>${c.ctype}</strong>). وعليه نوجه إليكم هذا <strong>الإنذار الكتابي لتراكم المخالفات</strong>.`;}
  text+=`<br><br>مع خالص التحيات،<br><strong>الإدارة</strong>`;
  const w={id:'W'+Date.now(),ref:c.ref,emp,branch:c.branch,ctype:c.ctype,title,text,ts:nowISO(),status:'draft'};
  warnings.unshift(w);localStorage.setItem('ims_w',JSON.stringify(warnings));
  goPage('warnings');showToast('تم تجهيز مسودة لفت النظر','ok');
  setTimeout(()=>reviewA4(w.id),500);
}

let currentA4=null;
function reviewA4(id,editMode=false){
  currentA4=warnings.find(w=>w.id===id);if(!currentA4)return;
  document.getElementById('a4-title').textContent=currentA4.title;
  document.getElementById('a4-content').innerHTML=currentA4.text;
  document.getElementById('a4-date').textContent=fmtShort(currentA4.ts);
  const sigEl=document.getElementById('a4-sig-img');
  if(signatureBase64&&currentA4.status==='approved'){sigEl.src=signatureBase64;sigEl.style.display='inline-block';}else sigEl.style.display='none';
  const tb=document.getElementById('a4-toolbar');const ca=document.getElementById('a4-content');
  let actionsHTML='';
  if(editMode){tb.style.display='flex';ca.contentEditable='true';ca.focus();actionsHTML=`<button class="btn pri" onclick="saveWarningText('${id}')">حفظ التعديلات</button><button class="btn" onclick="reviewA4('${id}',false)">إلغاء</button>`;}
  else{
    tb.style.display='none';ca.contentEditable='false';
    const r=session.role;const canM=r==='owner'||r==='admin'||r==='maint';
    if((currentA4.status==='draft'||currentA4.status==='revoked')&&canM){actionsHTML=`<button class="btn pri" onclick="approveWarning('${id}')">اعتماد وإرسال</button><button class="btn teal" onclick="reviewA4('${id}',true)">تعديل النص</button><button class="btn dan" onclick="excludeWarning('${id}')">استبعاد</button><button class="btn" onclick="closeA4()">إغلاق</button>`;}
    else if(currentA4.status==='approved'){actionsHTML=`${canM?`<button class="btn amb" onclick="revokeWarning('${id}')">سحب الإنذار</button>`:''}<button class="btn gn" onclick="downloadPDF()">تنزيل PDF</button><button class="btn" onclick="closeA4()">إغلاق</button>`;}
    else{actionsHTML=`<button class="btn" onclick="closeA4()">إغلاق</button>`;}
  }
  document.getElementById('a4-actions').innerHTML=actionsHTML;
  document.getElementById('a4-modal').classList.add('on');
}
function execCmd(cmd,val=null){document.execCommand(cmd,false,val);document.getElementById('a4-content').focus();}
function saveWarningText(id){const w=warnings.find(x=>x.id===id);if(!w)return;w.text=document.getElementById('a4-content').innerHTML;localStorage.setItem('ims_w',JSON.stringify(warnings));reviewA4(id,false);showToast('تم حفظ التعديلات','ok');}
function closeA4(){document.getElementById('a4-modal').classList.remove('on');document.getElementById('a4-content').contentEditable='false';document.getElementById('a4-toolbar').style.display='none';}
function approveWarning(id){
  const w=warnings.find(x=>x.id===id);if(!w)return;w.status='approved';localStorage.setItem('ims_w',JSON.stringify(warnings));
  const c=complaints.find(x=>x.ref===w.ref);
  if(c){c.audit.push({who:session.name,uid:session.id,role:session.role,ts:nowISO(),body:`تم اعتماد "${w.title}" للموظفة ${w.emp}`});saveC();const ownerName=users.find(u=>u.role==='owner')?.name||session.name;branchMsgs.unshift({id:'bm-'+Date.now(),branch:c.branch,complaintRef:c.ref,from:ownerName,ts:nowISO(),seenBy:{},text:`تم إصدار واعتماد "${w.title}" للموظفة ${c.branchEmployee} وهو متاح للتحميل من سجل الإنذارات.`,type:'warning'});saveBM();}
  reviewA4(id,false);renderWarnings();showToast('تم اعتماد الإنذار','ok');updateDots();
}
function revokeWarning(id){
  if(!confirm('هل أنت متأكد من سحب هذا الإنذار؟'))return;
  const w=warnings.find(x=>x.id===id);if(!w)return;w.status='revoked';localStorage.setItem('ims_w',JSON.stringify(warnings));
  const c=complaints.find(x=>x.ref===w.ref);if(c){c.audit.push({who:session.name,uid:session.id,role:session.role,ts:nowISO(),body:`تم سحب "${w.title}" للموظفة ${w.emp}`});saveC();}
  reviewA4(id,false);renderWarnings();showToast('تم سحب الإنذار','ok');
}
function excludeWarning(id){
  if(!confirm('استبعاد نهائي؟'))return;
  const w=warnings.find(x=>x.id===id);if(!w)return;w.status='excluded';localStorage.setItem('ims_w',JSON.stringify(warnings));
  closeA4();renderWarnings();showToast('تم الاستبعاد','ok');
}
function downloadPDF(){
  const element=document.getElementById('a4-document');
  const opt={margin:[0,0,0,0],filename:`إنذار_${currentA4.emp.replace(/\s/g,'_')}.pdf`,image:{type:'jpeg',quality:0.98},html2canvas:{scale:2,useCORS:true,logging:false},jsPDF:{unit:'mm',format:'a4',orientation:'portrait'}};
  showToast('جاري تجهيز الملف...','ok');
  html2pdf().set(opt).from(element).save().then(()=>showToast('تم التحميل','ok'));
}

// ═══════════════════════════════════════
//  الإحصائيات
// ═══════════════════════════════════════
function renderStats(){
  const el=document.getElementById('stats-content');
  const msToH=ms=>{if(!ms||ms<0)return'—';const h=Math.floor(ms/3600000);const d=Math.floor(h/24);if(d>0)return`${d} يوم`;if(h>0)return`${h} ساعة`;return'أقل من ساعة';};
  const done=complaints.filter(c=>c.status==='تمت المعالجة');const total=complaints.length;
  const closedC=complaints.filter(c=>isDone(c)).length;const closeRate=total?Math.round(closedC/total*100):0;
  let avgDoneMs=0;if(done.length){const times=done.map(c=>{const last=(c.audit||[]).filter(a=>a.body&&a.body.includes('تمت المعالجة'));if(!last.length)return null;return new Date(last[last.length-1].ts)-new Date(c.createdAt);}).filter(x=>x!==null);if(times.length)avgDoneMs=times.reduce((a,b)=>a+b,0)/times.length;}
  let avgRespMs=0;const withResp=complaints.filter(c=>c.audit&&c.audit.length>1);if(withResp.length){const rts=withResp.map(c=>{const f=c.audit.find(a=>a.uid!=='sys'&&a.ts!==c.audit[0].ts);if(!f)return null;return new Date(f.ts)-new Date(c.createdAt);}).filter(x=>x!==null&&x>0);if(rts.length)avgRespMs=rts.reduce((a,b)=>a+b,0)/rts.length;}
  el.innerHTML=`<div class="stats-grid">
    <div class="stat-box"><h3>مؤشرات الشكاوى</h3>
      <div class="stat-row"><span class="stat-lbl">إجمالي الشكاوى</span><span class="stat-val">${total}</span></div>
      <div class="stat-row"><span class="stat-lbl">تمت المعالجة</span><span class="stat-val">${done.length}</span></div>
      <div class="stat-row"><span class="stat-lbl">نسبة الإغلاق</span><span class="stat-val">${closeRate}%</span></div>
      <div class="stat-row"><span class="stat-lbl">متوسط وقت المعالجة</span><span class="stat-val">${msToH(avgDoneMs)}</span></div>
      <div class="stat-row"><span class="stat-lbl">متوسط الاستجابة الأولى</span><span class="stat-val">${msToH(avgRespMs)}</span></div>
    </div>
  </div>
  <div class="stats-grid">
    <div class="stat-mini"><div class="sn">${complaints.filter(c=>c.negative).length}</div><div class="sl">تقييمات سلبية</div></div>
    <div class="stat-mini"><div class="sn">${complaints.filter(c=>c.financial).length}</div><div class="sl">مطالبات مالية</div></div>
    <div class="stat-mini"><div class="sn">${messages.filter(m=>!m.converted).length}</div><div class="sl">رسائل عملاء جديدة</div></div>
    <div class="stat-mini"><div class="sn">${warnings.filter(w=>w.status==='approved').length}</div><div class="sl">إنذارات معتمدة</div></div>
  </div>`;
}

// ═══════════════════════════════════════
//  فلاتر
// ═══════════════════════════════════════
function runFilter(){
  renderCtypeForm();
  const brs=Array.from(document.querySelectorAll('#fb-wrap input:checked')).map(x=>x.value);
  const tps=Array.from(document.querySelectorAll('#ft-wrap input:checked')).map(x=>x.value);
  const sts=Array.from(document.querySelectorAll('#fst-wrap input:checked')).map(x=>x.value);
  let res=[...complaints];
  if(session.role==='branch')res=res.filter(c=>c.branch===session.branch);
  if(brs.length)res=res.filter(c=>brs.includes(c.branch));
  if(tps.length)res=res.filter(c=>tps.includes(c.ctype));
  if(sts.length)res=res.filter(c=>sts.includes(c.status));
  const done=res.filter(c=>c.status==='تمت المعالجة');const closedC=res.filter(c=>isDone(c)).length;const closeRate=res.length?Math.round(closedC/res.length*100):0;
  const msToH=ms=>{if(!ms||ms<0)return'—';const h=Math.floor(ms/3600000);const d=Math.floor(h/24);if(d>0)return`${d} يوم`;if(h>0)return`${h} ساعة`;return'أقل من ساعة';};
  let avgMs=0;if(done.length){const times=done.map(c=>{const last=(c.audit||[]).filter(a=>a.body&&a.body.includes('تمت المعالجة'));if(!last.length)return null;return new Date(last[last.length-1].ts)-new Date(c.createdAt);}).filter(x=>x!==null);if(times.length)avgMs=times.reduce((a,b)=>a+b,0)/times.length;}
  document.getElementById('filter-stats').innerHTML=`<h3>إحصائيات حسب التصفية</h3><div class="stat-row"><span class="stat-lbl">عدد الشكاوى</span><span class="stat-val">${res.length}</span></div><div class="stat-row"><span class="stat-lbl">متوسط المعالجة</span><span class="stat-val">${msToH(avgMs)}</span></div><div class="stat-row"><span class="stat-lbl">نسبة الإغلاق</span><span class="stat-val">${closeRate}%</span></div>`;
  document.getElementById('filter-count').textContent=`النتائج: ${res.length} شكوى مطابقة`;
  document.getElementById('filter-res').innerHTML=res.length?res.map(c=>cCard(c,session.role)).join(''):`<div class="empty"><p>لا توجد نتائج مطابقة</p></div>`;
}
function clearFilters(){document.querySelectorAll('#page-filter input[type=checkbox]').forEach(x=>x.checked=false);runFilter();}

// ═══════════════════════════════════════
//  حماية السمعة
// ═══════════════════════════════════════
function renderRep(){
  const el=document.getElementById('rep-content');const r=session.role;
  if(r!=='cs'&&r!=='owner'&&r!=='maint'){el.innerHTML=`<div class="no-access"><h3>تم إلغاء صلاحية وصولك لهذه الصفحة</h3></div>`;return;}
  const threeM=Date.now()-90*24*3600000;const recent=complaints.filter(c=>new Date(c.createdAt).getTime()>threeM);
  const cc={},ec={},bc={},tc={};
  complaints.forEach(c=>{cc[c.client]=(cc[c.client]||0)+1;if(c.hasEmp&&c.branchEmployee)ec[c.branchEmployee]=(ec[c.branchEmployee]||0)+1;bc[c.branch]=(bc[c.branch]||0)+1;if(c.ctype)tc[c.ctype]=(tc[c.ctype]||0)+1;});
  const rcc={},rec={},rbc={},rtc={};
  recent.forEach(c=>{rcc[c.client]=(rcc[c.client]||0)+1;if(c.hasEmp&&c.branchEmployee)rec[c.branchEmployee]=(rec[c.branchEmployee]||0)+1;rbc[c.branch]=(rbc[c.branch]||0)+1;if(c.ctype)rtc[c.ctype]=(rtc[c.ctype]||0)+1;});
  const sorted=obj=>Object.entries(obj).sort((a,b)=>b[1]-a[1]);
  const filtered=obj=>sorted(obj).filter(([,cnt])=>cnt>3);
  const allRisks=[...Object.entries(rcc).filter(([,n])=>n>=3).map(([nm,cnt])=>({nm,cnt,cat:'عميل'})),...Object.entries(rec).filter(([,n])=>n>=3).map(([nm,cnt])=>({nm,cnt,cat:'موظفة'})),...Object.entries(rbc).filter(([,n])=>n>=3).map(([nm,cnt])=>({nm,cnt,cat:'فرع'})),...Object.entries(rtc).filter(([,n])=>n>=3).map(([nm,cnt])=>({nm,cnt,cat:'نوع شكوى'}))].sort((a,b)=>b.cnt-a.cnt);
  let riskHTML=!allRisks.length?`<div class="risk-safe-banner"><div class="risk-safe-icon">⭐</div><div class="risk-safe-txt">مؤشر مخاطر السمعة منخفض وإيجابي</div><div class="risk-safe-sub">لا توجد مخاطر متكررة خلال آخر ٣ أشهر</div></div>`
  :`<div class="risk-grid">${allRisks.map(({nm,cnt,cat})=>{let cls='risk-card-y',level='تحذير';if(cnt>5){cls='risk-card-r';level='خطر عالٍ';}else if(cnt===5){cls='risk-card-o';level='تصاعد';}return`<div class="risk-card ${cls}"><div style="display:flex;justify-content:space-between;align-items:flex-start"><div><div class="risk-card-count">${cnt}</div><div class="risk-card-name">${nm}</div></div><span class="risk-card-badge">${cat}</span></div><div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px"><div class="risk-card-label">تكرار / ٣ أشهر</div><span class="risk-card-badge">${level}</span></div></div>`;}).join('')}</div>`;
  const buildSec=(title,icon,data)=>{if(!data.length)return'';const maxV=data[0][1];const fills=['#4f46e5','#7c3aed','#e11d48','#ea580c','#059669','#0ea5e9','#65a30d'];return`<div class="rep-section"><div style="display:flex;align-items:center;gap:10px;margin-bottom:14px"><span>${icon}</span><span style="font-size:.93rem;font-weight:800;color:var(--tx)">${title}</span></div>${data.map(([name,cnt],i)=>`<div class="rep-row"><div class="rep-rank">${i+1}</div><div class="rep-name">${name}</div><div class="rep-track"><div class="rep-fill" style="width:${Math.round(cnt/maxV*100)}%;background:${fills[i%fills.length]}"></div></div><div class="rep-cnt" style="color:${fills[i%fills.length]}">${cnt}</div></div>`).join('')}</div>`;};
  const fCC=filtered(cc),fEC=filtered(ec),fBC=filtered(bc),fTC=filtered(tc);
  const hasData=fCC.length||fEC.length||fBC.length||fTC.length;
  el.innerHTML=`<div class="rep-page">
    <div class="rep-section"><div style="display:flex;align-items:center;gap:10px;margin-bottom:14px"><span style="color:var(--rd)">⚠️</span><span style="font-size:.93rem;font-weight:800;color:var(--tx)">مخاطر السمعة النشطة</span><span style="font-size:.73rem;font-weight:600;color:var(--mu);margin-right:auto">آخر ٣ أشهر</span></div>${riskHTML}</div>
    ${!hasData?`<div class="rep-section" style="text-align:center;padding:28px"><div style="font-size:.93rem;font-weight:700;color:var(--tx)">لا توجد بيانات كافية حالياً</div><div style="font-size:.83rem;color:var(--mu);margin-top:5px">تظهر المؤشرات عند تجاوز ٣ تكرارات</div></div>`:''}
    ${buildSec('العملاء الأكثر تكراراً','👤',fCC)}
    ${buildSec('الموظفات المشار إليهن','⭐',fEC)}
    ${buildSec('تحليل الفروع','🏢',fBC)}
    ${buildSec('تكرار أنواع الشكاوى','📌',fTC)}
  </div>`;
}

// ═══════════════════════════════════════
//  البحث
// ═══════════════════════════════════════
function gSearch(q){
  const drop=document.getElementById('gdrop');q=q.trim().toLowerCase();
  if(!q){drop.style.display='none';return;}
  let pool=[...complaints];
  if(session.role==='branch')pool=pool.filter(c=>c.branch===session.branch);
  const res=pool.filter(c=>c.ref.toLowerCase().includes(q)||c.client.toLowerCase().includes(q)||(c.child||'').toLowerCase().includes(q)||c.mobile.includes(q)).slice(0,7);
  if(!res.length){drop.innerHTML=`<div class="di" style="color:var(--mu2);text-align:center">لا توجد نتائج</div>`;drop.style.display='block';return;}
  drop.innerHTML=res.map(c=>`<div class="di" onclick="jumpTo('${c.ref}')"><div class="di-ref">${c.ref}</div><div class="di-name">${c.client} — ${c.child}</div><div class="di-sub">${c.branch} | ${fmtShort(c.createdAt)}</div></div>`).join('');
  drop.style.display='block';
}
function jumpTo(ref){document.getElementById('gdrop').style.display='none';document.getElementById('gs').value='';goPage('list');setTimeout(()=>showDetail(ref),80);}
document.addEventListener('click',e=>{if(!e.target.closest('.tbsearch'))document.getElementById('gdrop').style.display='none';});

// ═══════════════════════════════════════
//  إدارة المستخدمين
// ═══════════════════════════════════════
function renderSettings(){
  document.getElementById('users-list').innerHTML=users.map(u=>`<div class="ucard">
    <div><div class="un">${u.name}${u.branch?' — '+u.branch:''}</div><div class="ur">${{owner:'المالك',admin:'الإدارة',branch:'مديرة الفرع',cs:'خدمة العملاء'}[u.role]||u.role}</div></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn" style="font-size:.78rem;padding:6px 12px" onclick="editPass('${u.id}')">تغيير كلمة المرور</button>
      <button class="btn" style="font-size:.78rem;padding:6px 12px" onclick="editName('${u.id}')">تغيير الاسم</button>
      ${u.role!=='owner'?`<button class="btn dan" style="font-size:.78rem;padding:6px 12px" onclick="delUser('${u.id}')">حذف</button>`:''}
    </div>
  </div>`).join('');
}
function editPass(id){const u=users.find(x=>x.id===id);if(!u)return;const p=prompt('الرقم السري الجديد (4 أرقام):');if(!p||p.length!==4)return;u.pass=p;sv();showToast('تم تحديث الرقم السري','ok');}
function editName(id){const u=users.find(x=>x.id===id);if(!u)return;const n=prompt('الاسم الجديد:',u.name);if(!n)return;u.name=n;sv();renderSettings();showToast('تم تحديث الاسم','ok');}
function delUser(id){if(!confirm('حذف المستخدم نهائياً؟'))return;users=users.filter(x=>x.id!==id);sv();renderSettings();showToast('تم الحذف','ok');}
function showAddUser(){document.getElementById('add-user-form').style.display='block';}
function toggleBF(){document.getElementById('nu-bwrap').style.display=document.getElementById('nu-role').value==='branch'?'block':'none';}
function saveNewUser(){
  const name=document.getElementById('nu-name').value.trim();
  const role=document.getElementById('nu-role').value;
  const pass=document.getElementById('nu-pass').value;
  const branch=role==='branch'?document.getElementById('nu-branch').value:null;
  if(!name||!pass||pass.length!==4){showToast('يرجى تعبئة جميع الحقول وتأكد أن كلمة المرور 4 أرقام','err');return;}
  users.push({id:`${role}-${Date.now()}`,name,role,pass,branch});sv();renderSettings();
  document.getElementById('add-user-form').style.display='none';
  document.getElementById('nu-name').value='';document.getElementById('nu-pass').value='';
  showToast('تم إضافة المستخدم','ok');
}

// ═══════════════════════════════════════
//  أدوات مساعدة
// ═══════════════════════════════════════
function toggleSb(){const s=document.getElementById('sidebar'),o=document.getElementById('sbov');const cl=s.classList.toggle('cl');o.classList.toggle('on',!cl);}
function closeSb(){document.getElementById('sidebar').classList.add('cl');document.getElementById('sbov').classList.remove('on');}
function doCopy(t){navigator.clipboard.writeText(t).then(()=>showToast('تم النسخ','ok')).catch(()=>{const e=document.createElement('textarea');e.value=t;document.body.appendChild(e);e.select();document.execCommand('copy');document.body.removeChild(e);showToast('تم النسخ','ok');});}
function showModal(t,m){document.getElementById('m-title').textContent=t||'';document.getElementById('m-msg').textContent=m;document.getElementById('modal').classList.add('on');}
function closeModal(){document.getElementById('modal').classList.remove('on');}
function showToast(msg,type=''){const t=document.getElementById('toast');t.textContent=msg;t.className=`toast ${type} on`;setTimeout(()=>t.classList.remove('on'),2800);}

// ═══════════════════════════════════════
//  حجم الخط والثيم
// ═══════════════════════════════════════
let fsLevel=parseFloat(localStorage.getItem('ims_fs')||'1');
function applyFontSize(){document.documentElement.style.fontSize=(fsLevel*16)+'px';const el=document.getElementById('fs-val');if(el)el.textContent=Math.round(fsLevel*100)+'%';localStorage.setItem('ims_fs',fsLevel);}
function changeFontSize(dir){const steps=[0.8,0.875,0.95,1,1.075,1.15,1.25];const idx=steps.reduce((b,v,i)=>Math.abs(v-fsLevel)<Math.abs(steps[b]-fsLevel)?i:b,0);fsLevel=steps[Math.max(0,Math.min(steps.length-1,idx+dir))];applyFontSize();}
applyFontSize();

let isDark=localStorage.getItem('ims_dark')==='1'||(localStorage.getItem('ims_dark')===null);
function applyTheme(){document.documentElement.setAttribute('data-theme',isDark?'dark':'');const icon=isDark?'☼':'☽';['theme-btn-login','theme-btn-app'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=icon;});localStorage.setItem('ims_dark',isDark?'1':'0');}
function toggleTheme(){isDark=!isDark;applyTheme();}
applyTheme();

// ═══════════════════════════════════════
//  بيانات تجريبية
// ═══════════════════════════════════════
(function(){
  if(localStorage.getItem('ims_demo_loaded'))return;
  const daysAgo=d=>new Date(Date.now()-d*86400000).toISOString();
  const demo=[
    {ref:'S042601',branch:'فرع القصر',ctype:'الأسلوب',mobile:'0551234567',client:'نورة السهلي',child:'ريم',desc:'قامت الموظفة بالتحدث مع ابنتي بأسلوب غير لائق أمام الأطفال',demand:'الاعتذار الرسمي وضمان عدم التكرار',hdQ:'no',hdA:null,origin:'داخل الفصل أثناء النشاط',financial:false,hasEmp:true,branchEmployee:'اسمهان (المديرة)',negative:false,negText:'',sentiment:'غاضب',demo:'أم',csnote:'العميلة كانت مضطربة',gC:'f',gK:'f',status:'تحت المعالجة',ownerPriority:false,adminComment:null,branchComment:'سيتم اتخاذ الإجراء اللازم',audit:[{who:'موظف خدمة العملاء',uid:'c1',role:'cs',ts:daysAgo(5),body:'تم إنشاء الشكوى'}],addedBy:'موظف خدمة العملاء',createdAt:daysAgo(5)},
  ];
  demo.forEach(c=>{const d=new Date(c.createdAt);c.dateKey=`${String(d.getDate()).padStart(2,'0')}${String(d.getMonth()+1).padStart(2,'0')}${d.getFullYear()}`;c.dateDisplay=`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;c.timeDisplay=`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;if(!c.seenBy)c.seenBy={};if(!c.tasks)c.tasks=[{id:'t1',label:'إرسال إشعار للعميل',done:false},{id:'t2',label:'معالجة الشكوى',done:false}];});
  const existing=complaints.map(c=>c.ref);
  demo.forEach(c=>{if(!existing.includes(c.ref))complaints.push(c);});
  complaints.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  saveC();localStorage.setItem('ims_demo_loaded','1');
})();

// ══ تشغيل التطبيق عند التحميل ══
if(session)initApp();else buildRoleGrid();
