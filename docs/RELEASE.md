# Fluxo de release

## Validação

A workflow `CI` executa formatação, lint, TypeScript, testes, build web, `cargo fmt`, `cargo clippy` e testes Rust.

## Builds de PR

- `Build desktop`: Linux, Windows e macOS.
- `Build Android`: APK universal e AAB universal.

Os artefatos ficam disponíveis na execução do GitHub Actions.

## Versionamento

O Release Please mantém o changelog, cria o pull request de versão e gera a tag após o merge.

Arquivos sincronizados:

- `package.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`

Também é possível sincronizar manualmente:

```bash
npm run release:sync -- 1.2.3
```

## Tag

Tags `v*` disparam builds assináveis de desktop e Android e criam uma release em rascunho.

Antes da publicação, valide instalação, inicialização, persistência, OCR, exportações e atualização de versão em todas as plataformas disponibilizadas.
