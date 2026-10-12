import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';

/**
 * Corrige incompatibilidade na configuração Android da dependência
 * tauri-plugin-file-access 1.0.0, que define compileSdk=34 enquanto
 * a versão resolvida de tauri-android exige API 36.
 *
 * O patch é limitado ao arquivo Gradle dessa dependência no cache
 * local de Cargo, sem alterar o código-fonte nem o targetSdk do app.
 * Remover assim que a dependência publicar uma correção oficial.
 */
const manifest = resolve('src-tauri/Cargo.toml');
const raw = execFileSync(
  'cargo',
  ['metadata', '--format-version', '1', '--manifest-path', manifest],
  { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'] },
);
const metadata = JSON.parse(raw);
const dependency = metadata.packages.find((item) => item.name === 'tauri-plugin-file-access');

if (!dependency) {
  throw new Error('Dependência tauri-plugin-file-access não encontrada pelo Cargo.');
}

if (dependency.version !== '1.0.0') {
  console.log(
    'tauri-plugin-file-access ' +
      dependency.version +
      ': revisão do patch Gradle necessária somente se a compilação falhar.',
  );
  process.exit(0);
}

const gradleFile = join(dirname(dependency.manifest_path), 'android', 'build.gradle.kts');
const contents = readFileSync(gradleFile, 'utf8');
const compileSdkPattern = /(^\s*compileSdk\s*=\s*)(\d+)(\s*$)/m;
const match = contents.match(compileSdkPattern);

if (!match) {
  throw new Error('Não foi possível determinar compileSdk em ' + gradleFile);
}

const current = Number(match[2]);
if (current >= 36) {
  console.log('Plugin file-access já utiliza compileSdk ' + current + '.');
  process.exit(0);
}

const patched = contents.replace(compileSdkPattern, (_, prefix, _old, suffix) => prefix + '36' + suffix);
writeFileSync(gradleFile, patched);
console.log('Plugin file-access: compileSdk atualizado de ' + current + ' para 36, sem mudar targetSdk.');
