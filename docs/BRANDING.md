# Branding — Conta Certa

## Identidade oficial

Esta aplicação usa o pacote oficial **Conta Certa — Branding Completo** como fonte da identidade visual para Web/PWA, desktop e mobile.

- **Marca:** Conta Certa
- **Assinatura:** Gestão Financeira
- **Azul-marinho:** `#092144` — RGB `9, 33, 68`
- **Verde:** `#279B48` — RGB `39, 155, 72`
- **Branco:** `#FFFFFF`

## Ativos mestres no projeto

| Arquivo | Uso |
| --- | --- |
| `public/app-icon.svg` | Mestre oficial dos ícones de aplicativo e geração Tauri/Android |
| `public/favicon.svg` | Favicon vetorial oficial |
| `public/logo.svg` | Símbolo oficial isolado |
| `public/branding/logo-symbol.svg` | Símbolo oficial para interfaces e materiais |
| `public/branding/logo-horizontal.svg` | Navegação, barra lateral e cabeçalhos |
| `public/branding/logo-full.svg` | Login, telas institucionais e materiais verticais |
| `public/branding/logo-full-light.svg` | Versão clara para fundos escuros |
| `public/branding/logo-wordmark.svg` | Nome da marca isolado |
| `public/branding/logo-tagline.svg` | Assinatura “Gestão Financeira” isolada |
| `public/branding/splash-desktop*.svg` | Splash desktop claro/escuro |
| `public/branding/splash-mobile*.svg` | Splash mobile claro/escuro |
| `public/branding/brand-tokens.css` | Tokens CSS oficiais |
| `public/branding/brand-tokens.json` | Tokens estruturados para integrações |
| `public/site.webmanifest` | Identidade Web/PWA |
| `src/branding.css` | Aplicação da paleta e apresentação no frontend |

## Geração automática

O workflow `.github/workflows/render-brand-assets.yml` é a fonte de sincronização dos binários derivados. Sempre que um SVG mestre ou token de branding muda, ele regenera e valida:

- favicon `.ico` e PNGs 16/32/48;
- Apple Touch Icon;
- ícones PWA 192/512;
- `app-icon.png`;
- PNGs de logotipo e splash;
- ícones nativos Tauri para Windows, Linux e macOS;
- ativos usados pelo build Android por meio de `npm run icons`.

O comando local equivalente para os ícones nativos é:

```bash
npm run icons
```

## Regras de uso

- Não alterar as cores oficiais.
- Não distorcer, inclinar ou rotacionar a marca.
- Preservar área livre mínima equivalente a 10% do símbolo.
- Usar o símbolo isolado em ícones e favicon.
- Usar o logotipo horizontal na navegação da aplicação.
- Usar o logotipo completo em login, abertura e materiais institucionais.
- Em fundos escuros, usar a versão clara/monocromática apropriada.

## Plataformas cobertas

A substituição de branding abrange **Web/PWA, Android, desktop/Tauri e metadados da aplicação**. Os builds futuros devem partir dos mestres acima para evitar divergência entre favicon, ícone instalado, splash e logotipos exibidos na interface.
