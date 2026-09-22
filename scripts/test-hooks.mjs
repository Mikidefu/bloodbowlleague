// Hook di risoluzione per i test (node --test col type stripping di Node): '@/...' -> src/...,
// e gli import senza estensione (come li scrive Next) -> il file .ts corrispondente.

import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));

export async function resolve(specifier, context, next) {
  // Next espone next/server senza "exports": fuori dal bundler serve il file esplicito
  if (specifier === 'next/server') return next('next/server.js', context);
  let spec = specifier;
  if (spec.startsWith('@/')) spec = pathToFileURL(path.join(SRC, spec.slice(2))).href;
  const local = spec.startsWith('file:') || spec.startsWith('./') || spec.startsWith('../');
  if (local && !path.extname(spec)) {
    const base = spec.startsWith('file:') ? spec : new URL(spec, context.parentURL).href;
    for (const ext of ['.ts', '.tsx', '/index.ts']) {
      if (existsSync(fileURLToPath(base + ext))) return next(base + ext, context);
    }
  }
  return next(spec, context);
}
