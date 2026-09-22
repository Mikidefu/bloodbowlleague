// node --import ./scripts/test-register.mjs --test ...  (vedi "npm test")
import { register } from 'node:module';

register('./test-hooks.mjs', import.meta.url);
