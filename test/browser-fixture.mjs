// Offline visual acceptance fixture. No Microsoft network requests or real secrets.
import {createApp} from '../server.mjs';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const names=['Ayşe Demir','Ahmet Yılmaz','Deniz Kaya','Ece Arslan','Can Öztürk','Test <img src=x onerror=alert(1)>'];
const users=names.map((displayName,i)=>({id:'u'+i,displayName,userPrincipalName:`user${i}@example.test`,accountEnabled:true}));
const rows=Array.from({length:18},(_,i)=>({id:'e'+i,userId:'u'+i%6,userDisplayName:names[i%6],createdDateTime:new Date(Date.now()-i*15000).toISOString(),ipAddress:'192.0.2.10',status:{errorCode:50126,failureReason:'Invalid username or password'},location:{countryOrRegion:'TR'},appDisplayName:'Test application'}));
const fetcher=async url=>url.includes('oauth2')?Response.json({access_token:'offline',expires_in:3600}):Response.json({value:url.includes('userRegistrationDetails')?users.slice(0,5).map((u,i)=>({id:u.id,isMfaRegistered:i>=3})):url.includes('auditLogs')?rows:users});
const app=createApp({dataDir:mkdtempSync(join(tmpdir(),'ir-browser-')),origin:'http://localhost:4318',fetcher,scheduled:false});
app.server.listen(4318,'127.0.0.1',()=>console.log('Offline UI acceptance: http://localhost:4318'));
