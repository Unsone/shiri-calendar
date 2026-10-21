export function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function addDays(value, count) {
  const d = new Date(`${value}T12:00:00`); d.setDate(d.getDate()+count); return dateKey(d);
}
export function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00`)) && dateKey(new Date(`${value}T12:00:00`)) === value;
}
export function normalizeRecord(input) {
  if (!input || typeof input !== 'object') throw new Error('日程格式不正确');
  const {id,title,date,time='',endTime='',kind='event',priority='normal',notes='',done=false,deleted=false,recurrence=null} = input;
  if (typeof id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(id)) throw new Error('无效的日程 ID');
  if (typeof title !== 'string' || !title.trim() || title.length>160) throw new Error('标题须为 1–160 个字符');
  if (!validDate(date)) throw new Error('请选择有效日期');
  const clock = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  if (typeof time !== 'string' || typeof endTime !== 'string' || (time && !clock.test(time)) || (endTime && !clock.test(endTime))) throw new Error('时间格式不正确');
  if (endTime && (!time || endTime <= time)) throw new Error('结束时间必须晚于开始时间');
  if (!['event','task'].includes(kind)) throw new Error('无效的日程类型');
  if (!['low','normal','high'].includes(priority)) throw new Error('无效的日程优先级');
  if (typeof notes !== 'string' || notes.length>4000) throw new Error('备注最多 4000 个字符');
  if (typeof done !== 'boolean' || typeof deleted !== 'boolean') throw new Error('日程状态不正确');
  return {id,title:title.trim(),date,time,endTime,kind,priority,notes,done,deleted,recurrence:normalizeRecurrence(recurrence)};
}
export function normalizeRecurrence(input){
  if(input===null||input===undefined)return null;
  const {seriesId,frequency,interval=1,weekdays=[],startDate,until,occurrenceDate}=input;
  if(typeof seriesId!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(seriesId)||!['daily','weekly'].includes(frequency))throw new Error('重复日程规则不正确');
  if(!Number.isInteger(interval)||interval<1||interval>12||!Array.isArray(weekdays)||weekdays.some(x=>!Number.isInteger(x)||x<1||x>7))throw new Error('重复日程间隔或星期不正确');
  if(!validDate(startDate)||!validDate(until)||!validDate(occurrenceDate)||until<startDate||occurrenceDate<startDate||occurrenceDate>until)throw new Error('重复日程日期范围不正确');
  if(frequency==='weekly'&&!weekdays.length)throw new Error('请至少选择一个重复星期');
  return {seriesId,frequency,interval,weekdays:[...new Set(weekdays)].sort((a,b)=>a-b),startDate,until,occurrenceDate};
}
export function visibleRecords(records) { return records.filter(x=>!x.deleted).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)); }
export function escapeHTML(value) { return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
