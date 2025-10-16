<script lang="ts">
	import { onMount } from 'svelte';
	import favicon from '$lib/assets/favicon.png';
	import '@kablan/clean-ui/css/index.css';

	let { children } = $props();
	
	// Load FontAwesome asynchronously after initial render
	onMount(() => {
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
		document.head.appendChild(link);
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<!-- Preconnect to CDN for faster font loading -->
	<link rel="preconnect" href="https://cdnjs.cloudflare.com" crossorigin="anonymous" />
	<link rel="dns-prefetch" href="https://cdnjs.cloudflare.com" />
</svelte:head>

{@render children?.()}
