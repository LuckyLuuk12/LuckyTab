<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { writable, get } from 'svelte/store';
  import { addHistory } from '$lib/stores';

  const fromLang = writable('auto');
  const toLang = writable('nl');
  const input = writable('');
  const output = writable('');

  const languages = [
    { code: 'nl', name: 'Dutch' },
    { code: 'en', name: 'English' },
    { code: 'de', name: 'German' },
    { code: 'fr', name: 'French' },
    { code: 'es', name: 'Spanish' },
    { code: 'it', name: 'Italian' }
  ];

  async function translate() {
    let q = '';
    input.subscribe((v) => (q = v))();
    if (!q.trim()) return;
    let from = '';
    fromLang.subscribe((v) => (from = v))();
    let to = '';
    toLang.subscribe((v) => (to = v))();

    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(q)}`;
      const res = await fetch(url);
      const data = await res.json();
      const translated = data?.[0]?.[0]?.[0] ?? '';
      output.set(translated);
      addHistory({ type: 'translate', from, to, query: q, result: translated });
    } catch (e) {
      console.error('translate error', e);
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    // Enter (without Shift) confirms translation
    if (e.key === 'Enter' && !(e as any).shiftKey) {
      e.preventDefault();
      translate();
    }
  }

  async function copyToClipboard(text: string) {
    if (!browser) return;
    try {
      await navigator.clipboard.writeText(text || '');
    } catch (e) {
      console.error('copy failed', e);
    }
  }

  function resetLanguages() {
    fromLang.set('auto');
    toLang.set('nl');
  }

  function swap() {
    let f = '';
    let t = '';
    fromLang.subscribe((v) => (f = v))();
    toLang.subscribe((v) => (t = v))();
    // swap and ensure that one side is nl by default if auto
    fromLang.set(t === 'nl' ? 'auto' : t);
    toLang.set(f === 'auto' ? 'nl' : f);
  }

</script>

<div class="translator">
  <div class="translator-row">
    <select bind:value={$fromLang} class="grow">
      <option value="auto">Auto</option>
      {#each languages as l}
        <option value={l.code}>{l.name}</option>
      {/each}
    </select>
    <button id="switch-button" on:click={swap} title="Swap" aria-label="Swap languages">
      <i class="fa fa-exchange-alt" aria-hidden="true"></i>
    </button>
    <select bind:value={$toLang} class="grow">
      {#each languages as l}
        <option value={l.code}>{l.name}</option>
      {/each}
    </select>
  </div>

  <textarea class="translator-input" rows="4" bind:value={$input} placeholder="Type text to translate..." on:keydown={handleKeydown} on:dblclick={() => copyToClipboard(get(input))}></textarea>
  <div class="translator-actions">
    <button class="secondary hollow" aria-label="Reset languages" title="Reset languages" on:click={resetLanguages}>
      <i class="fa fa-sync-alt" aria-hidden="true"></i>
    </button>
    <button class="red hollow" aria-label="Clear translator" on:click={() => { input.set(''); output.set(''); }}>
      <i class="fa fa-trash" aria-hidden="true"></i>
    </button>
    <button class="primary hollow" on:click={translate}>Translate</button>
  </div>

  <textarea class="translator-output" rows="4" readonly bind:value={$output} placeholder="Translation output" on:dblclick={() => copyToClipboard(get(output))}></textarea>
</div>

<style>
  #switch-button {
    color: var(--primary-700);
    font-size: 1.2rem;
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 0.25rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .translator { display:flex; flex-direction:column; gap:.5rem; height: 100%; }
  .translator-row { display:flex; gap:.5rem; align-items:center; }
  textarea { width:100%; box-sizing:border-box; background: var(--card); }
  select { background: var(--card); }
  .grow { flex:1; }
  /* Limit how far the textarea can be resized so it doesn't escape the sidebar */
  .translator-input, .translator-output {
    /* Allow textareas to flex and share available vertical space inside the sidebar */
    flex: 1 1 0;
    min-height: 0; /* allow flexbox to shrink properly inside overflow:auto containers */
    resize: vertical;
    overflow: auto;
  }
  .translator-actions { display:flex; gap:.5rem; }
  /* Make translate button expand to use remaining horizontal space */
  .translator-actions .primary { flex: 1 1 auto; }
  /* Clear button slightly larger for easier tapping */
  .red.hollow { display:inline-flex; align-items:center; justify-content:center; padding:0.45rem 0.65rem; min-width:48px; }
  .red.hollow .fa { color: var(--red, #b02e43); font-size:1.05rem; }
  .red.hollow:hover { transform: unset; }
  /* Quaternary hollow button style (same sizing) */
  .secondary.hollow { display:inline-flex; align-items:center; justify-content:center; padding:0.45rem 0.65rem; min-width:48px; }
  .secondary.hollow .fa { color: var(--secondary-700); font-size:1.05rem; }
  .secondary.hollow:hover { transform: unset; }
</style>
