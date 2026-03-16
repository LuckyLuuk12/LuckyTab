<!-- @component
This component provides a small settings button and panel for user preferences.
In here we provide options for theme modification, custom background image,
custom css injection, and customizing pinned links.
It will also provide a reset, import, and export functionality for user settings.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { browser } from "$app/environment";
  import {
    settings,
    setCustomCss,
    clearAllSettings,
    addPinned,
    updatePinned,
    removePinned,
    setProviderOrder,
  } from "$lib/stores";
  import { DEFAULT_PINNED_SITES } from "$lib/constants";
  import {
    DEFAULT_PROVIDERS,
    PROVIDER_ICONS,
    type Provider,
  } from "$lib/providerConfig";
  import type { PinnedSite } from "$lib/types";

  const providers = DEFAULT_PROVIDERS;

  // Available languages for translator
  const availableLanguages = [
    { code: "en", name: "English" },
    { code: "es", name: "Spanish" },
    { code: "fr", name: "French" },
    { code: "de", name: "German" },
    { code: "it", name: "Italian" },
    { code: "pt", name: "Portuguese" },
    { code: "nl", name: "Dutch" },
    { code: "pl", name: "Polish" },
    { code: "ru", name: "Russian" },
    { code: "ja", name: "Japanese" },
    { code: "zh", name: "Chinese" },
    { code: "ko", name: "Korean" },
    { code: "ar", name: "Arabic" },
  ];

  // State to manage settings visibility
  let showSettings = $state(false);

  // Function to toggle settings panel
  const toggleSettings = () => {
    showSettings = !showSettings;
  };

  // Close settings when clicking outside
  let settingsPanel = $state<HTMLDivElement | null>(null);
  let settingsButtonEl = $state<HTMLButtonElement | null>(null);
  const handleClickOutside = (event: MouseEvent) => {
    const target = event.target as Node;
    // don't close if click is inside the panel or the settings button itself
    if (
      settingsPanel &&
      (settingsPanel.contains(target) ||
        (settingsButtonEl && settingsButtonEl.contains(target)))
    ) {
      return;
    }
    if (settingsPanel && !settingsPanel.contains(target)) {
      showSettings = false;
    }
  };

  onMount(() => {
    if (browser) {
      document.addEventListener("click", handleClickOutside);
      return () => {
        document.removeEventListener("click", handleClickOutside);
      };
    }
  });

  // Custom css textarea (stored inside settings.customCss)
  let cssText = $state("");
  settings.subscribe((v) => (cssText = v.customCss || ""));

  // Pinned site adder fields (managed here in Settings)
  let newTitle = $state("");
  let newUrl = $state("");
  let newFavicon = $state("");

  // Provider reorder state - get ordered providers
  let orderedProviders = $derived.by(() => {
    const savedOrder = $settings.providerOrder;
    if (!savedOrder || savedOrder.length === 0) {
      return providers;
    }
    const ordered = savedOrder
      .map((id) => providers.find((p) => p.id === id))
      .filter((p): p is Provider => p !== undefined);
    const missingProviders = providers.filter(
      (p) => !savedOrder.includes(p.id),
    );
    return [...ordered, ...missingProviders];
  });

  let draggedProviderIndex = $state<number | null>(null);

  function handleProviderDragStart(e: DragEvent, index: number) {
    draggedProviderIndex = index;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
    }
  }

  function handleProviderDragOver(e: DragEvent) {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "move";
    }
  }

  function handleProviderDrop(e: DragEvent, dropIndex: number) {
    e.preventDefault();
    if (draggedProviderIndex === null || draggedProviderIndex === dropIndex) {
      draggedProviderIndex = null;
      return;
    }
    const newOrder = [...orderedProviders];
    const [draggedProvider] = newOrder.splice(draggedProviderIndex, 1);
    newOrder.splice(dropIndex, 0, draggedProvider);
    const newOrderIds = newOrder.map((p) => p.id);
    setProviderOrder(newOrderIds);
    draggedProviderIndex = null;
  }

  function handleProviderDragEnd() {
    draggedProviderIndex = null;
  }

  // Manage pinned sites with defaults shown
  let combinedPinnedSites = $derived(
    $settings.pinned.length > 0 ? $settings.pinned : DEFAULT_PINNED_SITES,
  );

  function addPinnedSite() {
    if (!newUrl || !newUrl.trim()) return alert("Please provide a URL");
    const id =
      crypto && crypto.getRandomValues
        ? crypto.getRandomValues(new Uint32Array(2)).join("-")
        : String(Date.now());
    const site: PinnedSite = {
      id,
      title: newTitle || newUrl,
      url: newUrl,
      custom_favicon: newFavicon || undefined,
    };
    addPinned(site);
    newTitle = "";
    newUrl = "";
    newFavicon = "";
  }

  function editPinnedSite(id: string) {
    const s = combinedPinnedSites.find((x) => x.id === id);
    if (!s) return;
    const updatedTitle = prompt("Title", s.title);
    const updatedUrl = prompt("URL", s.url);
    const updatedFav = prompt(
      "Custom favicon (optional)",
      s.custom_favicon ?? "",
    );
    if (updatedTitle !== null && updatedUrl !== null) {
      updatePinned(id, {
        title: updatedTitle,
        url: updatedUrl,
        custom_favicon: updatedFav || undefined,
      });
    }
  }

  function removePinnedSite(id: string) {
    // If it's a default site and we haven't customized yet, we need to explicitly set pinned
    const isDefault = DEFAULT_PINNED_SITES.some((s) => s.id === id);
    if (isDefault && $settings.pinned.length === 0) {
      // Initialize pinned with all defaults except the one being removed
      const remaining = DEFAULT_PINNED_SITES.filter((s) => s.id !== id);
      settings.update((s) => ({ ...s, pinned: remaining }));
    } else {
      removePinned(id);
    }
  }

  // Toggle functions for boolean settings
  function toggleProviderScroll() {
    settings.update((s) => ({
      ...s,
      enableProviderScroll: !s.enableProviderScroll,
    }));
  }

  function toggleProviderReorder() {
    settings.update((s) => ({
      ...s,
      enableProviderReorder: !s.enableProviderReorder,
    }));
  }

  function toggleTranslator() {
    settings.update((s) => ({ ...s, enableTranslator: !s.enableTranslator }));
  }

  function toggleHistory() {
    settings.update((s) => ({ ...s, enableHistory: !s.enableHistory }));
  }

  function toggleSystemInfo() {
    settings.update((s) => ({ ...s, enableSystemInfo: !s.enableSystemInfo }));
  }

  type SystemSettingKey =
    | "showSystemPublicIp"
    | "showSystemConnection"
    | "showSystemMemory"
    | "showSystemBattery"
    | "showSystemTime"
    | "showSystemTimezone"
    | "showSystemLanguage"
    | "showSystemCpuCores"
    | "showInfoDate"
    | "showInfoWeather"
    | "showInfoAirQuality";

  type CollapsedVisibleKey =
    | "public_ip"
    | "connection"
    | "device_memory"
    | "battery"
    | "language"
    | "cpu_cores"
    | "date"
    | "time"
    | "timezone"
    | "weather"
    | "air_quality";

  const collapsedValueOptions: Array<{
    key: CollapsedVisibleKey;
    label: string;
  }> = [
    { key: "public_ip", label: "Public IP" },
    { key: "connection", label: "Connection" },
    { key: "device_memory", label: "Device Memory" },
    { key: "battery", label: "Battery" },
    { key: "language", label: "Language" },
    { key: "cpu_cores", label: "CPU Cores" },
    { key: "date", label: "Date" },
    { key: "time", label: "Time" },
    { key: "timezone", label: "Timezone" },
    { key: "weather", label: "Weather" },
    { key: "air_quality", label: "Air Quality" },
  ];

  function toggleSystemSetting(key: SystemSettingKey) {
    settings.update((s) => ({ ...s, [key]: !(s[key] ?? true) }));
  }

  function toggleInfoCollapsed() {
    settings.update((s) => ({
      ...s,
      infoCollapsed: !(s.infoCollapsed ?? true),
    }));
  }

  function toggleCollapsedVisibleKey(key: CollapsedVisibleKey) {
    settings.update((s) => {
      const current = s.infoCollapsedVisibleKeys ?? [];
      const exists = current.includes(key);
      const next = exists
        ? current.filter((k) => k !== key)
        : [...current, key];
      return { ...s, infoCollapsedVisibleKeys: next };
    });
  }

  function toggleTranslateInHistory() {
    settings.update((s) => ({
      ...s,
      includeTranslateInHistory: !s.includeTranslateInHistory,
    }));
  }

  function updateDefaultTranslateFrom(value: string) {
    settings.update((s) => ({ ...s, defaultTranslateFrom: value }));
  }

  function updateDefaultTranslateTo(value: string) {
    settings.update((s) => ({ ...s, defaultTranslateTo: value }));
  }

  function getFavicon(siteUrl: string) {
    try {
      const u = new URL(siteUrl);
      return `${u.origin}/favicon.ico`;
    } catch (e) {
      return "/favicon.png";
    }
  }

  function applyCss() {
    if (!browser) return;
    const styleId = "lt-custom-css";
    let el = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement("style");
      el.id = styleId;
      document.head.appendChild(el);
    }
    el.textContent = cssText || "";
    setCustomCss(cssText || "");
    // small visual feedback
    showSettings = false;
  }

  function exportSettings() {
    const st = $settings;
    const payload = { pinned: st.pinned, css: cssText, colors: st.colors };
    const data = JSON.stringify(payload, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "luckytab-settings.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importSettings() {
    if (!browser) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      const text = await f.text();
      try {
        const parsed = JSON.parse(text);
        if (parsed.css) {
          cssText = parsed.css;
          // update centralized settings
          settings.update((s) => ({ ...s, customCss: cssText }));
          setCustomCss(cssText);
        }
        if (parsed.pinned) {
          // overwrite pinned sites in centralized settings
          settings.update((s) => ({ ...s, pinned: parsed.pinned }));
        }
        alert("Imported settings");
      } catch (e) {
        alert("Failed to import: " + e);
      }
    };
    input.click();
  }

  function doReset() {
    if (
      !confirm(
        "Reset all settings? This will remove pinned sites and custom CSS stored in localStorage.",
      )
    )
      return;
    clearAllSettings();
    const el = document.getElementById("lt-custom-css");
    if (el) el.remove();
    cssText = "";
    alert("Settings reset");
  }

  // Theme templates (use CSS variables so CleanUI classes can reference them)
  const themes = {
    "purple-template": {
      primary: "#311b92",
      secondary: "#512da8",
      tertiary: "rgba(49, 27, 146, 0.1)",
      quaternary: "rgba(49, 27, 146, 0.05)",
    },
    "pink-template": {
      primary: "#880e4f",
      secondary: "#c2185b",
      tertiary: "rgba(136, 14, 79, 0.1)",
      quaternary: "rgba(136, 14, 79, 0.05)",
    },
    "blue-template": {
      primary: "#142850",
      secondary: "#27496d",
      tertiary: "rgba(20, 40, 80, 0.1)",
      quaternary: "rgba(20, 40, 80, 0.05)",
    },
    "yellow-template": {
      primary: "#f57f17",
      secondary: "#ff9800",
      tertiary: "rgba(245, 127, 23, 0.1)",
      quaternary: "rgba(245, 127, 23, 0.05)",
    },
    "mixed-1-template": {
      primary: "#e8116a",
      secondary: "#0fe1e1",
      tertiary: "rgba(43,243,224,0.15)",
      quaternary: "rgba(207,26,144,0.15)",
    },
  } as Record<
    string,
    { primary: string; secondary: string; tertiary: string; quaternary: string }
  >;

  function saveThemeColors(
    primary: string,
    secondary: string,
    tertiary: string,
    quaternary: string,
  ) {
    if (!browser) return;
    // use new variable naming convention
    localStorage.setItem("primary", primary);
    localStorage.setItem("secondary", secondary);
    localStorage.setItem("tertiary", tertiary);
    localStorage.setItem("quaternary", quaternary);
  }

  function loadThemeColors() {
    if (!browser) return;
    const primary = localStorage.getItem("primaryColor");
    const secondary = localStorage.getItem("secondaryColor");
    const tertiary = localStorage.getItem("tertiaryColor");
    const quaternary = localStorage.getItem("quaternaryColor");
    if (primary && secondary && tertiary && quaternary) {
      document.body.style.setProperty("--primary", primary);
      document.body.style.setProperty("--secondary", secondary);
      document.body.style.setProperty("--tertiary", tertiary);
      document.body.style.setProperty("--quaternary", quaternary);
    }
  }

  function changeColorTemplate(key: string) {
    const theme = themes[key];
    if (!theme) return;
    document.body.style.setProperty("--primary", theme.primary);
    document.body.style.setProperty("--secondary", theme.secondary);
    document.body.style.setProperty("--tertiary", theme.tertiary);
    document.body.style.setProperty("--quaternary", theme.quaternary);
    saveThemeColors(
      theme.primary,
      theme.secondary,
      theme.tertiary,
      theme.quaternary,
    );
    showSettings = false;
  }

  // Load theme vars on mount
  onMount(() => {
    loadThemeColors();
  });
