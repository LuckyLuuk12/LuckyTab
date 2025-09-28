<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '@kablan/clean-ui/css/index.css';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
</svelte:head>

{@render children?.()}
