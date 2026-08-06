# Branding — Conta Certa

## Identidade oficial

- **Marca:** Conta Certa
- **Assinatura:** Gestão Financeira
- **Azul-marinho:** `#092144`
- **Verde:** `#279B48`
- **Branco:** `#FFFFFF`

## Ativos aplicados

| Arquivo | Uso |
| --- | --- |
| `public/logo.svg` | Símbolo vetorial principal e favicon alternativo |
| `public/app-icon.svg` | Mestre quadrado para geração de ícones nativos |
| `public/branding/logo-horizontal.svg` | Barra lateral e cabeçalhos horizontais |
| `public/branding/logo-full.svg` | Telas institucionais, abertura e materiais verticais |
| `public/branding/brand-tokens.css` | Tokens CSS para integrações externas |
| `public/branding/brand-tokens.json` | Tokens estruturados para automações e outros clientes |
| `public/site.webmanifest` | Identidade Web/PWA |
| `src/branding.css` | Aplicação da paleta e apresentação da marca no frontend |

## Desktop e Android

O comando abaixo gera novamente todos os ícones de plataforma a partir do mestre oficial:

```bash
npm run icons
```

O Tauri 2 gera os ativos de Windows, Linux, macOS e Android. Os fluxos `tauri:dev`, `tauri:build`, `android:dev`, `android:build:apk` e `android:build:aab` executam essa sincronização automaticamente antes do build.

## Regras de uso

- Não alterar as cores oficiais.
- Não distorcer, inclinar ou rotacionar a marca.
- Preservar uma área livre mínima de 10% ao redor do símbolo.
- Usar o símbolo isolado em ícones e favicon.
- Usar o logotipo horizontal na navegação da aplicação.
- Usar o logotipo completo em telas de abertura e materiais institucionais.
