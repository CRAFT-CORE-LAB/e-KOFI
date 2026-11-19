import fs from 'fs';

const file = 'src/generated/d1/index.js';
const text = fs.readFileSync(file, 'utf8');
const next = text.replace(
  /getQueryCompilerWasmModule: async \(\) => \{[\s\S]*?return new WebAssembly\.Module\(queryCompilerWasmFileBytes\)\s*\}/,
  `getQueryCompilerWasmModule: async () => {
        const wasm = globalThis.__PRISMA_QUERY_COMPILER_WASM
        if (!wasm) {
          throw new Error('Prisma query compiler wasm was not provided to the worker')
        }
        return wasm instanceof WebAssembly.Module ? wasm : new WebAssembly.Module(wasm)
      }`,
);
if (next === text) {
  if (text.includes('__PRISMA_QUERY_COMPILER_WASM')) {
    console.log('d1 client already patched');
    process.exit(0);
  }
  console.error('Could not patch the generated Prisma client');
  process.exit(1);
}
fs.writeFileSync(file, next);
console.log('patched d1 client wasm loader');
