import { defineConfig, build as viteBuild } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync } from 'fs';

function chromeExtensionPlugin() {
  let isBuildingContent = false;
  return {
    name: 'chrome-extension-plugin',
    async closeBundle() {
      if (isBuildingContent) return;
      isBuildingContent = true;

      // 1. Copia o manifest.json para dist/
      copyFileSync(
        resolve(__dirname, 'manifest.json'),
        resolve(__dirname, 'dist/manifest.json')
      );
      copyFileSync(
        resolve(__dirname, 'src/offscreen/pcm-worklet.js'),
        resolve(__dirname, 'dist/pcm-worklet.js')
      );
      console.log('[Build] manifest.json e pcm-worklet.js copiados para dist/');

      // 2. Compila o content-script como IIFE (bundle único sem imports ES)
      console.log('[Build] Compilando content-script.ts em formato IIFE...');
      await viteBuild({
        configFile: false,
        plugins: [react()],
        define: {
          'process.env.NODE_ENV': JSON.stringify('production')
        },
        build: {
          outDir: resolve(__dirname, 'dist/content'),
          emptyOutDir: true,
          lib: {
            entry: resolve(__dirname, 'src/content/content-script.ts'),
            name: 'CopilotContentScript',
            fileName: () => 'content-script.js',
            formats: ['iife']
          }
        }
      });
      console.log('[Build] content-script.js (IIFE) gerado com sucesso em dist/content/');
    }
  };
}

export default defineConfig({
  plugins: [react(), chromeExtensionPlugin()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/popup.html'),
        options: resolve(__dirname, 'src/options/options.html'),
        offscreen: resolve(__dirname, 'src/offscreen/offscreen.html'),
        background: resolve(__dirname, 'src/background/service-worker.ts')
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background') return 'background/service-worker.js';
          return 'assets/[name]-[hash].js';
        }
      }
    }
  }
});
