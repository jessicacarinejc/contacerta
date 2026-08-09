# Android para distribuição direta

O Conta Certa não usa Google Play, AAB ou secrets de assinatura de produção neste fluxo.

O APK é primeiro compilado em modo `release` ARM64, sem assinatura, para manter o binário otimizado e pequeno. Como o Android não permite instalar um APK literalmente sem qualquer assinatura, o GitHub Actions cria uma chave técnica temporária durante o próprio job, faz `zipalign`, aplica a assinatura apenas ao artefato final e descarta a chave ao terminar.

- sem integração com Google Play;
- sem AAB;
- sem `ANDROID_KEY_*` secrets;
- nenhuma chave privada fica salva no repositório;
- APK release ARM64 otimizado;
- validação com `apksigner`;
- limite de 80 MB para bloquear pacotes anormais.

Como a chave temporária muda entre execuções, um APK de outro build pode exigir desinstalar a versão anterior antes da instalação. Para atualizações Android sobre a instalação existente, futuramente será necessária uma chave estável de assinatura; isso é independente da Google Play.
