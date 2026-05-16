/* FinancePro v2 — app.js */

if (!Auth.isLogged()) window.location.href = 'login.html';

// ── MODAL DE CONFIRMAÇÃO CUSTOMIZADO ──
function confirm2(msg, onYes) {
  var overlay = document.getElementById('confirmOverlay');
  var msgEl   = document.getElementById('confirmMsg');
  if (!overlay) return;
  msgEl.textContent = msg;
  overlay.classList.remove('hidden');
  document.getElementById('confirmYes').onclick = function() {
    overlay.classList.add('hidden');
    onYes();
  };
  document.getElementById('confirmNo').onclick = function() {
    overlay.classList.add('hidden');
  };
}

let allTx    = [];
let allCats  = [];
let allGoals = [];
let txType   = 'income';
let txView   = 'list';
let catTab   = 'all';
let periodMode   = 'month';
let periodOffset = 0;

// ════════════════════════════════════════
// INIT
// ════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async function() {
  populateSidebar();
  bindNav();
  bindPeriod();
  bindTxModal();
  bindCatModal();
  bindGoalModal();
  bindProfile();
  bindTxFilters();
  applyPeriod();
  await loadAll();
  renderDashboard();
});

// ════════════════════════════════════════
// SIDEBAR
// ════════════════════════════════════════
function populateSidebar() {
  var u = Auth.user();
  if (!u) return;
  var name  = u.name  || 'Usuário';
  var email = u.email || '';
  var av    = u.avatar || '';

  var sbName  = document.getElementById('sbName');
  var sbEmail = document.getElementById('sbEmail');
  var sbAv    = document.getElementById('sbAvatar');

  if (sbName)  sbName.textContent  = name;
  if (sbEmail) sbEmail.textContent = email;
  if (sbAv) {
    if (av) {
      sbAv.innerHTML = '<img src="http://localhost:5000/uploads/' + av + '" alt="av" style="width:100%;height:100%;object-fit:cover;border-radius:50%">';
    } else {
      sbAv.textContent = name[0].toUpperCase();
    }
  }
}

// ════════════════════════════════════════
// NAVEGAÇÃO
// ════════════════════════════════════════
var PAGES = ['dash','tx','cat','goals','profile'];
var PAGE_META = {
  'dash':    { title:'Dashboard',   sub:'Visão geral das suas finanças' },
  'tx':      { title:'Transações',  sub:'Histórico completo de movimentações' },
  'cat':     { title:'Categorias',  sub:'Gerencie suas categorias' },
  'goals':   { title:'Metas',       sub:'Objetivos financeiros' },
  'profile': { title:'Perfil',      sub:'Suas informações e conta' },
};

function showPage(id) {
  PAGES.forEach(function(k) {
    var pg  = document.getElementById('page-' + k);
    var nav = document.getElementById('nav-'  + k);
    if (pg)  pg.classList.toggle('active', k === id);
    if (nav) nav.classList.toggle('active', k === id);
  });
  var meta = PAGE_META[id];
  if (meta) {
    var tt = document.getElementById('topbarTitle');
    var ts = document.getElementById('topbarSub');
    if (tt) tt.textContent = meta.title;
    if (ts) ts.textContent = meta.sub;
  }
  if (id === 'tx')      renderTxPage();
  if (id === 'cat')     renderCatPage();
  if (id === 'goals')   renderGoalsPage();
  if (id === 'profile') loadProfilePage();
}

function bindNav() {
  PAGES.forEach(function(k) {
    var el = document.getElementById('nav-' + k);
    if (el) el.addEventListener('click', function(e) { e.preventDefault(); showPage(k); });
  });

  var navCard = document.getElementById('nav-profile-card');
  if (navCard) navCard.addEventListener('click', function() { showPage('profile'); });

  var navOut = document.getElementById('nav-logout');
  if (navOut) navOut.addEventListener('click', function(e) { e.preventDefault(); Auth.logout(); });

  var btnOut2 = document.getElementById('btnLogout2');
  if (btnOut2) btnOut2.addEventListener('click', function() { Auth.logout(); });

  var btnVT = document.getElementById('btnVerTodas');
  if (btnVT) btnVT.addEventListener('click', function() { showPage('tx'); });

  var btnVM = document.getElementById('btnVerMetas');
  if (btnVM) btnVM.addEventListener('click', function() { showPage('goals'); });

  var btnNT = document.getElementById('btnNewTx');
  if (btnNT) btnNT.addEventListener('click', function() { openTxModal(); });
}

// ════════════════════════════════════════
// CARREGAR DADOS
// ════════════════════════════════════════
async function loadAll() {
  try {
    var results = await Promise.all([
      api.get('/transactions'),
      api.get('/categories'),
      api.get('/goals'),
    ]);
    allTx    = results[0].data || [];
    allCats  = results[1].data || [];
    allGoals = results[2].data || [];
  } catch(e) {
    toast('error', 'Erro de conexão', 'Backend offline? Rode python app.py');
  }
}

// ════════════════════════════════════════
// PERÍODO
// ════════════════════════════════════════
function toDS(d) {
  return d.getFullYear() + '-' +
    String(d.getMonth()+1).padStart(2,'0') + '-' +
    String(d.getDate()).padStart(2,'0');
}

function getPeriodRange() {
  var now = new Date();
  if (periodMode === 'week') {
    var dow = now.getDay();
    var diff = (dow === 0) ? -6 : 1 - dow;
    var mon = new Date(now);
    mon.setDate(now.getDate() + diff + periodOffset * 7);
    var sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    var s = toDS(mon), e = toDS(sun);
    var opts = { day:'2-digit', month:'short' };
    return {
      startStr: s, endStr: e, mode:'week', mondayStr: s,
      label: '📅 ' + mon.toLocaleDateString('pt-BR', opts) + ' – ' + sun.toLocaleDateString('pt-BR', opts)
    };
  }
  if (periodMode === 'month') {
    var base = new Date(now.getFullYear(), now.getMonth() + periodOffset, 1);
    var y = base.getFullYear(), m = base.getMonth();
    var s = y + '-' + String(m+1).padStart(2,'0') + '-01';
    var last = new Date(y, m+1, 0).getDate();
    var e = y + '-' + String(m+1).padStart(2,'0') + '-' + String(last).padStart(2,'0');
    var lbl = base.toLocaleDateString('pt-BR', { month:'long', year:'numeric' });
    return { startStr:s, endStr:e, mode:'month', year:y, month:m,
      label: '📆 ' + lbl.charAt(0).toUpperCase() + lbl.slice(1) };
  }
  var year = now.getFullYear() + periodOffset;
  return { startStr: year+'-01-01', endStr: year+'-12-31', mode:'year',
    label: '📊 ' + year };
}