</script>

<button
  class="settings-button"
  onclick={toggleSettings}
  title="Settings"
  aria-label="Settings"
  bind:this={settingsButtonEl}
>
  <i class="fa fa-cog" style="font-size:1.25rem;"></i>
</button>
{#if showSettings}
  <div class="settings-panel" bind:this={settingsPanel}>
    <h3 style="margin-top: 0;">Settings</h3>

    <!-- Search Provider Settings -->
    <h4 class="section-title">Search Providers</h4>
    <div class="toggle-option">
      <label>
        <input
          type="checkbox"
          checked={$settings.enableProviderScroll ?? true}
          onchange={toggleProviderScroll}
        />
        Enable scrolling through providers with mouse wheel
      </label>
    </div>
    <div class="toggle-option">
      <label>
        <input
          type="checkbox"
          checked={$settings.enableProviderReorder ?? true}
          onchange={toggleProviderReorder}
        />
        Enable drag-and-drop provider reordering
      </label>
    </div>

    {#if $settings.enableProviderReorder ?? true}
      <div class="provider-reorder-section">
        <p style="margin: 0.5rem 0; font-size: 0.9rem; opacity: 0.8;">
          Drag providers to reorder (affects display and scroll order):
        </p>
        <div class="provider-reorder-list">
          {#each orderedProviders as p, idx (p.id)}
            <div
              class="provider-reorder-item"
              class:dragging={draggedProviderIndex === idx}
              draggable={true}
              role="button"
              tabindex="0"
              ondragstart={(e) => handleProviderDragStart(e, idx)}
              ondragover={handleProviderDragOver}
              ondrop={(e) => handleProviderDrop(e, idx)}
              ondragend={handleProviderDragEnd}
            >
              <i class="fa fa-grip-vertical drag-handle" aria-hidden="true"></i>
              {#if typeof p.icon !== "string"}
                <enhanced:img
                  class="provider-reorder-img"
                  src={p.icon}
                  alt={p.name}
                />
              {:else}
                <img class="provider-reorder-img" src={p.icon} alt={p.name} />
              {/if}
              <span class="provider-reorder-name">{p.name}</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <hr class="section-sep" />

    <!-- Safety Check Settings -->
    <h4 class="section-title">URL Safety Check</h4>
    <p style="margin: 0 0 0.5rem; font-size: 0.85rem; opacity: 0.75;">
      Used when you navigate directly to a URL. Get a free API key at
      <a
        href="https://console.cloud.google.com/apis/library/safebrowsing.googleapis.com"
        target="_blank"
        rel="noopener noreferrer">Google Cloud Console</a
      >
      (enable "Safe Browsing API", create an API key, no billing required for &lt;10k/day).
    </p>
    <div class="setting-row">
      <label for="safe-browsing-key">Google Safe Browsing API key:</label>
      <input
        id="safe-browsing-key"
        type="password"
        placeholder="Paste API key here..."
        value={$settings.safeBrowsingApiKey ?? ""}
        oninput={(e) =>
          settings.update((s) => ({
            ...s,
            safeBrowsingApiKey: e.currentTarget.value,
          }))}
        style="flex:1; min-width:0; font-family: monospace; font-size: 0.85rem;"
      />
    </div>
    {#if !$settings.safeBrowsingApiKey?.trim()}
      <p
        style="margin: 0.25rem 0 0; font-size: 0.8rem; color: rgba(200,150,40,0.85);"
      >
        <i class="fa fa-exclamation-triangle" aria-hidden="true"></i>
        No key set — safety check will always ask for confirmation before visiting
        URLs directly.
      </p>
    {/if}

    <hr class="section-sep" />

    <!-- Translator Settings -->
    <h4 class="section-title">Translator</h4>
    <div class="toggle-option">
      <label>
        <input
          type="checkbox"
          checked={$settings.enableTranslator ?? true}
          onchange={toggleTranslator}
        />
        Enable translator tool
      </label>
    </div>

    {#if $settings.enableTranslator ?? true}
      <div class="translator-settings">
        <div class="setting-row">
          <label for="default-from">Default "From" language:</label>
          <select
            id="default-from"
            value={$settings.defaultTranslateFrom ?? "auto"}
            onchange={(e) => updateDefaultTranslateFrom(e.currentTarget.value)}
          >
            <option value="auto">Auto-detect</option>
            {#each availableLanguages as lang}
              <option value={lang.code}>{lang.name}</option>
            {/each}
          </select>
        </div>
        <div class="setting-row">
          <label for="default-to">Default "To" language:</label>
          <select
            id="default-to"
            value={$settings.defaultTranslateTo ?? "nl"}
            onchange={(e) => updateDefaultTranslateTo(e.currentTarget.value)}
          >
            {#each availableLanguages as lang}
              <option value={lang.code}>{lang.name}</option>
            {/each}
          </select>
        </div>
      </div>
    {/if}

    <hr class="section-sep" />

    <!-- History Settings -->
    <h4 class="section-title">History</h4>
    <div class="toggle-option">
      <label>
        <input
          type="checkbox"
          checked={$settings.enableHistory ?? true}
          onchange={toggleHistory}
        />
        Enable history tracking
      </label>
      <p style="margin: 0.25rem 0 0 1.5rem; font-size: 0.85rem; opacity: 0.7;">
        Note: Disabling this will prevent autocomplete suggestions from previous
        searches
      </p>
    </div>

    {#if $settings.enableHistory ?? true}
      <div class="toggle-option" style="margin-left: 1.5rem;">
        <label>
          <input
            type="checkbox"
            checked={$settings.includeTranslateInHistory ?? true}
            onchange={toggleTranslateInHistory}
          />
          Include translations in history
        </label>
      </div>
    {/if}

    <hr class="section-sep" />

    <!-- Info Widget Settings -->
    <h4 class="section-title">Info Widget</h4>
    <div class="toggle-option">
      <label>
        <input
          type="checkbox"
          checked={$settings.enableSystemInfo ?? true}
          onchange={toggleSystemInfo}
        />
        Show info widget above pinned sites
      </label>
    </div>

    {#if $settings.enableSystemInfo ?? true}
      <div class="system-info-settings">
        <div class="toggle-option">
          <label>
            <input
              type="checkbox"
              checked={$settings.showSystemPublicIp ?? true}
              onchange={() => toggleSystemSetting("showSystemPublicIp")}
            />
            Public IP
          </label>
        </div>
        <div class="toggle-option">
          <label>
            <input
              type="checkbox"
              checked={$settings.showSystemTime ?? true}
              onchange={() => toggleSystemSetting("showSystemTime")}
            />
            Time
          </label>
        </div>
        <div class="toggle-option">
          <label>
            <input
              type="checkbox"
              checked={$settings.showInfoDate ?? true}
              onchange={() => toggleSystemSetting("showInfoDate")}
            />
            Date
          </label>
        </div>
        <div class="toggle-option">
          <label>
            <input
              type="checkbox"
              checked={$settings.showSystemTimezone ?? true}
              onchange={() => toggleSystemSetting("showSystemTimezone")}
            />
            Timezone
          </label>
        </div>
        <div class="toggle-option">
          <label>
            <input
              type="checkbox"
              checked={$settings.showSystemLanguage ?? true}
              onchange={() => toggleSystemSetting("showSystemLanguage")}
            />
            Language
          </label>
        </div>
        <div class="toggle-option">
          <label>
            <input
              type="checkbox"
              checked={$settings.showSystemConnection ?? true}
              onchange={() => toggleSystemSetting("showSystemConnection")}
            />
            Connection Type/Speed
          </label>
        </div>
        <div class="toggle-option">
          <label>
            <input
              type="checkbox"
              checked={$settings.showSystemMemory ?? true}
              onchange={() => toggleSystemSetting("showSystemMemory")}
            />
            Device Memory
          </label>
        </div>
        <div class="toggle-option">
          <label>
            <input
              type="checkbox"
              checked={$settings.showSystemBattery ?? true}
              onchange={() => toggleSystemSetting("showSystemBattery")}
            />
            Battery Status
          </label>
        </div>
        <div class="toggle-option">
          <label>
            <input
              type="checkbox"
              checked={$settings.showInfoWeather ?? true}
              onchange={() => toggleSystemSetting("showInfoWeather")}
            />
            Weather
          </label>
        </div>
        <div class="toggle-option">
          <label>
            <input
              type="checkbox"
              checked={$settings.showInfoAirQuality ?? true}
              onchange={() => toggleSystemSetting("showInfoAirQuality")}
            />
            Air Quality
          </label>
        </div>
        <div class="toggle-option">
          <label>
            <input
              type="checkbox"
              checked={$settings.showSystemCpuCores ?? true}
              onchange={() => toggleSystemSetting("showSystemCpuCores")}
            />
            CPU Cores
          </label>
        </div>
      </div>

      <div
        class="toggle-option"
        style="margin-left: 1.5rem; margin-top: 0.5rem;"
      >
        <label>
          <input
            type="checkbox"
            checked={$settings.infoCollapsed ?? true}
            onchange={toggleInfoCollapsed}
          />
          Start with info widget collapsed
        </label>
      </div>

      <div class="collapsed-visibility-settings">
        <p class="collapsed-visibility-title">Visible values when collapsed:</p>
        <div class="collapsed-visibility-grid">
          {#each collapsedValueOptions as opt}
            <label class="collapsed-visibility-option">
              <input
                type="checkbox"
                checked={($settings.infoCollapsedVisibleKeys ?? []).includes(
                  opt.key,
                )}
                onchange={() => toggleCollapsedVisibleKey(opt.key)}
              />
              {opt.label}
            </label>
          {/each}
        </div>
      </div>
    {/if}

    <hr class="section-sep" />

    <!-- Appearance -->
    <h4 class="section-title">Appearance</h4>
    <div class="theme-tiles">
      {#each Object.keys(themes) as k}
        <button
          class="tertiary theme-tile"
          onclick={() => changeColorTemplate(k)}
          >{k.replace("-template", "")}</button
        >
      {/each}
    </div>

    <h4 class="section-title">Custom CSS</h4>
    <textarea
      class="custom-css"
      bind:value={cssText}
      placeholder="/* Custom CSS. use var(--primary) etc. */"
      rows="6">{cssText}</textarea
    >
    <div class="actions-row">
      <button class="secondary" onclick={importSettings}>Import</button>
      <button class="secondary" onclick={exportSettings}>Export</button>
      <button class="primary" onclick={applyCss}>Apply</button>
    </div>

    <hr class="section-sep" />

    <!-- Pinned Sites -->
    <h4 class="section-title">Pinned Sites</h4>
    <div class="pinned-adder">
      <input placeholder="Title (optional)" bind:value={newTitle} />
      <input placeholder="https://example.com" bind:value={newUrl} />
      <input placeholder="favicon url (optional)" bind:value={newFavicon} />
      <button class="primary" onclick={addPinnedSite}>Add</button>
    </div>
    <div class="pinned-list">
      {#each combinedPinnedSites as p}
        <div class="pinned-item">
          <div class="pinned-main">
            <img
              class="pinned-fav"
              src={p.custom_favicon ?? getFavicon(p.url)}
              alt=""
            />
            <div class="pinned-title">{p.title}</div>
          </div>
          <div class="pinned-actions">
            <button class="tertiary" onclick={() => editPinnedSite(p.id)}
              >Edit</button
            >
            <button class="red" onclick={() => removePinnedSite(p.id)}
              >Remove</button
            >
          </div>
        </div>
      {/each}
    </div>

    <hr class="section-sep" />
    <div class="footer-row">
      <small>Manage stored settings (local only)</small>
      <button class="red" onclick={doReset}>Reset</button>
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
    top: 2.5rem;
    left: 2.5rem;
    width: calc(100vw - 5rem);
    height: calc(100vh - 5rem);
    background-color: var(--container, rgba(0, 0, 0, 0.92));
    color: white;
    padding: 1.25rem;
    border-radius: 0.5rem;
    z-index: 9999;
    overflow: auto;
  }

  .section-title {
    margin-top: 0;
  }
  .theme-tiles {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-bottom: 0.5rem;
  }
  .theme-tile {
    min-width: 0;
    padding: 0.5rem;
    border-radius: 0.5rem;
  }
  .custom-css {
    width: 100%;
    margin-bottom: 0.5rem;
    border-radius: 0.25rem;
    padding: 0.5rem;
    box-sizing: border-box;
  }
  .actions-row {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
  }
  .section-sep {
    margin: 0.75rem 0;
    border-color: #333;
  }
  .pinned-adder {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }
  .pinned-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-height: 200px;
    overflow: auto;
    margin-bottom: 0.5rem;
  }
  .pinned-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.25rem;
    border-radius: 0.25rem;
    background: rgba(255, 255, 255, 0.02);
  }
  .pinned-main {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    flex: 1;
    overflow: hidden;
  }
  .pinned-fav {
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 4px;
  }
  .pinned-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .pinned-actions {
    display: flex;
    gap: 0.25rem;
  }
  .footer-row {
    display: flex;
    gap: 0.5rem;
    justify-content: space-between;
    align-items: center;
  }

  /* Toggle options */
  .toggle-option {
    margin: 0.5rem 0;
  }

  .toggle-option label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
  }

  .toggle-option input[type="checkbox"] {
    cursor: pointer;
    width: 1rem;
    height: 1rem;
  }

  /* Setting rows */
  .setting-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0.5rem 0;
  }

  .setting-row label {
    flex: 0 0 auto;
    min-width: 150px;
  }

  .setting-row select {
    flex: 1;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
  }

  .translator-settings {
    margin: 0.5rem 0 0 1.5rem;
  }

  .system-info-settings {
    margin: 0.5rem 0 0 1.5rem;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.25rem 0.75rem;
  }

  .collapsed-visibility-settings {
    margin: 0.4rem 0 0 1.5rem;
  }

  .collapsed-visibility-title {
    margin: 0.25rem 0;
    font-size: 0.86rem;
    opacity: 0.85;
  }

  .collapsed-visibility-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.2rem 0.75rem;
  }

  .collapsed-visibility-option {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
    cursor: pointer;
  }

  @media (max-width: 900px) {
    .system-info-settings {
      grid-template-columns: 1fr;
    }

    .collapsed-visibility-grid {
      grid-template-columns: 1fr;
    }
  }

  /* Provider reorder list */
  .provider-reorder-section {
    margin: 0.5rem 0 0 1.5rem;
  }

  .provider-reorder-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    max-height: 250px;
    overflow-y: auto;
    padding: 0.5rem;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 0.5rem;
  }

  .provider-reorder-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 0.5rem;
    cursor: grab;
    transition:
      opacity 0.2s,
      transform 0.2s;
  }

  .provider-reorder-item:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .provider-reorder-item:active {
    cursor: grabbing;
  }

  .provider-reorder-item.dragging {
    opacity: 0.5;
    transform: scale(0.95);
  }

  .drag-handle {
    color: rgba(255, 255, 255, 0.5);
    font-size: 0.75rem;
    cursor: grab;
  }

  .provider-reorder-item:active .drag-handle {
    cursor: grabbing;
  }

  .provider-reorder-img {
    width: 1.25rem;
    height: 1.25rem;
    border-radius: 3px;
  }

  .provider-reorder-name {
    font-size: 0.9rem;
    font-weight: 500;
  }
</style>
