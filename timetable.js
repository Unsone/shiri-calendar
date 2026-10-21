import {addDays,dateKey,escapeHTML as esc} from './core.js';

// Shared by the week GUI and the server's system prompt. Keep the two in sync.
export const COURSE_PERIODS = [
  ['08:00','08:45'], ['08:50','09:35'],
  ['09:50','10:35'], ['10:40','11:25'], ['11:30','12:15'],
  ['14:00','14:45'], ['14:50','15:35'],
  ['15:50','16:35'], ['16:40','17:25'], ['17:30','18:15'],
  ['19:00','19:45'], ['19:50','20:35'],
  ['20:50','21:35'], ['21:40','22:15'],
].map(([start,end],i)=>({number:i+1,start,end}));

function periods(lastEnd='22:15'){
  return COURSE_PERIODS.map(period=>period.number===14?{...period,end:lastEnd==='22:25'?'22:25':'22:15'}:period);
}

export function minutes(time){const [h,m]=time.split(':').map(Number);return h*60+m;}
export function clock(value){return `${String(Math.floor(value/60)).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`;}
export function courseRange(first,last=first,lastEnd='22:15'){
  if(!Number.isInteger(first)||!Number.isInteger(last)||first<1||last>14||first>last)throw new Error('请选择有效的课程节次范围');
  const table=periods(lastEnd);return {time:table[first-1].start,endTime:table[last-1].end};
}
export function coursePrompt(lastEnd='22:15'){
  return `北航课程节次采用用户指定的以下精确时间表：${periods(lastEnd).map(x=>`第${x.number}节 ${x.start}–${x.end}`).join('；')}。${lastEnd==='22:25'?'每小节45分钟':'通常每小节45分钟；第14节当前按用户指定的22:15结束，只有35分钟，这一例外以表为准'}，同一堂课内两小节之间休息5分钟，两堂课通常间隔15分钟，午休和晚饭间隔按表，不得用统一间隔外推。用户说“第1~2节”“1-2节”“第3到5节”时，time取首节开始，endTime取末节结束，包括中间课间时间。例如第1–2节=08:00–09:35，第3–4节=09:50–11:25，第3–5节=09:50–12:15，第6–7节=14:00–15:35，第8–9节=15:50–17:25，第8–10节=15:50–18:15，第11–12节=19:00–20:35。未给明确钟表时间但给出1–14节的节次时，必须按本表转换，不能把节次当作小时。课程和自习均适用。用户明确给出钟表时间则以其明确时间为准。`;
}
export function makeScale(kind='standard',step=60,lastEnd='22:15'){
  const bands=[];let y=0;
  const add=(start,end,height,label='',type='gap',number=null)=>{bands.push({start,end,height,label,type,number,top:y});y+=height;};
  if(kind==='course'){
    let previous=0;
    for(const period of periods(lastEnd)){
      const start=minutes(period.start),end=minutes(period.end);
      if(start>previous){const duration=start-previous;add(previous,start,duration>=40?40:duration>=15?22:10,duration>=40?(previous===0?'早间':'休息'):duration>=15?'课间':'','gap');}
      add(start,end,60,`第 ${period.number} 节`,'class',period.number);previous=end;
    }
    if(previous<1440)add(previous,1440,40,'晚间','gap');
  }else{
    step=step===120?120:60;
    for(let start=0;start<1440;start+=step)add(start,Math.min(1440,start+step),step===60?64:96,clock(start),'hour');
  }
  const project=value=>{
    const m=Math.max(0,Math.min(1440,value)),band=bands.find(x=>m<x.end)||bands[bands.length-1];
    return band.top+(m-band.start)/(band.end-band.start)*band.height;
  };
  return {bands,height:y,project,kind};
}
export function positionEvents(records){
  const intervals=records.filter(x=>x.time&&!x.deleted).map(record=>({record,start:minutes(record.time),end:record.endTime?minutes(record.endTime):Math.min(1440,minutes(record.time)+30)})).sort((a,b)=>a.start-b.start||b.end-a.end);
  const result=[];let group=[],end=-1;
  const finish=()=>{const columns=[];for(const item of group){let col=columns.findIndex(until=>until<=item.start);if(col<0)col=columns.length;columns[col]=item.end;item.column=col;}for(const item of group)result.push({...item,columns:columns.length});group=[];};
  for(const item of intervals){if(item.start>=end&&group.length)finish();group.push(item);end=group.length===1?item.end:Math.max(end,item.end);}
  if(group.length)finish();return result;
}
export function renderWeek(records,cursor,selected,options={}){
  const start=addDays(dateKey(cursor),-(cursor.getDay()+6)%7),today=dateKey();
  const scale=makeScale(options.scale,options.step,options.courseEnd),days=Array.from({length:7},(_,i)=>addDays(start,i));
  const content=days.map(day=>records.filter(x=>x.date===day));
  const allDay=content.some(items=>items.some(x=>!x.time));
  let html=`<div class="time-scroll" data-week="${start}" data-scale="${options.scale}:${options.step}:${options.courseEnd||'22:15'}"><div class="time-canvas" style="--timeline-height:${scale.height}px"><div class="time-week-head"><div class="time-corner">GMT+8</div>`;
  for(let i=0;i<7;i++)html+=`<button class="time-day-head ${days[i]===selected?'selected':''} ${days[i]===today?'is-today':''}" data-date="${days[i]}"><small>周${['一','二','三','四','五','六','日'][i]}</small><span>${Number(days[i].slice(-2))}</span><em>${days[i].slice(5,7)}月</em></button>`;
  html+='</div>';
  if(allDay){html+='<div class="all-day-row"><span class="all-day-label">全天</span>';for(let i=0;i<7;i++)html+=`<div class="all-day-cell">${content[i].filter(x=>!x.time).map(x=>`<button class="event-pill ${x.category} ${x.done?'done':''}" data-edit="${esc(x.id)}">${esc(x.title)}</button>`).join('')}</div>`;html+='</div>';}
  html+='<div class="time-grid"><div class="time-ruler">';
  for(const band of scale.bands)html+=`<div class="time-label ${band.type}" style="top:${band.top}px;height:${band.height}px">${band.type==='class'?`<b>${band.label}</b><span>${clock(band.start)}</span><small>${clock(band.end)}</small>`:band.type==='hour'?`<span>${band.label}</span>`:band.label?`<span>${band.label}</span>`:''}</div>`;
  html+='<span class="end-label">24:00</span></div>';
  for(let i=0;i<7;i++){
    const day=days[i];html+=`<div class="time-day ${day===selected?'selected':''}" data-column-date="${day}">`;
    for(const band of scale.bands)html+=`<button class="time-slot ${band.type}" style="top:${band.top}px;height:${band.height}px" data-slot-date="${day}" data-slot-start="${clock(band.start)}" data-slot-end="${clock(Math.min(band.end,1439))}" aria-label="在 ${day} ${clock(band.start)}${band.number?` 第${band.number}节`:''} 新建日程"></button>`;
    for(const {record,start:endStart,end,column,columns}of positionEvents(content[i])){
      const top=scale.project(endStart),height=Math.max(22,scale.project(end)-top-2);
      html+=`<button class="time-event ${record.category} ${record.done?'done':''}" style="top:${top}px;height:${height}px;left:calc(${column/columns*100}% + 3px);width:calc(${100/columns}% - 6px)" data-edit="${esc(record.id)}" title="${esc(record.title)} · ${record.time}–${record.endTime||clock(end)}" aria-label="编辑：${esc(record.title)}，${record.time}–${record.endTime||clock(end)}"><strong>${esc(record.title)}</strong><span>${record.time}${record.endTime?' – '+record.endTime:''}</span>${height>65?`<small>${record.kind==='task'?'□ 待办':record.category==='study'?'学习':'日程'}</small>`:''}</button>`;
    }
    if(day===today){const now=new Date(),y=scale.project(now.getHours()*60+now.getMinutes());html+=`<div class="now-line" style="top:${y}px"><i></i></div>`;}
    html+='</div>';
  }
  return {html:html+'</div></div></div>',scale};
}
