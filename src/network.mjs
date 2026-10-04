import {BlockList,isIP} from 'node:net';

export function normalizeIp(value){
  let ip=String(value||'').trim();
  if(ip.startsWith('[')){const end=ip.indexOf(']');if(end>0)ip=ip.slice(1,end);}
  else if(/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(ip))ip=ip.slice(0,ip.lastIndexOf(':'));
  if(ip.toLowerCase().startsWith('::ffff:')&&isIP(ip.slice(7))===4)ip=ip.slice(7);
  return isIP(ip)?ip:'';
}

export function parseSafeIps(value){
  const rows=(Array.isArray(value)?value:String(value||'').split(/[\s,;]+/)).map(v=>String(v).trim()).filter(Boolean);
  if(rows.length>200)throw new Error('Güvenli IP listesi en fazla 200 adres veya ağ içerebilir.');
  const unique=[];
  for(const row of rows){
    const [address,prefix,...extra]=row.split('/'),family=isIP(address);
    if(extra.length||!family)throw new Error(`Geçersiz güvenli IP veya CIDR: ${row}`);
    if(prefix!==undefined&&(!/^\d+$/.test(prefix)||Number(prefix)<0||Number(prefix)>(family===4?32:128)))throw new Error(`Geçersiz güvenli IP ağı: ${row}`);
    const normalized=prefix===undefined?address:`${address}/${Number(prefix)}`;
    if(!unique.includes(normalized))unique.push(normalized);
  }
  return unique;
}

export function safeIpMatcher(entries=[]){
  const block=new BlockList();
  for(const row of parseSafeIps(entries)){
    const [address,prefix]=row.split('/'),family=isIP(address),type=family===4?'ipv4':'ipv6';
    if(prefix===undefined)block.addAddress(address,type);else block.addSubnet(address,Number(prefix),type);
  }
  return value=>{const ip=normalizeIp(value);return !!ip&&block.check(ip,isIP(ip)===4?'ipv4':'ipv6');};
}

export function isPrivateIp(value){
  const ip=normalizeIp(value);if(!ip)return false;
  const block=new BlockList();
  for(const [address,prefix,type] of [['10.0.0.0',8,'ipv4'],['172.16.0.0',12,'ipv4'],['192.168.0.0',16,'ipv4'],['127.0.0.0',8,'ipv4'],['169.254.0.0',16,'ipv4'],['0.0.0.0',8,'ipv4'],['::1',128,'ipv6'],['fc00::',7,'ipv6'],['fe80::',10,'ipv6']])block.addSubnet(address,prefix,type);
  return block.check(ip,isIP(ip)===4?'ipv4':'ipv6');
}
