import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {mkdirSync} from 'node:fs';
const home=resolve('.local/cloudflare');mkdirSync(home,{recursive:true});
const child=spawn(process.execPath,[resolve('node_modules/wrangler/bin/wrangler.js'),...process.argv.slice(2)],{stdio:'inherit',env:{...process.env,XDG_CONFIG_HOME:home,WRANGLER_SEND_METRICS:'false',WRANGLER_LOG_PATH:resolve('.local/wrangler.log')}});
child.on('exit',code=>process.exitCode=code??1);
