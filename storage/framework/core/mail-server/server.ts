/**
 * Stacks Mail Server - IMAP/SMTP server with S3 backend
 */
import * as tls from 'tls';import * as net from 'net';import * as crypto from 'crypto';import * as fs from 'fs';
import{S3Client,GetObjectCommand,ListObjectsV2Command}from'@aws-sdk/client-s3';
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
          case'CAPABILITY':s.write('* CAPABILITY IMAP4rev1 AUTH=PLAIN\r\n'+tag+' OK\r\n');break;
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
          default:s.write(tag+' BAD\r\n');
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
      if(inD){if(inp.trim()==='.'){inD=false;
        try{await ses.send(new SendEmailCommand({FromEmailAddress:from,Destination:{ToAddresses:to},Content:{Raw:{Data:new TextEncoder().encode(data)}}}));s.write('250 OK\r\n');}
        catch(e:any){s.write('550 '+e.message+'\r\n');}
        data='';to=[];
      }else data+=inp;return;}
      for(const l of inp.split('\r\n').filter((x:string)=>x)){
        const cmd=l.split(' ')[0].toUpperCase(),args=l.substring(cmd.length+1);
        console.log('SMTP:',l);
        switch(cmd){
          case'EHLO':case'HELO':s.write(`250-${SD}.${D}\r\n250-AUTH PLAIN\r\n250 OK\r\n`);break;
          case'AUTH':
            if(args.startsWith('PLAIN ')){const dec=Buffer.from(args.substring(6),'base64').toString(),[,u,p]=dec.split('\0');
              if(await module.exports.auth(u,p)){auth=true;s.write('235 OK\r\n');}else s.write('535 NO\r\n');}
            else if(args==='PLAIN'){s.write('334\r\n');s.once('data',async(ad)=>{
              const dec=Buffer.from(ad.toString().trim(),'base64').toString(),[,u,p]=dec.split('\0');
              if(await module.exports.auth(u,p)){auth=true;s.write('235 OK\r\n');}else s.write('535 NO\r\n');});}
            break;
          case'MAIL':if(!auth){s.write('530\r\n');break;}const fm=args.match(/FROM:<([^>]+)>/i);if(fm){from=fm[1];s.write('250 OK\r\n');}else s.write('501\r\n');break;
          case'RCPT':if(!auth){s.write('530\r\n');break;}const tm=args.match(/TO:<([^>]+)>/i);if(tm){to.push(tm[1]);s.write('250 OK\r\n');}else s.write('501\r\n');break;
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

async function main(){
  console.log('Mail server for',D);
  const hasTls=await loadCert();
  startIMAP(hasTls);
  startSMTP(hasTls);
}

// Export for testing
export { authenticate };

main().catch(console.error);
