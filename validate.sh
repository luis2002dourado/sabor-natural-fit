#!/usr/bin/env bash
# ============================================================
# validate.sh — checagem rápida antes de publicar
# 1) JS inline (node --check)  2) CSS (chaves)  3) HTML (tags)
# 4) varredura de segredos/placeholders
# Sem dependências externas além de node + python3.
# ============================================================
cd "$(dirname "$0")"
OK=1

echo "== 1/4 JS inline (index.html) =="
python3 - <<'PY'
import re
html = open("index.html", encoding="utf-8").read()
scripts = re.findall(r"<script>(.*?)</script>", html, re.S)
if not scripts:
    print("  nenhum <script> inline encontrado")
    raise SystemExit(1)
open("/tmp/_sn_site.js", "w", encoding="utf-8").write(scripts[-1])
PY
if [ $? -ne 0 ]; then OK=0; fi
if node --check /tmp/_sn_site.js 2>/dev/null; then
  echo "  JS OK"
else
  echo "  JS COM ERRO (rode: node --check /tmp/_sn_site.js)"; OK=0
fi

echo "== 2/4 CSS (chaves balanceadas) =="
python3 - <<'PY'
import re
css = re.findall(r"<style>(.*?)</style>", open("index.html", encoding="utf-8").read(), re.S)[0]
a, b = css.count("{"), css.count("}")
print(f"  chaves: {a} abertas / {b} fechadas -> {'OK' if a == b else 'ERRO'}")
raise SystemExit(0 if a == b else 1)
PY
if [ $? -ne 0 ]; then OK=0; fi

echo "== 3/4 HTML (tags balanceadas) =="
python3 - <<'PY'
import re
h = open("index.html", encoding="utf-8").read()
bad = False
for t in ["section", "div", "button", "footer", "header", "details", "nav", "form"]:
    o = len(re.findall(r"<" + t + r"[\s>]", h))
    c = len(re.findall(r"</" + t + r">", h))
    if o != c:
        print(f"  {t}: {o} abertas / {c} fechadas -> ERRO"); bad = True
print("  OK" if not bad else "  ERRO")
raise SystemExit(0 if not bad else 1)
PY
if [ $? -ne 0 ]; then OK=0; fi

echo "== 4/4 varredura (secrets / placeholders) =="
FAIL=0
for p in "G-XXXXXXXXXX" "ghp_" "GIT_TOKEN=" "mcp-"; do
  if grep -rq "$p" index.html 2>/dev/null; then
    echo "  ENCONTRADO em index.html: $p"; FAIL=1
  fi
done
if [ "$FAIL" = "0" ]; then
  echo "  OK (sem placeholder de GA, token ou segredo no index.html)"
else
  OK=0
fi

echo ""
if [ "$OK" = "1" ]; then
  echo "✅ Tudo certo — pode publicar."
else
  echo "❌ Há problemas — corrija antes de publicar."
fi
exit $(( 1 - OK ))
