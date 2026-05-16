import os, json
from datetime import timedelta, date, datetime
from decimal import Decimal

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_jwt_extended import (
    JWTManager, create_access_token,
    jwt_required, get_jwt_identity
)
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
import mysql.connector

app = Flask(__name__)
@app.route('/')
def home():
    return jsonify({
        "status": "online",
        "api": "FINACEIROPRO2"
    })
app.config["SECRET_KEY"]               = "financepro-jwt-secret-2024"
app.config["JWT_SECRET_KEY"]           = "financepro-jwt-secret-2024"
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=48)
app.config["MAX_CONTENT_LENGTH"]       = 10 * 1024 * 1024

_BASE         = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.abspath(os.path.join(_BASE, "..", "uploads"))
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

CORS(app, origins="*", allow_headers=["Content-Type","Authorization"],
     methods=["GET","POST","PUT","DELETE","OPTIONS"], supports_credentials=False)

JWTManager(app)
ALLOWED = {"png","jpg","jpeg","gif","webp"}

DB = dict(host="localhost", user="root", password="@Jhon2008",
          database="financepro", charset="utf8mb4", autocommit=True)

# ── HELPERS ──────────────────────────────────────────────────
def db():
    return mysql.connector.connect(**DB)

def q(sql, p=(), fetch=False, lastid=False):
    c = db()
    cur = c.cursor(dictionary=True)
    cur.execute(sql, p)
    if fetch:   r = cur.fetchall(); cur.close(); c.close(); return r
    if lastid:  r = cur.lastrowid;  cur.close(); c.close(); return r
    r = cur.rowcount; cur.close(); c.close(); return r

def j(obj):
    if isinstance(obj, Decimal):        return float(obj)
    if isinstance(obj, (date,datetime)):return obj.isoformat()
    raise TypeError

def ok(data=None, code=200, **kw):
    p = {"ok": True}
    if data is not None: p["data"] = data
    p.update(kw)
    return app.response_class(json.dumps(p, default=j),
                               status=code, mimetype="application/json")

def err(msg, code=400):
    return app.response_class(json.dumps({"ok":False,"error":msg}),
                               status=code, mimetype="application/json")

def allowed(fn):
    return "." in fn and fn.rsplit(".",1)[1].lower() in ALLOWED

CATS = [
    ("Salário","income","💰","#10B981"),
    ("Freelance","income","💼","#3B82F6"),
    ("Investimentos","income","📈","#8B5CF6"),
    ("Outros Ganhos","income","💵","#06B6D4"),
    ("Alimentação","expense","🍔","#EF4444"),
    ("Transporte","expense","🚗","#F59E0B"),
    ("Moradia","expense","🏠","#64748B"),
    ("Saúde","expense","🏥","#14B8A6"),
    ("Lazer","expense","🎮","#EC4899"),
    ("Educação","expense","📚","#8B5CF6"),
    ("Compras","expense","🛒","#6366F1"),
    ("Assinaturas","expense","📱","#F97316"),
    ("Dívidas","expense","💳","#DC2626"),
    ("Outros","expense","📝","#94A3B8"),
]

def make_cats(uid):
    for name,t,icon,color in CATS:
        q("INSERT INTO categories(user_id,name,type,icon,color) VALUES(%s,%s,%s,%s,%s)",
          (uid,name,t,icon,color))

# ── AUTH ─────────────────────────────────────────────────────
@app.route("/api/auth/register", methods=["POST"])
def register():
    d = request.get_json(silent=True) or {}
    name  = (d.get("name")     or "").strip()
    email = (d.get("email")    or "").strip().lower()
    pwd   = (d.get("password") or "").strip()
    if not name or not email or not pwd:
        return err("Preencha todos os campos")
    if len(pwd) < 6:
        return err("Senha mínima de 6 caracteres")
    if q("SELECT id FROM users WHERE email=%s",(email,),fetch=True):
        return err("E-mail já cadastrado", 409)
    uid = q("INSERT INTO users(name,email,password) VALUES(%s,%s,%s)",
            (name, email, generate_password_hash(pwd)), lastid=True)
    make_cats(uid)
    return ok({"user_id": uid}, 201, message="Conta criada!")

