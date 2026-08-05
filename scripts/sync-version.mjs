import { readFileSync, writeFileSync } from 'node:fs';

const version = process.argv[2] || process.env.npm_package_version;
if (!/^\d+\.\d+\.\d+(?:[-+].+)?$/.test(version || '')) {
  throw new Error('Informe uma versão semântica: npm run release:sync -- 1.2.3');
}

const updateJson = (path) => {
  const value = JSON.parse(readFileSync(path, 'utf8'));
  value.version = version;
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
};

updateJson('package.json');
updateJson('src-tauri/tauri.conf.json');

const cargoPath = 'src-tauri/Cargo.toml';
const cargo = readFileSync(cargoPath, 'utf8').replace(/^version = ".*"/m, `version = "${version}"`);
writeFileSync(cargoPath, cargo);
console.log(`Versão sincronizada: ${version}`);
