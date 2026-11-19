import { httpServerHandler } from 'cloudflare:node';
import queryCompilerWasm from './src/generated/d1/query_compiler_bg.wasm';
import { boot } from './dist/src/worker.js';

globalThis.__PRISMA_QUERY_COMPILER_WASM = queryCompilerWasm;

let handler;

export default {
  async fetch(request, env, ctx) {
    if (!handler) {
      await boot(env);
      handler = httpServerHandler({ port: 3000 });
    }
    return handler.fetch(request, env, ctx);
  },
};
