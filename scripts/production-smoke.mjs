// Server-only production verification. Never log credentials, arguments or raw errors.
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {ConvexHttpClient} from 'convex/browser';
import {api} from '../convex/_generated/api.js';
const url=process.env.VITE_CONVEX_URL;
if(!url||url!==process.env.SATISH_EXPECTED_CONVEX_URL){console.error('Production smoke check: backend mismatch.');process.exit(1);}
const cli=fileURLToPath(new URL('../node_modules/convex/bin/main.js',import.meta.url));
const secret=name=>execFileSync(process.execPath,[cli,'env','get',name],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:60000}).trim();
const client=new ConvexHttpClient(url,{logger:false});
const token=secret('ROOM_TOKEN'),code=secret('ACCESS_CODE');
const room={channel:'instrumentation',roomToken:token,accessCode:code};
const rand=()=>randomBytes(24).toString('base64url');
const prefix=`Setup-${randomBytes(3).toString('hex')}`;
const joined=[];
const scope=a=>({...a,channel:room.channel});
function check(value){if(!value)throw new Error('check failed');}
async function rejected(call){let denied=false;try{await call();}catch{denied=true;}check(denied);}
try{
  await client.query(api.access.info,room);
  await rejected(()=>client.query(api.access.info,{...room,roomToken:rand()}));
  await rejected(()=>client.query(api.access.info,{...room,accessCode:rand()}));
  for(const count of [2,5,10]){
    const group=[];
    try{
      for(let i=0;i<count;i++){
        const a={sessionId:rand(),sessionSecret:rand()};
        const result=await client.mutation(api.presence.join,{...a,...room,name:`${prefix}-${count}-${i}`});
        check(result.ok);joined.push(a);group.push(a);
      }
      const roster=await client.query(api.presence.roster,scope(group[0]));
      // Do not erase or displace real members if testing a running team.
      check(roster.filter(m=>group.some(a=>a.sessionId===m.sessionId)).length===count);
      await client.mutation(api.presence.heartbeat,group[0]);
      await rejected(()=>client.query(api.presence.roster,{...scope(group[0]),sessionSecret:rand()}));
      const results=await Promise.all(group.map(a=>client.mutation(api.floor.acquire,scope(a))));
      check(results.filter(r=>r.granted).length===1);
      const winner=group[results.findIndex(r=>r.granted)];
      check((await client.mutation(api.floor.renew,scope(winner))).held);
      await client.mutation(api.floor.release,scope(winner));
      check((await client.mutation(api.floor.acquire,scope(group[1]))).granted);
      await client.mutation(api.floor.release,scope(group[1]));
      await client.mutation(api.signaling.send,{fromSession:group[0].sessionId,sessionSecret:group[0].sessionSecret,toSession:group[1].sessionId,channel:room.channel,kind:'restart',payload:'{}'});
      const inbox=await client.query(api.signaling.inbox,{toSession:group[1].sessionId,sessionSecret:group[1].sessionSecret});
      const signals=inbox.filter(s=>s.fromSession===group[0].sessionId);check(signals.length===1);
      await client.mutation(api.signaling.consume,{...group[1],ids:signals.map(s=>s.id)});
      if(count===10){const extra={sessionId:rand(),sessionSecret:rand()};const result=await client.mutation(api.presence.join,{...extra,...room,name:`${prefix}-extra`});if(result.ok)joined.push(extra);check(!result.ok&&result.reason==='channel-full');}
      console.log(`Production check passed: ${count} members, private presence/signaling, one speaker, release/reacquire and heartbeat.`);
    }finally{await Promise.allSettled(group.map(a=>client.mutation(api.presence.leave,a)));}
  }
  console.log('Production check passed: invalid credentials/session rejected; 11th member denied. No physical audio test claimed.');
}catch{console.error('Production smoke check failed. Inspect function health without printing secrets.');process.exitCode=1;}
finally{await Promise.allSettled(joined.map(a=>client.mutation(api.presence.leave,a)));}
