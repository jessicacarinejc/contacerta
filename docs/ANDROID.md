# Android

O suporte Android utiliza o pipeline móvel oficial do Tauri 2.

## Inicialização

```bash
npm run android:init
```

O comando é idempotente: somente executa `tauri android init --ci` quando o projeto nativo ainda não existe.

## Desenvolvimento

```bash
npm run android:dev
```

## APK

```bash
npm run android:build:apk
```

## Android App Bundle

```bash
npm run android:build:aab
```

## Assinatura

O build local sem configuração adicional produz artefatos de desenvolvimento. Para publicação na Google Play, configure o keystore no projeto Gradle gerado ou injete as credenciais por secrets no CI.

Secrets recomendados:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`
- `ANDROID_STORE_PASSWORD`

Nunca versione o arquivo de keystore ou suas senhas.

## Compatibilidade

- `minSdkVersion`: 24
- Alvo CI: Android SDK 35
- NDK CI: 27.2.12479018
- Arquiteturas Rust: ARM64, ARMv7, x86 e x86_64
