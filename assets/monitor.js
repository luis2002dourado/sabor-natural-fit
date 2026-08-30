/* ============================================================
   Sabor Natural — Monitor de produção (observabilidade client-side)
   Mapeamento das 10 regras DevOps para um site estático:

   1) Request ID único      -> SESSION_ID / PAGE_ID + nº do pedido rastreado
   2) Stack trace + contexto -> onerror / unhandledrejection com contexto
   3) Logs estruturados JSON -> ring buffer em localStorage (nada de texto livre)
   4) Health check detalhado -> SNmonitor.health() + /health.json (endpoint estático)
   5) Query logging c/ tempo -> instrumenta localStorage (único "banco" do site)
   6) Cache hit/miss        -> Resource Timing (transferSize=0 = hit)
   7) Métricas de performance-> Navigation Timing, LCP, long tasks, memória
   8) Testes de regressão   -> qa/e2e.mjs (Playwright, fluxo crítico)
   9) Alertas configuráveis -> thresholds + webhook opcional
   10) Rollback automático  -> deploy.sh (smoke test + git revert)

   Uso:
     SNmonitor.log("info","evento","mensagem",{dado:1});
     SNmonitor.health();     // objeto detalhado do estado
     SNmonitor.report();     // dump JSON completo (logs + anomalias)
     SNmonitor.config({ webhook:"https://...", slowPageMs:4000 });
   ============================================================ */
