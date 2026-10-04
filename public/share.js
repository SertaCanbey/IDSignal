const put=(id,text)=>{document.getElementById(id).textContent=text;};
const date=value=>value?new Date(value).toLocaleString('tr-TR'):'Henüz yok';
async function refresh(){
  try{
    const response=await fetch('/api/summary');if(!response.ok)throw Error();const data=await response.json();
    for(const key of ['users','events','incidents','priority'])put(key,Number(data[key]).toLocaleString('tr-TR'));
    put('source',data.mode==='m365'?'Microsoft 365 Audit API':data.mode==='free'?'Dosya / portal aktarımı':'Microsoft Graph');
    put('status',{ready:'Veri toplama çalışıyor. Son alınan veriler gösteriliyor.',waiting:'API aboneliği etkin. Microsoft’un ilk veri paketleri bekleniyor.',error:'Son veri toplama tamamlanamadı. Yönetici panelinden kontrol gerekiyor.',pending:'İlk başarılı veri toplama bekleniyor.'}[data.status]);
    put('last',date(data.lastSuccess));put('attempt',date(data.lastAttempt));put('interval',data.intervalMinutes?data.intervalMinutes+' dakika':'Otomatik toplama kapalı');put('updated','Ekran güncellendi: '+date(data.generatedAt));
  }catch{put('status','Sunucuya ulaşılamıyor. Görünen bilgiler güncel olmayabilir; otomatik yeniden denenecek.');}
}
refresh();setInterval(refresh,30000);