@app.route("/api/auth/login", methods=["POST"])
def login():
    d = request.get_json(silent=True) or {}
    email = (d.get("email")    or "").strip().lower()
    pwd   = (d.get("password") or "").strip()
    if not email or not pwd:
        return err("E-mail e senha obrigatórios")
    rows = q("SELECT * FROM users WHERE email=%s",(email,),fetch=True)
    if not rows or not check_password_hash(rows[0]["password"], pwd):
        return err("E-mail ou senha incorretos", 401)
    u   = rows[0]
    tok = create_access_token(identity=str(u["id"]))
    return ok({"token": tok, "user": {
        "id":u["id"],"name":u["name"],"email":u["email"],"avatar":u["avatar"]
    }})

@app.route("/api/auth/me")
@jwt_required()
def me():
    uid  = int(get_jwt_identity())
    rows = q("SELECT id,name,email,avatar,created_at FROM users WHERE id=%s",(uid,),fetch=True)
    return ok(rows[0]) if rows else err("Não encontrado",404)

# ── PERFIL ───────────────────────────────────────────────────
@app.route("/api/profile", methods=["PUT"])
@jwt_required()
def update_profile():
    uid   = int(get_jwt_identity())
    d     = request.get_json(silent=True) or {}
    name  = (d.get("name")  or "").strip()
    email = (d.get("email") or "").strip().lower()
    if not name or not email: return err("Dados obrigatórios")
    dup = q("SELECT id FROM users WHERE email=%s AND id!=%s",(email,uid),fetch=True)
    if dup: return err("E-mail já usado",409)
    q("UPDATE users SET name=%s,email=%s WHERE id=%s",(name,email,uid))
    return ok(message="Perfil atualizado")

@app.route("/api/profile/avatar", methods=["POST"])
@jwt_required()
def upload_avatar():
    uid  = int(get_jwt_identity())
    file = request.files.get("avatar")
    if not file or not file.filename:
        return err("Nenhum arquivo")
    if not allowed(file.filename):
        return err("Use PNG, JPG ou WEBP")
    ext   = file.filename.rsplit(".",1)[1].lower()
    fname = f"avatar_{uid}.{ext}"
    path  = os.path.join(UPLOAD_FOLDER, fname)
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    file.save(path)
    q("UPDATE users SET avatar=%s WHERE id=%s",(fname,uid))
    return ok({"avatar": fname})

@app.route("/uploads/<path:fn>")
def serve_file(fn):
    return send_from_directory(UPLOAD_FOLDER, fn)

# ── CATEGORIAS ───────────────────────────────────────────────
@app.route("/api/categories")
@jwt_required()
def list_cats():
    uid = int(get_jwt_identity())
    t   = request.args.get("type")
    if t: rows = q("SELECT * FROM categories WHERE user_id=%s AND type=%s ORDER BY name",(uid,t),fetch=True)
    else: rows = q("SELECT * FROM categories WHERE user_id=%s ORDER BY type,name",(uid,),fetch=True)
    return ok(rows)

@app.route("/api/categories", methods=["POST"])
@jwt_required()
def create_cat():
    uid  = int(get_jwt_identity())
    d    = request.get_json(silent=True) or {}
    name = (d.get("name") or "").strip()
    if not name: return err("Nome obrigatório")
    cid = q("INSERT INTO categories(user_id,name,type,icon,color) VALUES(%s,%s,%s,%s,%s)",
            (uid,name,d.get("type","expense"),d.get("icon","💰"),d.get("color","#6366F1")),lastid=True)
    return ok({"id":cid},201)

@app.route("/api/categories/<int:cid>", methods=["PUT"])
@jwt_required()
def update_cat(cid):
    uid = int(get_jwt_identity())
    d   = request.get_json(silent=True) or {}
    q("UPDATE categories SET name=%s,icon=%s,color=%s WHERE id=%s AND user_id=%s",
      (d.get("name"),d.get("icon","💰"),d.get("color","#6366F1"),cid,uid))
    return ok(message="Atualizada")

@app.route("/api/categories/<int:cid>", methods=["DELETE"])
@jwt_required()
def delete_cat(cid):
    uid = int(get_jwt_identity())
    has = q("SELECT id FROM transactions WHERE category_id=%s AND user_id=%s LIMIT 1",(cid,uid),fetch=True)
    if has: return err("Categoria tem transações",409)
    q("DELETE FROM categories WHERE id=%s AND user_id=%s",(cid,uid))
    return ok(message="Excluída")

