---
description: Roda o teste E2E no navegador (Playwright) contra o preview local
---

1. Garanta o preview no ar: `python3 -m http.server 8000 --bind 0.0.0.0` (se não estiver, inicie).
2. Rode `BASE=http://localhost:8000/index.html node qa/e2e.mjs`.
3. Mostre o resultado (✅/❌). Se algo falhar, investigue e corrija ANTES de publicar.
