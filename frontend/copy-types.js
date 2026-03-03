import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sharedTypes = path.resolve(__dirname, '../shared/types.ts');
const target = path.resolve(__dirname, 'types.ts');

fs.copyFileSync(sharedTypes, target);
console.log(`Copied types.ts to ${target}`);
