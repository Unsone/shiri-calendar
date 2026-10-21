import {test} from 'node:test';
import assert from 'node:assert/strict';
import {COURSE_PERIODS,courseRange,coursePrompt,makeScale,minutes,positionEvents,renderWeek} from '../public/timetable.js';

test('BUAA 2- and 3-period sessions use exact start and end boundaries',()=>{
  for(const [first,last,time,endTime]of [[1,2,'08:00','09:35'],[3,4,'09:50','11:25'],[3,5,'09:50','12:15'],[6,7,'14:00','15:35'],[8,9,'15:50','17:25'],[8,10,'15:50','18:15'],[11,12,'19:00','20:35']])assert.deepEqual(courseRange(first,last),{time,endTime});
  assert.equal(COURSE_PERIODS.length,14);assert.throws(()=>courseRange(5,3));assert.throws(()=>courseRange(0,2));
});
test('the last evening period respects the chosen end time in GUI and AI',()=>{
  assert.deepEqual(courseRange(13,14),{time:'20:50',endTime:'22:15'});
  assert.deepEqual(courseRange(13,14,'22:25'),{time:'20:50',endTime:'22:25'});
  assert.match(coursePrompt(),/第14节 21:40–22:15/);
  assert.match(coursePrompt('22:25'),/第14节 21:40–22:25/);
  assert.match(coursePrompt(),/35分钟/);
});
test('course axis is continuous across compressed lunch and preserves every class',()=>{
  const scale=makeScale('course');
  for(const period of COURSE_PERIODS){assert.equal(scale.project(minutes(period.end))-scale.project(minutes(period.start)),60);}
  for(let i=0;i<1440;i++)assert.ok(scale.project(i+1)>scale.project(i));
  assert.equal(scale.project(0),0);assert.equal(scale.project(1440),scale.height);
  assert.ok(scale.project(14*60)-scale.project(12*60+15)<60);
});
test('standard axis supports one-hour and two-hour lines without moving event times incorrectly',()=>{
  const hour=makeScale('standard',60),two=makeScale('standard',120);
  assert.equal(hour.bands.length,24);assert.equal(two.bands.length,12);
  assert.equal(hour.project(9*60+30),608);assert.equal(two.project(9*60+30),456);
});
test('overlapping events get separate columns; adjacent events can reuse a column',()=>{
  const event=(id,time,endTime)=>({id,time,endTime});
  const result=positionEvents([event('a','08:00','09:35'),event('b','09:00','10:00'),event('c','09:35','11:00'),event('d','14:00','15:00')]);
  assert.equal(result.find(x=>x.record.id==='a').columns,2);
  assert.notEqual(result.find(x=>x.record.id==='a').column,result.find(x=>x.record.id==='b').column);
  assert.equal(result.find(x=>x.record.id==='c').column,result.find(x=>x.record.id==='a').column);
  assert.equal(result.find(x=>x.record.id==='d').columns,1);
});
test('a year-crossing week contains correct dates, all-day records and safe event titles',()=>{
  const result=renderWeek([{id:'sample',title:'<img onerror=bad>',date:'2027-01-01',time:'',category:'study'}],new Date('2027-01-01T12:00:00'),'2027-01-01',{scale:'course'});
  assert.match(result.html,/2026-12-28/);assert.match(result.html,/2027-01-03/);assert.match(result.html,/全天/);assert.match(result.html,/&lt;img/);assert.ok(!result.html.includes('<img onerror'));
  assert.match(coursePrompt(),/第3–5节=09:50–12:15/);
});
