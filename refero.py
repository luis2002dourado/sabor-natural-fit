#!/usr/bin/env python3
"""Atalho para chamar ferramentas do MCP do Refero via linha de comando.

Uso:
  python3 refero.py <ferramenta> '<json dos argumentos>'

Exemplos:
  python3 refero.py refero_search_styles '{"query":"healthy food restaurant brand","limit":3}'
  python3 refero.py refero_search_screens '{"query":"restaurant menu website","platform":"web"}'
"""
import json
import os
import sys
import urllib.request

URL = "https://api.refero.design/mcp"

# Token lido de variável de ambiente ou do arquivo .env (nunca no código)
def _carregar_token():
    token = os.environ.get("REFERO_TOKEN")
    if not token:
        try:
            for linha in open(os.path.join(os.path.dirname(__file__), ".env")):
                if linha.startswith("REFERO_TOKEN="):
                    token = linha.strip().split("=", 1)[1]
        except FileNotFoundError:
            pass
    return token

TOKEN = "Bearer " + (_carregar_token() or "")


def call(tool: str, args: dict) -> dict:
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {"name": tool, "arguments": args},
    }
    req = urllib.request.Request(
        URL,
        data=json.dumps(payload).encode(),
        headers={
            "Authorization": TOKEN,
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        body = r.read().decode()
    # Servidor pode responder SSE ("data: {...}") ou JSON puro
    for line in body.splitlines():
        if line.startswith("data:"):
            body = line[5:].strip()
            break
    return json.loads(body)


if __name__ == "__main__":
    tool = sys.argv[1]
    args = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}
    result = call(tool, args)
    # Extrai o conteúdo de texto da resposta MCP
    contents = result.get("result", {}).get("content", [])
    for c in contents:
        if c.get("type") == "text":
            print(c["text"])
        elif c.get("type") == "image":
            print(f"[imagem: {c.get('mimeType')} — {len(c.get('data',''))} chars base64]")