function getTxInPeriod() {
  var r = getPeriodRange();
  return allTx.filter(function(t) {
    if (!t.date) return false;
    var d = t.date.slice(0,10);
    return d >= r.startStr && d <= r.endStr;
  });
}

function applyPeriod() {
  var r = getPeriodRange();
  var lbl = document.getElementById('periodLabel');
  if (lbl) lbl.textContent = r.label;
  var wk = document.getElementById('weekCard');
  if (wk) wk.style.display = (r.mode === 'week') ? 'block' : 'none';
}

function bindPeriod() {
  document.querySelectorAll('.p-btn').forEach(function(b) {
    b.addEventListener('click', function() {
      document.querySelectorAll('.p-btn').forEach(function(x) { x.classList.remove('active'); });
      b.classList.add('active');
      periodMode   = b.dataset.period;
      periodOffset = 0;
      applyPeriod();
      renderDashboard();
    });
  });

  var prev = document.getElementById('periodPrev');
  var next = document.getElementById('periodNext');
  var tdy  = document.getElementById('periodToday');

  if (prev) prev.addEventListener('click', function() { periodOffset--; applyPeriod(); renderDashboard(); });
  if (next) next.addEventListener('click', function() { periodOffset++; applyPeriod(); renderDashboard(); });
  if (tdy)  tdy.addEventListener('click',  function() { periodOffset=0; applyPeriod(); renderDashboard(); });
}

// ════════════════════════════════════════
// RENDER DASHBOARD
// ════════════════════════════════════════
function renderDashboard() {
  var txs = getTxInPeriod();
  var inc = 0, exp = 0;
  txs.forEach(function(t) {
    var a = parseFloat(t.amount||0);
    if (t.type==='income')  inc += a;
    else                    exp += a;
  });
  var bal = inc - exp;
  var pct = inc > 0 ? Math.round(exp/inc*100) : 0;

  setText('stBalance',     fmt(bal));
  setText('stIncome',      fmt(inc));
  setText('stExpense',     fmt(exp));
  setText('stPct',         pct + '%');
  setText('stIncomeQty',   txs.filter(function(t){return t.type==='income';}).length  + ' lançamentos');
  setText('stExpenseQty',  txs.filter(function(t){return t.type==='expense';}).length + ' lançamentos');
  setText('stBalanceSub',  bal >= 0 ? '✅ Saldo positivo' : '⚠️ Saldo negativo');
  setText('recentSub',     txs.length + ' transações no período');

  var balEl = document.getElementById('stBalance');
  if (balEl) balEl.className = 'stat-card-value ' + (bal >= 0 ? 'text-green' : 'text-red');

  if (periodMode === 'week') renderWeekBars();
  renderRecentList(txs);
  renderCatChart(txs);
  renderMonthHistory();
  renderDashGoals();
}

function setText(id, val) {
  var el = document.getElementById(id);
  if (el) el.textContent = val;
}

function renderWeekBars() {
  var r = getPeriodRange();
  var parts = r.mondayStr.split('-').map(Number);
  var monday = new Date(parts[0], parts[1]-1, parts[2]);
  var days   = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];
  var today  = toDS(new Date());

  var data = days.map(function(label, i) {
    var d = new Date(monday); d.setDate(monday.getDate() + i);
    var ds = toDS(d);
    var dayTx = allTx.filter(function(t) { return t.date && t.date.slice(0,10) === ds; });
    var inc = 0, exp = 0;
    dayTx.forEach(function(t) {
      var a = parseFloat(t.amount||0);
      if (t.type==='income') inc+=a; else exp+=a;
    });
    return { label:label, ds:ds, isToday:ds===today, inc:inc, exp:exp };
  });

  var maxVal = Math.max.apply(null, data.map(function(d){return Math.max(d.inc,d.exp);}));
  if (maxVal <= 0) maxVal = 1;

  var barsEl = document.getElementById('weekBars');
  var daysEl = document.getElementById('weekDays');
  if (!barsEl) return;

  barsEl.innerHTML = data.map(function(d) {
    var ih = Math.round(d.inc/maxVal*100);
    var eh = Math.round(d.exp/maxVal*100);
    return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px" title="'+d.label+': Rec '+fmt(d.inc)+' | Desp '+fmt(d.exp)+'">' +
      '<div style="display:flex;gap:2px;flex:1;width:100%;align-items:flex-end">' +
        '<div style="flex:1;background:var(--bg4);border-radius:3px;overflow:hidden;display:flex;align-items:flex-end">' +
          '<div style="width:100%;height:'+ih+'%;min-height:'+(d.inc>0?3:0)+'px;background:var(--green);border-radius:3px;transition:height .6s ease"></div>' +
        '</div>' +
        '<div style="flex:1;background:var(--bg4);border-radius:3px;overflow:hidden;display:flex;align-items:flex-end">' +
          '<div style="width:100%;height:'+eh+'%;min-height:'+(d.exp>0?3:0)+'px;background:var(--red);border-radius:3px;transition:height .6s ease"></div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');

  if (daysEl) {
    daysEl.innerHTML = data.map(function(d) {
      return '<div style="flex:1;text-align:center;font-size:.7rem;font-weight:'+(d.isToday?700:500)+';color:'+(d.isToday?'var(--accent2)':'var(--t3)')+'">'+d.label+'</div>';
    }).join('');
  }
}

function renderRecentList(txs) {
  var el = document.getElementById('recentList');
  if (!el) return;
  var sorted = txs.slice().sort(function(a,b){return b.date.localeCompare(a.date);}).slice(0,6);
  if (!sorted.length) {
    el.innerHTML = '<div class="empty-state"><span class="es-icon">💸</span><h3>Nenhuma transação</h3><p>Clique em Nova Transação para começar</p></div>';
    return;
  }
  el.innerHTML = sorted.map(function(t) {
    return '<div style="display:flex;align-items:center;gap:.85rem;padding:.75rem 0;border-bottom:1px solid rgba(255,255,255,.04)">' +
      '<div style="width:38px;height:38px;border-radius:var(--r2);flex-shrink:0;background:'+(t.color||'#6366F1')+'20;color:'+(t.color||'#6366F1')+';display:flex;align-items:center;justify-content:center;font-size:1.2rem">'+(t.icon||'💰')+'</div>' +
      '<div style="flex:1;min-width:0">' +
        '<div class="fw-bold text-sm" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(t.description)+'</div>' +
        '<div class="text-xs text-muted">'+esc(t.category_name||'')+'&nbsp;•&nbsp;'+fmtDate(t.date)+'</div>' +
      '</div>' +
      '<div class="font-mono fw-bold" style="font-size:.9rem;color:'+(t.type==='income'?'var(--green2)':'var(--red2)')+'">'+( t.type==='income'?'+':'-')+' '+fmt(t.amount)+'</div>' +
    '</div>';
  }).join('');
}

