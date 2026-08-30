#!/usr/bin/env bash
# ============================================================
# Deploy: Sabor Natural → GitHub Pages
# Uso: GIT_TOKEN=ghp_... bash deploy.sh   (ou ter GIT_TOKEN no .env)
# ============================================================
set -euo pipefail
cd "$(dirname "$0")"

# Carrega .env se existir (token fica fora do código e do Git)
[ -f .env ] && set -a && . ./.env && set +a
: "${GIT_TOKEN:?Defina GIT_TOKEN no .env ou na variável de ambiente}"

REPO="${REPO:-sabor-natural-fit}"

api() { # chamada autenticada na API do GitHub
  curl -sS -H "Authorization: Bearer $GIT_TOKEN" -H "Accept: application/vnd.github+json" "$@"
}

echo "1/6 — Identificando sua conta do GitHub..."
LOGIN=$(api https://api.github.com/user | python3 -c "import json,sys;print(json.load(sys.stdin)['login'])")
echo "   → conta: $LOGIN | repositório: $REPO"

echo "2/6 — Criando o repositório (público — pré-requisito do Pages grátis)..."
api -X POST https://api.github.com/user/repos \
  -d "{\"name\":\"$REPO\",\"private\":false,\"description\":\"Site oficial do Sabor Natural — comida fitness • Dom Pedro, MA\"}" \
  | python3 -c "import json,sys;d=json.load(sys.stdin);print('   →', d.get('html_url', '(já existia ou erro: %s)'))" || true

echo "3/6 — Ajustando URLs absolutas (robots/sitemap/OG) para o endereço do Pages..."
BASE="https://${LOGIN}.github.io/${REPO}"
sed -i "s|https://sabornatural.com.br|${BASE}|g" sitemap.xml robots.txt
sed -i "s|content=\"assets/og.jpg\"|content=\"${BASE}/assets/og.jpg\"|g" index.html
grep -q 'rel="canonical"' index.html || \
  sed -i "s|<link rel=\"icon\" href=\"assets/logo.jpg\">|<link rel=\"icon\" href=\"assets/logo.jpg\">\n<link rel=\"canonical\" href=\"${BASE}/\">\n<meta property=\"og:url\" content=\"${BASE}/\">|" index.html

echo "4/6 — Atualizando health.json (versão + data do deploy)..."
python3 - <<'PY'
import json, datetime
p = "health.json"
try:
    d = json.load(open(p, encoding="utf-8"))
    now = datetime.datetime.now(datetime.timezone.utc)
    d["version"] = now.strftime("%Y-%m-%d")
    d["lastDeploy"] = now.strftime("%Y-%m-%dT%H:%M:%SZ")
    json.dump(d, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print("   → health.json atualizado")
except Exception as e:
    print("   → health.json não atualizado:", e)
PY

echo "4/6 — Commitando o código (sem .env — protegido pelo .gitignore)..."
[ -d .git ] || git init -q -b main
git config user.email "site@sabor-natural.local" >/dev/null
git config user.name  "Sabor Natural" >/dev/null
git add -A
git commit -q -m "deploy: site Sabor Natural 🥗" || echo "   → nada novo para commitar"

echo "5/6 — Enviando para o GitHub (token usado só neste push, nada fica salvo)..."
git push -q "https://x-access-token:${GIT_TOKEN}@github.com/${LOGIN}/${REPO}.git" HEAD:main --force-with-lease 2>/dev/null \
  || git push -q "https://x-access-token:${GIT_TOKEN}@github.com/${LOGIN}/${REPO}.git" HEAD:main

echo "6/6 — Ativando o GitHub Pages (branch main, raiz)..."
api -X POST "https://api.github.com/repos/${LOGIN}/${REPO}/pages" \
  -d '{"source":{"branch":"main","path":"/"}}' >/dev/null 2>&1 || true

URL="${BASE}/"
echo ""
echo "7/7 — Smoke test no site publicado + rollback automático..."
CODE="000"
for i in $(seq 1 12); do
  sleep 10
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "$URL" || true)
  [ "$CODE" = "200" ] && break
done
SMOKE_OK=0
if [ "$CODE" = "200" ]; then
  HTML=$(curl -s "$URL" || true)
  if echo "$HTML" | grep -q 'id="btn-zap"' && echo "$HTML" | grep -q 'versão'; then SMOKE_OK=1; fi
fi
if [ "$SMOKE_OK" != "1" ]; then
  echo "❌ Smoke test FALHOU (HTTP $CODE) — revertendo o deploy..."
  git revert HEAD --no-edit >/dev/null 2>&1 || true
  git push -q "https://x-access-token:${GIT_TOKEN}@github.com/${LOGIN}/${REPO}.git" HEAD:main
  echo "↩️  Rollback concluído. Último commit revertido."
  exit 1
fi
echo "✅ Smoke test ok (HTTP 200 + marcadores do site presentes)."

echo "🎉 Pronto! Deploy concluído e verificado."
echo "➡️  SEU SITE: $URL"
echo "   (se der 404 no primeiro minuto, é o build do Pages terminando)"
