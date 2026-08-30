---
description: Publica o site no GitHub Pages
---

1. Rode `bash validate.sh`; pare se falhar.
2. Configure o git (`user.email site@sabor-natural.local`, `user.name Sabor Natural`).
3. Carregue o `.env` (`set -a && . ./.env && set +a`) e faça push para `main` usando o `GIT_TOKEN` — NUNCA imprima o token.
4. Aguarde o build do Pages (API: `repos/luis2002dourado/sabor-natural-fit/pages/builds/latest`) até o status `built`.
5. Confirme o site ao vivo com cache-buster: `https://luis2002dourado.github.io/sabor-natural-fit/?v=<timestamp>`.
