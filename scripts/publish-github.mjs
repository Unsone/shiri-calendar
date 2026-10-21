import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,readdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';

// Explicit allowlists prevent credentials, local data, and old repository history from publication.
const gh=process.env.GH_BIN||resolve('.local/gh/bin/gh.exe');
const env={...process.env,GH_CONFIG_DIR:resolve('.local/github')};
function api(path,method='GET',body){
  const args=['api',path,'--method',method];if(body!==undefined)args.push('--input','-');
  try{const out=execFileSync(gh,args,{env,input:body===undefined?undefined:JSON.stringify(body),encoding:'utf8',windowsHide:true,stdio:['pipe','pipe','pipe']});return out.trim()?JSON.parse(out):{};}catch(error){throw new Error(`GitHub ${method} ${path}: ${error.stderr?.toString()||error.message}`);}
}
function files(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(`${dir}/${entry.name}`):[`${dir}/${entry.name}`]);}
const login=api('user').login;
const savedPath='.local/publication.json';
let publication=existsSync(savedPath)?JSON.parse(readFileSync(savedPath,'utf8')):null;
if(!publication){
  const repo=api('user/repos','POST',{name:'shiri-calendar',description:'拾日：私人 AI 日历与跨设备同步。GitHub Pages + Cloudflare Workers + D1。',private:false,auto_init:true});
  publication={owner:login,repo:repo.name,url:repo.html_url,defaultBranch:repo.default_branch};writeFileSync(savedPath,JSON.stringify(publication,null,2));
}
if(publication.owner!==login)throw new Error('当前 GitHub 登录账号与已发布仓库不一致');
const prefix=`repos/${publication.owner}/${publication.repo}`;
function commit(branch,entries,create=false){
  const previous=create?null:api(`${prefix}/git/ref/heads/${branch}`).object.sha;
  const tree=api(`${prefix}/git/trees`,'POST',{tree:entries.map(([path,source])=>({path,mode:'100644',type:'blob',content:readFileSync(source,'utf8')}))});
  const next=api(`${prefix}/git/commits`,'POST',{message:'Publish Shiri calendar',tree:tree.sha,parents:previous?[previous]:[]});
  if(create)api(`${prefix}/git/refs`,'POST',{ref:`refs/heads/${branch}`,sha:next.sha});
  else api(`${prefix}/git/refs/heads/${branch}`,'PATCH',{sha:next.sha,force:false});
  return next.sha;
}
const source=['.gitignore','README.md','package.json','package-lock.json','wrangler.jsonc','启动日历.cmd',...files('public'),...files('worker'),...files('migrations'),...files('scripts'),...files('tests')];
const mainCommit=commit(publication.defaultBranch,source.map(path=>[path,path]));
const branches=api(`${prefix}/branches?per_page=100`);
const pagesCommit=commit('gh-pages',files('public').map(path=>[path.slice(7),path]),!branches.some(x=>x.name==='gh-pages'));
if(!publication.pagesEnabled){api(`${prefix}/pages`,'POST',{source:{branch:'gh-pages',path:'/'}});publication.pagesEnabled=true;}
publication.mainCommit=mainCommit;publication.pagesCommit=pagesCommit;publication.pagesUrl=api(`${prefix}/pages`).html_url;
writeFileSync(savedPath,JSON.stringify(publication,null,2));
console.log(JSON.stringify(publication,null,2));
