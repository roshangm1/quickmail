import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		// cloudflared tunnel --url http://localhost:5173
		allowedHosts: ['.trycloudflare.com']
	}
});
