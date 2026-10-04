import {applicationName} from './catalog.mjs';
import {safeIpMatcher} from './network.mjs';

// Explainable triage heuristic, not Microsoft's Identity Protection risk score.
const WINDOW = 10 * 60000;
export function analyze(directory, registrations, events,{safeIps=[]}={}) {
  const isSafeIp=safeIpMatcher(safeIps);
  const reg = new Map(registrations.map(u => [u.id, u]));
  const byId = new Map(directory.map(u => [u.id, {
    id: u.id, name: u.displayName || u.userPrincipalName || u.id,
    email: u.userPrincipalName || '', enabled: u.accountEnabled !== false,
    mfa: typeof reg.get(u.id)?.isMfaRegistered === 'boolean' ? reg.get(u.id).isMfaRegistered : null,
    mfaCapable: reg.get(u.id)?.isMfaCapable ?? null, events: [],
  }]));
  const groups = new Map();
  for (const source of events) {
    const e={...source,appDisplayName:applicationName(source.appDisplayName),trustedIp:isSafeIp(source.ipAddress)};
    if (!e.userId || !Number.isFinite(Date.parse(e.createdDateTime))) continue;
    const upn = String(e.userPrincipalName || '').toLowerCase();
    const uid = String(e.userId || '').toLowerCase();
    if (upn.includes('||') || uid.includes('||')) continue;
    if (!byId.has(e.userId)) {
      const isGuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(upn || uid);
      const hasEmail = upn.includes('@');
      if (isGuid || (uid.length > 20 && !hasEmail)) continue;
    }
    if (!byId.has(e.userId)) byId.set(e.userId, {id: e.userId, name: e.userDisplayName || e.userPrincipalName || e.userId, email: e.userPrincipalName || '', enabled: null, mfa: null, mfaCapable: null, events: []});
    byId.get(e.userId).events.push(e);
    // 50126 is invalid username/password. Other failures (including MFA/CA) are not password-spray evidence.
    if (!e.trustedIp && Number(e.status?.errorCode) === 50126 && e.ipAddress) {
      if (!groups.has(e.ipAddress)) groups.set(e.ipAddress, []);
      groups.get(e.ipAddress).push(e);
    }
  }
  const incidents = [], sprayAffected = new Set(), accountAttacks = new Map();
  for (const [ip, rows] of groups) {
    rows.sort((a,b) => Date.parse(a.createdDateTime)-Date.parse(b.createdDateTime));
    let start = 0, lastEnd = -Infinity;
    const counts = new Map();
    for (let end = 0; end < rows.length; end++) {
      const now = Date.parse(rows[end].createdDateTime);
      counts.set(rows[end].userId, (counts.get(rows[end].userId) || 0) + 1);
      while (now - Date.parse(rows[start].createdDateTime) > WINDOW) {
        const id = rows[start++].userId, n = counts.get(id)-1;
        if (n) counts.set(id,n); else counts.delete(id);
      }
      if (counts.size >= 5) {
        for (const id of counts.keys()) sprayAffected.add(id);
        if (now - lastEnd >= WINDOW) {
          incidents.push({type:'spray',ip, time: rows[end].createdDateTime, start: rows[start].createdDateTime, users: [...counts.keys()], attempts: end-start+1, apps: [...new Set(rows.slice(start,end+1).map(e=>e.appDisplayName).filter(Boolean))]});
          lastEnd = now;
        } else {
          const incident = incidents.at(-1);
          incident.users = [...new Set([...incident.users, ...counts.keys()])];
          incident.time = rows[end].createdDateTime;
          incident.attempts++;
        }
      }
    }
  }
  // A distributed attack against one account is the inverse of password spray:
  // many source IPs target one identity. Include lockout (50053), because after
  // the password threshold is crossed Entra reports the subsequent attempts as locked.
  for(const user of byId.values()){
    const rows=user.events.filter(e=>!e.trustedIp&&[50053,50126].includes(Number(e.status?.errorCode))&&e.ipAddress).sort((a,b)=>Date.parse(a.createdDateTime)-Date.parse(b.createdDateTime));
    let start=0,best=null;
    for(let end=0;end<rows.length;end++){
      const now=Date.parse(rows[end].createdDateTime);
      while(start<=end&&now-Date.parse(rows[start].createdDateTime)>30*60000)start++;
      const window=rows.slice(start,end+1),ips=new Set(window.map(e=>e.ipAddress));
      if(window.length>=5&&ips.size>=5&&(!best||ips.size>best.ips.length||window.length>best.attempts))best={type:'account',userId:user.id,user:user.name,ip:null,ips:[...ips],users:[user.id],attempts:window.length,start:window[0].createdDateTime,time:window.at(-1).createdDateTime,apps:[...new Set(window.map(e=>e.appDisplayName).filter(Boolean))]};
    }
    if(best){accountAttacks.set(user.id,best);incidents.push(best);}
  }
    const trendMap = new Map();
  for (const e of events) {
    if (!e.createdDateTime) continue;
    const day = String(e.createdDateTime).substring(0, 10);
    if (!trendMap.has(day)) trendMap.set(day, { events: 0, incidents: 0, failures: 0 });
    trendMap.get(day).events++;
    if (typeof e.status?.errorCode === 'number' && e.status.errorCode !== 0 && !e.trustedIp) {
      trendMap.get(day).failures++;
    }
  }
  for (const inc of incidents) {
    if (!inc.time) continue;
    const day = String(inc.time).substring(0, 10);
    if (!trendMap.has(day)) trendMap.set(day, { events: 0, incidents: 0, failures: 0 });
    trendMap.get(day).incidents++;
  }
  const trend = [...trendMap.entries()].sort((a,b) => a[0].localeCompare(b[0])).map(x => ({ date: x[0], ...x[1] }));

  const users = [...byId.values()].map(u => {
    u.events.sort((a,b) => Date.parse(b.createdDateTime)-Date.parse(a.createdDateTime));
    const allFailures = u.events.filter(e => typeof e.status?.errorCode === 'number' && e.status.errorCode !== 0);
    const failures = allFailures.filter(e=>!e.trustedIp);
    const passwords = failures.filter(e => e.status.errorCode === 50126);
    const attackFailures=failures.filter(e=>[50053,50126].includes(e.status.errorCode));
    const lockouts=failures.filter(e=>e.status.errorCode===50053);
    const ips = new Set(attackFailures.map(e=>e.ipAddress).filter(Boolean));
    const countries = new Set(attackFailures.map(e=>e.location?.countryOrRegion).filter(Boolean));
    const suspiciousIps = new Set(incidents.filter(i=>i.users.includes(u.id)).flatMap(i=>i.ip?[i.ip]:(i.ips||[])));
    const follow = u.events.some(e => !e.trustedIp&&e.status?.errorCode === 0 && suspiciousIps.has(e.ipAddress) && passwords.some(f=>f.ipAddress===e.ipAddress && Date.parse(e.createdDateTime)>Date.parse(f.createdDateTime) && Date.parse(e.createdDateTime)-Date.parse(f.createdDateTime)<=3600000));
    
    let impossibleTravel = false;
    const successes = u.events.filter(e => e.status?.errorCode === 0 && e.location?.countryOrRegion && !e.trustedIp);
    for(let i=0; i<successes.length; i++) {
      for(let j=i+1; j<successes.length; j++) {
        const diff = Date.parse(successes[i].createdDateTime) - Date.parse(successes[j].createdDateTime);
        if (diff > 3600000) break;
        if (successes[i].location.countryOrRegion !== successes[j].location.countryOrRegion) {
          impossibleTravel = true;
          incidents.push({
            type: 'travel',
            userId: u.id,
            user: u.name,
            ip: successes[i].ipAddress,
            ips: [successes[j].ipAddress, successes[i].ipAddress],
            users: [u.id],
            attempts: 2,
            start: successes[j].createdDateTime,
            time: successes[i].createdDateTime,
            apps: [...new Set([successes[j].appDisplayName, successes[i].appDisplayName].filter(Boolean))],
            countries: [successes[j].location.countryOrRegion, successes[i].location.countryOrRegion]
          });
          break;
        }
      }
      if(impossibleTravel) break;
    }

    const reasons=[];
    if (sprayAffected.has(u.id)) reasons.push({points:45,text:'Aynı IP, 10 dakikada en az 5 hesabı hedefledi (password spray).'});
    if (accountAttacks.has(u.id)) reasons.push({points:50,text:'30 dakika içinde en az 5 farklı IP bu hesabı hedefledi (dağıtık hesap saldırısı).'});
    if (impossibleTravel) reasons.push({points:75,text:'İmkansız seyahat: 1 saat içinde 2 farklı ülkeden başarılı giriş yapıldı.'});
    if (attackFailures.length>=10) reasons.push({points:Math.min(25,10+Math.floor(Math.log10(attackFailures.length/10))*5),text:`${attackFailures.length} hatalı parola/kilitlenme olayı.`});
    if (ips.size>=3) reasons.push({points:ips.size>=25?30:ips.size>=10?20:10,text:`Saldırı hataları ${ips.size} farklı IP kaynaklı.`});
    if (lockouts.length>=5) reasons.push({points:15,text:`${lockouts.length} hesap kilitli (50053) olayı.`});
    if (countries.size>=3) reasons.push({points:10,text:`Saldırı hataları ${countries.size} farklı ülkeden.`});
    if (follow) reasons.push({points:100,text:'Çoklu başarısız denemeden sonra aynı şüpheli IP ile başarılı oturum açıldı; acil inceleyin.'});
    if ((sprayAffected.has(u.id)||accountAttacks.has(u.id)||impossibleTravel) && u.mfa===false) reasons.push({points:15,text:'Saldırı sinyali var ve kayıtlı MFA yöntemi yok.'});
    const attackSignal=sprayAffected.has(u.id)||accountAttacks.has(u.id)||impossibleTravel;
    if((sprayAffected.has(u.id)||accountAttacks.has(u.id))&&u.mfa===true&&!follow)reasons.push({points:0,text:'MFA yöntemi etkin; kaba kuvvet saldırısı parolayı aşmış sayılmaz, hesabı izleyin.'});
    const rawScore=Math.min(100,reasons.reduce((n,r)=>n+r.points,0));
    const score=(follow||impossibleTravel)?100:(sprayAffected.has(u.id)||accountAttacks.has(u.id))&&u.mfa===true?Math.min(49,rawScore):rawScore;
    const reviewState=(follow||impossibleTravel)?'critical':(sprayAffected.has(u.id)||accountAttacks.has(u.id))&&u.mfa===true?'control':score>=70?'urgent':score>0?'review':u.mfa===false?'mfa-missing':'normal';
    return {...u,score,rawScore,reviewState,reasons,fails:allFailures.length,trustedFailures:allFailures.length-failures.length,passwordFails:passwords.length,attackFails:attackFailures.length,lockouts:lockouts.length,ips:ips.size,countries:countries.size,successes:u.events.filter(e=>e.status?.errorCode===0).length, events:u.events.slice(0,100),eventCount:u.events.length};
  }).sort((a,b)=>b.score-a.score || a.name.localeCompare(b.name));
  return {users,incidents:incidents.sort((a,b)=>b.time.localeCompare(a.time)), trend, metrics:{users:users.length,usersEnabled:users.filter(u=>u.enabled!==false).length,usersDisabled:users.filter(u=>u.enabled===false).length,mfaRegistered:users.filter(u=>u.mfa===true).length,mfaMissing:users.filter(u=>u.mfa===false).length,mfaUnknown:users.filter(u=>u.mfa===null).length,priority:users.filter(u=>u.score>=50).length,control:users.filter(u=>u.reviewState==='control').length,events:events.length,incidents:incidents.length}};
}