# ── TRANSAÇÕES ───────────────────────────────────────────────
@app.route("/api/transactions")
@jwt_required()
def list_tx():
    uid  = int(get_jwt_identity())
    rows = q("""SELECT t.*,c.name AS category_name,c.icon,c.color
                FROM transactions t JOIN categories c ON c.id=t.category_id
                WHERE t.user_id=%s ORDER BY t.date DESC,t.id DESC LIMIT 500""",
             (uid,),fetch=True)
    return ok(rows)

@app.route("/api/transactions", methods=["POST"])
@jwt_required()
def create_tx():
    uid = int(get_jwt_identity())
    d   = request.get_json(silent=True) or {}
    cat_id = d.get("category_id")
    desc   = (d.get("description") or "").strip()
    amount = d.get("amount")
    typ    = d.get("type","expense")
    dt     = d.get("date")
    notes  = (d.get("notes") or "").strip() or None
    if not all([cat_id,desc,amount,dt]):
        return err("Campos obrigatórios: category_id, description, amount, date")
    cat = q("SELECT id FROM categories WHERE id=%s AND user_id=%s",(cat_id,uid),fetch=True)
    if not cat: return err("Categoria inválida",403)
    tid = q("INSERT INTO transactions(user_id,category_id,description,amount,type,date,notes) VALUES(%s,%s,%s,%s,%s,%s,%s)",
            (uid,cat_id,desc,amount,typ,dt,notes),lastid=True)
    return ok({"id":tid},201)

@app.route("/api/transactions/<int:tid>", methods=["PUT"])
@jwt_required()
def update_tx(tid):
    uid = int(get_jwt_identity())
    d   = request.get_json(silent=True) or {}
    q("""UPDATE transactions SET category_id=%s,description=%s,amount=%s,
         type=%s,date=%s,notes=%s WHERE id=%s AND user_id=%s""",
      (d.get("category_id"),d.get("description"),d.get("amount"),
       d.get("type"),d.get("date"),d.get("notes") or None,tid,uid))
    return ok(message="Atualizada")

@app.route("/api/transactions/<int:tid>", methods=["DELETE"])
@jwt_required()
def delete_tx(tid):
    uid = int(get_jwt_identity())
    q("DELETE FROM transactions WHERE id=%s AND user_id=%s",(tid,uid))
    return ok(message="Excluída")

@app.route("/api/transactions/summary")
@jwt_required()
def tx_summary():
    uid  = int(get_jwt_identity())
    rows = q("""SELECT
        COALESCE(SUM(CASE WHEN type='income'  THEN amount ELSE 0    END),0) total_income,
        COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0    END),0) total_expense,
        COALESCE(SUM(CASE WHEN type='income'  THEN amount ELSE -amount END),0) balance
        FROM transactions WHERE user_id=%s""",(uid,),fetch=True)
    return ok(rows[0])

@app.route("/api/transactions/by-category")
@jwt_required()
def by_cat():
    uid  = int(get_jwt_identity())
    rows = q("""SELECT c.name,c.icon,c.color,SUM(t.amount) total,COUNT(*) qty
                FROM transactions t JOIN categories c ON c.id=t.category_id
                WHERE t.user_id=%s AND t.type='expense' GROUP BY c.id ORDER BY total DESC""",
             (uid,),fetch=True)
    return ok(rows)

@app.route("/api/transactions/monthly")
@jwt_required()
def monthly():
    uid   = int(get_jwt_identity())
    year  = request.args.get("year",  datetime.now().year,  type=int)
    month = request.args.get("month", datetime.now().month, type=int)
    rows  = q("""SELECT type,SUM(amount) total,COUNT(*) qty
                 FROM transactions WHERE user_id=%s AND YEAR(date)=%s AND MONTH(date)=%s
                 GROUP BY type""",(uid,year,month),fetch=True)
    return ok(rows)

# ── METAS ────────────────────────────────────────────────────
@app.route("/api/goals")
@jwt_required()
def list_goals():
    uid  = int(get_jwt_identity())
    rows = q("SELECT * FROM goals WHERE user_id=%s ORDER BY status,deadline",(uid,),fetch=True)
    return ok(rows)

