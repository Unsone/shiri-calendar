import {dateKey,addDays,normalizeRecord,visibleRecords,escapeHTML as esc,categories} from './core.js';

const $=selector=>document.querySelector(selector);
const store={get(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}},set(key,value){localStorage.setItem(key,JSON.stringify(value));}};
let settings=store.get('shiri-settings',{}),dataKey=settings.dataKey||'shiri-local';
let state=store.get(dataKey,{records:[],pending:[]});
if(!Array.isArray(state.records)||!Array.isArray(state.pending))state={records:[],pending:[]};
let selected=dateKey(),cursor=new Date(`${selected}T12:00:00`),mode='month',view='month',filter='all';
let syncing=false,conflicts=[],plan=null,planSnapshot=null,toastTimer,lastSync=0;
const weekdays=['日','一','二','三','四','五','六'];
const active=()=>visibleRecords(state.records).filter(x=>filter==='all'||x.category===filter);

function toast(message,undo){
  clearTimeout(toastTimer);const box=$('#toast');box.textContent=message;box.classList.add('show');box.style.pointerEvents=undo?'auto':'none';
  if(undo){const button=document.createElement('button');button.textContent='撤销';button.onclick=()=>{undo();box.classList.remove('show');};box.append(button);}
  toastTimer=setTimeout(()=>box.classList.remove('show'),undo?12000:4500);
}
function persist(next){try{store.set(dataKey,next);state=next;return true;}catch{toast('浏览器存储已满或不可用，请先导出备份');return false;}}
function queue(records){
  const next=structuredClone(state);
  for(const raw of records){const record=normalizeRecord(raw),old=next.records.find(x=>x.id===record.id),pending=next.pending.find(x=>x.record.id===record.id);
    const updated={...record,revision:old?.revision||0,updatedAt:new Date().toISOString()};
    next.records=next.records.filter(x=>x.id!==record.id);next.records.push(updated);
    next.pending=next.pending.filter(x=>x.record.id!==record.id);next.pending.push({record,baseRevision:pending?.baseRevision??old?.revision??0,mutationId:crypto.randomUUID()});
  }
  if(!persist(next))return false;render();setSyncStatus(settings.token?'等待同步':'本机保存');void sync();return true;
}
function setSyncStatus(text,error=false){const button=$('#sync-button');button.querySelector('span').textContent=text;button.classList.toggle('connected',!!settings.token&&!error);button.classList.toggle('error',error);$('#connection-dot').classList.toggle('connected',!!settings.token&&!error);}
function calendarTitle(){return `${cursor.getFullYear()}年 ${cursor.getMonth()+1}月`;}
function card(record){return `<article class="day-card ${record.done?'done':''}"><button class="check-button ${record.done?'checked':''}" data-toggle="${esc(record.id)}" aria-label="${record.done?'标记未完成':'标记完成'}：${esc(record.title)}">${record.done?'✓':''}</button><div class="card-content" role="button" tabindex="0" data-edit="${esc(record.id)}" aria-label="编辑：${esc(record.title)}"><h3>${record.priority==='high'?'↑ ':''}${esc(record.title)}</h3><p>${record.time?esc(record.time+(record.endTime?' – '+record.endTime:'')):'全天'}${record.kind==='task'?' · 待办':''}</p><span class="tag">${categories[record.category]}${record.priority==='high'?' · 优先':record.priority==='low'?' · 有空再做':''}</span></div></article>`;}
function pill(record){return `<button class="event-pill ${record.category} ${record.done?'done':''}" data-edit="${esc(record.id)}" title="${esc(record.title)}"><small>${record.time||'全天'}</small>${record.kind==='task'?'☐ ':''}${esc(record.title)}</button>`;}
function empty(text='这一天，还很轻盈',sub='给重要的事留个位置。'){return `<div class="empty-day"><div class="empty-icon">◌</div><strong>${text}</strong><p>${sub}</p><button data-action="new">＋ 添加一件事</button></div>`;}
function render(){
  const today=dateKey(),records=active();
  $('#today-label').textContent=`${new Intl.DateTimeFormat('zh-CN',{month:'long',day:'numeric',weekday:'long'}).format(new Date())} / YOUR DAYS, YOUR PACE`;
  $('#page-title').textContent=view==='tasks'?'一件一件，慢慢完成。':view==='today'?'今天，也值得好好度过。':'把时间，留给重要的事。';
  $('#task-count').textContent=state.records.filter(x=>!x.deleted&&x.kind==='task'&&!x.done).length;
  document.querySelectorAll('[data-view]').forEach(el=>el.classList.toggle('active',el.dataset.view===view));
  document.querySelectorAll('[data-filter]').forEach(el=>el.classList.toggle('active',el.dataset.filter===filter));
  document.querySelectorAll('[data-mode]').forEach(el=>el.classList.toggle('selected',el.dataset.mode===mode));
  $('.view-toggle').classList.toggle('hidden',view!=='month');
  $('#previous').classList.toggle('hidden',view==='tasks');$('#next').classList.toggle('hidden',view==='tasks');
  $('#month-title').textContent=view==='tasks'?'我的待办':view==='today'?`${new Date(selected+'T12:00:00').getMonth()+1}月${Number(selected.slice(-2))}日`:calendarTitle();
  let html='';
  if(view==='month'&&mode==='month'){
    const first=new Date(cursor.getFullYear(),cursor.getMonth(),1,12),start=addDays(dateKey(first),-(first.getDay()+6)%7);
    html='<div class="weekdays">'+['一','二','三','四','五','六','日'].map(x=>`<span>周${x}</span>`).join('')+'</div><div class="month-grid">';
    for(let i=0;i<42;i++){const day=addDays(start,i),items=records.filter(x=>x.date===day);html+=`<div class="date-cell ${Number(day.slice(5,7))!==cursor.getMonth()+1?'outside':''} ${day===selected?'selected':''}"><button class="date-select ${day===today?'today':''}" data-date="${day}" aria-label="选择 ${day}"><span>${Number(day.slice(-2))}</span></button>${items.slice(0,3).map(pill).join('')}${items.length>3?`<span class="more-count">另 ${items.length-3} 项</span>`:''}</div>`;}
    html+='</div>';
  }else if(view==='month'&&mode==='week'){
    const start=addDays(dateKey(cursor),-(cursor.getDay()+6)%7);html='<div class="week-grid">';
    for(let i=0;i<7;i++){const day=addDays(start,i);html+=`<div class="week-column ${selected===day?'selected':''}"><button class="week-date" data-date="${day}"><small>周${['一','二','三','四','五','六','日'][i]}</small>${Number(day.slice(-2))}</button>${records.filter(x=>x.date===day).map(pill).join('')}</div>`;}html+='</div>';
  }else{
    let list=records.filter(x=>view==='tasks'?x.kind==='task':view==='today'?x.date===selected:x.date.startsWith(`${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,'0')}`));
    if(view==='tasks')list.sort((a,b)=>Number(a.done)-Number(b.done)||({high:0,normal:1,low:2}[a.priority||'normal']-{high:0,normal:1,low:2}[b.priority||'normal'])||a.date.localeCompare(b.date));
    html='<div class="agenda-list">';let last='';for(const item of list){if(item.date!==last){html+=`<h3 class="agenda-day">${esc(item.date)} · 星期${weekdays[new Date(item.date+'T12:00:00').getDay()]}</h3>`;last=item.date;}html+=card(item);}html+=list.length?'':empty(view==='tasks'?'还没有待办，轻装上阵':'暂时没有安排');html+='</div>';
  }
  $('#calendar-content').innerHTML=html;
  const date=new Date(selected+'T12:00:00'),dayItems=records.filter(x=>x.date===selected);
  $('#selected-weekday').textContent=`${selected===today?'TODAY · ':''}星期${weekdays[date.getDay()]}`;
  $('#selected-title').textContent=`${date.getMonth()+1}月${date.getDate()}日`;
  $('#day-summary').textContent=`${dayItems.length} 项安排 · ${dayItems.filter(x=>x.done).length} 项已完成`;
  $('#day-events').innerHTML=dayItems.length?dayItems.map(card).join(''):empty();
  $('#storage-note').textContent=settings.token?`自动同步已开启${state.pending.length?` · ${state.pending.length} 项待同步`:''} · 离线也能记录`:'数据保存在此浏览器 · 在设置中连接云端以自动同步';
}
function openEditor(id){
  const record=state.records.find(x=>x.id===id)||{id:'',title:'',date:selected,time:'',endTime:'',kind:view==='tasks'?'task':'event',category:filter==='all'?'life':filter,notes:''};
  $('#event-id').value=record.id;$('#event-title').value=record.title;$('#event-date').value=record.date;$('#event-time').value=record.time;$('#event-end').value=record.endTime;$('#event-kind').value=record.kind;$('#event-category').value=record.category;$('#event-priority').value=record.priority||'normal';$('#event-notes').value=record.notes;
  $('#editor-title').textContent=record.id?'编辑日程':'新建日程';$('#event-error').textContent='';$('#delete-event').classList.toggle('hidden',!record.id);$('#event-dialog').showModal();$('#event-title').focus();
}
function openSettings(){ $('#api-base').value=settings.base||window.SHIRI_CONFIG?.apiBase||(/^localhost$|^127\.0\.0\.1$/.test(location.hostname)?location.origin:'');$('#api-token').value=settings.token||'';$('#settings-message').textContent='';$('#settings-dialog').showModal(); }
async function api(path,body,config=settings){
  const response=await fetch(config.base+path,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${config.token}`,...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(path==='/api/ai'?55000:20000)});
  let result;try{result=await response.json();}catch{throw new Error('服务地址未返回有效数据，请检查网址');}
  if(!response.ok)throw new Error(result.error||`请求失败（${response.status}）`);return result;
}
async function sync(){
  if(syncing||!settings.token||!settings.base)return;
  if(!navigator.onLine){setSyncStatus('离线 · 本机保存',true);return;}
  syncing=true;setSyncStatus('正在同步…');
  const oldKey=dataKey,config={...settings},blocked=new Set(conflicts.map(x=>x.id));
  const sent=state.pending.filter(x=>!blocked.has(x.record.id)).slice(0,40);
  try{
    const result=await api('/api/sync',{changes:sent},config);if(dataKey!==oldKey)return;
    const next=structuredClone(state);
    for(const accepted of result.accepted){const pending=next.pending.find(x=>x.record.id===accepted.record.id);if(pending?.mutationId===accepted.mutationId)next.pending=next.pending.filter(x=>x.mutationId!==accepted.mutationId);else if(pending)pending.baseRevision=accepted.record.revision;}
    const pendingIds=new Set(next.pending.map(x=>x.record.id));
    next.records=[...result.records.filter(x=>!pendingIds.has(x.id)),...next.records.filter(x=>pendingIds.has(x.id))];
    if(!persist(next))throw new Error('同步数据无法保存到浏览器');
    for(const conflict of result.conflicts){if(next.pending.some(x=>x.record.id===conflict.id)&&!conflicts.some(x=>x.id===conflict.id))conflicts.push(conflict);}
    lastSync=Date.now();setSyncStatus(conflicts.length?'需要处理冲突':state.pending.length?'等待同步':'已同步',!!conflicts.length);render();showConflict();
    if(state.pending.some(x=>!conflicts.some(c=>c.id===x.record.id)))setTimeout(sync,500);
  }catch(error){setSyncStatus('同步未完成',true);$('#storage-note').textContent=`${error.message} · 变更仍保存在本机`;}
  finally{syncing=false;}
}
function showConflict(){if(!conflicts.length||document.querySelector('dialog[open]'))return;const conflict=conflicts[0],local=state.records.find(x=>x.id===conflict.id);$('#conflict-details').innerHTML=[['本机',local],['云端',conflict.remote]].map(([label,record])=>`<div class="plan-item"><strong>${label}：${esc(record?.title||'日程不存在')}</strong><p>${record?.deleted?'已删除':esc((record?.date||'')+' '+(record?.time||''))}</p><p>${esc(record?.notes||'')}</p></div>`).join('');$('#conflict-dialog').showModal();}
function resolveConflict(useLocal){const conflict=conflicts[0];if(!conflict)return;const next=structuredClone(state),local=next.records.find(x=>x.id===conflict.id);next.pending=next.pending.filter(x=>x.record.id!==conflict.id);next.records=next.records.filter(x=>x.id!==conflict.id);
  if(useLocal&&local){next.records.push({...local,revision:conflict.remote?.revision||0});next.pending.push({record:normalizeRecord(local),baseRevision:conflict.remote?.revision||0,mutationId:crypto.randomUUID()});}else if(conflict.remote)next.records.push(conflict.remote);
  if(!persist(next))return;conflicts.shift();$('#conflict-dialog').close();render();void sync();showConflict();}

function exportData(){const blob=new Blob([JSON.stringify({app:'shiri',version:1,exportedAt:new Date().toISOString(),records:visibleRecords(state.records)},null,2)],{type:'application/json'});const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=`拾日日程-${dateKey()}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);toast('备份已导出');}
document.addEventListener('click',event=>{
  const button=event.target.closest('button,[data-edit]');if(!button)return;
  if(button.hasAttribute('data-close')){button.closest('dialog').close();showConflict();return;}
  const action=button.dataset.action;if(action==='new')openEditor();if(action==='settings')openSettings();if(action==='export')exportData();
  if(button.dataset.view){view=button.dataset.view;if(view==='today'){selected=dateKey();cursor=new Date(selected+'T12:00:00');}render();}
  if(button.dataset.mode){mode=button.dataset.mode;render();}
  if(button.dataset.filter){filter=button.dataset.filter;render();}
  if(button.dataset.date){selected=button.dataset.date;render();}
  if(button.dataset.edit)openEditor(button.dataset.edit);
  if(button.dataset.toggle){const record=state.records.find(x=>x.id===button.dataset.toggle);if(record)queue([{...record,done:!record.done}]);}
});
document.addEventListener('keydown',event=>{if(event.key==='Enter'&&event.target.matches('[data-edit]'))openEditor(event.target.dataset.edit);if(event.key.toLowerCase()==='n'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.target.closest('input,textarea,select,dialog')){event.preventDefault();openEditor();}});
$('#event-form').onsubmit=event=>{event.preventDefault();try{const id=$('#event-id').value||crypto.randomUUID(),old=state.records.find(x=>x.id===id);const record=normalizeRecord({id,title:$('#event-title').value,date:$('#event-date').value,time:$('#event-time').value,endTime:$('#event-end').value,kind:$('#event-kind').value,category:$('#event-category').value,priority:$('#event-priority').value,notes:$('#event-notes').value,done:old?.done||false});if(queue([record])){$('#event-dialog').close();selected=record.date;cursor=new Date(selected+'T12:00:00');render();toast('已保存');}}catch(error){$('#event-error').textContent=error.message;}};
$('#delete-event').onclick=()=>{const record=state.records.find(x=>x.id===$('#event-id').value);if(record&&queue([{...record,deleted:true}])){$('#event-dialog').close();toast('日程已删除',()=>queue([{...record,deleted:false}]));}};
for(const [selector,delta]of [['#previous',-1],['#next',1]])$(selector).onclick=()=>{if(view==='today'){selected=addDays(selected,delta);cursor=new Date(selected+'T12:00:00');}else if(mode==='week'){cursor.setDate(cursor.getDate()+7*delta);selected=dateKey(cursor);}else{cursor=new Date(cursor.getFullYear(),cursor.getMonth()+delta,1,12);selected=dateKey(cursor);}render();};
$('#go-today').onclick=()=>{selected=dateKey();cursor=new Date(selected+'T12:00:00');render();};
$('#sync-button').onclick=()=>settings.token?sync():openSettings();
$('#settings-form').onsubmit=async event=>{event.preventDefault();const button=$('#connect-button');button.disabled=true;$('#settings-message').textContent='正在检查连接…';try{
  const url=new URL($('#api-base').value.trim());if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)))throw new Error('请使用 HTTPS 服务地址');if(url.username||url.password||url.search||url.hash||url.pathname!=='/')throw new Error('请填写服务根地址，不带路径或参数');
  const config={base:url.origin,token:$('#api-token').value.trim()};const health=await api('/api/health',undefined,config);
  const fingerprint=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(config.base+config.token)))).map(x=>x.toString(16).padStart(2,'0')).join('').slice(0,24);config.dataKey='shiri-data-'+fingerprint;
  const nextData=store.get(config.dataKey,settings.token?{records:[],pending:[]}:structuredClone(state));store.set(config.dataKey,nextData);store.set('shiri-settings',config);settings=config;dataKey=config.dataKey;state=nextData;conflicts=[];$('#settings-dialog').close();render();toast(health.ai?'已连接，AI 助手也已就绪':'同步已连接，AI 密钥尚未配置');await sync();
}catch(error){$('#settings-message').textContent=error.message;}finally{button.disabled=false;}};
$('#disconnect').onclick=()=>{settings={};store.set('shiri-settings',settings);dataKey='shiri-local';state=store.get(dataKey,{records:[],pending:[]});conflicts=[];$('#api-token').value='';$('#settings-message').textContent='已断开，云端日程仍保留；重新连接即可恢复。';setSyncStatus('本机保存');render();};
$('#import-button').onclick=()=>$('#import-file').click();
$('#import-file').onchange=async event=>{try{const file=event.target.files[0];if(!file)return;if(file.size>2000000)throw new Error('备份文件不能超过 2 MB');const backup=JSON.parse(await file.text());if(backup.app!=='shiri'||backup.version!==1||!Array.isArray(backup.records)||backup.records.length>1000)throw new Error('请选择有效的拾日备份（最多 1000 条）');const records=backup.records.map(x=>normalizeRecord({...x,id:crypto.randomUUID(),deleted:false}));if(queue(records))toast(`已导入 ${records.length} 条日程`);}catch(error){toast(error.message);}finally{event.target.value='';}};
$('#quick-form').onsubmit=async event=>{event.preventDefault();const prompt=$('#quick-input').value.trim();if(!prompt)return;if(!settings.token){openSettings();toast('先连接你的同步服务，即可使用 AI');return;}const button=$('#quick-submit');button.disabled=true;button.textContent='正在整理…';try{
  const records=visibleRecords(state.records).sort((a,b)=>Math.abs(Date.parse(a.date)-Date.now())-Math.abs(Date.parse(b.date)-Date.now())).slice(0,100);planSnapshot=JSON.stringify(state.records);
  plan=await api('/api/ai',{prompt,records});$('#plan-message').textContent=plan.message;$('#plan-items').innerHTML=plan.operations.map(op=>{const item=op.record||state.records.find(x=>x.id===op.id);return `<div class="plan-item"><strong><em>${{create:'新增',update:'修改',delete:'删除'}[op.action]}</em>${esc(item?.title||'日程')}</strong><p>${esc((item?.date||'')+' '+(item?.time||'全天')+(item?.endTime?' – '+item.endTime:''))}</p></div>`;}).join('');$('#apply-plan').disabled=!plan.operations.length;$('#plan-dialog').showModal();
}catch(error){toast(error.message);}finally{button.disabled=false;button.innerHTML='帮我安排 <span>↗</span>';}};
$('#apply-plan').onclick=()=>{if(!plan)return;if(JSON.stringify(state.records)!==planSnapshot){toast('日程已发生变化，请重新生成安排');$('#plan-dialog').close();return;}const old=structuredClone(state.records),ops=plan.operations;try{if(queue(ops.map(op=>op.action==='delete'?{...state.records.find(x=>x.id===op.id),deleted:true}:op.record))){$('#plan-dialog').close();$('#quick-input').value='';plan=null;toast(`已应用 ${ops.length} 项安排`,()=>queue(ops.map(op=>old.find(x=>x.id===op.id)||{...op.record,deleted:true})));}}catch(error){toast(error.message);}};
$('#keep-remote').onclick=()=>resolveConflict(false);$('#keep-local').onclick=()=>resolveConflict(true);
$('#conflict-dialog').addEventListener('cancel',event=>event.preventDefault());
window.addEventListener('online',sync);window.addEventListener('offline',()=>setSyncStatus('离线 · 本机保存',true));
window.addEventListener('storage',event=>{if(event.key===dataKey&&!syncing){state=store.get(dataKey,state);render();}if(event.key==='shiri-settings')location.reload();});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&Date.now()-lastSync>10000)void sync();});
setInterval(()=>{if(document.visibilityState==='visible')void sync();},20000);
render();setSyncStatus(settings.token?'等待同步':'本机保存');void sync();
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
