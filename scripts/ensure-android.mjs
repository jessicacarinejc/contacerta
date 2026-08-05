import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const androidProject = new URL('../src-tauri/gen/android', import.meta.url);
if (existsSync(androidProject)) {
  console.log('Projeto Android já inicializado.');
  process.exit(0);
}

console.log('Inicializando o projeto Android do Tauri...');
const executable = process.platform === 'win32' ? 'npx.cmd' : 'npx';
execFileSync(executable, ['tauri', 'android', 'init', '--ci'], {
  cwd: new URL('..', import.meta.url),
  stdio: 'inherit',
});
