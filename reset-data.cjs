const fs=require('fs'),path=require('path');
const data=path.join(__dirname,'data'),sets=path.join(data,'datasets');
if(!fs.existsSync(sets))fs.mkdirSync(sets,{recursive:true});
for(const f of fs.readdirSync(sets))if(f.endsWith('.json'))fs.unlinkSync(path.join(sets,f));
fs.writeFileSync(path.join(data,'db.json'),JSON.stringify({
 version:'25.0.0',
 users:[{id:'admin',email:'admin@forexia.local',password:'admin123',role:'admin'}],
 datasets:[],backtests:[],mt5Status:[],
 importConfig:{mode:'quick',years:1,maxBarsByTimeframe:{M1:300000,M5:200000,M15:120000,H1:60000,D1:10000},allowFullImport:false}
},null,2));
console.log('Banco limpo.');
