// ============================================================
// Teste E2E (Playwright) — fluxo completo do site
// Uso:
//   1) suba o preview:  python3 -m http.server 8000 --bind 0.0.0.0
//   2) instale:         npm i -D playwright && npx playwright install chromium
//   3) rode:            BASE=http://localhost:8000/index.html node qa/e2e.mjs
// Cobre: carga, status, busca da marmita, folha, adicionar,
//        sacola, validação de nome/endereço, resumo, nº do pedido,
//        botão WhatsApp, excluir item e erros de console/JS.
// ============================================================
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:8000/index.html';
const results = [];
const pass = (name, ok, extra = '') =>
  results.push({ name, ok, extra }) && console.log(`${ok ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push('PAGEERROR: ' + e.message));

await page.goto(BASE, { waitUntil: 'networkidle' });
pass('Carrega sem erro de rede', (await page.title()).includes('Sabor Natural'), await page.title());

const status = await page.locator('#status-loja').textContent();
pass('Status aberto/fechado renderizado', /[Aa]berto|[Ff]echado|[Ee]ncomendas/.test(status), status.trim());

await page.fill('#campo-busca', 'marmita');
await page.waitForTimeout(200);
const resTxt = await page.locator('#resultados').textContent();
pass('Busca "marmita" acha Marmita do Dia', resTxt.includes('Marmita do Dia'), '');

await page.click('#resultados .res-linha[data-marmita]');
await page.waitForTimeout(450);
const folhaAberta = await page.locator('#folha').evaluate(el => el.classList.contains('aberta'));
const folhaNome = await page.locator('#f-nome').textContent();
pass('Folha da Marmita abre', folhaAberta && folhaNome.includes('Marmita'), folhaNome.trim());

await page.click('#f-add');
await page.waitForTimeout(400);
const badge = await page.locator('#badge').textContent();
const barraOn = await page.locator('#barra').evaluate(el => el.classList.contains('on'));
pass('Marmita adicionada (badge=1, barra visível)', badge.trim() === '1' && barraOn, 'badge=' + badge.trim());

await page.click('#btn-sacola');
await page.waitForTimeout(400);
const sacolaTxt = await page.locator('#sacola-itens').textContent();
const sTotal = await page.locator('#s-total').textContent();
pass('Sacola mostra a Marmita', sacolaTxt.includes('Marmita do Dia'), '');
pass('Total correto (R$ 25,00)', /25,00/.test(sTotal), sTotal.trim());

await page.click('#btn-revisar');
await page.waitForTimeout(300);
const nomeErro = await page.locator('#c-nome').evaluate(el => el.classList.contains('erro'));
pass('Exige nome (campo marca erro)', nomeErro, '');

await page.fill('#c-nome', 'Teste E2E');
await page.click('#btn-revisar');
await page.waitForTimeout(300);
const endErro = await page.locator('#c-end').evaluate(el => el.classList.contains('erro'));
pass('Exige endereço (modo entrega) também', endErro, '');

await page.fill('#c-end', 'Rua Teste, 123');
await page.click('#btn-revisar');
await page.waitForTimeout(400);
const resumoAberto = await page.locator('#tela-resumo').evaluate(el => el.classList.contains('aberta'));
const rNum = await page.locator('#r-num').textContent();
const rTotal = await page.locator('#r-total').textContent();
const rCliente = await page.locator('#r-cliente').textContent();
pass('Resumo abre', resumoAberto, '');
pass('Número do pedido único (#SN-...)', /#SN-/.test(rNum), rNum.trim());
pass('Total no resumo correto', /25,00/.test(rTotal), rTotal.trim());
pass('Dados do cliente aparecem', rCliente.includes('Teste E2E'), '');

const btnZapVisivel = await page.locator('#btn-zap').isVisible();
pass('Botão "Enviar no WhatsApp" visível', btnZapVisivel, '');

await page.click('#btn-editar');
await page.waitForTimeout(400);
const delCount = await page.locator('#sacola-itens button[data-del]').count();
pass('Botão de excluir item presente', delCount >= 1, delCount + ' lixeira(s)');
await page.click('#sacola-itens button[data-del]');
await page.waitForTimeout(300);
const vazio = await page.locator('#sacola-itens').textContent();
pass('Excluir item esvazia a sacola', vazio.includes('vazia'), '');

pass('ZERO erros de console/JS', consoleErrors.length === 0, consoleErrors.length + ' erro(s)' + (consoleErrors.length ? ':\n  ' + consoleErrors.join('\n  ') : ''));

await browser.close();
const failed = results.filter(r => !r.ok);
console.log(`\n===== ${results.length - failed.length}/${results.length} testes passaram =====`);
process.exit(failed.length ? 1 : 0);