function renderCatChart(txs) {
  var el = document.getElementById('catChart');
  if (!el) return;
  var exp = txs.filter(function(t){return t.type==='expense';});
  if (!exp.length) {
    el.innerHTML = '<div class="empty-state"><span class="es-icon">📊</span><h3>Sem despesas</h3><p>Nenhuma despesa neste período</p></div>';
    return;
  }
  var map = {};
  exp.forEach(function(t) {
    var k = t.category_name || 'Outros';
    if (!map[k]) map[k] = { total:0, count:0, icon:t.icon||'💰', color:t.color||'#6366F1' };
    map[k].total += parseFloat(t.amount||0);
    map[k].count++;
  });
  var entries = Object.keys(map).map(function(k){return [k,map[k]];}).sort(function(a,b){return b[1].total-a[1].total;}).slice(0,7);
  var total = entries.reduce(function(s,e){return s+e[1].total;},0);
  el.innerHTML = entries.map(function(e) {
    var name=e[0], v=e[1];
    var pct = total > 0 ? (v.total/total*100).toFixed(1) : 0;
    return '<div style="margin-bottom:.95rem">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.35rem">' +
        '<span style="display:flex;align-items:center;gap:.4rem;font-size:.85rem;font-weight:600">'+v.icon+' '+esc(name)+'</span>' +
        '<span class="font-mono fw-bold" style="font-size:.82rem">'+fmt(v.total)+'</span>' +
      '</div>' +
      '<div class="progress"><div class="progress-fill" style="width:'+pct+'%;background:'+v.color+'"></div></div>' +
      '<div class="text-xs text-muted" style="margin-top:.25rem">'+pct+'% • '+v.count+' lançamento(s)</div>' +
    '</div>';
  }).join('');
}

