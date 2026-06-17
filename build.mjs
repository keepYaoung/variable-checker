import { build, context } from 'esbuild';
import { copyFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const watch = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: ['src/code.ts'],
  outfile: 'dist/code.js',
  bundle: true,
  format: 'iife',
  target: 'es2016',
  platform: 'browser',
  logLevel: 'info',
};

async function copyUi() {
  if (!existsSync('dist')) await mkdir('dist', { recursive: true });
  await copyFile('src/ui.html', 'dist/ui.html');
  console.log('[build] copied src/ui.html -> dist/ui.html');
}

if (watch) {
  const ctx = await context({
    ...buildOptions,
    plugins: [
      {
        name: 'copy-ui-on-rebuild',
        setup(b) {
          b.onEnd(async (result) => {
            if (result.errors.length === 0) await copyUi();
          });
        },
      },
    ],
  });
  await ctx.watch();
  console.log('[build] watching...');
} else {
  await build(buildOptions);
  await copyUi();
}
