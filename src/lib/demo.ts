import type { WasteDashboard, WasteTrip } from './waste';
const DAY = 86400000;
const carriers = ['Перевозчик Альфа', 'Перевозчик Бета', 'Перевозчик Гамма', 'Перевозчик Дельта', 'Перевозчик Эпсилон', 'Перевозчик Зета'];
const origins = ['Объект Северный', 'Объект Южный', 'Объект Западный', 'Объект Восточный', 'Объект Центральный', 'Объект Новый'];
const wasteTypes = [{code:'31400000000',name:'Грунт'}, {code:'82200000000',name:'Бетон и железобетон'}, {code:'83000000000',name:'Кирпичный бой'}, {code:'82400000000',name:'Асфальт'}, {code:'89000000000',name:'Смешанные отходы'}];
const statuses = ['Завершен', 'Перевозка', 'Подача', 'Отменен'];
const rows: WasteTrip[] = Array.from({length:2400}, (_,i) => ({
 tripNo:`ДЕМО-${10001+i}`, submittedAt:`2026-10-${String(i%30+1).padStart(2,'0')}T${String(7+i%14).padStart(2,'0')}:30:00`,
 status: statuses[i%10<7?0:i%3+1], vehicle:`ДЕМО ${100+i%83}`, driver:`Водитель ${i%83+1}`,
 originObject:origins[i%6], originName:origins[i%6], destinationObject:`Площадка ${i%8+1}`, destinationName:`Площадка ${i%8+1}`,
 carrier:carriers[i%6], maxMass:25, cargoMass:12+i%13, cargoMassRaw:String(12+i%13), wasteCode:wasteTypes[i%5].code, wasteType:wasteTypes[i%5].name,
}));
const metric = (value:number) => ({value,previous:value,changePct:0});
export async function demoFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
 if(init?.signal?.aborted) throw new DOMException('Aborted','AbortError');
 const url = new URL(String(input), 'https://demo.local');
 const body = init?.body ? JSON.parse(String(init.body)) : {};
 const period = body.period || {from:url.searchParams.get('from') || '2026-10-01',to:url.searchParams.get('to') || '2026-10-30'};
 const f = body.filters || Object.fromEntries(['carriers','origins','wasteCodes'].map(k=>[k,url.searchParams.getAll(k)]));
 const filtered = rows.filter(r=>r.submittedAt.slice(0,10)>=period.from && r.submittedAt.slice(0,10)<=period.to && (!f.carriers?.length || f.carriers.includes(r.carrier)) && (!f.origins?.length || f.origins.includes(r.originName)) && (!f.wasteCodes?.length || f.wasteCodes.includes(r.wasteCode)));
 let data:unknown;
 if(url.pathname.endsWith('/filters')) data={availablePeriod:{from:'2026-10-01',to:'2026-10-30'},carriers,origins,wasteTypes};
 else if(url.pathname.endsWith('/trips')) {
 const page=body.page||1, pageSize=body.pageSize||25;
 data={page,pageSize,total:filtered.length,totalPages:Math.ceil(filtered.length/pageSize),rows:filtered.slice((page-1)*pageSize,page*pageSize)};
 } else {
 const completed=filtered.filter(r=>r.status==='Завершен');
 const mass=completed.reduce((s,r)=>s+r.cargoMass!,0);
 const rank=(key:'carrier'|'originName'|'destinationName')=>[...new Set(filtered.map(r=>r[key]!))].map(name=>{const subset=filtered.filter(r=>r[key]===name);return {name,trips:subset.length,mass:subset.filter(r=>r.status==='Завершен').reduce((s,r)=>s+r.cargoMass!,0),vehicles:new Set(subset.map(r=>r.vehicle)).size};}).sort((a,b)=>b.trips-a.trips);
 const start=Date.parse(period.from),end=Date.parse(period.to);
 const buckets=Array.from({length:Math.max(0,Math.min(744,Math.round((end-start)/DAY)+1))},(_,i)=>new Date(start+i*DAY).toISOString().slice(0,10));
 const trend=buckets.flatMap(day=>body.granularity==='hour'?Array.from({length:24},(_,h)=>`${day}T${String(h).padStart(2,'0')}:00:00`):[day]);
 const subset=(bucket:string)=>filtered.filter(r=>body.granularity==='hour'?r.submittedAt.slice(0,13)===bucket.slice(0,13):r.submittedAt.slice(0,10)===bucket);
 const avg=completed.length?mass/completed.length:0;
 const trends=Object.fromEntries(['averageMass','tripsPerVehicle','wasteTop5Share','receptionTop5Share','originTop5Share','carrierTop5Share'].map(key=>[key,buckets.map(day=>({day,value:key==='averageMass'?avg:key==='tripsPerVehicle'?3:85}))])) as WasteDashboard['analytics']['trends'];
 data={period,comparisonPeriod:period,dataThrough:'2026-10-30T21:30:00',metrics:{trips:metric(filtered.length),completedShare:{...metric(filtered.length?completed.length/filtered.length*100:0),changePp:0,completedTrips:completed.length,totalTrips:filtered.length},receptionSites:metric(rank('destinationName').length),carriers:metric(rank('carrier').length),originSites:metric(rank('originName').length),vehicles:metric(new Set(filtered.map(r=>r.vehicle)).size),mass:{...metric(mass),unit:'t',completedTrips:completed.length,knownMassTrips:completed.length,coveragePct:100}},
 statusStructure:statuses.map(status=>{const n=filtered.filter(r=>r.status===status).length;return {status,...metric(n),sharePct:filtered.length?n/filtered.length*100:0};}),
 wasteStructure:wasteTypes.map(w=>{const items=completed.filter(r=>r.wasteCode===w.code),tons=items.reduce((s,r)=>s+r.cargoMass!,0);return {...w,tons,trips:items.length,sharePct:mass?tons/mass*100:0};}),
 trends:{trips:trend.map(bucket=>({bucket,value:subset(bucket).length})),mass:trend.map(bucket=>{const items=subset(bucket).filter(r=>r.status==='Завершен');return {bucket,value:items.reduce((s,r)=>s+r.cargoMass!,0),completedTrips:items.length,knownMassTrips:items.length,coveragePct:100};})},
 analytics:{metrics:{averageMass:metric(avg),tripsPerVehicle:metric(3),wasteTop5Share:metric(100),receptionTop5Share:metric(65),originTop5Share:metric(85),carrierTop5Share:metric(85)},rankings:{carriers:rank('carrier'),origins:rank('originName'),receptions:rank('destinationName')},intensity:buckets.flatMap(day=>Array.from({length:24},(_,hour)=>({day,hour,trips:filtered.filter(r=>r.submittedAt.startsWith(`${day}T${String(hour).padStart(2,'0')}`)).length}))),carrierEfficiency:rank('carrier'),carrierEfficiencyAverage:null,carrierEfficiencyTopAverage:null,trends}} satisfies WasteDashboard;
 }
 return new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json'}});
}
