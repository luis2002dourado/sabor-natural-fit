# Monitoramento & Debugging — Sabor Natural

Este projeto é um **site estático** (HTML/CSS/JS vanilla, GitHub Pages, sem backend,
sem banco de dados, sem cache de servidor). As 10 regras DevOps foram aplicadas ao
que existe de verdade; onde não há equivalente direto, está registrado o que fazer
quando houver backend.

| # | Regra DevOps | Implementado neste projeto | Onde |
|---|---|---|---|
| 1 | Request ID único | `SESSION_ID` (visita) + `PAGE_ID` (carregamento) gerados no cliente; nº do pedido `#SN-...` ligado ao log | `assets/monitor.js` + hooks em `index.html` |
| 2 | Erro com stack + contexto | `error`/`unhandledrejection` capturados com stack completo, arquivo/linha/col, URL, viewport, UA e estado do carrinho | `assets/monitor.js` |
| 3 | Logs estruturados JSON | Ring buffer (300 entradas) em `localStorage`, sempre JSON (`level/type/msg/session/page/t/ms/data`) — nunca texto livre | `assets/monitor.js` |
| 4 | Health check detalhado | `SNmonitor.health()` (ready, menu renderizado, status, checkout, storage, imagens) + endpoint estático `health.json` | `assets/monitor.js` + `health.json` |
| 5 | Query logging com tempo | Instrumentação de `localStorage.getItem/setItem/removeItem` (o único "banco" do site), com ms e throttle | `assets/monitor.js` |
| 6 | Cache hit/miss | Resource Timing (`transferSize=0` = hit) com taxa e lista por imagem | `assets/monitor.js` |
| 7 | Métricas de performance | Navigation Timing (TTFB, domInteractive, domComplete, load), LCP, long tasks (proxy de CPU), heap/memória, cores | `assets/monitor.js` |
| 8 | Testes de regressão | Suite E2E Playwright do fluxo crítico (busca→folha→adicionar→sacola→validação→resumo→nº único→excluir) — 17 verificações | `qa/e2e.mjs` |
| 9 | Alertas configuráveis | Thresholds (`slowPageMs`), contadores de anomalia, webhook opcional (`SNmonitor.config({webhook})`) | `assets/monitor.js` |
| 10 | Deploy monitorado + rollback | `deploy.sh`: valida → publica → **smoke test** (HTTP 200 + marcadores) → **rollback automático** (`git revert` + push) em falha | `deploy.sh` |

## Como usar

### Em produção (nada a fazer — já ativo)
O `assets/monitor.js` carrega sozinho no site e:
- grava logs estruturados + anomalias no `localStorage` da sessão;
- expõe `window.SNmonitor` e `window.SN_HEALTH`.

### Depurar um problema (console do navegador)
```js
SNmonitor.report()      // dump JSON completo: logs, anomalias, thresholds
SNmonitor.download()    // baixa o report como .json (pode colar no suporte)
SNmonitor.health()      // estado detalhado dos checks
```

### Configurar alerta (webhook)
```js
// No console (ou via init): envia anomalias por sendBeacon
SNmonitor.config({ webhook: "https://seu-endpoint/alertas", slowPageMs: 4000 });
```
> ⚠️ Para um webhook **externo** funcionar, o CSP (`connect-src`) do `index.html`
> precisa liberar o host do endpoint. Hoje está `connect-src 'self'`.

### Deploy seguro
```bash
bash validate.sh   # lint: JS/CSS/HTML + varredura de segredos
bash deploy.sh     # publica + smoke test + rollback automático em falha
```

## Quando houver backend (loja de roupas e afins)
Aí as regras ganham forma completa:
1. **Request ID** → middleware que injeta `X-Request-Id` e devolve no header/log.
2. **Stack trace** → error handler com stack completo + request context.
3. **Logs JSON** → `pino`/`winston` JSON → stdout → coleta (Datadog/Grafana/CloudWatch).
4. **Health check** → `GET /health` com sub-checks (DB, cache, filas) e status `ok|degraded|down`.
5. **Query logging** → ORM com log de SQL + duração (ex.: Prisma `log: ['query']`).
6. **Cache hit/miss** → métricas no cliente de cache (Redis/CloudFront) por chave.
7. **Métricas** → `prom-client` (Prometheus): tempo de resposta, memória, CPU.
8. **Regressão** → CI que roda E2E a cada push (aqui já existe, só plugar).
9. **Alertas** → Grafana/PagerDuty com thresholds configuráveis.
10. **Deploy/rollback** → pipeline (GitHub Actions) com canary + rollback automático por métrica.
