import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const required = process.argv.includes('--required');
const androidRoot = resolve('src-tauri/gen/android');
const gradlePath = join(androidRoot, 'app', 'build.gradle.kts');
const propertiesPath = join(androidRoot, 'keystore.properties');

const keyBase64 = process.env.ANDROID_KEY_BASE64?.trim();
const keyAlias = process.env.ANDROID_KEY_ALIAS?.trim();
const keyPassword = process.env.ANDROID_KEY_PASSWORD?.trim();
const storePassword = process.env.ANDROID_STORE_PASSWORD?.trim() || keyPassword;

if (!keyBase64 || !keyAlias || !keyPassword || !storePassword) {
  const message =
    'Assinatura Android não configurada. Defina ANDROID_KEY_BASE64, ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD e, opcionalmente, ANDROID_STORE_PASSWORD.';
  if (required) {
    console.error(message);
    process.exit(1);
  }
  console.log(`${message} Build continuará sem configuração de assinatura de release.`);
  process.exit(0);
}

if (!existsSync(gradlePath)) {
  console.error(`Projeto Android não encontrado em ${gradlePath}. Execute android:init antes.`);
  process.exit(1);
}

const keystorePath = resolve(process.env.RUNNER_TEMP || androidRoot, 'conta-certa-release.jks');
writeFileSync(keystorePath, Buffer.from(keyBase64, 'base64'), { mode: 0o600 });

writeFileSync(
  propertiesPath,
  [
    `storePassword=${storePassword}`,
    `keyPassword=${keyPassword}`,
    `keyAlias=${keyAlias}`,
    `storeFile=${keystorePath.replaceAll('\\', '\\\\')}`,
    '',
  ].join('\n'),
  { mode: 0o600 },
);

let gradle = readFileSync(gradlePath, 'utf8');

if (!gradle.includes('import java.util.Properties')) {
  gradle = `import java.util.Properties\n${gradle}`;
}
if (!gradle.includes('import java.io.FileInputStream')) {
  gradle = `import java.io.FileInputStream\n${gradle}`;
}

if (!gradle.includes('create("release")')) {
  const signingBlock = `    signingConfigs {\n        create("release") {\n            val keystorePropertiesFile = rootProject.file("keystore.properties")\n            val keystoreProperties = Properties()\n            keystoreProperties.load(FileInputStream(keystorePropertiesFile))\n            keyAlias = keystoreProperties["keyAlias"] as String\n            keyPassword = keystoreProperties["keyPassword"] as String\n            storeFile = file(keystoreProperties["storeFile"] as String)\n            storePassword = keystoreProperties["storePassword"] as String\n        }\n    }\n\n`;

  const marker = '    buildTypes {';
  if (!gradle.includes(marker)) {
    console.error('Não foi possível localizar buildTypes no build.gradle.kts gerado pelo Tauri.');
    process.exit(1);
  }
  gradle = gradle.replace(marker, `${signingBlock}${marker}`);
}

if (!gradle.includes('signingConfig = signingConfigs.getByName("release")')) {
  const releaseMarker = '        getByName("release") {';
  if (!gradle.includes(releaseMarker)) {
    console.error('Não foi possível localizar o buildType release no build.gradle.kts gerado pelo Tauri.');
    process.exit(1);
  }
  gradle = gradle.replace(
    releaseMarker,
    `${releaseMarker}\n            signingConfig = signingConfigs.getByName("release")`,
  );
}

writeFileSync(gradlePath, gradle);
console.log('Assinatura Android de release configurada com sucesso.');
