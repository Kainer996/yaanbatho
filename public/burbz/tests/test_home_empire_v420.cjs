const {test}=require('node:test'),assert=require('node:assert/strict'),C=require('../scan_home_core.js');
test('holding status follows care and actual appointment, with accessible reasons and owned building opportunities',()=>{
 const cases=[{id:'one',name:'Well',assigned:true,need:{id:'well',label:'All is well'},target:{kind:'village',seed:1},wards:[1]},{id:'two',name:'Vacant',assigned:false,need:{id:'merge',label:'Ready to merge'},target:{kind:'town',id:'two'}},{id:'three',name:'Hungry',assigned:true,need:{id:'unhappy',label:'Unhappy'},target:{kind:'region',id:'three'}}];
 const input={villages:cases},before=JSON.stringify(input);const columns=C.empireColumns(input,[{seed:1,name:'Kitchen'}]);assert.equal(columns.length,3);assert.deepEqual(columns[0].rows.map(r=>r.tone),['good','bad','bad']);assert.deepEqual(columns[0].rows.map(r=>r.status),['All is well','No governor','Unhappy']);assert.equal(columns[0].rows[0].buildCount,1);assert.equal(columns[0].rows[1].buildCount,0);assert.equal(JSON.stringify(input),before);assert.equal(columns[1].rows.length,0);
});
test('locked empire never exposes holdings; malformed or empty data produces three honest empty columns',()=>{
 const input={gates:{village:false},empireDesk:{villages:[{id:'one',name:'A',target:{kind:'village',seed:1}}]}};assert(C.derive(input).empire.every(c=>c.rows.length===0));assert(C.empireColumns({villages:[null,{},'bad']}).every(c=>c.rows.length===0));
});
