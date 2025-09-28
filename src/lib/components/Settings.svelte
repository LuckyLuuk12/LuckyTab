<!-- @component
This component provides a small settings button and panel for user preferences.
In here we provide options for theme modification, custom background image,
custom css injection, and customizing pinned links.
It will also provide a reset, import, and export functionality for user settings.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { EnhancedImg, srcset } from '@sveltejs/enhanced-img';
  import { writable } from 'svelte/store';

  // Store to manage settings visibility
  const showSettings = writable(false);

  // Function to toggle settings panel
  const toggleSettings = () => {
    showSettings.update(value => !value);
  };

  // Close settings when clicking outside
  let settingsPanel: HTMLDivElement;
  const handleClickOutside = (event: MouseEvent) => {
    if (settingsPanel && !settingsPanel.contains(event.target as Node)) {
      showSettings.set(false);
    }
  };

  onMount(() => {
    if (browser) {
      document.addEventListener('click', handleClickOutside);
      return () => {
        document.removeEventListener('click', handleClickOutside);
      };
    }
  });
</script>


<div class="settings-button" on:click={toggleSettings} title="Settings">
  <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-white hover:text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 7.292M12 12.354a4 4 0 110 7.292M12 20.354a4 4 0 110 7.292" />
  </svg>
</div>
{#if $showSettings}
  <div class="settings-panel" bind:this={settingsPanel}>
    <h2 class="text-lg font-bold mb-4">Settings</h2>
    <div class="mb-4">
      <label class="block mb-2">Theme:</label>
      <select class="w-full p-2 rounded bg-gray-800 text-white">
        <option value="light">Light</option>
        <option value="dark" selected>Dark</option>
        <option value="system">System Default</option>
      </select>
    </div>
    <div class="mb-4">
      <label class="block mb-2">Custom Background Image URL:</label>
      <input type="text" placeholder="Enter image URL" class="w-full p-2 rounded bg-gray-800 text-white" />
    </div>
    <div class="mb-4">
      <label class="block mb-2">Custom CSS:</label>
      <textarea rows="4" placeholder="Enter custom CSS" class="w-full p-2 rounded bg-gray-800 text-white"></textarea>
    </div>
    <div class="flex justify-between">
      <button class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">Reset</button>
      <button class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Import</button>
      <button class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Export</button>
    </div>
  </div>
{/if}


<style>
  .settings-button {
    position: fixed;
    top: 1rem;
    right: 1rem;
    background: none;
    border: none;
    cursor: pointer;
    z-index: 1000;
  }

  .settings-panel {
    position: fixed;
    top: 3rem;
    right: 1rem;
    background-color: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 1rem;
    border-radius: 0.5rem;
    z-index: 1000;
    width: 300px;
  }
</style>
