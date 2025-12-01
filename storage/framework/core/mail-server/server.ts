/**
 * Stacks Mail Server - IMAP/SMTP server with S3 backend
 */
import * as tls from 'tls';import * as net from 'net';import * as crypto from 'crypto';import * as fs from 'fs';
import{S3Client,GetObjectCommand,ListObjectsV2Command,PutObjectCommand}from'@aws-sdk/client-s3';
import{SESv2Client,SendEmailCommand}from'@aws-sdk/client-sesv2';
import{DynamoDBClient,GetItemCommand}from'@aws-sdk/client-dynamodb';

const R=process.env.REGION||'us-east-1',B=process.env.EMAIL_BUCKET||'',T=process.env.USERS_TABLE||'',
D=process.env.EMAIL_DOMAIN||'',IP=+(process.env.IMAP_PORT||993),SP=+(process.env.SMTP_PORT||465),
SD=process.env.MAIL_SUBDOMAIN||'mail';
const s3=new S3Client({region:R}),ses=new SESv2Client({region:R}),db=new DynamoDBClient({region:R});
let tO:tls.TlsOptions={};

async function loadCert(){
  const p=`/etc/letsencrypt/live/${SD}.${D}`;
  if(fs.existsSync(`${p}/fullchain.pem`)){
    tO={key:fs.readFileSync(`${p}/privkey.pem`),cert:fs.readFileSync(`${p}/fullchain.pem`)};
    console.log('TLS cert loaded');return true;
  }
  console.log('No TLS cert');return false;
}

async function authenticate(e:string,p:string):Promise<boolean>{
  try{
    console.log('Auth attempt for:',e,'table:',T,'pass len:',p?.length);
    const r=await db.send(new GetItemCommand({TableName:T,Key:{email:{S:e.toLowerCase()}}}));
    if(!r.Item){console.log('User not found');return false;}
    const hash=crypto.createHash('sha256').update(p).digest('hex');
    console.log('Computed hash:',hash);
    console.log('Stored hash:  ',r.Item.passwordHash?.S);
    const match=r.Item.passwordHash?.S===hash;
    console.log('Auth result:',match);
    return match;
  }catch(err){console.error('Auth error:',err);return false;}
}

function parseH(c:string):Record<string,string>{
  const h:Record<string,string>={},e=c.indexOf('\r\n\r\n'),s=e>0?c.substring(0,e):c.substring(0,2000);
  for(const l of s.split('\r\n')){const i=l.indexOf(':');if(i>0)h[l.substring(0,i).toLowerCase()]=l.substring(i+1).trim();}
  return h;
}

async function listM(u:string,m='INBOX'){
  const pf=m==='INBOX'?'incoming/':`${m.toLowerCase()}/`;
  const r=await s3.send(new ListObjectsV2Command({Bucket:B,Prefix:pf}));
  const ms:any[]=[];let uid=1;
  for(const o of r.Contents||[]){
    if(o.Key?.includes('AMAZON_SES'))continue;
    try{
      const g=await s3.send(new GetObjectCommand({Bucket:B,Key:o.Key}));
      const c=await g.Body?.transformToString()||'',h=parseH(c),to=(h.to||'').toLowerCase();
      if(to.includes(u.toLowerCase())||to.includes(u.split('@')[0])){
        ms.push({uid:uid++,from:h.from||'',to:h.to||'',subject:h.subject||'(No Subject)',
          date:h.date||o.LastModified?.toISOString(),size:o.Size,key:o.Key});
      }
    }catch{}
  }
  return ms.sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime());
}

async function getM(k:string){const r=await s3.send(new GetObjectCommand({Bucket:B,Key:k}));return await r.Body?.transformToString()||'';}

