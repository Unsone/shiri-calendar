import {escapeHTML as esc,normalizeRecord,visibleRecords} from './core.js';

export function createChat(options){
  const $=selector=>document.querySelector(selector);
  let messages=[],busy=false,currentKey='';
  const key=()=>options.getDataKey()+'-conversation-v1';
  function save(){
    const plans=messages.filter(x=>x.operations?.length).slice(-5).map(x=>x.id);
    messages=messages.slice(-60).map(x=>x.operations?.length&&!plans.includes(x.id)?{...x,operations:[],bases:{},planCount:x.operations.length}:x);
    try{localStorage.setItem(currentKey,JSON.stringify(messages));}catch{options.toast('对话记录暂时无法保存，本次对话仍可继续');}
  }
  function load(){currentKey=key();try{const saved=JSON.parse(localStorage.getItem(currentKey)||'[]');messages=Array.isArray(saved)?saved.filter(x=>x&&['user','assistant'].includes(x.role)&&typeof x.content==='string'):[];}catch{messages=[];}render();}
  function operationRow(op){
    const record=op.record||options.getState().records.find(x=>x.id===op.id);
    return `<div class="chat-operation"><span>${{create:'＋ 新增',update:'↗ 修改',delete:'− 删除'}[op.action]}</span><strong>${esc(record?.title||'日程')}</strong><small>${esc((record?.date||'')+' '+(record?.time||'全天')+(record?.endTime?'–'+record.endTime:''))}</small></div>`;
  }
  function render(scroll=true){
    const list=$('#chat-messages');
    let html=messages.length?'':`<div class="chat-welcome"><span>✧</span><h3>一起把计划理清楚</h3><p>可以连续聊天，也可以让我帮你安排课程、待办和自习。需要补充条件时，我会继续问你。</p><button data-chat-example="帮我安排本学期每周一第3–5节的课程">安排整学期课程 ↗</button><button data-chat-example="我想重新整理这周的计划，你需要哪些信息？">一起梳理本周计划 ↗</button></div>`;
    for(const message of messages){
      const ops=message.operations||[],status=message.status||'pending';
      html+=`<article class="chat-message ${message.role} ${message.error?'error':''}"><div class="chat-role">${message.role==='user'?'你':'✧ 拾日助手'}</div><div class="chat-text">${esc(message.content)}</div>`;
      if(ops.length){
        html+=`<div class="chat-plan"><div class="chat-plan-title">日历方案 <span>${ops.length} 项变更</span></div>${ops.slice(0,5).map(operationRow).join('')}${ops.length>5?`<details><summary>查看其余 ${ops.length-5} 项</summary>${ops.slice(5).map(operationRow).join('')}</details>`:''}`;
        if(status==='pending')html+=`<div class="chat-plan-actions"><button class="primary" data-chat-apply="${esc(message.id)}" ${busy?'disabled':''}>应用到日历</button><button class="secondary" data-chat-dismiss="${esc(message.id)}" ${busy?'disabled':''}>暂不应用</button></div><small>还想调整？直接在下面继续回复。</small>`;
        else html+=`<div class="chat-plan-status">${{applied:'✓ 已应用到日历',dismissed:'暂未应用',superseded:'已由后续对话更新'}[status]||status}</div>`;
        html+='</div>';
      }
      html+='</article>';
    }
    if(busy)html+='<article class="chat-message assistant"><div class="chat-role">✧ 拾日助手</div><div class="chat-thinking">正在思考<span>…</span></div></article>';
    list.innerHTML=html;
    $('#chat-send').disabled=busy||!$('#chat-input').value.trim();$('#chat-clear').disabled=busy;
    $('#chat-status').textContent=busy?'正在回复…':'可连续对话 · 日历变更需确认';
    if(scroll)list.scrollTop=list.scrollHeight;
  }
  function history(){
    let length=0;const out=[];
    for(const item of messages.filter(x=>!x.error).slice(-24).reverse()){
      const suffix=item.operations?.length?`\n[日历方案状态：${{pending:'未应用',applied:'已应用',dismissed:'未应用',superseded:'已被替代'}[item.status||'pending']}；${item.operations.length}项变更；${item.operations.slice(0,8).map(x=>(x.record?.title||x.id)+' '+(x.record?.date||'')).join('；')}]`:'';
      const content=(item.content+suffix).slice(0,5000);if(length+content.length>40000)break;length+=content.length;out.unshift({role:item.role,content});
    }
    return out;
  }
  async function send(event){
    event.preventDefault();const input=$('#chat-input'),prompt=input.value.trim();if(!prompt||busy)return;
    if(!options.getSettings().token){options.openSettings();options.toast('连接同步服务后即可与 AI 对话');return;}
    const previous=history(),requestKey=currentKey;
    messages.push({id:crypto.randomUUID(),role:'user',content:prompt});input.value='';busy=true;save();render();
    const before=structuredClone(options.getState().records);
    try{
      const context=options.getContext();
      const records=[];let contextBytes=0;
      for(const item of visibleRecords(before).sort((a,b)=>Math.abs(Date.parse(a.date)-Date.parse(context.selectedDate))-Math.abs(Date.parse(b.date)-Date.parse(context.selectedDate))).slice(0,300)){
        const bytes=new TextEncoder().encode(JSON.stringify(item)).length;if(contextBytes+bytes>600000)break;contextBytes+=bytes;records.push(item);
      }
      const plan=await options.api('/api/ai',{prompt,messages:previous,records,...context});
      if(requestKey!==key())return;
      for(const item of messages)if(item.status==='pending')item.status='superseded';
      const bases={};for(const op of plan.operations){if(op.action!=='create'){const original=before.find(x=>x.id===op.id);if(original)bases[op.id]=normalizeRecord(original);}}
      messages.push({id:crypto.randomUUID(),role:'assistant',content:plan.message,operations:plan.operations,bases,status:'pending'});
    }catch(error){if(requestKey===key())messages.push({id:crypto.randomUUID(),role:'assistant',content:`请求未完成：${error.message}\n你可以继续输入，或重新发送刚才的内容。`,error:true});}
    finally{busy=false;if(requestKey===key()){save();render();}else load();}
  }
  function apply(id){
    const message=messages.find(x=>x.id===id);if(!message||message.status!=='pending'||busy)return;
    const records=options.getState().records;
    for(const [recordId,base]of Object.entries(message.bases||{})){
      const current=records.find(x=>x.id===recordId);
      if(!current||JSON.stringify(normalizeRecord(current))!==JSON.stringify(base)){options.toast('相关日程已经变化，请继续告诉 AI 重新调整方案');return;}
    }
    try{
      const edits=message.operations.map(op=>op.action==='delete'?{...records.find(x=>x.id===op.id),deleted:true}:op.record);
      if(options.queue(edits)){
        message.status='applied';message.content+='\n\n✓ 以上方案已应用到日历。';save();render();options.toast(`已应用 ${edits.length} 项日历变更`);
        if(edits[0]?.date)options.navigate(edits[0].date);
      }
    }catch(error){options.toast(error.message);}
  }
  $('#chat-form').onsubmit=send;
  $('#chat-input').oninput=()=>{$('#chat-send').disabled=busy||!$('#chat-input').value.trim();};
  $('#chat-input').onkeydown=event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();$('#chat-form').requestSubmit();}};
  $('#chat-clear').onclick=()=>{const old=messages;messages=[];save();render();options.toast('已开始新对话，日程不受影响',()=>{messages=old;save();render();});};
  $('#chat-panel').addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;
    if(button.dataset.chatApply)apply(button.dataset.chatApply);
    if(button.dataset.chatDismiss){const message=messages.find(x=>x.id===button.dataset.chatDismiss);if(message){message.status='dismissed';save();render(false);}}
    if(button.dataset.chatExample){$('#chat-input').value=button.dataset.chatExample;$('#chat-input').dispatchEvent(new Event('input'));$('#chat-input').focus();}
  });
  load();return {reload:load};
}
