# Assinatura Android para distribuição direta

O Conta Certa não usa Google Play nem secrets de assinatura de produção neste fluxo.

O APK é compilado em modo `release` para reduzir o tamanho. Como o Android não instala APK literalmente sem assinatura, o GitHub Actions cria uma chave técnica temporária durante o próprio build, assina o APK e descarta a chave ao final do job.

- sem integração com Google Play;
- sem AAB;
- sem `ANDROID_KEY_*` secrets;
- nenhuma chave privada fica salva no repositório;
- APK ARM64 otimizado e validado com `apksigner`;
- limite de 80 MB para bloquear pacotes anormais.

Como a chave temporária muda entre execuções, uma versão gerada por um build pode exigir desinstalar a anterior antes de instalar outra. Para atualizações Android sobre a instalação existente, futuramente será necessária uma chave estável de assinatura — isso é independente da Google Play.
