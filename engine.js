'use strict';
// Rules engine: no DOM, network, or dependencies. Card IDs remain unique.
(function(root){
const CARDS=[
 ['伸爪飛撲！','攻擊','距離內造成 1 傷害；一般每回合限 1 張。',6],
 ['鑽進騎樓！','防禦','受到出爪或混戰時使用，抵銷攻擊。',4],
 ['碳烤臭豆腐','補給','回復 1 生命，也能在自己瀕死時自救。',2],
 ['臭豆腐長鐵夾','裝備','武器：出爪不限次，範圍 1。',1,'weapon'],
 ['竹節遠程彈弓','裝備','武器：攻擊範圍 3。',1,'weapon'],
 ['老街瓦頂眺望','裝備','你看對手的距離 −1。',1,'view'],
 ['廟口石獅護體','裝備','對手看你的距離 +1。',1,'lion'],
 ['老街水溝暗道','裝備','被出爪時可判定，紅框牌抵銷攻擊。',1,'tunnel'],
 ['深坑巡守反光背心','裝備','自動抵銷首次致死傷害，保留 1 HP。',1,'vest'],
 ['廟埕大混戰！','事件','其他人依序出 1 張騎樓，否則受傷 1。',2],
 ['觀光客掉落豆腐','事件','抽 2 張牌。',1],
 ['流水席辦桌開席','事件','所有存活玩家回復 1 生命。',1],
 ['野貓神偷順爪','事件','距離 1：隨機偷 1 手牌，或選取 1 裝備。',1],
 ['深坑土狗狂吠','事件','不限距離：隨機棄 1 手牌，或選棄 1 裝備。',1]
].map((a,i)=>({type:i,name:a[0],category:a[1],text:a[2],count:a[3],slot:a[4],red:[0,9,12,13].includes(i)}));
const CHARS=[
 ['集順廟飛簷貓','輕功爪','自己回合第一次出爪須用 2 張騎樓閃避。'],
 ['亭子腳阿橘','熟門熟路','其他人看你的距離 +1。'],
 ['豆腐街大黃狗','食吃本色','使用臭豆腐回血後，額外抽 1 張。'],
 ['水溝蓋花子精','暗溝搜刮','摸牌時可隨機偷一位對手的 1 裝備，代替抽 1 張。'],
 ['渡船頭狂吠犬','連環狂吠','自己回合出爪次數無上限。'],
 ['茄苳樹夜行貓','高處視野','看對手距離 −1；摸牌看頂 3 張選 2 張。'],
 ['油條攤老獵犬','死鬥警覺','其他人真正進入瀕死時，立即抽 2 張。']
];
const ROLES={guard:['老街巡守犬','消滅所有野貓與黑鼠，自己存活。'],loyal:['看門忠犬','守護巡守犬；犬陣營獲勝時自己也要存活。'],cat:['屋頂野貓','擊倒巡守犬；黑鼠最後單挑成功除外。'],rat:['下水道黑鼠','其他人先出局，最後與巡守犬單挑並親手擊倒牠。']};
class Game{
 constructor(options={},choose=async(p,t,opts)=>opts[0].value,notify=()=>{}){
 this.choose=choose;this.notify=notify;this.rng=options.rng||Math.random;
 const roles=this.shuffle(options.count===4?['guard','cat','cat','rat']:['guard','loyal','cat','cat','rat']);
 const chars=this.shuffle([0,1,2,3,4,5,6]);
 this.s={version:1,mode:options.mode||'solo',abilities:options.abilities!==false,players:roles.map((role,i)=>({id:i,name:`玩家 ${i+1}`,role,char:chars[i],hp:role==='guard'?5:4,max:role==='guard'?5:4,alive:true,hand:[],equip:{},suspicion:0})),deck:[],discard:[],resolving:[],turn:0,round:0,attacks:0,phase:'draw',logs:[],over:null,shuffles:0};
 let id=0;for(const c of CARDS)for(let n=0;n<c.count;n++)this.s.deck.push({id:id++,type:c.type});
 this.s.deck=this.shuffle(this.s.deck);this.s.turn=this.s.players.findIndex(p=>p.role==='guard');
 for(let offset=0;offset<roles.length;offset++){let p=this.s.players[(this.s.turn+offset)%roles.length];this.draw(p,p.max);}
 this.log('老街入夜，巡守犬公開身分。其餘身分保密，角色全部公開。');
 }
 shuffle(a){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(this.rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
 get current(){return this.s.players[this.s.turn];}
 alive(){return this.s.players.filter(p=>p.alive);}
 ability(p,n){return this.s.abilities&&p.char===n;}
 log(t){this.s.logs.push(t);this.s.logs=this.s.logs.slice(-100);this.notify(this.s);}
 take(){if(!this.s.deck.length&&this.s.discard.length){this.s.deck=this.shuffle(this.s.discard);this.s.discard=[];this.s.shuffles++;this.log('牌庫用盡，重洗棄牌堆。');}return this.s.deck.pop();}
 draw(p,n){if(!p.alive)return;for(let i=0;i<n;i++){const c=this.take();if(c)p.hand.push(c);}}
 distance(a,b){const alive=this.alive(),d=Math.abs(alive.indexOf(a)-alive.indexOf(b));return Math.max(1,Math.min(d,alive.length-d)+(this.ability(b,1)?1:0)+(b.equip.lion?1:0)-(this.ability(a,5)?1:0)-(a.equip.view?1:0));}
 range(p){return p.equip.weapon?.type===4?3:1;}
 targets(p,type){return this.alive().filter(q=>q!==p&&(type!==0||this.distance(p,q)<=this.range(p))&&(type!==12||this.distance(p,q)<=1)&&(![12,13].includes(type)||q.hand.length+Object.keys(q.equip).length>0));}
 reason(p,c){if(this.s.over)return '本局已結束';if(p!==this.current||!p.alive||this.s.phase!=='play')return '等待你的出牌階段';if(c.type===1)return '受到攻擊時才能使用';if(c.type===2&&p.hp===p.max)return '目前生命已滿';if(c.type===11&&!this.alive().some(q=>q.hp<q.max))return '所有人生命已滿';if(c.type===0&&this.s.attacks>=1&&!this.ability(p,4)&&p.equip.weapon?.type!==3)return '本回合已出爪';if([0,12,13].includes(c.type)&&!this.targets(p,c.type).length)return '沒有合法目標';return '';}
 async ask(p,title,opts){if(!opts.length)throw Error('Empty choice');const v=await this.choose(p,title,opts);return opts.some(o=>o.value===v)?v:opts[0].value;}
 async begin(){if(this.s.over||this.s.phase!=='draw')return;let p=this.current;this.s.round++;this.s.attacks=0;this.log(`第 ${this.s.round} 回合：${p.name} 摸牌。`);
 if(this.ability(p,5)){let pool=[];for(let i=0;i<3;i++){const c=this.take();if(c)pool.push(c);}let picked=0;while(pool.length&&picked<2){const id=await this.ask(p,'高處視野：選一張加入手牌',pool.map(c=>({value:c.id,label:CARDS[c.type].name,card:c.type})));p.hand.push(pool.splice(pool.findIndex(c=>c.id===id),1)[0]);picked++;if(picked===2)break;}while(pool.length)this.s.deck.unshift(pool.pop());
 }else if(this.ability(p,3)){const targets=this.alive().filter(q=>q!==p&&Object.keys(q.equip).length);let target=targets.length?await this.ask(p,'暗溝搜刮：偷裝備代替抽一張？',[...targets.map(q=>({value:q.id,label:`偷 ${q.name} 的隨機裝備`})),{value:-1,label:'正常抽 2 張'}]):-1;if(target!==-1){let q=this.s.players[target],keys=Object.keys(q.equip),slot=keys[Math.floor(this.rng()*keys.length)];p.hand.push(q.equip[slot]);delete q.equip[slot];this.log(`${p.name} 搜刮了 ${q.name} 的一件裝備。`);this.draw(p,1);}else this.draw(p,2);
 }else this.draw(p,2);
 this.s.phase='play';this.notify(this.s);
 
 }
 async play(id,targetId){const p=this.current,c=p.hand.find(c=>c.id===id);if(!c||this.reason(p,c))return false;const type=c.type;let q;
 if([0,12,13].includes(type)){q=this.s.players[targetId];if(!this.targets(p,type).includes(q))return false;}
 p.hand.splice(p.hand.indexOf(c),1);this.s.resolving.push(c);this.log(`${p.name} 打出「${CARDS[type].name}」${q?' → '+q.name:''}。`);
 if(CARDS[type].slot){let slot=CARDS[type].slot;if(p.equip[slot])this.s.discard.push(p.equip[slot]);p.equip[slot]=c;}
 else if(type===0){this.s.attacks++;if(q.role==='guard')p.suspicion+=2;await this.attack(p,q,this.ability(p,0)&&this.s.attacks===1?2:1,true);}
 else if(type===2){p.hp=Math.min(p.max,p.hp+1);if(this.ability(p,2))this.draw(p,1);}
 else if(type===9){for(let k=1;k<this.s.players.length;k++){q=this.s.players[(p.id+k)%this.s.players.length];if(q.alive)await this.attack(p,q,1,false);if(this.s.over)break;}}
 else if(type===10)this.draw(p,2);
 else if(type===11){for(const a of this.alive())a.hp=Math.min(a.max,a.hp+1);}
 else if(type===12||type===13){let opts=Object.keys(q.equip).map(slot=>({value:slot,label:CARDS[q.equip[slot].type].name,card:q.equip[slot].type}));if(q.hand.length)opts.unshift({value:'hand',label:'隨機手牌（不公開）'});let zone=await this.ask(p,type===12?'選擇偷取區域':'選擇棄置區域',opts);let taken;if(zone==='hand')taken=q.hand.splice(Math.floor(this.rng()*q.hand.length),1)[0];else{taken=q.equip[zone];delete q.equip[zone];}if(type===12)p.hand.push(taken);else this.s.discard.push(taken);this.log(`${q.name} 的${zone==='hand'?'一張手牌':CARDS[taken.type].name}被${type===12?'偷取':'棄置'}。`);}
 this.s.resolving=this.s.resolving.filter(x=>x!==c);if(!CARDS[type].slot)this.s.discard.push(c);this.notify(this.s);return true;
 }
 async attack(a,b,need,tunnel){if(tunnel&&b.equip.tunnel){const yes=await this.ask(b,'使用水溝暗道判定？',[{value:true,label:'翻牌判定'},{value:false,label:'略過暗道'}]);if(yes){const flip=this.take();if(flip){this.s.discard.push(flip);this.log(`${b.name} 暗道翻到「${CARDS[flip.type].name}」：${CARDS[flip.type].red?'閃避成功':'非紅框牌'}。`);if(CARDS[flip.type].red)return;}}}
 const dodges=b.hand.filter(c=>c.type===1);if(dodges.length>=need){const yes=await this.ask(b,`${a.name} 攻擊：使用 ${need} 張騎樓閃避？`,[{value:true,label:`使用 ${need} 張騎樓`},{value:false,label:'保留手牌，承受傷害'}]);if(yes){for(const c of dodges.slice(0,need)){b.hand.splice(b.hand.indexOf(c),1);this.s.discard.push(c);}this.log(`${b.name} 鑽進騎樓，閃避成功。`);return;}}
 await this.damage(a,b);
 }
 async damage(a,b){if(b.hp===1&&b.equip.vest){this.s.discard.push(b.equip.vest);delete b.equip.vest;this.log(`${b.name} 的反光背心抵銷致死傷害。`);return;}
 b.hp--;this.log(`${b.name} 受到 1 點傷害，剩餘 ${b.hp} HP。`);if(b.hp>0)return;
 for(const q of this.alive())if(q!==b&&this.ability(q,6)){this.draw(q,2);this.log(`${q.name} 觸發死鬥警覺，抽 2 張。`);}
 const tofu=b.hand.find(c=>c.type===2);if(tofu&&await this.ask(b,'瀕死！使用臭豆腐自救？',[{value:true,label:'吃豆腐，回到 1 HP'},{value:false,label:'放棄自救，出局'}])){b.hand.splice(b.hand.indexOf(tofu),1);this.s.discard.push(tofu);b.hp=1;if(this.ability(b,2))this.draw(b,1);this.log(`${b.name} 吃臭豆腐自救成功。`);return;}
 const duel=this.alive().length===2&&a.role==='rat'&&b.role==='guard';b.alive=false;this.s.discard.push(...b.hand,...Object.values(b.equip));b.hand=[];b.equip={};this.log(`${b.name} 出局，身分是「${ROLES[b.role][0]}」。`);
 if(b.role==='cat'){this.draw(a,3);this.log(`${a.name} 擊倒野貓，獎勵抽 3 張。`);}if(a.role==='guard'&&b.role==='loyal'){this.s.discard.push(...a.hand,...Object.values(a.equip));a.hand=[];a.equip={};this.log('巡守犬誤殺忠犬，棄掉所有手牌與裝備。');}
 const guard=this.s.players.find(p=>p.role==='guard');if(!guard.alive)this.s.over=duel?'rat':'cat';else if(!this.alive().some(p=>p.role==='cat'||p.role==='rat'))this.s.over='dog';if(this.s.over){this.s.phase='over';this.log(`遊戲結束：${{rat:'黑鼠',cat:'野貓陣營',dog:'犬陣營'}[this.s.over]}獲勝！`);}
 }
 async end(){if(this.s.over||this.s.phase!=='play')return;const p=this.current;this.s.phase='discard';while(p.hand.length>p.hp){let id=await this.ask(p,`棄牌：還須棄 ${p.hand.length-p.hp} 張（上限 ${p.hp}）`,p.hand.map(c=>({value:c.id,label:CARDS[c.type].name,card:c.type})));let c=p.hand.splice(p.hand.findIndex(c=>c.id===id),1)[0];this.s.discard.push(c);this.log(`${p.name} 棄置「${CARDS[c.type].name}」。`);}do{this.s.turn=(this.s.turn+1)%this.s.players.length;}while(!this.current.alive);this.s.phase='draw';this.notify(this.s);}
 winners(){return this.s.players.filter(p=>this.s.over==='cat'?p.role==='cat':this.s.over==='rat'?p.role==='rat':this.s.over==='dog'&&p.alive&&['guard','loyal'].includes(p.role));}
}
const api={Game,CARDS,CHARS,ROLES};if(typeof module!=='undefined')module.exports=api;root.StreetKings=api;
})(typeof window!=='undefined'?window:globalThis);

