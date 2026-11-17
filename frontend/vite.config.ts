import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const isDesignPreview = mode === 'design-preview';

  return {
    plugins: [react(), tailwindcss()],
    ...(isDesignPreview
      ? {
          appType: 'mpa' as const,
          server: {
            fs: {
              deny: ['**/src/App.tsx', '**/src/styles.css'],
            },
          },
          build: {
            rollupOptions: {
              input: 'design-preview.html',
            },
          },
        }
      : {}),
  };
});
