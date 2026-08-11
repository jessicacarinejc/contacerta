# Assinatura persistente do Android

As releases Android do Conta Certa devem usar sempre a mesma chave de assinatura. Sem isso, o Android bloqueia a instalação de uma versão nova sobre a anterior.

## Secrets obrigatórios

Cadastre em **Settings > Secrets and variables > Actions** do repositório:

- `ANDROID_KEYSTORE_BASE64`: conteúdo Base64 do arquivo JKS de release;
- `ANDROID_KEYSTORE_PASSWORD`: senha do keystore e da chave.

O alias esperado pelo workflow é `contacerta`.

## Gerar a chave uma única vez

```bash
keytool -genkeypair -noprompt \
  -keystore conta-certa-release.jks \
  -storetype JKS \
  -alias contacerta \
  -keyalg RSA \
  -keysize 4096 \
  -validity 10000 \
  -storepass "SENHA_FORTE" \
  -keypass "SENHA_FORTE" \
  -dname "CN=Conta Certa, OU=Android Release, O=Conta Certa, L=Santo Antonio de Jesus, ST=BA, C=BR"
```

Para criar o valor do secret Base64 no Linux:

```bash
base64 -w0 conta-certa-release.jks
```

A chave `.jks` e sua senha devem ser mantidas em backup privado. Nunca devem ser commitadas no repositório.

## Migração das versões antigas

As versões publicadas até a `v0.1.14` foram assinadas com chaves temporárias geradas durante cada build. A chave privada usada nessas releases não foi preservada. Portanto, não é tecnicamente possível assinar uma nova versão compatível com uma instalação antiga já existente.

A primeira versão publicada com a chave persistente exigirá uma única reinstalação. A partir dela, todas as versões futuras assinadas com a mesma chave poderão ser instaladas como atualização, preservando os dados do aplicativo.