@app.route("/api/goals", methods=["POST"])
@jwt_required()
def create_goal():
    uid    = int(get_jwt_identity())
    d      = request.get_json(silent=True) or {}
    title  = (d.get("title") or "").strip()
    target = d.get("target_amount")
    if not title or not target: return err("Título e valor alvo obrigatórios")
    gid = q("INSERT INTO goals(user_id,title,description,target_amount,current_amount,deadline) VALUES(%s,%s,%s,%s,%s,%s)",
            (uid,title,d.get("description",""),target,d.get("current_amount",0),d.get("deadline") or None),lastid=True)
    return ok({"id":gid},201)

@app.route("/api/goals/<int:gid>", methods=["PUT"])
@jwt_required()
def update_goal(gid):
    uid = int(get_jwt_identity())
    d   = request.get_json(silent=True) or {}
    q("""UPDATE goals SET title=%s,description=%s,target_amount=%s,
         current_amount=%s,deadline=%s,status=%s WHERE id=%s AND user_id=%s""",
      (d.get("title"),d.get("description"),d.get("target_amount"),
       d.get("current_amount",0),d.get("deadline") or None,d.get("status","active"),gid,uid))
    return ok(message="Atualizada")

@app.route("/api/goals/<int:gid>", methods=["DELETE"])
@jwt_required()
def delete_goal(gid):
    uid = int(get_jwt_identity())
    q("DELETE FROM goals WHERE id=%s AND user_id=%s",(gid,uid))
    return ok(message="Excluída")

# ── VERIFICAR EMAIL (para reset) ─────────────────────────────
@app.route("/api/auth/check-email", methods=["POST"])
def check_email():
    d     = request.get_json(silent=True) or {}
    email = (d.get("email") or "").strip().lower()
    if not email: return err("E-mail obrigatório")
    rows = q("SELECT id,name FROM users WHERE email=%s",(email,),fetch=True)
    if not rows: return err("E-mail não encontrado. Verifique e tente novamente.", 404)
    return ok({"name": rows[0]["name"]})

# ── TROCAR SENHA (logado) ────────────────────────────────────
@app.route("/api/profile/password", methods=["POST"])
@jwt_required()
def change_password():
    uid  = int(get_jwt_identity())
    d    = request.get_json(silent=True) or {}
    old_pwd = (d.get("old_password") or "").strip()
    new_pwd = (d.get("new_password") or "").strip()
    if not old_pwd or not new_pwd:
        return err("Senha atual e nova senha são obrigatórias")
    if len(new_pwd) < 6:
        return err("Nova senha deve ter no mínimo 6 caracteres")
    rows = q("SELECT password FROM users WHERE id=%s",(uid,),fetch=True)
    if not rows or not check_password_hash(rows[0]["password"], old_pwd):
        return err("Senha atual incorreta", 401)
    q("UPDATE users SET password=%s WHERE id=%s",(generate_password_hash(new_pwd), uid))
    return ok(message="Senha alterada com sucesso!")

# ── RESET SENHA (sem login — por email) ──────────────────────
@app.route("/api/auth/reset-password", methods=["POST"])
def reset_password():
    d     = request.get_json(silent=True) or {}
    email = (d.get("email")        or "").strip().lower()
    new_pwd=(d.get("new_password") or "").strip()
    if not email or not new_pwd:
        return err("E-mail e nova senha são obrigatórios")
    if len(new_pwd) < 6:
        return err("Senha deve ter no mínimo 6 caracteres")
    rows = q("SELECT id FROM users WHERE email=%s",(email,),fetch=True)
    if not rows:
        return err("E-mail não encontrado", 404)
    q("UPDATE users SET password=%s WHERE email=%s",(generate_password_hash(new_pwd), email))
    return ok(message="Senha redefinida com sucesso!")

# ── HEALTH ───────────────────────────────────────────────────
@app.route("/api/health")
def health():
    try:    db().close(); dbs="ok"
    except: dbs="error"
    return ok({"version":"2.0","db":dbs,"uploads":UPLOAD_FOLDER})

if __name__ == "__main__":
    print(f"\n✅ FinancePro v2 iniciado!")
    print(f"📁 Uploads: {UPLOAD_FOLDER}")
    print(f"🌐 API: http://localhost:5000/api/health\n")
    app.run(debug=True, host="0.0.0.0", port=5000)