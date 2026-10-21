import {addDays,validDate,normalizeRecord,normalizeRecurrence} from './core.js';

export const weekdayOf=day=>new Date(day+'T12:00:00').getDay()||7;
const difference=(a,b)=>Math.round((Date.parse(a+'T12:00:00Z')-Date.parse(b+'T12:00:00Z'))/86400000);
export function occurrenceDates(startDate,rule){
  if(!validDate(startDate))throw new Error('请选择重复日程的开始日期');
  if(!rule||rule.frequency==='none')return [startDate];
  const meta=normalizeRecurrence({...rule,seriesId:'preview',startDate,occurrenceDate:startDate});
  if(difference(meta.until,startDate)>730)throw new Error('一次最多创建两年的重复日程');
  const monday=addDays(startDate,1-weekdayOf(startDate)),dates=[];
  for(let day=startDate;day<=meta.until;day=addDays(day,1)){
    const matches=meta.frequency==='daily'?difference(day,startDate)%meta.interval===0:Math.floor(difference(day,monday)/7)%meta.interval===0&&meta.weekdays.includes(weekdayOf(day));
    if(matches)dates.push(day);
    if(dates.length>300)throw new Error('一个重复系列最多创建 300 次，请缩短截止日期');
  }
  if(!dates.length)throw new Error('当前日期范围内没有符合规则的日程');
  return dates;
}
export function createSeries(template,rule,seriesId=crypto.randomUUID()){
  const base=normalizeRecord({...template,recurrence:null});
  if(!rule||rule.frequency==='none')return [base];
  const dates=occurrenceDates(base.date,rule);
  return dates.map(day=>normalizeRecord({...base,id:day===base.date?base.id:crypto.randomUUID(),date:day,recurrence:{seriesId,frequency:rule.frequency,interval:rule.interval||1,weekdays:rule.weekdays||[],startDate:base.date,until:rule.until,occurrenceDate:day}}));
}
export function seriesMembers(records,original,scope='one'){
  if(scope==='one'||!original.recurrence)return [original];
  return records.filter(x=>!x.deleted&&x.recurrence?.seriesId===original.recurrence.seriesId&&(scope==='all'||x.recurrence.occurrenceDate>=original.recurrence.occurrenceDate));
}
export function editSchedule(records,original,template,rule,scope='one'){
  const edited=normalizeRecord({...template,id:original.id,done:original.done});
  if(original.recurrence&&scope==='one')return [normalizeRecord({...edited,recurrence:original.recurrence})];
  if(!original.recurrence){
    const created=createSeries(edited,rule);
    // A selected weekday can exclude the original date; don't leave the original behind.
    return created.some(x=>x.id===original.id)?created:[{...original,deleted:true},...created];
  }
  const members=seriesMembers(records,original,scope),shift=difference(edited.date,original.date);
  if(!rule||rule.frequency==='none')return members.map(item=>normalizeRecord({...item,title:edited.title,time:edited.time,endTime:edited.endTime,notes:edited.notes,priority:edited.priority,kind:edited.kind,date:addDays(item.date,shift),recurrence:null}));
  const startDate=scope==='all'?addDays(original.recurrence.startDate,shift):edited.date;
  let weekdays=rule.weekdays;
  if(rule.frequency==='weekly'&&shift&&JSON.stringify(weekdays)===JSON.stringify(original.recurrence.weekdays))weekdays=weekdays.map(day=>((day-1+shift)%7+7)%7+1).sort((a,b)=>a-b);
  const skipped=new Set(records.filter(x=>x.deleted&&x.recurrence?.seriesId===original.recurrence.seriesId).map(x=>addDays(x.recurrence.occurrenceDate,shift)));
  const created=createSeries({...edited,id:crypto.randomUUID(),date:startDate,done:false},{...rule,weekdays}).filter(x=>!skipped.has(x.date)).map(item=>{
    const previous=members.find(x=>addDays(x.recurrence.occurrenceDate,shift)===item.date);
    return {...item,done:previous?.done||false};
  });
  if(!created.length)throw new Error('新重复规则没有生成可用日期');
  return [...members.map(x=>({...x,deleted:true})),...created];
}
