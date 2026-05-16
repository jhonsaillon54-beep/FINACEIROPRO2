const API = 'http://localhost:5000/api';

const Auth = {
  token:    () => localStorage.getItem('fp_token'),
  user:     () => { try{ return JSON.parse(localStorage.getItem('fp_user')); }catch(e){ return null; } },
  save:     (token, user) => { localStorage.setItem('fp_token', token); localStorage.setItem('fp_user', JSON.stringify(user)); },
  clear:    () => { localStorage.removeItem('fp_token'); localStorage.removeItem('fp_user'); },
  isLogged: () => !!localStorage.getItem('fp_token'),
  logout:   () => { localStorage.clear(); window.location.href = 'login.html'; },
};

async function apiFetch(path, opts) {
  opts = opts || {};
  var token = Auth.token();
  var headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  if (opts.headers) { for (var k in opts.headers) headers[k] = opts.headers[k]; }

  var res = await fetch(API + path, {
    method:  opts.method  || 'GET',
    headers: headers,
    body:    opts.body    || undefined
  });

  // Se 401/422 redirecionar para login
  if (res.status === 401 || res.status === 422) {
    Auth.clear();
    window.location.href = 'login.html';
    throw new Error('Sessão expirada. Faça login novamente.');
  }

  var data = {};
  try { data = await res.json(); } catch(e) {}
  if (!res.ok) throw new Error(data.error || 'Erro ' + res.status);
  return data;
}

var api = {
  get:    function(path)       { return apiFetch(path); },
  post:   function(path, body) { return apiFetch(path, { method:'POST',   body: JSON.stringify(body) }); },
  put:    function(path, body) { return apiFetch(path, { method:'PUT',    body: JSON.stringify(body) }); },
  delete: function(path)       { return apiFetch(path, { method:'DELETE' }); },
};

// Formatters
var fmt = function(v) { return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0); };
var fmtDate = function(d) { try{ return new Intl.DateTimeFormat('pt-BR').format(new Date(d+'T12:00:00')); }catch(e){ return d||''; } };
var fmtWeekday = function(d) { try{ return new Date(d+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'short'}).replace('.',''); }catch(e){ return ''; } };
var fmtMonth = function(y,m) { var s=new Date(y,m,1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'}); return s.charAt(0).toUpperCase()+s.slice(1); };
var toDS = function(d) { return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); };
var esc = function(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); };

// Toast
function toast(type, title, msg) {
  var wrap = document.getElementById('toastWrap');
  if (!wrap) return;
  var icons = {success:'✅',error:'❌',info:'ℹ️',warning:'⚠️'};
  var el = document.createElement('div');
  el.className = 'toast ' + type;
  el.innerHTML = '<div class="toast-ico">'+(icons[type]||'ℹ️')+'</div>' +
    '<div class="toast-body"><div class="toast-title">'+esc(title)+'</div>' +
    (msg?'<div class="toast-msg">'+esc(msg)+'</div>':'') + '</div>' +
    '<button class="toast-close" onclick="this.parentElement.remove()">✕</button>';
  wrap.appendChild(el);
  setTimeout(function(){ el.remove(); }, 5000);
}

function openModal(id)  { var el=document.getElementById(id); if(el) el.classList.remove('hidden'); }
function closeModal(id) { var el=document.getElementById(id); if(el) el.classList.add('hidden'); }

function setBtnLoading(btn, loading, label) {
  if (!btn) return;
  btn.disabled = loading;
  btn.textContent = loading ? 'Aguarde...' : (label || 'Salvar');
}

function populateSidebarUser() {
  var u = Auth.user();
  if (!u) return;
  var name  = u.name  || 'Usuário';
  var email = u.email || '';
  var av    = u.avatar || '';
  document.querySelectorAll('.sidebar-user-name').forEach(function(el)  { el.textContent = name;  });
  document.querySelectorAll('.sidebar-user-email').forEach(function(el) { el.textContent = email; });
  if (av) {
    document.querySelectorAll('.sidebar-avatar-img').forEach(function(el) {
      el.innerHTML = '<img src="http://localhost:5000/uploads/'+av+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%">';
    });
  }
}