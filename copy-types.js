const fs = require('fs');
const path = require('path');

const sharedTypes = path.resolve(__dirname, 'shared/types.ts');

// Destinos
const targets = [
    path.resolve(__dirname, 'frontend-public/types.ts'),
    path.resolve(__dirname, 'frontend/types.ts')
];

targets.forEach(target => {
    fs.copyFileSync(sharedTypes, target);
    console.log(`Copied types.ts to ${target}`);
});
