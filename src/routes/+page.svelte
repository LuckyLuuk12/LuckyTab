<!-- @component
  This is a single-page Svelte project that serves as my custom new tab page.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { EnhancedImg, srcset } from '@sveltejs/enhanced-img';

  let searchQuery = '';

  // Function to handle search form submission
  const handleSearch = (event: Event) => {
    event.preventDefault();
    if (searchQuery.trim()) {
      const query = encodeURIComponent(searchQuery.trim());
      goto(`https://www.google.com/search?q=${query}`);
    }
  };

  // Focus the search input on mount
  let searchInput: HTMLInputElement;
  onMount(() => {
    if (browser && searchInput) {
      searchInput.focus();
    }
  });
</script>


<svelte:head>
  <title>New Tab</title>
  <meta name="description" content="" />
  <link rel="icon" type="image/png" href="/favicon.png" />
</svelte:head>


<main class="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
  <div class="mb-8">
    <EnhancedImg
      src="/logo.png"
      alt="Logo"
      class="w-32 h-32"
      {srcset}
      sizes="(max-width: 600px) 100vw, 200px"
      loading="eager"
    />
  </div>

  <form on:submit|preventDefault={handleSearch} class="w-full max-w-md">
    <input
      bind:this={searchInput}
      type="text"
      bind:value={searchQuery}
      placeholder="Search Google..."
      class="w-full p-3 rounded-lg bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  </form>
</main>