function startIMAP(tls:boolean){
  const srv=(tls?require('tls').createServer.bind(null,tO):net.createServer)((s:net.Socket)=>{
    let auth=false,user='',mbox='',msgs:any[]=[];
    s.write('* OK IMAP4rev1 Ready\r\n');
    s.on('data',async(d)=>{
      for(const l of d.toString().split('\r\n').filter((x:string)=>x)){
        const p=l.split(' '),tag=p[0],cmd=(p[1]||'').toUpperCase(),args=p.slice(2);
        console.log('IMAP:',l);
        switch(cmd){
          case'CAPABILITY':s.write('* CAPABILITY IMAP4rev1 AUTH=PLAIN AUTH=LOGIN ID NAMESPACE\r\n'+tag+' OK\r\n');break;
          case'AUTHENTICATE':
            if(args[0]?.toUpperCase()==='PLAIN'){
              s.write('+ \r\n');
              s.once('data',async(authData)=>{
                const dec=Buffer.from(authData.toString().trim(),'base64').toString();
                const parts=dec.split('\0');
                const u=(parts[1]||'').trim(),p=(parts[2]||'').trim();
                console.log('IMAP AUTHENTICATE user:',u);
                if(await authenticate(u,p)){auth=true;user=u;s.write(tag+' OK\r\n');}
                else s.write(tag+' NO\r\n');
              });
            }else{s.write(tag+' NO Unsupported\r\n');}
            break;
          case'LOGIN':
            const loginUser=(args[0]||'').replace(/"/g,'').trim();
            const loginPass=(args[1]||'').replace(/"/g,'').trim();
            console.log('LOGIN user:',loginUser,'pass len:',loginPass.length);
            if(await authenticate(loginUser,loginPass)){auth=true;user=loginUser;s.write(tag+' OK\r\n');}
            else s.write(tag+' NO\r\n');break;
          case'LIST':if(!auth){s.write(tag+' NO\r\n');break;}
            s.write('* LIST (\\HasNoChildren) "/" "INBOX"\r\n* LIST (\\Sent) "/" "Sent"\r\n'+tag+' OK\r\n');break;
          case'SELECT':if(!auth){s.write(tag+' NO\r\n');break;}
            mbox=args[0]?.replace(/"/g,'')||'INBOX';msgs=await listM(user,mbox);
            s.write(`* ${msgs.length} EXISTS\r\n* 0 RECENT\r\n* FLAGS (\\Seen)\r\n${tag} OK\r\n`);break;
          case'FETCH':if(!auth||!mbox){s.write(tag+' NO\r\n');break;}
            const seq=args[0],fi=args.slice(1).join(' ');
            let st=1,en=msgs.length;
            if(seq.includes(':')){const[a,b]=seq.split(':');st=+a||1;en=b==='*'?msgs.length:+b;}
            else st=en=+seq||1;
            for(let i=st;i<=en&&i<=msgs.length;i++){
              const m=msgs[i-1];if(!m)continue;
              if(fi.includes('ENVELOPE')||fi.includes('ALL'))s.write(`* ${i} FETCH (UID ${m.uid} ENVELOPE (NIL "${m.subject}" NIL NIL NIL NIL NIL NIL NIL NIL))\r\n`);
              else if(fi.includes('BODY')||fi.includes('RFC822')){const c=await getM(m.key);s.write(`* ${i} FETCH (UID ${m.uid} RFC822 {${c.length}}\r\n${c})\r\n`);}
              else if(fi.includes('FLAGS'))s.write(`* ${i} FETCH (UID ${m.uid} FLAGS ())\r\n`);
            }
            s.write(tag+' OK\r\n');break;
          case'NOOP':s.write(tag+' OK\r\n');break;
          case'LOGOUT':s.write('* BYE\r\n'+tag+' OK\r\n');s.end();break;
          case'EXAMINE':if(!auth){s.write(tag+' NO\r\n');break;}
            mbox=(args[0]||'').replace(/"/g,'')||'INBOX';msgs=await listM(user,mbox);
            s.write(`* ${msgs.length} EXISTS\r\n* 0 RECENT\r\n* FLAGS (\\Seen \\Answered \\Flagged \\Deleted \\Draft)\r\n* OK [UIDVALIDITY 1]\r\n${tag} OK [READ-ONLY]\r\n`);break;
          case'STATUS':if(!auth){s.write(tag+' NO\r\n');break;}
            const stBox=(args[0]||'').replace(/"/g,'')||'INBOX';
            s.write(`* STATUS "${stBox}" (MESSAGES 0 RECENT 0 UNSEEN 0 UIDNEXT 1 UIDVALIDITY 1)\r\n${tag} OK\r\n`);break;
          case'CREATE':case'DELETE':case'RENAME':case'SUBSCRIBE':case'UNSUBSCRIBE':
            s.write(tag+' OK\r\n');break;
          case'LSUB':if(!auth){s.write(tag+' NO\r\n');break;}
            s.write('* LSUB () "/" "INBOX"\r\n* LSUB (\\Sent) "/" "Sent"\r\n* LSUB (\\Drafts) "/" "Drafts"\r\n* LSUB (\\Trash) "/" "Trash"\r\n'+tag+' OK\r\n');break;
          case'APPEND':if(!auth){s.write(tag+' NO\r\n');break;}
            const appBox=(args[0]||'').replace(/"/g,'').toLowerCase();
            console.log('APPEND to:',appBox);
            const litMatch=l.match(/\{(\d+)\}/);
            if(litMatch){
              const litSize=parseInt(litMatch[1]);
              s.write('+ Ready\r\n');
              let appData='';
              const appHandler=(chunk:Buffer)=>{
                appData+=chunk.toString();
                if(appData.length>=litSize){
                  s.removeListener('data',appHandler);
                  const key=`${appBox}/${Date.now()}-${Math.random().toString(36).slice(2)}.eml`;
                  s3.send(new PutObjectCommand({Bucket:B,Key:key,Body:appData.slice(0,litSize),ContentType:'message/rfc822'}))
                    .then(()=>{console.log('Saved:',key);s.write(tag+' OK APPEND completed\r\n');})
                    .catch((e:any)=>{console.error('APPEND err:',e);s.write(tag+' NO\r\n');});
                }
              };
              s.on('data',appHandler);
            }else{s.write(tag+' OK\r\n');}
            break;
          case'STORE':case'COPY':case'MOVE':case'EXPUNGE':case'CLOSE':case'UID':
            if(!auth){s.write(tag+' NO\r\n');break;}
            s.write(tag+' OK\r\n');break;
          case'NAMESPACE':
            s.write('* NAMESPACE (("" "/")) NIL NIL\r\n'+tag+' OK\r\n');break;
          case'ID':
            s.write('* ID ("name" "Stacks Mail" "version" "1.0")\r\n'+tag+' OK\r\n');break;
          default:console.log('Unknown IMAP cmd:',cmd);s.write(tag+' BAD Unknown command\r\n');
        }
      }
    });
    s.on('error',e=>console.error('IMAP err:',e));
  });
  srv.listen(IP,()=>console.log('IMAP on',IP));
}

function startSMTP(tls:boolean){
  const srv=(tls?require('tls').createServer.bind(null,tO):net.createServer)((s:net.Socket)=>{
    let auth=false,from='',to:string[]=[],inD=false,data='';
    s.write(`220 ${SD}.${D} ESMTP\r\n`);
    s.on('data',async(d)=>{
      const inp=d.toString();
      if(inD){
        data+=inp;
        // Check for end of data: \r\n.\r\n
        if(data.endsWith('\r\n.\r\n')||data.endsWith('\n.\n')||inp.trim()==='.'){
          inD=false;
          // Remove the trailing dot
          const emailData=data.replace(/\r?\n\.\r?\n$/,'');
          console.log('SMTP DATA complete, sending via SES, size:',emailData.length);
          try{
            await ses.send(new SendEmailCommand({FromEmailAddress:from,Destination:{ToAddresses:to},Content:{Raw:{Data:new TextEncoder().encode(emailData)}}}));
            console.log('SES send success');
            s.write('250 2.0.0 OK Message queued\r\n');
          }catch(e:any){
            console.error('SES error:',e);
            s.write('550 5.7.1 '+e.message+'\r\n');
          }
          data='';to=[];
        }
        return;
      }
      for(const l of inp.split('\r\n').filter((x:string)=>x)){
        const cmd=l.split(' ')[0].toUpperCase(),args=l.substring(cmd.length+1);
        console.log('SMTP:',l);
        switch(cmd){
          case'EHLO':case'HELO':
            s.write(`250-${SD}.${D}\r\n250-AUTH PLAIN LOGIN\r\n250-AUTH=PLAIN LOGIN\r\n250-PIPELINING\r\n250-8BITMIME\r\n250-SIZE 52428800\r\n250 OK\r\n`);break;
          case'AUTH':
            console.log('SMTP AUTH:',args);
            if(args.startsWith('PLAIN ')){
              const dec=Buffer.from(args.substring(6),'base64').toString();
              const parts=dec.split('\0');
              const u=(parts[1]||'').trim(),p=(parts[2]||'').trim();
              console.log('AUTH PLAIN inline user:',u);
              if(await authenticate(u,p)){auth=true;from=u;s.write('235 2.7.0 Authentication successful\r\n');}
              else s.write('535 5.7.8 Authentication failed\r\n');
            }else if(args==='PLAIN'||args.startsWith('PLAIN')){
              s.write('334 \r\n');
              s.once('data',async(ad)=>{
                const dec=Buffer.from(ad.toString().trim(),'base64').toString();
                const parts=dec.split('\0');
                const u=(parts[1]||'').trim(),p=(parts[2]||'').trim();
                console.log('AUTH PLAIN challenge user:',u);
                if(await authenticate(u,p)){auth=true;from=u;s.write('235 2.7.0 Authentication successful\r\n');}
                else s.write('535 5.7.8 Authentication failed\r\n');
              });
            }else if(args==='LOGIN'||args.startsWith('LOGIN')){
              let authUser='';
              s.write('334 VXNlcm5hbWU6\r\n'); // "Username:" base64
              s.once('data',async(ud)=>{
                authUser=Buffer.from(ud.toString().trim(),'base64').toString().trim();
                console.log('AUTH LOGIN user:',authUser);
                s.write('334 UGFzc3dvcmQ6\r\n'); // "Password:" base64
                s.once('data',async(pd)=>{
                  const authPass=Buffer.from(pd.toString().trim(),'base64').toString().trim();
                  if(await authenticate(authUser,authPass)){auth=true;from=authUser;s.write('235 2.7.0 Authentication successful\r\n');}
                  else s.write('535 5.7.8 Authentication failed\r\n');
                });
              });
            }else{s.write('504 5.5.4 Unrecognized authentication type\r\n');}
            break;
          case'MAIL':
            console.log('SMTP MAIL auth:',auth,'from:',args);
            if(!auth){s.write('530 5.7.0 Authentication required\r\n');break;}
            const fm=args.match(/FROM:<([^>]+)>/i);if(fm){from=fm[1];s.write('250 2.1.0 OK\r\n');}else s.write('501 5.1.7 Bad sender address\r\n');break;
          case'RCPT':
            if(!auth){s.write('530 5.7.0 Authentication required\r\n');break;}
            const tm=args.match(/TO:<([^>]+)>/i);if(tm){to.push(tm[1]);s.write('250 2.1.5 OK\r\n');}else s.write('501 5.1.3 Bad recipient address\r\n');break;
          case'DATA':if(!auth||!from||!to.length){s.write('503\r\n');break;}inD=true;s.write('354\r\n');break;
          case'QUIT':s.write('221 Bye\r\n');s.end();break;
          case'NOOP':case'RSET':s.write('250 OK\r\n');if(cmd==='RSET'){from='';to=[];data='';}break;
          default:s.write('502\r\n');
        }
      }
    });
    s.on('error',e=>console.error('SMTP err:',e));
  });
  srv.listen(SP,()=>console.log('SMTP on',SP));
}

function startSMTP587(){
  // Port 587 with STARTTLS - starts plain, upgrades to TLS
  const srv=net.createServer((s)=>{
    let auth=false,from='',to:string[]=[],inD=false,data='',upgraded=false;
    s.write(`220 ${SD}.${D} ESMTP\r\n`);
    s.on('data',async(d)=>{
      const inp=d.toString();
      if(inD){if(inp.trim()==='.'){inD=false;
        try{await ses.send(new SendEmailCommand({FromEmailAddress:from,Destination:{ToAddresses:to},Content:{Raw:{Data:new TextEncoder().encode(data)}}}));s.write('250 OK\r\n');}
        catch(e:any){console.error('SES error:',e);s.write('550 '+e.message+'\r\n');}
        data='';to=[];
      }else data+=inp;return;}
      for(const l of inp.split('\r\n').filter((x:string)=>x)){
        const cmd=l.split(' ')[0].toUpperCase(),args=l.substring(cmd.length+1);
        console.log('SMTP587:',l);
        switch(cmd){
          case'EHLO':case'HELO':
            s.write(`250-${SD}.${D}\r\n250-AUTH PLAIN LOGIN\r\n250-STARTTLS\r\n250-PIPELINING\r\n250-8BITMIME\r\n250 SIZE 52428800\r\n`);break;
          case'STARTTLS':
            if(tO.key){
              s.write('220 Ready to start TLS\r\n');
              const tlsSock=new tls.TLSSocket(s,{...tO,isServer:true});
              upgraded=true;
              tlsSock.on('secure',()=>console.log('STARTTLS upgrade complete'));
            }else{s.write('454 TLS not available\r\n');}
            break;
          case'AUTH':
            console.log('SMTP587 AUTH:',args);
            if(args.startsWith('PLAIN ')){
              const dec=Buffer.from(args.substring(6),'base64').toString();
              const parts=dec.split('\0');
              const u=(parts[1]||'').trim(),p=(parts[2]||'').trim();
              if(await authenticate(u,p)){auth=true;from=u;s.write('235 2.7.0 Authentication successful\r\n');}
              else s.write('535 5.7.8 Authentication failed\r\n');
            }else if(args==='PLAIN'){
              s.write('334 \r\n');
              s.once('data',async(ad)=>{
                const dec=Buffer.from(ad.toString().trim(),'base64').toString();
                const parts=dec.split('\0');
                const u=(parts[1]||'').trim(),p=(parts[2]||'').trim();
                if(await authenticate(u,p)){auth=true;from=u;s.write('235 2.7.0 Authentication successful\r\n');}
                else s.write('535 5.7.8 Authentication failed\r\n');
              });
            }else if(args==='LOGIN'||args.startsWith('LOGIN')){
              let authUser='';
              s.write('334 VXNlcm5hbWU6\r\n');
              s.once('data',async(ud)=>{
                authUser=Buffer.from(ud.toString().trim(),'base64').toString().trim();
                s.write('334 UGFzc3dvcmQ6\r\n');
                s.once('data',async(pd)=>{
                  const authPass=Buffer.from(pd.toString().trim(),'base64').toString().trim();
                  if(await authenticate(authUser,authPass)){auth=true;from=authUser;s.write('235 2.7.0 Authentication successful\r\n');}
                  else s.write('535 5.7.8 Authentication failed\r\n');
                });
              });
            }else{s.write('504 Unrecognized auth type\r\n');}
            break;
          case'MAIL':if(!auth){s.write('530 5.7.0 Authentication required\r\n');break;}
            const fm=args.match(/FROM:<([^>]+)>/i);if(fm){from=fm[1];s.write('250 OK\r\n');}else s.write('501\r\n');break;
          case'RCPT':if(!auth){s.write('530 5.7.0 Authentication required\r\n');break;}
            const tm=args.match(/TO:<([^>]+)>/i);if(tm){to.push(tm[1]);s.write('250 OK\r\n');}else s.write('501\r\n');break;
          case'DATA':if(!auth||!from||!to.length){s.write('503\r\n');break;}inD=true;s.write('354 Start mail input\r\n');break;
          case'QUIT':s.write('221 Bye\r\n');s.end();break;
          case'NOOP':case'RSET':s.write('250 OK\r\n');if(cmd==='RSET'){from='';to=[];data='';}break;
          default:s.write('502 Command not implemented\r\n');
        }
      }
    });
    s.on('error',e=>console.error('SMTP587 err:',e));
  });
  srv.listen(587,()=>console.log('SMTP on 587 (STARTTLS)'));
}

async function main(){
  console.log('Mail server for',D);
  const hasTls=await loadCert();
  startIMAP(hasTls);
  startSMTP(hasTls);
  startSMTP587(); // Also listen on 587 with STARTTLS
}

// Export for testing
export { authenticate };

main().catch(console.error);
