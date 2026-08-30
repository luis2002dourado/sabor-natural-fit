# Sabor Natural — guia do projeto

Cardápio digital **mobile-first** do restaurante Sabor Natural (Dom Pedro, MA).
Visual estilo Uber Eats, carrinho, resumo do pedido e envio via WhatsApp.

- **Site publicado:** https://luis2002dourado.github.io/sabor-natural-fit/
- **Repositório:** https://github.com/luis2002dourado/sabor-natural-fit

## Stack
HTML + CSS + JS vanilla em um único `index.html` (~1.700 linhas). Sem build, sem backend.
Carrinho em `localStorage`. Checkout via `wa.me`. GitHub Pages (branch `main`, raiz `/`).

## Arquivos principais
- `index.html` — site inteiro (HTML + CSS + JS inline). Cardápio no objeto `CATEGORIAS`.
- `obrigado.html` — pós-envio (recebe `?n=<número>`). `privacidade.html` — LGPD.
- `404.html`, `robots.txt`, `sitemap.xml`, `_headers` (válido só em Netlify/Cloudflare).
- `deploy.sh` — publica no Pages (usa `GIT_TOKEN` do `.env`).
- `validate.sh` — valida JS/CSS/HTML + varre segredos antes de publicar.
- `assets/` — logo, fotos (ilustrativas), favicon, apple-touch-icon, OG image.

## Regras CRÍTICAS (não quebrar)
- **Privacidade:** nome/endereço/observações NUNCA vão para `localStorage`; campos sempre limpos.
  Só `sn_carrinho` persiste (até o envio). Após envio, limpar carrinho + `sn_numero` + campos.
- **Número do pedido nunca repete:** `#SN-` + `Date.now().toString(36)` (ex.: `#SN-M7K2F9AB`).
- **Não zerar a sacola antes de o WhatsApp abrir** (abre WhatsApp → `visibilitychange`/botão "já enviei" → limpa).
- **Sem placeholder de Google Analytics** (`G-XXXXXXXXXX` proibido). Se ligar: ID real + aviso LGPD.
- **Imagens meramente ilustrativas** — manter os avisos ("📷 imagem ilustrativa").
- **Fonte:** Nunito (500–900) no corpo; valores/preços em `--mono` (assinatura "comanda").
- **Nunca commitar `.env`** (contém `GIT_TOKEN`). Já está no `.gitignore`.
- Após cada mudança de conteúdo: validar (`bash validate.sh`) e **publicar** (commit + push).
- Git: `user.email site@sabor-natural.local` / `user.name Sabor Natural` (configurar antes de commitar).

## Dados oficiais
- WhatsApp: `559992338700` — (99) 9233-8700
- Instagram: https://www.instagram.com/sabornaturalfit_dp
- Endereço: Rua Bela Vista, Bairro Cândido Hermes, Dom Pedro-MA, CEP 65765-000
- Coordenadas: -5.0279485, -44.4378402
- Horários: Seg–Sáb 7h–13h / 15h–20h • Dom: encomendas (status dinâmico usa America/Sao_Paulo)

## Comandos
- Validar: `bash validate.sh`
- Monitoramento/debugging: ver `MONITORING.md` (10 regras DevOps mapeadas). No console:
  `SNmonitor.report()` (logs JSON), `SNmonitor.health()` (estado), `SNmonitor.config({webhook})` (alertas).
- Teste E2E (navegador real): `BASE=http://localhost:8000/index.html node qa/e2e.mjs`
  (requer `npm i -D playwright && npx playwright install chromium`; cobre busca→folha→
  adicionar→sacola→validação→resumo→nº único→excluir item, e falha se houver erro de console/JS)
- Preview local: `python3 -m http.server 8000 --bind 0.0.0.0`
- Deploy: `bash deploy.sh` (token vem do `.env`)
- Commit manual:
  ```bash
  set -a && . ./.env && set +a
  git config user.email "site@sabor-natural.local"; git config user.name "Sabor Natural"
  git add -A && git commit -m "mensagem"
  git push "https://x-access-token:${GIT_TOKEN}@github.com/luis2002dourado/sabor-natural-fit.git" HEAD:main
  ```
