# Correções de interface, autenticação, cartões e release

Esta alteração corrige os problemas identificados após a PR #13.

## Interface e branding

- usa o `logo-full.svg` oficial no sidebar sem forçar proporção horizontal;
- preserva `object-fit: contain` e proporções naturais da marca;
- substitui a fonte vetorial do ícone da aplicação pelo `app-icon.svg` oficial;
- os builds Tauri executam `npm run icons`, regenerando os ícones nativos desktop e Android a partir dessa fonte oficial.

## Tema

- aplica o tema no nível raiz da aplicação, inclusive na tela de login;
- suporta claro, escuro e sistema;
- acompanha mudança do tema do sistema operacional;
- corrige superfícies, modal, campos, tabelas, documentos, gráficos e estados auxiliares no modo escuro.

## Autenticação e perfil

- mantém cadastro, login, logout, edição de nome/e-mail/avatar e troca de senha;
- senha permanece derivada por PBKDF2/SHA-256 com salt aleatório e 210 mil iterações;
- a autenticação não é persistida entre reinicializações: o usuário precisa informar a senha novamente ao abrir o aplicativo;
- perfil e credencial local existentes são preservados.

## Cartões de crédito

- habilita o botão `Novo cartão`;
- adiciona formulário de cadastro com instituição, nome, últimos quatro dígitos, limite, fatura atual, fechamento, vencimento e cor;
- valida os campos antes de persistir;
- adiciona ações de store para criar, atualizar e excluir cartões.

## Release e versionamento

- o workflow de release passa a executar em todo push para `main`, sem filtro de paths;
- cada execução calcula a próxima versão SemVer a partir das releases existentes;
- o padrão é incremento `patch`; execução manual permite `minor` ou `major`;
- uma release/tag existente nunca é sobrescrita.
