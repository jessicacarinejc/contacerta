# Arquitetura

## Visão geral

O Conta Certa é uma aplicação local-first. O mesmo frontend React é empacotado pelo Tauri para desktop e Android.

```text
React / TypeScript
  ├── Store financeiro persistente
  ├── Dashboard e módulos de gestão
  ├── PDF.js: texto e renderização de PDFs
  ├── Tesseract.js: OCR de imagens
  └── Bridge Tauri
        ├── comandos Rust
        ├── armazenamento privado
        └── empacotamento desktop/Android
```

## Domínios

- `accounts`: contas e saldos.
- `transactions`: receitas, despesas e transferências.
- `cards`: cartões e comprometimento de limite.
- `budgets`: orçado versus realizado.
- `goals`: objetivos financeiros.
- `assets`: patrimônio e dívidas.
- `documents`: OCR, extração, duplicidade e aprovação.
- `intelligence`: indicadores e recomendações explicáveis.

## Regras de integridade

- Transferência entre contas não compõe receita ou despesa.
- Documento OCR nunca gera lançamento definitivo sem confirmação.
- Hash do documento é usado como primeira camada de detecção de duplicidade.
- Pagamento de fatura deve ser tratado como liquidação, não como nova despesa.
- Estados persistidos possuem versão para futuras migrações.

## Evolução prevista

A camada de estado foi isolada para permitir substituição por SQLite, API remota ou sincronização Open Finance sem reescrever as páginas.
