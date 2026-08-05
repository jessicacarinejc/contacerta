# Conta Certa

Aplicação financeira local-first com interface profissional para **desktop** e **Android**, construída com React, TypeScript, Rust e Tauri 2.

## Recursos incluídos

- Dashboard com saldo, receitas, despesas, resultado, vencimentos e gráficos.
- Movimentações de receita, despesa e transferência.
- Contas, cartões, contas a pagar e contas a receber.
- Orçamentos, metas, patrimônio e relatórios.
- Exportação de movimentações para Excel e relatório em PDF.
- Central de documentos com:
  - leitura direta de PDFs pesquisáveis;
  - OCR de PDFs digitalizados e imagens;
  - detecção de valor, vencimento, beneficiário e linha digitável;
  - hash SHA-256 e alerta de duplicidade;
  - revisão obrigatória antes da criação do lançamento.
- Inteligência financeira com alertas, insights, dicas e simulador de metas.
- Persistência local por `tauri-plugin-store`, com fallback para `localStorage` no navegador.
- Layout responsivo com navegação desktop e navegação inferior para Android.

## Stack

- React 19 + TypeScript + Vite
- Zustand
- Recharts
- Tesseract.js + PDF.js
- Tauri 2 + Rust
- Tauri Store Plugin
- Vitest + ESLint + Prettier

## Requisitos

### Desktop

- Node.js 22+
- Rust stable
- Dependências de sistema exigidas pelo Tauri para Windows, Linux ou macOS

### Android

- Android Studio
- Java 17
- Android SDK Platform 35
- Android Build Tools 35
- Android NDK 27
- Targets Rust Android:

```bash
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
```

Configure `ANDROID_HOME`, `JAVA_HOME` e `NDK_HOME` conforme o seu ambiente.

## Execução

```bash
npm install
npm run dev
```

Aplicação desktop Tauri:

```bash
npm run tauri:dev
```

Aplicação Android:

```bash
npm run android:dev
```

O script inicializa automaticamente `src-tauri/gen/android` quando necessário.

## Builds

```bash
npm run build
npm run tauri:build
npm run android:build:apk
npm run android:build:aab
```

Artefatos Android são gerados dentro de:

```text
src-tauri/gen/android/app/build/outputs/
```

## Qualidade

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
```

Ou execute tudo:

```bash
npm run check
```

## Releases

O repositório contém fluxos para:

- validação de frontend e Rust;
- build desktop em Linux, Windows e macOS;
- build Android em APK e AAB;
- Release Please para versionamento;
- criação de release em tags `v*`;
- publicação de artefatos desktop e Android na release em rascunho.

Consulte [`docs/RELEASE.md`](docs/RELEASE.md) e [`docs/ANDROID.md`](docs/ANDROID.md).

## Segurança dos documentos

O OCR é executado no cliente. O conteúdo não é enviado para uma API própria do projeto. O modelo de idioma do Tesseract pode ser baixado na primeira utilização. Antes da confirmação, todos os campos extraídos ficam em estado de revisão.

## Licença

MIT.