function renderMonthHistory() {
  var el = document.getElementById('monthHistory');
  if (!el) return;
  if (!allTx.length) { el.innerHTML = '<p class="text-sm text-muted">Nenhuma transação registrada.</p>'; return; }

  var yms = allTx.map(function(t){return t.date?t.date.slice(0,7):null;}).filter(Boolean);
  var now = new Date();
  var nowYM = now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
  var minYM = yms.reduce(function(a,b){return a<b?a:b;}, nowYM);
  var maxYM = yms.reduce(function(a,b){return a>b?a:b;}, nowYM);

  var months = [];
  var sp = minYM.split('-').map(Number), sy=sp[0], sm=sp[1];
  var ep = maxYM.split('-').map(Number), ey=ep[0], em=ep[1];
  while (sy < ey || (sy===ey && sm<=em)) {
    months.push({ year:sy, month:sm-1 });
    sm++; if (sm>12){ sm=1; sy++; }
  }
  months.reverse();

  var html = months.map(function(item) {
    var y=item.year, m=item.month;
    var ms = y+'-'+String(m+1).padStart(2,'0')+'-01';
    var me = y+'-'+String(m+1).padStart(2,'0')+'-'+String(new Date(y,m+1,0).getDate()).padStart(2,'0');
    var mTx = allTx.filter(function(t){return t.date&&t.date.slice(0,10)>=ms&&t.date.slice(0,10)<=me;});
    if (!mTx.length) return '';
    var inc=0, exp=0;
    mTx.forEach(function(t){ var a=parseFloat(t.amount||0); if(t.type==='income') inc+=a; else exp+=a; });
    var bal = inc - exp;
    var ym = y+'-'+String(m+1).padStart(2,'0');
    var isCurrent = ym === nowYM;
    var isFuture  = ym > nowYM;
    var lbl = new Date(y,m,1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
    lbl = lbl.charAt(0).toUpperCase()+lbl.slice(1);
    return '<div class="month-card'+(isCurrent?' is-current':'')+(isFuture?' is-future':'')+'" onclick="jumpToMonth('+y+','+m+')" style="cursor:pointer">' +
      '<div class="month-name">'+(isCurrent?'🔵 ':isFuture?'🟢 ':'')+'<b>'+lbl+'</b>'+(isFuture?'<span class="badge badge-green" style="margin-left:.3rem">futuro</span>':'')+'</div>' +
      '<div style="display:flex;flex-direction:column;gap:.25rem;margin-bottom:.4rem">' +
        '<div style="display:flex;justify-content:space-between;font-size:.78rem"><span class="text-muted">📈 Receitas</span><span class="text-green fw-bold">'+fmt(inc)+'</span></div>' +
        '<div style="display:flex;justify-content:space-between;font-size:.78rem"><span class="text-muted">📉 Despesas</span><span class="text-red fw-bold">'+fmt(exp)+'</span></div>' +
        '<div style="display:flex;justify-content:space-between;font-size:.78rem"><span class="text-muted">'+mTx.length+' lançamento(s)</span></div>' +
      '</div>' +
      '<div class="month-balance '+(bal>=0?'text-green':'text-red')+'">'+fmt(bal)+'</div>' +
    '</div>';
  }).filter(Boolean).join('');

  el.innerHTML = html || '<p class="text-sm text-muted">Nenhum dado ainda.</p>';
}

function jumpToMonth(year, month) {
  var now = new Date();
  periodMode   = 'month';
  periodOffset = (year - now.getFullYear())*12 + (month - now.getMonth());
  document.querySelectorAll('.p-btn').forEach(function(b){ b.classList.toggle('active', b.dataset.period==='month'); });
  applyPeriod();
  renderDashboard();
  showPage('dash');
  window.scrollTo({top:0,behavior:'smooth'});
}

function renderDashGoals() {
  var el = document.getElementById('dashGoals');
  if (!el) return;
  var active = allGoals.filter(function(g){return g.status==='active';});
  if (!active.length) {
    el.innerHTML = '<div class="empty-state"><span class="es-icon">🎯</span><h3>Nenhuma meta</h3><p>Crie sua primeira meta financeira</p>' +
      '<button class="btn btn-primary btn-sm" style="margin-top:.75rem" onclick="showPage(\'goals\')">Criar meta →</button></div>';
    return;
  }
  el.innerHTML = active.slice(0,3).map(function(g){ return goalMiniHTML(g); }).join('');
}

// ════════════════════════════════════════
// MODAL TRANSAÇÃO
// ════════════════════════════════════════
function bindTxModal() {
  var btnI = document.getElementById('btnIncome');
  var btnE = document.getElementById('btnExpense');
  var btnS = document.getElementById('btnSaveTx');
  var btnD = document.getElementById('btnDeleteTx');
  var modal= document.getElementById('txModal');

  if (btnI) btnI.addEventListener('click', function(){ setTxType('income'); });
  if (btnE) btnE.addEventListener('click', function(){ setTxType('expense'); });
  if (btnS) btnS.addEventListener('click', saveTx);
  if (btnD) btnD.addEventListener('click', function(){
    var id = document.getElementById('txId').value;
    if (id) deleteTx(id, true);
  });
  if (modal) modal.addEventListener('click', function(e){ if(e.target===modal) closeModal('txModal'); });
}

function setTxType(type) {
  txType = type;
  var bI = document.getElementById('btnIncome');
  var bE = document.getElementById('btnExpense');
  if (bI) bI.className = 'type-btn' + (type==='income'  ? ' t-income'  : '');
  if (bE) bE.className = 'type-btn' + (type==='expense' ? ' t-expense' : '');
  populateCatSelect(type);
}

function populateCatSelect(type) {
  var sel  = document.getElementById('txCat');
  if (!sel) return;
  var cats = allCats.filter(function(c){ return c.type === type; });
  if (!cats.length) {
    sel.innerHTML = '<option value="">Nenhuma categoria — crie em Categorias</option>';
  } else {
    sel.innerHTML = cats.map(function(c){
      return '<option value="'+c.id+'">'+c.icon+' '+esc(c.name)+'</option>';
    }).join('');
  }
}

function openTxModal(tx) {
  var form = document.getElementById('txForm');
  if (form) form.reset();
  document.getElementById('txId').value = '';
  var btnD = document.getElementById('btnDeleteTx');
  var btnS = document.getElementById('btnSaveTx');
  if (btnD) btnD.classList.add('hidden');

  var r = getPeriodRange();
  var lbl = r.label.replace(/^[📅📆📊] /,'');
  var noteEl = document.getElementById('txPeriodNoteLabel');
  if (noteEl) noteEl.textContent = lbl;

  if (tx && typeof tx === 'object') {
    setText('txModalTitle', 'Editar Transação');
    if (btnS) btnS.textContent = 'Salvar';
    if (btnD) btnD.classList.remove('hidden');
    document.getElementById('txId').value    = tx.id;
    document.getElementById('txDesc').value  = tx.description || '';
    document.getElementById('txAmt').value   = tx.amount || '';
    document.getElementById('txDate').value  = (tx.date||'').slice(0,10);
    document.getElementById('txNotes').value = tx.notes || '';
    txType = tx.type || 'income';
    setTxType(txType);
    setTimeout(function(){ document.getElementById('txCat').value = tx.category_id; }, 80);
  } else {
    setText('txModalTitle', 'Nova Transação');
    if (btnS) btnS.textContent = 'Adicionar';
    var defDate = periodOffset === 0 ? toDS(new Date()) : r.startStr;
    document.getElementById('txDate').value = defDate;
    setTxType('income');
  }
  openModal('txModal');
}

async function saveTx() {
  var id    = document.getElementById('txId').value;
  var catId = parseInt(document.getElementById('txCat').value) || 0;
  var desc  = document.getElementById('txDesc').value.trim();
  var amt   = parseFloat(document.getElementById('txAmt').value) || 0;
  var date  = document.getElementById('txDate').value;
  var notes = document.getElementById('txNotes').value.trim() || null;
  var btn   = document.getElementById('btnSaveTx');

  if (!catId) { toast('error','Atenção','Selecione uma categoria'); return; }
  if (!desc)  { toast('error','Atenção','Informe a descrição');     return; }
  if (amt<=0) { toast('error','Atenção','Informe um valor válido'); return; }
  if (!date)  { toast('error','Atenção','Informe a data');          return; }

  if (btn) { btn.disabled=true; btn.textContent='Salvando...'; }
  try {
    var body = { category_id:catId, description:desc, amount:amt, type:txType, date:date, notes:notes };
    if (id) await api.put('/transactions/'+id, body);
    else    await api.post('/transactions', body);
    toast('success', id?'Atualizado!':'Adicionado!', 'Transação salva');
    closeModal('txModal');
    await loadAll();
    renderDashboard();
    if (document.getElementById('page-tx').classList.contains('active')) renderTxPage();
  } catch(e) {
    toast('error','Erro ao salvar', e.message);
  } finally {
    if (btn) { btn.disabled=false; btn.textContent=id?'Salvar':'Adicionar'; }
  }
}

async function deleteTx(id, fromModal) {
  confirm2('Tem certeza que deseja excluir esta transação?', async function() {
    try {
      await api.delete('/transactions/'+id);
      toast('success','Excluída','Transação removida');
      if (fromModal) closeModal('txModal');
      await loadAll();
      renderDashboard();
      if (document.getElementById('page-tx').classList.contains('active')) renderTxPage();
    } catch(e) { toast('error','Erro',e.message); }
  });
}

// ════════════════════════════════════════
// PAGE TRANSAÇÕES
// ════════════════════════════════════════
function bindTxFilters() {
  var s  = document.getElementById('txSearch');
  var ft = document.getElementById('txFType');
  var fm = document.getElementById('txFMonth');
  var cl = document.getElementById('txClear');
  var vl = document.getElementById('viewList');
  var vg = document.getElementById('viewGroup');

  if (s)  s.addEventListener('input',  renderTxPage);
  if (ft) ft.addEventListener('change', renderTxPage);
  if (fm) fm.addEventListener('change', renderTxPage);
  if (cl) cl.addEventListener('click', function(){
    if(s) s.value=''; if(ft) ft.value=''; if(fm) fm.value='';
    renderTxPage();
  });
  if (vl) vl.addEventListener('click', function(){
    txView='list';
    vl.style.cssText='background:var(--accent);color:#fff';
    if(vg) vg.style.cssText='';
    renderTxPage();
  });
  if (vg) vg.addEventListener('click', function(){
    txView='group';
    vg.style.cssText='background:var(--accent);color:#fff';
    if(vl) vl.style.cssText='';
    renderTxPage();
  });
}

function getFilteredTx() {
  var search = (document.getElementById('txSearch')?.value||'').toLowerCase();
  var type   = document.getElementById('txFType')?.value||'';
  var month  = document.getElementById('txFMonth')?.value||'';
  return allTx.filter(function(t){
    var ms = !search || t.description.toLowerCase().includes(search) || (t.category_name||'').toLowerCase().includes(search);
    var mt = !type  || t.type===type;
    var mm = !month || (t.date&&t.date.startsWith(month));
    return ms&&mt&&mm;
  }).sort(function(a,b){ return b.date.localeCompare(a.date); });
}

function renderTxPage() {
  // Popular meses
  var months = [...new Set(allTx.map(function(t){return t.date?t.date.slice(0,7):null;}).filter(Boolean))].sort().reverse();
  var mSel = document.getElementById('txFMonth');
  if (mSel) {
    var curM = mSel.value;
    mSel.innerHTML = '<option value="">📅 Todos os meses</option>' + months.map(function(m){
      var p=m.split('-'), lbl=new Date(+p[0],+p[1]-1,1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
      lbl=lbl.charAt(0).toUpperCase()+lbl.slice(1);
      return '<option value="'+m+'"'+(m===curM?' selected':'')+'>'+lbl+'</option>';
    }).join('');
  }

  var list = getFilteredTx();
  var inc=0, exp=0;
  list.forEach(function(t){ var a=parseFloat(t.amount||0); if(t.type==='income') inc+=a; else exp+=a; });
  var bal=inc-exp;

  setText('txSumIn',  fmt(inc));
  setText('txSumExp', fmt(exp));
  var balEl=document.getElementById('txSumBal');
  if(balEl){ balEl.textContent=fmt(bal); balEl.className='font-mono fw-bold '+(bal>=0?'text-green':'text-red'); }
  setText('txCount', list.length+' transação(ões)');

  var wrap=document.getElementById('txTableWrap');
  if (!wrap) return;

  if (!list.length) {
    wrap.innerHTML='<div class="card"><div class="card-pad"><div class="empty-state"><span class="es-icon">🔍</span><h3>Nada encontrado</h3><p>Tente outros filtros</p></div></div></div>';
    return;
  }
  if (txView==='group') renderTxGrouped(list, wrap);
  else                  renderTxTable(list, wrap);
}

function renderTxTable(list, wrap) {
  var tInc=0, tExp=0;
  list.forEach(function(t){ var a=parseFloat(t.amount||0); if(t.type==='income') tInc+=a; else tExp+=a; });
  wrap.innerHTML = '<div class="card"><table class="data-table"><thead><tr>' +
    '<th style="width:36px"></th>' +
    '<th>Descrição</th>' +
    '<th>Categoria</th>' +
    '<th>Data</th>' +
    '<th style="text-align:right">Valor</th>' +
    '<th style="text-align:center;width:90px">Ações</th>' +
    '</tr></thead><tbody>' +
    list.map(function(t){
      return '<tr style="cursor:pointer" onclick="openTxModal(getTxById(\''+t.id+'\'))">' +
        '<td><div style="width:36px;height:36px;border-radius:var(--r2);background:'+(t.color||'#6366F1')+'20;color:'+(t.color||'#6366F1')+';display:flex;align-items:center;justify-content:center;font-size:1.1rem">'+(t.icon||'💰')+'</div></td>' +
        '<td><div class="fw-bold">'+esc(t.description)+'</div><div class="text-xs text-muted">'+(t.notes?esc(t.notes.slice(0,40)):'Sem observações')+'</div></td>' +
        '<td><span class="badge" style="background:'+(t.color||'#6366F1')+'18;color:'+(t.color||'#6366F1')+'">'+(t.icon||'')+' '+esc(t.category_name||'—')+'</span></td>' +
        '<td><div class="fw-bold text-sm">'+fmtDate(t.date)+'</div><div class="text-xs text-muted">'+fmtWeekday(t.date)+'</div></td>' +
        '<td style="text-align:right"><div class="font-mono fw-bold '+(t.type==='income'?'text-green':'text-red')+'">'+(t.type==='income'?'+':'-')+' '+fmt(t.amount)+'</div>' +
          '<span class="badge '+(t.type==='income'?'badge-green':'badge-red')+'">'+(t.type==='income'?'RECEITA':'DESPESA')+'</span></td>' +
        '<td onclick="event.stopPropagation()" style="text-align:center">' +
          '<div style="display:flex;gap:.3rem;justify-content:center">' +
            '<button class="btn btn-ghost btn-icon btn-xs" onclick="openTxModal(getTxById(\''+t.id+'\'))" title="Editar">✏️</button>' +
            '<button class="btn btn-danger btn-icon btn-xs" onclick="deleteTx(\''+t.id+'\')" title="Excluir">🗑️</button>' +
          '</div></td>' +
        '</tr>';
    }).join('') +
    '</tbody><tfoot><tr style="background:var(--bg3)">' +
      '<td colspan="4" style="padding:.85rem 1.25rem;font-size:.78rem;color:var(--t3);font-weight:600">'+list.length+' transação(ões)</td>' +
      '<td style="padding:.85rem 1.25rem;text-align:right"><div class="text-xs text-green fw-bold">+ '+fmt(tInc)+'</div><div class="text-xs text-red fw-bold">- '+fmt(tExp)+'</div></td>' +
      '<td></td></tr></tfoot></table></div>';
}

function renderTxGrouped(list, wrap) {
  var groups={};
  list.forEach(function(t){ var k=t.date?t.date.slice(0,7):'—'; if(!groups[k]) groups[k]=[]; groups[k].push(t); });
  var keys=Object.keys(groups).sort().reverse();
  wrap.innerHTML=keys.map(function(key){
    var txs=groups[key];
    var inc=0,exp=0;
    txs.forEach(function(t){ var a=parseFloat(t.amount||0); if(t.type==='income') inc+=a; else exp+=a; });
    var bal=inc-exp;
    var p=key.split('-'), lbl=(p[0]&&p[1])?new Date(+p[0],+p[1]-1,1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'}):key;
    lbl=lbl.charAt(0).toUpperCase()+lbl.slice(1);
    return '<div class="card mb-15"><div class="card-header">' +
      '<div><div class="card-title">📅 '+lbl+'</div><div class="card-sub">'+txs.length+' lançamento(s)</div></div>' +
      '<div style="display:flex;gap:1.25rem">' +
        '<div style="text-align:right"><div class="text-xs text-muted">Receitas</div><div class="font-mono text-green fw-bold text-sm">+'+fmt(inc)+'</div></div>' +
        '<div style="text-align:right"><div class="text-xs text-muted">Despesas</div><div class="font-mono text-red fw-bold text-sm">-'+fmt(exp)+'</div></div>' +
        '<div style="text-align:right;padding-left:.85rem;border-left:1px solid var(--b1)"><div class="text-xs text-muted">Saldo</div><div class="font-mono fw-bold text-sm '+(bal>=0?'text-green':'text-red')+'">'+fmt(bal)+'</div></div>' +
      '</div></div>' +
      '<div class="card-pad" style="padding-top:0;padding-bottom:0">' +
      txs.map(function(t,i){
        return '<div style="display:flex;align-items:center;gap:.85rem;padding:.85rem 0;border-bottom:'+(i<txs.length-1?'1px solid rgba(255,255,255,.04)':'none')+';cursor:pointer" onclick="openTxModal(getTxById(\''+t.id+'\'))">' +
          '<div style="width:36px;height:36px;border-radius:var(--r2);flex-shrink:0;background:'+(t.color||'#6366F1')+'20;color:'+(t.color||'#6366F1')+';display:flex;align-items:center;justify-content:center;font-size:1.1rem">'+(t.icon||'💰')+'</div>' +
          '<div style="flex:1;min-width:0"><div class="fw-bold text-sm">'+esc(t.description)+'</div>' +
            '<div class="text-xs text-muted">'+fmtDate(t.date)+' ('+fmtWeekday(t.date)+') • <span style="color:'+(t.color||'#6366F1')+'">'+esc(t.category_name||'')+'</span></div></div>' +
          '<div class="font-mono fw-bold '+(t.type==='income'?'text-green':'text-red')+'">'+(t.type==='income'?'+':'-')+' '+fmt(t.amount)+'</div>' +
          '<div onclick="event.stopPropagation()" style="display:flex;gap:.3rem">' +
            '<button class="btn btn-ghost btn-icon btn-xs" onclick="openTxModal(getTxById(\''+t.id+'\'))">✏️</button>' +
            '<button class="btn btn-danger btn-icon btn-xs" onclick="deleteTx(\''+t.id+'\')">🗑️</button>' +
          '</div></div>';
      }).join('') +
      '</div></div>';
  }).join('');
}

function getTxById(id) {
  return allTx.find(function(t){ return String(t.id)===String(id); });
}

// ════════════════════════════════════════
// CATEGORIAS
// ════════════════════════════════════════
function bindCatModal() {
  var btnS = document.getElementById('btnSaveCat');
  var btnD = document.getElementById('btnDeleteCat');
  var modal= document.getElementById('catModal');
  if (btnS) btnS.addEventListener('click', saveCat);
  if (btnD) btnD.addEventListener('click', function(){ deleteCatFromModal(); });
  if (modal) modal.addEventListener('click', function(e){ if(e.target===modal) closeModal('catModal'); });

  document.querySelectorAll('.tab-btn').forEach(function(b){
    b.addEventListener('click', function(){
      document.querySelectorAll('.tab-btn').forEach(function(x){ x.classList.remove('active'); });
      b.classList.add('active');
      catTab=b.dataset.tab;
      renderCatPage();
    });
  });
}

function renderCatPage() {
  var el = document.getElementById('catList');
  if (!el) return;
  var cats = catTab==='all' ? allCats : allCats.filter(function(c){ return c.type===catTab; });
  // Botão sempre visível no topo
  var btnRow = '<div style="display:flex;justify-content:flex-end;margin-bottom:1rem">' +
    '<button class="btn btn-primary btn-sm" onclick="openCatModal()">➕ Nova Categoria</button></div>';
  if (!cats.length) {
    el.innerHTML = btnRow +
      '<div class="empty-state"><span class="es-icon">🏷️</span><h3>Nenhuma categoria</h3>' +
      '<p>Clique em "+ Nova Categoria" acima para criar</p></div>';
    return;
  }
  el.innerHTML = btnRow +
    cats.map(function(c){
      return '<div class="cat-item" onclick="openCatModal(getCatById('+c.id+'))">' +
        '<div class="cat-ico" style="background:'+c.color+'20;color:'+c.color+'">'+c.icon+'</div>' +
        '<div style="flex:1"><div class="fw-bold text-sm">'+esc(c.name)+'</div>' +
          '<div class="text-xs text-muted">'+allTx.filter(function(t){return t.category_id===c.id;}).length+' transação(ões)</div></div>' +
        '<span class="badge '+(c.type==='income'?'badge-green':'badge-red')+'">'+(c.type==='income'?'📈 Receita':'📉 Despesa')+'</span>' +
        '<div onclick="event.stopPropagation()">' +
          '<button class="btn btn-danger btn-icon btn-xs" onclick="deleteCatById('+c.id+')" title="Excluir">🗑️</button>' +
        '</div></div>';
    }).join('');
}

function getCatById(id) { return allCats.find(function(c){ return c.id===id; }); }

function openCatModal(cat) {
  var form=document.getElementById('catForm');
  if(form) form.reset();
  document.getElementById('catId').value='';
  document.getElementById('catIcon').value='💰';
  document.getElementById('catColor').value='#6366F1';
  var btnD=document.getElementById('btnDeleteCat');
  if(btnD) btnD.classList.add('hidden');
  if(cat && typeof cat==='object'){
    setText('catModalTitle','Editar Categoria');
    document.getElementById('catId').value   =cat.id;
    document.getElementById('catName').value =cat.name||'';
    document.getElementById('catType').value =cat.type||'expense';
    document.getElementById('catIcon').value =cat.icon||'💰';
    document.getElementById('catColor').value=cat.color||'#6366F1';
    if(btnD) btnD.classList.remove('hidden');
  } else {
    setText('catModalTitle','Nova Categoria');
  }
  openModal('catModal');
}

async function saveCat() {
  var id   =document.getElementById('catId').value;
  var name =document.getElementById('catName').value.trim();
  var type =document.getElementById('catType').value;
  var icon =document.getElementById('catIcon').value.trim()||'💰';
  var color=document.getElementById('catColor').value;
  var btn  =document.getElementById('btnSaveCat');
  if(!name){ toast('error','Atenção','Informe o nome'); return; }
  if(btn){ btn.disabled=true; btn.textContent='Salvando...'; }
  try {
    if(id) await api.put('/categories/'+id,{name,icon,color});
    else   await api.post('/categories',{name,type,icon,color});
    toast('success','Salvo','Categoria salva');
    closeModal('catModal');
    await loadAll(); renderCatPage();
  } catch(e){ toast('error','Erro',e.message); }
  finally{ if(btn){ btn.disabled=false; btn.textContent='Salvar'; } }
}

function deleteCatFromModal() {
  var id=document.getElementById('catId').value;
  if(id) deleteCatById(id, true);
}

async function deleteCatById(id, fromModal) {
  confirm2('Excluir esta categoria?', async function() {
    try {
      await api.delete('/categories/'+id);
      toast('success','Excluída','Categoria removida');
      if(fromModal) closeModal('catModal');
      await loadAll(); renderCatPage();
    } catch(e){ toast('error','Erro',e.message); }
  });
}

// ════════════════════════════════════════
// METAS
// ════════════════════════════════════════
function bindGoalModal() {
  var btnS=document.getElementById('btnSaveGoal');
  var btnD=document.getElementById('btnDeleteGoal');
  var modal=document.getElementById('goalModal');
  if(btnS) btnS.addEventListener('click', saveGoal);
  if(btnD) btnD.addEventListener('click', deleteGoalFromModal);
  if(modal) modal.addEventListener('click', function(e){ if(e.target===modal) closeModal('goalModal'); });

  var btnNew=document.getElementById('goal-new-btn');
  if(btnNew) btnNew.addEventListener('click', function(){ openGoalModal(); });
}

function goalMiniHTML(g) {
  var pct=Math.min(parseFloat(g.current_amount||0)/parseFloat(g.target_amount||1)*100,100).toFixed(1);
  var rem=Math.max(0,parseFloat(g.target_amount||0)-parseFloat(g.current_amount||0));
  return '<div class="goal-card" onclick="openGoalModal(getGoalById(\''+g.id+'\'))">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem">' +
      '<span class="fw-bold">'+esc(g.title)+'</span>' +
      '<span class="fw-black text-green" style="font-size:1.1rem">'+pct+'%</span>' +
    '</div>' +
    '<div class="progress"><div class="progress-fill" style="width:'+pct+'%"></div></div>' +
    '<div style="display:flex;justify-content:space-between;margin-top:.4rem" class="text-xs text-muted">' +
      '<span>'+fmt(g.current_amount)+' de '+fmt(g.target_amount)+'</span>' +
      '<span>Faltam '+fmt(rem)+'</span>' +
    '</div></div>';
}

function goalFullHTML(g) {
  var pct=Math.min(parseFloat(g.current_amount||0)/parseFloat(g.target_amount||1)*100,100).toFixed(1);
  var rem=Math.max(0,parseFloat(g.target_amount||0)-parseFloat(g.current_amount||0));
  var dl='';
  if(g.deadline){
    var d=new Date(g.deadline+'T12:00:00');
    var diff=Math.ceil((d-new Date())/(1000*86400));
    dl=diff>0?'<span class="text-muted">📅 '+diff+' dias restantes</span>':
       diff===0?'<span class="text-yellow">📅 Vence hoje!</span>':
                '<span class="text-red">📅 Prazo vencido</span>';
  }
  var badge=g.status==='completed'?'<span class="badge badge-green">✅ Concluída</span>':
            g.status==='cancelled'?'<span class="badge badge-gray">❌ Cancelada</span>':'';
  return '<div class="goal-card" onclick="openGoalModal(getGoalById(\''+g.id+'\'))">' +
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.65rem">' +
      '<div>' +
        '<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.25rem"><span class="fw-bold" style="font-size:1rem">'+esc(g.title)+'</span>'+badge+'</div>' +
        '<div class="text-xs text-muted">'+esc(g.description||'Sem descrição')+'</div>' +
        '<div class="text-xs" style="margin-top:4px">'+dl+'</div>' +
      '</div>' +
      '<div style="text-align:right"><div class="fw-black text-green" style="font-size:1.4rem">'+pct+'%</div><div class="text-xs text-muted">concluído</div></div>' +
    '</div>' +
    '<div class="progress progress-lg"><div class="progress-fill" style="width:'+pct+'%"></div></div>' +
    '<div class="grid3" style="margin-top:.65rem;gap:.5rem">' +
      '<div style="background:var(--bg3);border-radius:var(--r2);padding:.6rem"><div class="text-xs text-muted mb-1">Acumulado</div><div class="font-mono fw-bold text-green text-sm">'+fmt(g.current_amount)+'</div></div>' +
      '<div style="background:var(--bg3);border-radius:var(--r2);padding:.6rem"><div class="text-xs text-muted mb-1">Meta total</div><div class="font-mono fw-bold text-sm">'+fmt(g.target_amount)+'</div></div>' +
      '<div style="background:var(--bg3);border-radius:var(--r2);padding:.6rem"><div class="text-xs text-muted mb-1">Faltam</div><div class="font-mono fw-bold text-yellow text-sm">'+fmt(rem)+'</div></div>' +
    '</div></div>';
}

function renderGoalsPage() {
  var el=document.getElementById('goalsList');
  if(!el) return;
  if(!allGoals.length){
    el.innerHTML='<div class="card"><div class="card-pad"><div class="empty-state">' +
      '<span class="es-icon">🎯</span><h3>Nenhuma meta cadastrada</h3>' +
      '<p>Defina seus objetivos financeiros e acompanhe o progresso</p>' +
      '<button class="btn btn-primary" style="margin-top:.75rem" onclick="openGoalModal()">➕ Criar Primeira Meta</button>' +
    '</div></div></div>';
    return;
  }
  el.innerHTML='<div style="display:flex;justify-content:flex-end;margin-bottom:1rem">' +
    '<button class="btn btn-primary btn-sm" onclick="openGoalModal()">➕ Nova Meta</button></div>' +
    allGoals.map(function(g){ return goalFullHTML(g); }).join('');
}

function getGoalById(id){ return allGoals.find(function(g){ return String(g.id)===String(id); }); }

function openGoalModal(g) {
  var form=document.getElementById('goalForm');
  if(form) form.reset();
  document.getElementById('goalId').value='';
  document.getElementById('goalCurrent').value='0';
  var grp=document.getElementById('goalStatusGroup');
  var btnD=document.getElementById('btnDeleteGoal');
  if(grp) grp.classList.add('hidden');
  if(btnD) btnD.classList.add('hidden');

  if(g && typeof g==='object'){
    setText('goalModalTitle','Editar Meta');
    document.getElementById('goalId').value      =g.id;
    document.getElementById('goalTitle').value   =g.title||'';
    document.getElementById('goalDesc').value    =g.description||'';
    document.getElementById('goalTarget').value  =g.target_amount||'';
    document.getElementById('goalCurrent').value =g.current_amount||0;
    document.getElementById('goalDeadline').value=(g.deadline||'').slice(0,10);
    document.getElementById('goalStatus').value  =g.status||'active';
    if(grp) grp.classList.remove('hidden');
    if(btnD) btnD.classList.remove('hidden');
  } else {
    setText('goalModalTitle','Nova Meta');
  }
  openModal('goalModal');
}

async function saveGoal() {
  var id      =document.getElementById('goalId').value;
  var title   =document.getElementById('goalTitle').value.trim();
  var desc    =document.getElementById('goalDesc').value.trim();
  var target  =parseFloat(document.getElementById('goalTarget').value)||0;
  var current =parseFloat(document.getElementById('goalCurrent').value)||0;
  var deadline=document.getElementById('goalDeadline').value||null;
  var status  =document.getElementById('goalStatus').value||'active';
  var btn     =document.getElementById('btnSaveGoal');

  if(!title)   { toast('error','Atenção','Informe o título');     return; }
  if(target<=0){ toast('error','Atenção','Informe o valor alvo'); return; }

  if(btn){ btn.disabled=true; btn.textContent='Salvando...'; }
  try {
    var body={title,description:desc,target_amount:target,current_amount:current,deadline,status};
    if(id) await api.put('/goals/'+id,body);
    else   await api.post('/goals',body);
    toast('success','Salvo','Meta salva com sucesso');
    closeModal('goalModal');
    await loadAll(); renderGoalsPage(); renderDashboard();
  } catch(e){ toast('error','Erro',e.message); }
  finally{ if(btn){ btn.disabled=false; btn.textContent='Salvar'; } }
}

async function deleteGoalFromModal() {
  var id=document.getElementById('goalId').value;
  if(!id) return;
  confirm2('Excluir esta meta?', async function() {
    try {
      await api.delete('/goals/'+id);
      toast('success','Excluída','Meta removida');
      closeModal('goalModal');
      await loadAll(); renderGoalsPage(); renderDashboard();
    } catch(e){ toast('error','Erro',e.message); }
  });
}

// ════════════════════════════════════════
// PERFIL
// ════════════════════════════════════════
function bindProfile() {
  var avInput=document.getElementById('avatarInput');
  var avBig  =document.getElementById('profileAvatar');
  var btnSave=document.getElementById('btnSaveProfile');

  if(avBig) avBig.addEventListener('click', function(){ if(avInput) avInput.click(); });
  if(avInput) avInput.addEventListener('change', async function(){
    var file=this.files[0];
    if(!file) return;
    if(file.size>4*1024*1024){ toast('error','Arquivo grande','Máximo 4MB'); return; }
    // Preview local imediato
    var reader=new FileReader();
    reader.onload=function(ev){
      var av=document.getElementById('profileAvatar');
      if(av) av.innerHTML='<img src="'+ev.target.result+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%">';
    };
    reader.readAsDataURL(file);
    // Upload para o servidor
    var fd=new FormData(); fd.append('avatar',file);
    try {
      var res=await fetch(`${API_URL}/api/profile/avatar`, {
        method:'POST',
        headers:{'Authorization':'Bearer '+Auth.token()},
        body:fd
      });
      var data=await res.json();
      if(!res.ok) throw new Error(data.error||'Erro no upload');
      var u=Auth.user(); u.avatar=data.data.avatar; Auth.save(Auth.token(),u);
      toast('success','Foto atualizada','Foto de perfil salva com sucesso');
      populateSidebar();
    } catch(e){
      toast('error','Erro na foto', e.message);
    }
  });
  if(btnSave) btnSave.addEventListener('click', saveProfile);

  var btnCP = document.getElementById('btnChangePass');
  if(btnCP) btnCP.addEventListener('click', async function(){
    var op = document.getElementById('oldPass').value;
    var np = document.getElementById('newPass').value;
    var cp = document.getElementById('confPass').value;
    if(!op){ toast('error','Atenção','Informe a senha atual'); return; }
    if(np.length < 6){ toast('error','Atenção','Nova senha mínima de 6 caracteres'); return; }
    if(np !== cp){ toast('error','Atenção','As senhas não coincidem'); return; }
    setBtnLoading(btnCP, true, '🔒 Alterar Senha');
    try {
      await api.post('/profile/password', {old_password:op, new_password:np});
      toast('success','Senha alterada!','Sua senha foi atualizada com sucesso');
      document.getElementById('oldPass').value = '';
      document.getElementById('newPass').value = '';
      document.getElementById('confPass').value = '';
    } catch(e){ toast('error','Erro', e.message); }
    finally{ setBtnLoading(btnCP, false, '🔒 Alterar Senha'); }
  });
}

function loadProfilePage() {
  var u=Auth.user();
  if(!u) return;
  var pName =document.getElementById('pName');
  var pEmail=document.getElementById('pEmail');
  if(pName)  pName.value =u.name ||'';
  if(pEmail) pEmail.value=u.email||'';

  var av=document.getElementById('profileAvatar');
  if(av){
    if(u.avatar){
      av.innerHTML='<img src="http://localhost:5000/uploads/'+u.avatar+'" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%">';
    } else {
      av.innerHTML=''; av.textContent=(u.name||'U')[0].toUpperCase();
    }
  }

  var stats=document.getElementById('profileStats');
  if(stats){
    var items=[
      {label:'Transações',  value:allTx.length,   icon:'💳'},
      {label:'Categorias',  value:allCats.length,  icon:'🏷️'},
      {label:'Metas Ativas',value:allGoals.filter(function(g){return g.status==='active';}).length, icon:'🎯'},
    ];
    stats.innerHTML=items.map(function(s){
      return '<div style="background:var(--bg3);border-radius:var(--r2);padding:1rem;text-align:center">' +
        '<div style="font-size:1.5rem;margin-bottom:.4rem">'+s.icon+'</div>' +
        '<div class="fw-black" style="font-size:1.5rem">'+s.value+'</div>' +
        '<div class="text-xs text-muted">'+s.label+'</div></div>';
    }).join('');
  }
}

function toggleEye(inputId, eyeId) {
  var i = document.getElementById(inputId);
  var e = document.getElementById(eyeId);
  if (!i || !e) return;
  i.type = i.type === 'text' ? 'password' : 'text';
  e.textContent = i.type === 'text' ? '🙈' : '👁';
}

async function saveProfile() {
  var name =document.getElementById('pName').value.trim();
  var email=document.getElementById('pEmail').value.trim();
  var btn  =document.getElementById('btnSaveProfile');
  if(!name) { toast('error','Atenção','Informe seu nome');  return; }
  if(!email){ toast('error','Atenção','Informe seu email'); return; }
  if(btn){ btn.disabled=true; btn.textContent='Salvando...'; }
  try {
    await api.put('/profile',{name,email});
    var u=Auth.user(); u.name=name; u.email=email; Auth.save(Auth.token(),u);
    toast('success','Salvo','Perfil atualizado');
    populateSidebar();
  } catch(e){ toast('error','Erro',e.message); }
  finally{ if(btn){ btn.disabled=false; btn.textContent='💾 Salvar alterações'; } }
}