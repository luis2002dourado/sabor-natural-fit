# 🔒 Checklist de Segurança — Sabor Natural

## Arquitetura
O site é **100% estático** (HTML/CSS/JS, sem servidor, sem banco de dados). Isso elimina por
construção a maior parte dos riscos da lista. Segue o status item a item:

| # | Item | Status |
|---|------|--------|
| 1 | Ocultar chaves de API | ✅ Token do Refero e ID do GA movidos para `.env` (fora do código e do Git) |
| 2 | Remover segredos do histórico do Git | ✅ Repositório novo, `.gitignore` criado **antes** do primeiro commit — nenhum segredo entrou no histórico |
| 3 | Chave pública para o banco de dados | ➖ N/A — não há banco de dados |
| 4 | Row-Level Security | ➖ N/A — não há banco de dados |
| 5 | Autenticação no lado do servidor | ➖ N/A — não há backend nem contas de usuário |
| 6 | Restringir acesso aos registros | ➖ N/A |
| 7 | Impedir adulteração de campos | ✅ Não há formulários com envio a servidor; preços/itens vêm só do cardápio interno do site |
| 8 | Proteger cookies de sessão | ✅ Sem cookies de sessão; nome/endereço do cliente **não são salvos** (campos sempre limpos); só os itens da sacola ficam no `localStorage` do aparelho |
| 9 | Senhas com hash | ➖ N/A — não há senhas |
| 10 | Limitar tentativas de login | ➖ N/A — não há login |
| 11 | Proteção contra bots | ➖ N/A — não há formulário postável; pedidos saem pelo WhatsApp (app já valida spam) |
| 12 | Consultas parametrizadas | ➖ N/A — não há SQL |
| 13 | Validar todas as entradas | ✅ Campos de nome/endereço/observação são texto simples; quantidades só por botões +/− |
| 15 | Escapar conteúdo do usuário | ✅ Função `escapeHtml()` aplicada ao exibir nome, endereço e observações |
| 16 | Restringir uploads | ✅ Site não aceita uploads |
| 17 | Retornar só o necessário nas APIs | ➖ N/A — não há API própria |
| 18 | Cabeçalhos de segurança | ✅ Meta CSP + Referrer-Policy no HTML; arquivo `_headers` pronto (Netlify/Cloudflare) |
| 19 | Forçar HTTPS | 📋 Automático ao publicar em Netlify/Vercel/Cloudflare (todos forçam HTTPS); `_headers` já traz HSTS |
| 20 | Varreduras de segurança | 📋 Rodar uma vez ao publicar: [SecurityHeaders.com](https://securityheaders.com) e [Observatory Mozilla](https://observatory.mozilla.org) |

## Arquivos
- `.env` → segredos locais (token Refero, ID do Google Analytics) — **nunca** commitar
- `.gitignore` → garante que `.env` não entre no histórico
- `_headers` → cabeçalhos de segurança para deploy em Netlify/Cloudflare Pages
  - Vercel equivalente (`vercel.json`):
    ```json
    { "headers": [{ "source": "/(.*)", "headers": [
      { "key": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains; preload" },
      { "key": "X-Content-Type-Options", "value": "nosniff" },
      { "key": "X-Frame-Options", "value": "SAMEORIGIN" },
      { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
    ]}]}
    ```
