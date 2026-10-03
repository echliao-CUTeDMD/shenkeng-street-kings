'use strict';
const {Game,CARDS,CHARS,ROLES}=StreetKings;
const $=s=>document.querySelector(s),el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
const SAVE='shenkeng-street-kings-v1';let game=null,busy=false,selected=null,viewPlayer=-1,privateVisible=false,pumpRunning=false,resultShown=false;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
// Use original sheets as CSS sprites; no external fonts or services required.
function sprite(node,kind,index){let sheet,rect;
 if(kind==='card'){sheet=[1536,1024];const x=[18,323,628,933,1238],y=[80,393,710];rect=[x[index%5],y[Math.floor(index/5)],294,298];}
 else if(kind==='char'){sheet=[1536,1024];const points=[[47,126],[425,126],[789,126],[1156,126],[187,604],[581,604],[1000,604]];rect=[...points[index],323,204];}
 else {sheet=[1774,887];rect=[14+index*352,105,346,710];}
 const [x,y,w,h]=rect;node.style.backgroundSize=`${sheet[0]/w*100}% ${sheet[1]/h*100}%`;node.style.backgroundPosition=`${x/(sheet[0]-w)*100}% ${y/(sheet[1]-h)*100}%`;return node;
}
function toast(t){$('#toast').textContent=t;$('#toast').style.display='block';clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').style.display='none',3500);}
function human(p){return game.s.mode==='local'||p.id===0;}
function currentViewer(){return privateVisible?game.s.players[viewPlayer]:null;}
function save(){if(!game||game.s.resolving.length||!['draw','play','over'].includes(game.s.phase))return;try{localStorage.setItem(SAVE,JSON.stringify(game.s));$('#saveStatus').textContent='已自動儲存 · 重新開啟網頁後可繼續上次對局。';}catch{$('#saveStatus').textContent='瀏覽器未允許儲存；請保持此頁開啟。';}}
function openModal(title,content){$('#modalTitle').textContent=title;$('#modalBody').replaceChildren(content);if(!$('#modal').open)$('#modal').showModal();}
function button(text,fn,cls){const b=el('button',cls,text);b.type='button';b.onclick=fn;return b;}
async function gate(p,message='請把裝置交給這位玩家，再查看私密資訊。'){
 privateVisible=false;viewPlayer=-1;render();$('#curtainTitle').textContent=`請交給 ${p.name}`;$('#curtainText').textContent=message;$('#curtain').showModal();await new Promise(resolve=>$('#revealBtn').onclick=()=>{$('#curtain').close();viewPlayer=p.id;privateVisible=true;render();resolve();});
}
function botChoice(p,title,options){
 if(title.startsWith('棄牌'))return [...options].sort((a,b)=>cardValue(a.card,p)-cardValue(b.card,p))[0].value;
 if(title.startsWith('高處視野'))return [...options].sort((a,b)=>cardValue(b.card,p)-cardValue(a.card,p))[0].value;
 if(title.startsWith('暗溝搜刮')){const target=options.find(o=>o.value!==-1&&game.s.players[o.value].role!=='guard');return (target||options[options.length-1]).value;}
 if(title.startsWith('選擇'))return (options.find(o=>o.value==='weapon'||o.value==='vest')||options[0]).value;
 return options[0].value;
}
async function choose(p,title,options){
 if(!human(p))return botChoice(p,title,options);
 if(game.s.mode==='local'&&viewPlayer!==p.id)await gate(p,'你需要回應卡牌效果。請讓其他玩家暫時移開視線。');
 if(game.s.mode==='solo'){viewPlayer=0;privateVisible=true;}
 render();$('#choiceTitle').textContent=title;$('#choiceWho').textContent=`${p.name} · ${ROLES[p.role][0]} · ${p.hp} / ${p.max} HP`;
 $('#choiceOptions').replaceChildren();const answer=new Promise(resolve=>{for(const o of options){const b=button(o.card===undefined?o.label:'',()=>{$('#choice').close();resolve(o.value);});if(o.card!==undefined){b.append(sprite(el('div','card-art'),'card',o.card),el('span','',o.label));}$('#choiceOptions').append(b);}});$('#choice').showModal();return answer;
}
function cardValue(t,p){if(t===2)return p.hp<3?10:8;if(t===1)return 7;if(t===0)return 6;if(t===4)return 9;if(t===8)return 8;if(CARDS[t]?.slot)return p.equip[CARDS[t].slot]?2:7;return 5;}
function enemyScore(p,q){const guard=q.role==='guard';if(p.role==='cat')return guard?100:10+q.suspicion*-2;if(p.role==='loyal')return guard?-100:30+q.suspicion*15;if(p.role==='rat')return guard?(game.alive().length===2?100:-50):50-q.hp;if(p.role==='guard')return 25+q.suspicion*20-q.hp;return 0;}
function botAction(){let p=game.current;let cards=p.hand.filter(c=>!game.reason(p,c));let scored=cards.map(c=>{let score=cardValue(c.type,p),target;
 if(CARDS[c.type].slot&&p.equip[CARDS[c.type].slot]?.type===c.type)score=-1;
 if([0,12,13].includes(c.type)){let qs=game.targets(p,c.type).sort((a,b)=>enemyScore(p,b)-enemyScore(p,a));target=qs[0];if(!target||enemyScore(p,target)<0)score=-1;else score+=enemyScore(p,target)/20;}
 if(c.type===9&&['loyal','rat'].includes(p.role)&&game.alive().length>2){let guard=game.s.players.find(q=>q.role==='guard');if(guard.hp<=2)score=-1;}
 if(c.type===11&&p.hp===p.max)score=-1;
 return{c,score,target};}).filter(x=>x.score>=0).sort((a,b)=>b.score-a.score);return scored[0];}
function render(){if(!game)return;const s=game.s,p=game.current,viewer=currentViewer(),canPlay=!busy&&human(p)&&viewer===p&&s.phase==='play'&&!s.over;
 $('#roundTag').textContent=`${s.players.length} 人局 · ${s.abilities?'角色能力開啟':'基礎規則'}`;
 $('#turnTitle').textContent=s.over?'今晚，勝負已定。':`第 ${s.round||1} 回合 · ${p.name}`;
 $('#phase').textContent=s.over?'對局結束':busy?'卡牌效果結算中':s.phase==='play'?'② 出牌階段':s.phase==='discard'?'③ 棄牌階段':'① 摸牌階段';
 $('#deckCount').textContent=`牌庫 ${s.deck.length} · 棄牌 ${s.discard.length} · 重洗 ${s.shuffles} 次`;
 $('#players').replaceChildren();for(const q of s.players){let targetable=canPlay&&selected&&game.targets(p,selected.type).includes(q);const b=button('',()=>{if(targetable)perform(selected.id,q.id);else inspectPlayer(q);},`player ${q===p?'active':''} ${q.alive?'':'dead'} ${targetable?'targetable':''}`);b.setAttribute('aria-label',`${q.name}，${q.hp} 生命${targetable?'，選為目標':''}`);b.append(sprite(el('div','portrait'),'char',q.char),el('div','player-name',`${q.name}${q.id===0&&s.mode==='solo'?' · 你':''}${!q.alive?' · 出局':''}`));b.append(el('div','player-role',q.role==='guard'||!q.alive||s.over?ROLES[q.role][0]:'身分未公開'));
 const hp=el('div','health','♥'.repeat(Math.max(q.hp,0))+'♡'.repeat(q.max-Math.max(q.hp,0)));hp.append(el('small','',` ${q.hp}/${q.max}`));b.append(hp,el('div','player-char',CHARS[q.char][0]),el('div','distance',`手牌 ${q.hand.length}${q!==p&&q.alive&&p.alive?' · 距離 '+game.distance(p,q):''}`));const equipment=el('div','equipment');for(const [k,c]of Object.entries(q.equip))equipment.append(el('span','',({weapon:'武器',view:'眺望',lion:'石獅',tunnel:'暗道',vest:'背心'})[k]));b.append(equipment);$('#players').append(b);}
 $('#tableMessage').textContent=s.over?`${{dog:'犬陣營',cat:'野貓陣營',rat:'下水道黑鼠'}[s.over]}獲勝`:selected?CARDS[selected.type].name:busy?'老街風聲，正在變化。':'每張牌，都有下一步。';
 $('#tableHint').textContent=selected?'點選亮框玩家作為目標。':s.mode==='solo'&&!human(p)?'電腦正在思考與出牌。':'點選手牌出牌；點選玩家查看公開資訊。';
 $('#actionBar').replaceChildren();if(selected){$('#actionBar').append(el('span','',CARDS[selected.type].text),button('取消選牌',()=>{selected=null;render();}));}else $('#actionBar').append(el('span','',s.over?'所有身分已公開。':`攻擊範圍 ${game.range(p)} · 本回合已出爪 ${s.attacks} 次 · 出局會重新計算距離`));
 $('#logs').replaceChildren(...[...s.logs].reverse().map(t=>el('li','',t)));
 $('#hand').replaceChildren();if(viewer&&viewer.alive){$('#handTitle').textContent=`${viewer.name} 的手牌 · ${viewer.hand.length} 張`;$('#identityLabel').textContent=`秘密身分 · ${ROLES[viewer.role][0]}`;$('#mission').textContent=ROLES[viewer.role][1];for(const c of viewer.hand){const reason=game.reason(viewer,c),b=button('',()=>{if(!canPlay){toast('請等待你的出牌階段。');return;}if(reason){toast(reason);return;}if([0,12,13].includes(c.type)){selected=selected?.id===c.id?null:c;render();if(selected)document.getElementById('players').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'});}else perform(c.id);},`card-btn ${reason?'unavailable':''} ${selected?.id===c.id?'selected':''}`);b.title=CARDS[c.type].text+(reason?'（'+reason+'）':'');b.setAttribute('aria-label',CARDS[c.type].name+(reason?'：'+reason:''));b.append(sprite(el('div','card-art'),'card',c.type),el('span','card-label',CARDS[c.type].name),el('span','card-category',CARDS[c.type].category),el('span','card-desc',reason||CARDS[c.type].text));$('#hand').append(b);}if(!viewer.hand.length)$('#hand').append(el('p','empty','目前沒有手牌，結束回合等待下一次摸牌。'));}
 else {$('#handTitle').textContent=viewer&&!viewer.alive?'你已出局 · 觀戰中':'手牌已保密';$('#identityLabel').textContent='KEEP YOUR IDENTITY SECRET';$('#mission').textContent=viewer&&!viewer.alive?'對局會繼續進行，野貓仍可能共享陣營勝利。':'只讓目前操作的玩家查看自己的身分與手牌。';$('#hand').append(el('p','empty',busy?'其他玩家正在行動…':'交接裝置後即可查看手牌。'));}
 $('#endBtn').disabled=!canPlay;$('#identityBtn').disabled=!viewer;$('#privacyBtn').disabled=busy||!!s.over;
}
async function pump(){if(pumpRunning)return;pumpRunning=true;try{while(!game.s.over){let p=game.current;busy=true;selected=null;if(human(p)){if(game.s.mode==='local'&&viewPlayer!==p.id)await gate(p);else if(game.s.mode==='solo'){viewPlayer=0;privateVisible=true;}}else {viewPlayer=0;privateVisible=true;}render();if(game.s.phase==='draw'){await game.begin();save();}
 if(human(p)){busy=false;render();break;}
 await delay(450);let moves=0;while(!game.s.over&&moves++<40){let action=botAction();if(!action)break;await game.play(action.c.id,action.target?.id);save();render();await delay(380);}
 if(!game.s.over){await game.end();save();}render();}
 }catch(e){console.error(e);toast('操作發生問題，可回首頁讀取最近一次存檔。');}finally{busy=false;pumpRunning=false;render();showResult();}}
async function perform(id,target){if(busy||game.s.over)return;busy=true;selected=null;render();try{await game.play(id,target);save();if(!game.s.over&&game.s.mode==='local'&&viewPlayer!==game.current.id)await gate(game.current,'效果已結算，請交還正在出牌的玩家。');}finally{busy=false;render();showResult();}}
async function endTurn(){if(busy)return;busy=true;selected=null;render();try{await game.end();save();}finally{busy=false;}pump();}
function mount(){resultShown=false;selected=null;viewPlayer=-1;privateVisible=false;$('#landing').hidden=true;$('#game').hidden=false;window.scrollTo(0,0);render();pump();}
function inspectPlayer(p){const box=el('div','rule-text');box.append(sprite(el('div','portrait'),'char',p.char));box.firstChild.style.cssText+=';height:220px;max-width:340px;margin:auto';box.append(el('h3','',CHARS[p.char][0]),el('p','',game.s.abilities?`【${CHARS[p.char][1]}】${CHARS[p.char][2]}`:'本局未啟用角色能力。'),el('p','',`公開身分：${p.role==='guard'||!p.alive||game.s.over?ROLES[p.role][0]:'尚未公開'}。手牌 ${p.hand.length} 張。`));for(const c of Object.values(p.equip))box.append(el('p','',`${CARDS[c.type].name}：${CARDS[c.type].text}`));if(!Object.keys(p.equip).length)box.append(el('p','', '尚未裝備任何道具。'));openModal(p.name+' · 公開資訊',box);}
function showResult(){if(!game.s.over||resultShown)return;resultShown=true;save();const box=el('div','result');box.append(el('div','eyebrow','THE STREET HAS A NEW LEGEND'),el('h3','',`${{dog:'犬陣營',cat:'野貓陣營',rat:'黑鼠'}[game.s.over]}獲勝`),el('p','',`勝者：${game.winners().map(p=>p.name).join('、')}`));const list=el('div','role-list');for(const p of game.s.players)list.append(el('p','',`${p.name} · ${ROLES[p.role][0]} · ${CHARS[p.char][0]} · ${p.alive?'存活':'出局'}`));box.append(list,el('p','',`共 ${game.s.round} 回合 · 重洗 ${game.s.shuffles} 次`),button('再逛一回老街',()=>location.reload(),'primary'));openModal('對局結果',box);}
function gallery(tab='card'){const wrap=el('div'),tabs=el('div','tab-row');for(const [id,name]of [['card','手牌 · 14 種 / 24 張'],['char','角色 · 7 張'],['role','身分 · 5 張']])tabs.append(button(name,()=>gallery(id),id===tab?'selected':''));wrap.append(tabs);const list=el('div','catalog');if(tab==='card'){for(const c of CARDS){const article=el('article');article.append(sprite(el('div','card-art'),'card',c.type),el('h3','',c.name),el('p','',`${c.category} ×${c.count} · ${c.text}`));list.append(article);}}else if(tab==='char'){CHARS.forEach((c,i)=>{const a=el('article');a.append(sprite(el('div','portrait'),'char',i),el('h3','',c[0]),el('p','',`【${c[1]}】${c[2]}`));list.append(a);});}else{['guard','loyal','cat','cat','rat'].forEach((r,i)=>{const a=el('article');a.append(sprite(el('div','identity-art'),'role',i),el('h3','',ROLES[r][0]),el('p','',ROLES[r][1]));list.append(a);});}wrap.append(list);openModal('老街卡牌圖鑑',wrap);}
function rules(){const box=el('div','rule-text');const sections=[['一分鐘上手','你是玩家 1。單人模式由另外 3–4 位電腦玩家陪你試玩；同機模式所有座位皆由真人輪流操作。巡守犬先手。身分決定勝利目標，角色決定能力，兩者物種不必相同。'],['摸牌 → 出牌 → 棄牌','回合開始自動抽 2 張，角色可能改變摸牌方式。點選手牌：攻擊、偷牌、狂吠要再點亮框目標，其餘直接結算。按「結束回合」後，自選多餘手牌棄到目前生命值。'],['攻防與距離','通常每回合最多出爪 1 次，基本範圍 1。座位取較短距離，再加上阿橘、夜行貓及裝備修正，最低 1。點玩家可以看裝備與能力。閃避和自救時會跳出選擇，不會自動替真人決定。'],['出局立即判勝','黑鼠最後與巡守犬單挑且親手擊倒牠，黑鼠勝；其他情況巡守犬死亡，野貓陣營勝。巡守犬存活且野貓、黑鼠皆出局，犬陣營勝，忠犬須存活才共享勝利。'],['同機交接與存檔','其他人需要回應時會跳出交接遮罩。請其他玩家移開視線，再按「我是這位玩家」。完整出牌結算後及回合邊界自動存檔，過程中重新整理可能回到上次完整結算。'],['數位版約定','依完整規則書 v0.2 與其補充裁定實作。電腦以自己的身分、公開巡守犬與攻擊紀錄做簡易決策，不讀取其他隱藏身分或手牌。程式本機執行，開發者工具可讀狀態，同機保密依靠玩家自律。此版未提供跨裝置連線。'],['僵局與試玩','牌庫空不直接判負。若全場沒有合法進展，可共同同意結束此局並回到首頁；不自動指定贏家。這仍是原型，電腦策略及角色平衡可繼續調整。']];for(const [h,t]of sections)box.append(el('h3','',h),el('p','',t));const a=el('a','','下載／閱讀完整規則 PDF ↗');a.href='rules-v0.2.pdf';a.target='_blank';a.rel='noopener';box.append(a);openModal('老街對決 · 玩法說明',box);}
$('#setupForm').onsubmit=e=>{e.preventDefault();game=new Game({count:Number($('#count').value),mode:$('#mode').value,abilities:$('#abilities').checked},choose,()=>render());save();mount();};
$('#resumeBtn').onclick=()=>{try{const state=JSON.parse(localStorage.getItem(SAVE));if(state.version!==1||!['draw','play','over'].includes(state.phase)||state.resolving.length)throw Error('Invalid save');game=new Game({count:state.players.length},choose);game.s=state;game.notify=()=>render();mount();}catch{toast('無法讀取存檔，請重新開局。');}};
$('#endBtn').onclick=endTurn;$('#galleryBtn').onclick=()=>gallery();$('#rulesBtn').onclick=rules;$('#closeModal').onclick=()=>$('#modal').close();
$('#privacyBtn').onclick=async()=>{if(busy)return;const p=game.s.mode==='solo'?game.s.players[0]:game.current;busy=true;await gate(p,'手牌已遮住。確認只有自己查看後，繼續對局。');busy=false;render();};
$('#restartBtn').onclick=()=>{const box=el('div','rule-text');box.append(el('p','',busy?'正在結算，離開會回到最近一次完整儲存。':'最近一次完整結算已保存在此瀏覽器，可以稍後繼續。'),button('回到首頁',()=>location.reload(),'primary'));openModal('離開牌桌',box);};
$('#discardBtn').onclick=()=>{const list=el('div','catalog');for(const c of [...game.s.discard].reverse()){const a=el('article');a.append(sprite(el('div','card-art'),'card',c.type),el('p','',CARDS[c.type].name));list.append(a);}if(!game.s.discard.length)list.append(el('p','','棄牌堆目前是空的。'));openModal('公開棄牌堆',list);};
$('#identityBtn').onclick=()=>{const p=currentViewer();if(!p)return;let index={guard:0,loyal:1,cat:2,rat:4}[p.role];const box=el('div','rule-text');box.append(sprite(el('div','identity-art'),'role',index),el('p','',ROLES[p.role][1]));openModal(`${p.name} 的秘密身分`,box);};
for(const id of ['choice','curtain'])$('#'+id).addEventListener('cancel',e=>e.preventDefault());
try{const stored=JSON.parse(localStorage.getItem(SAVE));$('#resumeBtn').hidden=!(stored?.version===1&&!stored.over);}catch{}