(function () {
  'use strict';
  if (window.SNmonitor) return;

  var LS_LOGS = 'sn_monitor_logs';
  var CAP = 300;

  function id() {
    return Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 7).toUpperCase();
  }
  var SESSION_ID = id();   // identifica a visita/sessão (rastreável)
  var PAGE_ID = id();      // identifica este carregamento de página

  var logs = [];
  try { var v = JSON.parse(localStorage.getItem(LS_LOGS) || '[]'); if (Array.isArray(v)) logs = v; } catch (e) {}

  function save() { try { localStorage.setItem(LS_LOGS, JSON.stringify(logs.slice(-CAP))); } catch (e) {} }
  function nowIso() { return new Date().toISOString(); }
  function perfNow() { return (window.performance && performance.now) ? Math.round(performance.now()) : null; }

  var ANOMALIAS = { js_error: 0, asset_fail: 0, slow_page: 0, unhandled_rejection: 0, health_degraded: 0 };
  var thresholds = { slowPageMs: 4000 };
  var webhook = null;
  try { webhook = localStorage.getItem('sn_monitor_webhook') || null; } catch (e) {}

  function push(level, type, msg, data) {
    var entry = {
      level: level, type: type, msg: msg,
      session: SESSION_ID, page: PAGE_ID,
      t: nowIso(), ms: perfNow(),
      data: data || {}
    };
    logs.push(entry);
    if (logs.length > CAP) logs = logs.slice(-CAP);
    save();
    try { console.debug('[monitor]', entry); } catch (e) {}
    detectAnomaly(entry);
    return entry;
  }

  /* Regra 9 — anomalias + alerta (webhook opcional).
     Obs.: para um webhook externo funcionar, o CSP (connect-src) precisa liberar o host. */
  function detectAnomaly(entry) {
    var is = false;
    if (entry.type === 'js_error') { ANOMALIAS.js_error++; is = true; }
    if (entry.type === 'unhandled_rejection') { ANOMALIAS.unhandled_rejection++; is = true; }
    if (entry.type === 'asset_fail') { ANOMALIAS.asset_fail++; is = true; }
    if (entry.type === 'perf' && entry.data.loadMs && entry.data.loadMs > thresholds.slowPageMs) { ANOMALIAS.slow_page++; is = true; }
    if (entry.type === 'health' && entry.data.status === 'degraded') { ANOMALIAS.health_degraded++; is = true; }
    if (is) notify({ anomaly: entry.type, detail: entry.data, session: SESSION_ID, page: PAGE_ID, t: nowIso() });
  }
  function notify(payload) {
    if (!webhook) return;
    try {
      if (navigator.sendBeacon) navigator.sendBeacon(webhook, JSON.stringify(payload));
      else { var r = new XMLHttpRequest(); r.open('POST', webhook, true); r.send(JSON.stringify(payload)); }
    } catch (e) { push('warn', 'notify_fail', 'falha ao notificar webhook', { err: String(e) }); }
  }

  /* Regra 2 — erro com stack trace completo + contexto */
  function ctx() {
    var d = {
      url: location.href, ua: navigator.userAgent, vw: innerWidth, vh: innerHeight,
      online: navigator.onLine, cores: navigator.hardwareConcurrency || null,
      mem: navigator.deviceMemory || null
    };
    try {
      var c = JSON.parse(localStorage.getItem('sn_carrinho') || '[]');
      if (Array.isArray(c)) d.cart = { itens: c.length, qtd: c.reduce(function (s, i) { return s + (i.qtd || 0); }, 0) };
    } catch (e) {}
    return d;
  }
  window.addEventListener('error', function (ev) {
    var t = ev.target;
    if (t && t.tagName && (t.tagName === 'IMG' || t.tagName === 'SCRIPT' || t.tagName === 'LINK')) {
      push('error', 'asset_fail', 'recurso não carregou', { tag: t.tagName, src: (t.src || t.href || '').slice(0, 160) });
      return;
    }
    push('error', 'js_error', ev.message || 'erro JS', {
      file: ev.filename, line: ev.lineno, col: ev.colno,
      stack: (ev.error && ev.error.stack) ? ev.error.stack.slice(0, 1200) : null,
      context: ctx()
    });
  }, true);
  window.addEventListener('unhandledrejection', function (ev) {
    var reason = ev.reason;
    push('error', 'unhandled_rejection', 'promise rejeitada sem tratamento', {
      reason: String((reason && reason.message) || reason).slice(0, 300),
      stack: (reason && reason.stack) ? reason.stack.slice(0, 1200) : null,
      context: ctx()
    });
  });

  /* Regra 5 — query logging do localStorage (o "banco de dados" do site), com tempo */
  try {
    var _g = Storage.prototype.getItem, _s = Storage.prototype.setItem, _r = Storage.prototype.removeItem;
    var lastLs = 0;
    Storage.prototype.getItem = function (k) {
      var t0 = (window.performance && performance.now) ? performance.now() : Date.now();
      var v;
      try { v = _g.call(this, k); } finally {
        var t1 = (window.performance && performance.now) ? performance.now() : Date.now();
        if (k && k.indexOf('sn_') === 0 && t1 - lastLs > 400) { lastLs = t1; push('debug', 'storage', 'get ' + k, { key: k, ms: Math.round((t1 - t0) * 100) / 100 }); }
      }
      return v;
    };
    Storage.prototype.setItem = function (k, v) {
      var t0 = (window.performance && performance.now) ? performance.now() : Date.now();
      try { _s.call(this, k, v); } finally {
        var t1 = (window.performance && performance.now) ? performance.now() : Date.now();
        if (k && k.indexOf('sn_') === 0 && t1 - lastLs > 400) { lastLs = t1; push('debug', 'storage', 'set ' + k, { key: k, ms: Math.round((t1 - t0) * 100) / 100 }); }
      }
    };
    Storage.prototype.removeItem = function (k) {
      var t0 = (window.performance && performance.now) ? performance.now() : Date.now();
      try { _r.call(this, k); } finally {
        var t1 = (window.performance && performance.now) ? performance.now() : Date.now();
        if (k && k.indexOf('sn_') === 0 && t1 - lastLs > 400) { lastLs = t1; push('debug', 'storage', 'remove ' + k, { key: k, ms: Math.round((t1 - t0) * 100) / 100 }); }
      }
    };
  } catch (e) { push('warn', 'storage', 'não foi possível instrumentar localStorage', { err: String(e) }); }

  /* Regra 6 — cache hit/miss */
  function collectCache() {
    if (!window.performance || !performance.getEntriesByType) return;
    var res = performance.getEntriesByType('resource') || [];
    var hits = 0, misses = 0, imgs = [];
    res.forEach(function (r) {
      var cached = r.transferSize === 0 && r.decodedBodySize > 0;
      if (cached) hits++; else misses++;
      if (r.initiatorType === 'img') imgs.push({ src: (r.name || '').split('/').pop(), cached: cached });
    });
    push('info', 'cache', 'hit/miss de recursos', {
      hits: hits, misses: misses,
      rate: (hits + misses) ? Math.round(hits / (hits + misses) * 100) : null,
      imagens: imgs.slice(0, 30)
    });
  }

  /* Regra 7 — métricas de performance (tempo, memória, proxy de CPU) */
  function collectPerf() {
    if (!window.performance || !performance.getEntriesByType) return;
    var nav = performance.getEntriesByType('navigation')[0];
    var d = { loadMs: null, ttfb: null, domInteractive: null, domComplete: null, longTasks: 0, heapUsedMb: null, cores: navigator.hardwareConcurrency || null, memGb: navigator.deviceMemory || null };
    if (nav) {
      d.ttfb = Math.round(nav.responseStart);
      d.domInteractive = Math.round(nav.domInteractive);
      d.domComplete = Math.round(nav.domComplete);
      d.loadMs = Math.round(nav.loadEventEnd || nav.domComplete || 0);
    }
    if (performance.memory) {
      d.heapUsedMb = Math.round(performance.memory.usedJSHeapSize / 1048576 * 10) / 10;
      d.heapLimitMb = Math.round(performance.memory.jsHeapSizeLimit / 1048576 * 10) / 10;
    }
    push('info', 'perf', 'métricas de carregamento', d);
  }
  try {
    new PerformanceObserver(function (list) {
      var e = list.getEntries(); var last = e[e.length - 1];
      if (last) push('info', 'webvital', 'LCP', { lcpMs: Math.round(last.startTime) });
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch (e) {}
  try {
    var lt = 0;
    new PerformanceObserver(function (list) { lt += list.getEntries().length; })
      .observe({ type: 'longtask', buffered: true });
    window.addEventListener('load', function () {
      setTimeout(function () { if (lt) push('info', 'perf', 'long tasks (proxy de CPU)', { longTasks: lt }); }, 3000);
    });
  } catch (e) {}

  /* Regra 4 — health check detalhado */
  function runHealth() {
    var checks = {};
    checks.ready = document.readyState === 'complete' || document.readyState === 'interactive';
    var m = document.getElementById('menu');
    checks.menu = !!(m && m.children.length);
    checks.status = !!document.getElementById('status-loja');
    checks.checkout = !!document.getElementById('btn-zap');
    checks.storage = (function () {
      try { localStorage.setItem('sn_health', '1'); localStorage.removeItem('sn_health'); return true; }
      catch (e) { return false; }
    })();
    var bad = [];
    Array.prototype.forEach.call(document.images, function (im) {
      if (im.complete && im.naturalWidth === 0 && im.src) bad.push((im.getAttribute('src') || im.src).slice(0, 160));
    });
    checks.images = bad.length === 0;
    var ok = checks.ready && checks.menu && checks.status && checks.checkout && checks.storage && checks.images;
    var h = { status: ok ? 'ok' : 'degraded', ts: nowIso(), session: SESSION_ID, page: PAGE_ID, checks: checks, badImages: bad, anomalias: ANOMALIAS };
    window.SN_HEALTH = h;
    push(ok ? 'info' : 'error', 'health', ok ? 'health check ok' : 'health check degradado', h);
    return h;
  }

  window.addEventListener('load', function () {
    setTimeout(collectPerf, 300);
    setTimeout(collectCache, 300);
    setTimeout(runHealth, 500);
  });

  /* Regra 1 — request ID + API pública */
  window.SNmonitor = {
    session: SESSION_ID,
    page: PAGE_ID,
    log: function (level, type, msg, data) { push(level, type, msg, data); },
    health: runHealth,
    report: function () {
      return { generated: nowIso(), session: SESSION_ID, page: PAGE_ID, anomalias: ANOMALIAS, thresholds: thresholds, webhook: webhook, logs: logs.slice(-CAP) };
    },
    download: function () {
      var blob = new Blob([JSON.stringify(this.report(), null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'sn-monitor-' + SESSION_ID + '.json'; a.click();
    },
    config: function (opts) {
      if (opts && opts.webhook) { webhook = opts.webhook; try { localStorage.setItem('sn_monitor_webhook', webhook); } catch (e) {} }
      if (opts && opts.slowPageMs) thresholds.slowPageMs = opts.slowPageMs;
    }
  };

  push('info', 'boot', 'monitor iniciado', { session: SESSION_ID, page: PAGE_ID });
})();
