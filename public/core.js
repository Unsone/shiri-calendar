export const categories = { work: '工作', study: '学习', life: '生活' };
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
  const {id,title,date,time='',endTime='',kind='event',category='life',priority='normal',notes='',done=false,deleted=false} = input;
  if (typeof id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(id)) throw new Error('无效的日程 ID');
  if (typeof title !== 'string' || !title.trim() || title.length>160) throw new Error('标题须为 1–160 个字符');
  if (!validDate(date)) throw new Error('请选择有效日期');
  const clock = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  if (typeof time !== 'string' || typeof endTime !== 'string' || (time && !clock.test(time)) || (endTime && !clock.test(endTime))) throw new Error('时间格式不正确');
  if (endTime && (!time || endTime <= time)) throw new Error('结束时间必须晚于开始时间');
  if (!['event','task'].includes(kind) || !Object.hasOwn(categories,category)) throw new Error('无效的日程分类');
  if (!['low','normal','high'].includes(priority)) throw new Error('无效的日程优先级');
  if (typeof notes !== 'string' || notes.length>4000) throw new Error('备注最多 4000 个字符');
  if (typeof done !== 'boolean' || typeof deleted !== 'boolean') throw new Error('日程状态不正确');
  return {id,title:title.trim(),date,time,endTime,kind,category,priority,notes,done,deleted};
}
export function visibleRecords(records) { return records.filter(x=>!x.deleted).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)); }
export function escapeHTML(value) { return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
