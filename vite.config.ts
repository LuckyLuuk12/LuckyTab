import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { enhancedImages } from '@sveltejs/enhanced-img';

export default defineConfig({
	plugins: [enhancedImages(), sveltekit()],

	build: {
		// Enable minification
		minify: 'terser',
		terserOptions: {
			compress: {
				drop_console: true, // Remove console.logs in production
				drop_debugger: true,
				passes: 2
			},
			mangle: true,
			format: {
				comments: false
			}
		},

		// Optimize chunking for better caching
		rollupOptions: {
			output: {
				manualChunks: (id) => {
					// Vendor chunks for better caching
					if (id.includes('node_modules')) {
						if (id.includes('svelte')) {
							return 'vendor-svelte';
						}
						return 'vendor';
					}

					// Settings component gets its own chunk (already lazy-loaded)
					if (id.includes('Settings.svelte')) {
						return 'settings';
					}
				}
			}
		},

		// Target modern browsers for smaller bundles
		target: 'es2020',

		// Optimize CSS
		cssCodeSplit: true,
		cssMinify: true,

		// Report compressed size
		reportCompressedSize: true,

		// Chunk size warnings
		chunkSizeWarningLimit: 500
	},

	// Optimize dependencies
	optimizeDeps: {
		include: ['svelte', '@sveltejs/kit'],
		exclude: []
	}
});
