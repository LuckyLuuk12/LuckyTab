<!-- @component
Displays a two-column info widget (system + general/API data) with copy actions.
Rows with unknown values are hidden and reasons are logged to the console.
Users can reorder rows via drag-and-drop; order persists via settings.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { browser } from "$app/environment";
  import { settings } from "$lib/stores";

  type InfoRow = {
    key: string;
    yamlKey: string;
    label: string;
    value: string;
    unknownReason?: string;
  };

  type InfoColumn = "system" | "general";

  const SYSTEM_DEFAULT_ORDER = [
    "public_ip",
    "connection",
    "device_memory",
    "battery",
    "language",
    "cpu_cores",
  ];
  const GENERAL_DEFAULT_ORDER = [
    "date",
    "time",
    "timezone",
    "weather",
    "air_quality",
  ];

  const unknownLogCache = new Map<string, string>();

  let now = $state(new Date());
  let publicIp = $state("Loading...");
  let weatherText = $state("Loading...");
  let airQualityText = $state("Loading...");
  let batteryText = $state("Loading...");
  let connectionText = $state("Loading...");
  let deviceMemoryText = $state("Unknown");
  let geo = $state<{ lat: number; lon: number } | null>(null);
  let toastMessage = $state("");

  let publicIpReason = $state("Public IP request still loading");
  let weatherReason = $state("Weather request still loading");
  let airQualityReason = $state("Air quality request still loading");
  let batteryReason = $state("Battery info still loading");
  let connectionReason = $state("Connection info still loading");
  let memoryReason = $state("Device memory unavailable");

  let draggedColumn = $state<InfoColumn | null>(null);
  let draggedYamlKey = $state<string | null>(null);

  let refreshTimer: ReturnType<typeof setInterval> | null = null;
  let toastTimer: ReturnType<typeof setTimeout> | null = null;

  function toYamlScalar(value: string) {
    const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return `"${escaped}"`;
  }

  function showToast(message: string) {
    toastMessage = message;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastMessage = "";
    }, 1200);
  }

  function isUnknownValue(value: string) {
    return (
      !value ||
      ["Unknown", "Unavailable", "Loading...", "Location unavailable"].includes(
        value,
      )
    );
  }

  function logUnknownOnce(row: InfoRow) {
    const reason = row.unknownReason || `${row.label} is unavailable`;
    const key = row.yamlKey;
    const previousReason = unknownLogCache.get(key);
    if (previousReason !== reason) {
      console.warn(`[Info] Hiding ${row.label}: ${reason}`);
      unknownLogCache.set(key, reason);
    }
  }

  function normalizeOrder(order: string[] | undefined, defaults: string[]) {
    const base = Array.isArray(order) ? order : [];
    const validSet = new Set(defaults);
    const unique = base.filter(
      (key, idx) => validSet.has(key) && base.indexOf(key) === idx,
    );
    const missing = defaults.filter((key) => !unique.includes(key));
    return [...unique, ...missing];
  }

  function applyOrder(
    rows: InfoRow[],
    order: string[] | undefined,
    defaults: string[],
  ) {
    const orderedKeys = normalizeOrder(order, defaults);
    const byKey = new Map(rows.map((row) => [row.yamlKey, row]));
    return orderedKeys
      .map((key) => byKey.get(key))
      .filter((row): row is InfoRow => Boolean(row));
  }

  function materializeVisibleRows(rows: InfoRow[]) {
    return rows.filter((row) => {
      if (isUnknownValue(row.value)) {
        logUnknownOnce(row);
        return false;
      }
      unknownLogCache.delete(row.yamlKey);
      return true;
    });
  }

  async function copyText(value: string, successMessage: string) {
    if (!browser || !navigator?.clipboard) {
      showToast("Clipboard unavailable");
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      showToast(successMessage);
    } catch {
      showToast("Copy failed");
    }
  }

  async function copyRowValue(row: { label: string; value: string }) {
    await copyText(row.value, `${row.label} copied`);
  }

  async function copyAllAsYaml(
    rows: Array<{ yamlKey: string; value: string }>,
  ) {
    if (!rows.length) {
      showToast("Nothing to copy");
      return;
    }

    const yaml = rows
      .map((row) => `${row.yamlKey}: ${toYamlScalar(row.value)}`)
      .join("\n");
    await copyText(yaml, "All info copied");
  }

  async function copyColumnAsYaml(
    rows: Array<{ yamlKey: string; value: string }>,
    label: string,
  ) {
    if (!rows.length) {
      showToast("Nothing to copy");
      return;
    }

    const yaml = rows
      .map((row) => `${row.yamlKey}: ${toYamlScalar(row.value)}`)
      .join("\n");
    await copyText(yaml, `${label} copied`);
  }

  function describeAqi(aqi: number) {
    if (aqi <= 50) return "Good";
    if (aqi <= 100) return "Moderate";
    if (aqi <= 150) return "Unhealthy for sensitive groups";
    if (aqi <= 200) return "Unhealthy";
    if (aqi <= 300) return "Very unhealthy";
    return "Hazardous";
  }

  function describePm25(pm: number) {
    if (pm <= 12) return "Good";
    if (pm <= 35.4) return "Moderate";
    if (pm <= 55.4) return "Unhealthy for sensitive groups";
    if (pm <= 150.4) return "Unhealthy";
    if (pm <= 250.4) return "Very unhealthy";
    return "Hazardous";
  }

  function mapWeatherCode(code: number) {
    if (code === 0) return "Clear";
    if ([1, 2].includes(code)) return "Partly cloudy";
    if (code === 3) return "Overcast";
    if ([45, 48].includes(code)) return "Fog";
    if ([51, 53, 55].includes(code)) return "Drizzle";
    if ([61, 63, 65].includes(code)) return "Rain";
    if ([71, 73, 75, 77].includes(code)) return "Snow";
    if ([80, 81, 82].includes(code)) return "Rain showers";
    if ([95, 96, 99].includes(code)) return "Thunderstorm";
    return "Unknown";
  }

  async function resolveLocation() {
    if (!browser || !navigator.geolocation) return null;

    return new Promise<{ lat: number; lon: number } | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        },
        (err) => {
          weatherReason = `Geolocation error: ${err.message}`;
          airQualityReason = `Geolocation error: ${err.message}`;
          resolve(null);
        },
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 5 * 60 * 1000 },
      );
    });
  }

  async function fetchWeatherAndAirQuality(lat: number, lon: number) {
    const weatherUrl =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      "&current=temperature_2m,weather_code&timezone=auto";
    const airUrl =
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}` +
      "&current=us_aqi,pm2_5";

    try {
      const response = await fetch(weatherUrl, { cache: "no-store" });
      if (!response.ok) {
        weatherText = "Unavailable";
        weatherReason = `Weather API HTTP ${response.status}`;
      } else {
        const data = (await response.json()) as {
          current?: { temperature_2m?: number; weather_code?: number };
        };
        const temp = data.current?.temperature_2m;
        const code = data.current?.weather_code;
        if (Number.isFinite(temp) && Number.isFinite(code)) {
          weatherText = `${temp} C, ${mapWeatherCode(code as number)}`;
        } else {
          weatherText = "Unavailable";
          weatherReason = "Weather API response missing temperature/code";
        }
      }
    } catch (e) {
      weatherText = "Unavailable";
      weatherReason = `Weather API request failed: ${String(e)}`;
    }

    try {
      const response = await fetch(airUrl, { cache: "no-store" });
      if (!response.ok) {
        airQualityText = "Unavailable";
        airQualityReason = `Air quality API HTTP ${response.status}`;
      } else {
        const data = (await response.json()) as {
          current?: { us_aqi?: number; pm2_5?: number };
        };
        const aqi = data.current?.us_aqi;
        const pm25 = data.current?.pm2_5;
        if (Number.isFinite(aqi)) {
          const aqiLabel = describeAqi(aqi as number);
          const pmText = Number.isFinite(pm25)
            ? ` PM2.5: ${pm25} ug/m3 (${describePm25(pm25 as number)})`
            : "";
          airQualityText = `AQI: ${aqi} (${aqiLabel}).${pmText}`;
        } else {
          airQualityText = "Unavailable";
          airQualityReason = "Air quality API response missing US AQI";
        }
      }
    } catch (e) {
      airQualityText = "Unavailable";
      airQualityReason = `Air quality API request failed: ${String(e)}`;
    }
  }

  function refreshConnectionInfo() {
    if (!browser) return;
    const conn = (navigator as any).connection;
    if (!conn) {
      connectionText = "Unknown";
      connectionReason =
        "Navigator.connection is not supported by this browser";
      return;
    }

    const type = conn.effectiveType || conn.type || "Unknown";
    const speed = Number.isFinite(conn.downlink)
      ? `${conn.downlink} Mbps`
      : "speed unknown";
    connectionText = `${type} (${speed})`;
  }

  async function refreshBatteryInfo() {
    if (!browser || !("getBattery" in navigator)) {
      batteryText = "Unknown";
      batteryReason = "Battery Status API is not supported by this browser";
      return;
    }

    try {
      const battery = await (navigator as any).getBattery();
      const level = Math.round((battery.level ?? 0) * 100);
      const charging = battery.charging ? "charging" : "not charging";
      batteryText = `${level}%, ${charging}`;
    } catch (e) {
      batteryText = "Unknown";
      batteryReason = `Battery API request failed: ${String(e)}`;
    }
  }

  async function refreshApiInfo() {
    if (!browser) return;
    if (!geo) {
      geo = await resolveLocation();
    }
    if (!geo) {
      weatherText = "Location unavailable";
      airQualityText = "Location unavailable";
      if (!weatherReason) weatherReason = "Geolocation unavailable or denied";
      if (!airQualityReason)
        airQualityReason = "Geolocation unavailable or denied";
      return;
    }
    await fetchWeatherAndAirQuality(geo.lat, geo.lon);
  }

  async function fetchPublicIp() {
    if (!browser) return;

    const endpoints = [
      "https://api.ipify.org?format=json",
      "https://api64.ipify.org?format=json",
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, { cache: "no-store" });
        if (!response.ok) {
          publicIpReason = `Public IP API HTTP ${response.status} (${endpoint})`;
          continue;
        }
        const data = (await response.json()) as { ip?: string };
        if (data?.ip) {
          publicIp = data.ip;
          return;
        }
        publicIpReason = `Public IP API returned empty payload (${endpoint})`;
      } catch (e) {
        publicIpReason = `Public IP API request failed (${endpoint}): ${String(e)}`;
      }
    }

    publicIp = "Unavailable";
  }

  function moveOrderItem(order: string[], fromKey: string, toKey: string) {
    const fromIndex = order.indexOf(fromKey);
    const toIndex = order.indexOf(toKey);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return order;

    const next = [...order];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return next;
  }

  function handleDragStart(column: InfoColumn, yamlKey: string, e: DragEvent) {
    draggedColumn = column;
    draggedYamlKey = yamlKey;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
    }
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "move";
    }
  }

  function handleDrop(column: InfoColumn, targetKey: string, e: DragEvent) {
    e.preventDefault();
    if (
      !draggedYamlKey ||
      draggedColumn !== column ||
      draggedYamlKey === targetKey
    ) {
      draggedYamlKey = null;
      draggedColumn = null;
      return;
    }

    settings.update((s) => {
      if (column === "system") {
        const current = normalizeOrder(s.infoSystemOrder, SYSTEM_DEFAULT_ORDER);
        return {
          ...s,
          infoSystemOrder: moveOrderItem(current, draggedYamlKey!, targetKey),
        };
      }

      const current = normalizeOrder(s.infoGeneralOrder, GENERAL_DEFAULT_ORDER);
      return {
        ...s,
        infoGeneralOrder: moveOrderItem(current, draggedYamlKey!, targetKey),
      };
    });

    draggedYamlKey = null;
    draggedColumn = null;
  }

  function handleDragEnd() {
    draggedYamlKey = null;
    draggedColumn = null;
  }

  function toggleCollapsed() {
    settings.update((s) => ({
      ...s,
      infoCollapsed: !(s.infoCollapsed ?? true),
    }));
  }

  const isInfoCollapsed = $derived($settings.infoCollapsed ?? true);

  onMount(() => {
    if (!browser) return;

    void fetchPublicIp();
    refreshConnectionInfo();
    void refreshBatteryInfo();

    const mem = (navigator as any).deviceMemory;
    if (Number.isFinite(mem)) {
      deviceMemoryText = `${mem} GB`;
    } else {
      deviceMemoryText = "Unknown";
      memoryReason = "navigator.deviceMemory is not supported by this browser";
    }

    void refreshApiInfo();

    refreshTimer = setInterval(() => {
      now = new Date();
    }, 1000);

    const conn = (navigator as any).connection;
    conn?.addEventListener?.("change", refreshConnectionInfo);
    window.addEventListener("online", refreshConnectionInfo);
    window.addEventListener("offline", refreshConnectionInfo);

    return () => {
      if (refreshTimer) clearInterval(refreshTimer);
      if (toastTimer) clearTimeout(toastTimer);
      conn?.removeEventListener?.("change", refreshConnectionInfo);
      window.removeEventListener("online", refreshConnectionInfo);
      window.removeEventListener("offline", refreshConnectionInfo);
    };
  });

  const systemRows = $derived.by<InfoRow[]>(() => {
    if (!browser) return [];

    const candidates: InfoRow[] = [];

    if ($settings.showSystemPublicIp ?? true) {
      candidates.push({
        key: "public-ip",
        yamlKey: "public_ip",
        label: "Public IP",
        value: publicIp,
        unknownReason: publicIpReason,
      });
    }
    if ($settings.showSystemConnection ?? true) {
      candidates.push({
        key: "connection",
        yamlKey: "connection",
        label: "Connection",
        value: connectionText,
        unknownReason: connectionReason,
      });
    }
    if ($settings.showSystemMemory ?? true) {
      candidates.push({
        key: "memory",
        yamlKey: "device_memory",
        label: "Device Memory",
        value: deviceMemoryText,
        unknownReason: memoryReason,
      });
    }
    if ($settings.showSystemBattery ?? true) {
      candidates.push({
        key: "battery",
        yamlKey: "battery",
        label: "Battery",
        value: batteryText,
        unknownReason: batteryReason,
      });
    }
    if ($settings.showSystemLanguage ?? true) {
      candidates.push({
        key: "language",
        yamlKey: "language",
        label: "Language",
        value: navigator.language || "Unknown",
        unknownReason: "navigator.language unavailable",
      });
    }
    if ($settings.showSystemCpuCores ?? true) {
      candidates.push({
        key: "cpu",
        yamlKey: "cpu_cores",
        label: "CPU Cores",
        value: navigator.hardwareConcurrency
          ? String(navigator.hardwareConcurrency)
          : "Unknown",
        unknownReason: "navigator.hardwareConcurrency unavailable",
      });
    }

    return materializeVisibleRows(
      applyOrder(candidates, $settings.infoSystemOrder, SYSTEM_DEFAULT_ORDER),
    );
  });

  const generalRows = $derived.by<InfoRow[]>(() => {
    if (!browser) return [];

    const candidates: InfoRow[] = [];

    if ($settings.showInfoDate ?? true) {
      candidates.push({
        key: "date",
        yamlKey: "date",
        label: "Date",
        value: now.toLocaleDateString(),
      });
    }
    if ($settings.showSystemTime ?? true) {
      candidates.push({
        key: "time",
        yamlKey: "time",
        label: "Time",
        value: now.toLocaleTimeString(),
      });
    }
    if ($settings.showSystemTimezone ?? true) {
      candidates.push({
        key: "timezone",
        yamlKey: "timezone",
        label: "Timezone",
        value: Intl.DateTimeFormat().resolvedOptions().timeZone || "Unknown",
        unknownReason: "Resolved timezone unavailable",
      });
    }
    if ($settings.showInfoWeather ?? true) {
      candidates.push({
        key: "weather",
        yamlKey: "weather",
        label: "Weather",
        value: weatherText,
        unknownReason: weatherReason,
      });
    }
    if ($settings.showInfoAirQuality ?? true) {
      candidates.push({
        key: "air-quality",
        yamlKey: "air_quality",
        label: "Air Quality",
        value: airQualityText,
        unknownReason: airQualityReason,
      });
    }

    return materializeVisibleRows(
      applyOrder(candidates, $settings.infoGeneralOrder, GENERAL_DEFAULT_ORDER),
    );
  });

  const collapsedRows = $derived.by<InfoRow[]>(() => {
    const preferred = $settings.infoCollapsedVisibleKeys ?? [];
    const all = [...systemRows, ...generalRows];
    if (preferred.length === 0) return all.slice(0, 3);

    const byKey = new Map(all.map((row) => [row.yamlKey, row]));
    const chosen = preferred
      .map((key) => byKey.get(key))
      .filter((row): row is InfoRow => Boolean(row));

    return chosen.length > 0 ? chosen : all.slice(0, 3);
  });
</script>

<section class="system-info-card" aria-label="System information">
  <div class="system-header">
    <div class="system-title-wrap">
      <i class="fa fa-desktop" aria-hidden="true"></i>
      <h3>Info</h3>
    </div>

    <div class="header-actions">
      <button
        type="button"
        class="copy-all-button"
        title="Copy all as YAML"
        aria-label="Copy all info as YAML"
        onclick={() => copyAllAsYaml([...systemRows, ...generalRows])}
      >
        <i class="fa fa-copy" aria-hidden="true"></i>
      </button>
      <button
        type="button"
        class="collapse-button"
        title={isInfoCollapsed ? "Expand info" : "Collapse info"}
        aria-label={isInfoCollapsed ? "Expand info" : "Collapse info"}
        onclick={toggleCollapsed}
      >
        <i
          class={isInfoCollapsed ? "fa fa-chevron-down" : "fa fa-chevron-up"}
          aria-hidden="true"
        ></i>
      </button>
    </div>
  </div>

  {#if isInfoCollapsed}
    <div class="collapsed-strip">
      {#each collapsedRows as row (row.key)}
        <button
          type="button"
          class="collapsed-item"
          title="Click to copy"
          aria-label={`Copy ${row.label}`}
          onclick={() => copyRowValue(row)}
        >
          <span class="system-label">{row.label}</span>
          <span class="system-value">{row.value}</span>
        </button>
      {/each}
    </div>
  {:else}
    <div class="info-columns">
      <section class="info-column" aria-label="System info">
        <div class="column-header">
          <h4>System</h4>
          <button
            type="button"
            class="copy-column-button"
            title="Copy system column as YAML"
            aria-label="Copy system info as YAML"
            onclick={() => copyColumnAsYaml(systemRows, "System info")}
          >
            <i class="fa fa-copy" aria-hidden="true"></i>
          </button>
        </div>

        <div class="system-grid">
          {#each systemRows as row (row.key)}
            <button
              type="button"
              class="system-row"
              class:dragging={draggedYamlKey === row.yamlKey}
              draggable={true}
              onclick={() => copyRowValue(row)}
              title="Click to copy"
              aria-label={`Copy ${row.label}`}
              ondragstart={(e) => handleDragStart("system", row.yamlKey, e)}
              ondragover={handleDragOver}
              ondrop={(e) => handleDrop("system", row.yamlKey, e)}
              ondragend={handleDragEnd}
            >
              <span class="system-label">{row.label}</span>
              <span class="system-value">{row.value}</span>
            </button>
          {/each}
        </div>
      </section>

      <section class="info-column" aria-label="General info">
        <div class="column-header">
          <h4>General</h4>
          <button
            type="button"
            class="copy-column-button"
            title="Copy general column as YAML"
            aria-label="Copy general info as YAML"
            onclick={() => copyColumnAsYaml(generalRows, "General info")}
          >
            <i class="fa fa-copy" aria-hidden="true"></i>
          </button>
        </div>

        <div class="system-grid">
          {#each generalRows as row (row.key)}
            <button
              type="button"
              class="system-row"
              class:dragging={draggedYamlKey === row.yamlKey}
              draggable={true}
              onclick={() => copyRowValue(row)}
              title="Click to copy"
              aria-label={`Copy ${row.label}`}
              ondragstart={(e) => handleDragStart("general", row.yamlKey, e)}
              ondragover={handleDragOver}
              ondrop={(e) => handleDrop("general", row.yamlKey, e)}
              ondragend={handleDragEnd}
            >
              <span class="system-label">{row.label}</span>
              <span class="system-value">{row.value}</span>
            </button>
          {/each}
        </div>
      </section>
    </div>
  {/if}

  {#if toastMessage}
    <div class="system-toast" role="status" aria-live="polite">
      {toastMessage}
    </div>
  {/if}
</section>

<style>
  .system-info-card {
    position: relative;
    width: 100%;
    border: 1px solid var(--dark-400, rgba(0, 0, 0, 0.2));
    border-radius: var(--border-radius, 0.5rem);
    background: var(--container, rgba(0, 0, 0, 0.2));
    padding: 0.85rem 0.95rem;
    box-sizing: border-box;
  }

  .system-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.65rem;
  }

  .system-title-wrap {
    display: flex;
    align-items: center;
    gap: 0.45rem;
  }

  .system-header h3 {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 600;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .copy-all-button,
  .collapse-button {
    border: 1px solid rgba(255, 255, 255, 0.14);
    background: rgba(0, 0, 0, 0.18);
    color: inherit;
    border-radius: 0.45rem;
    width: 1.9rem;
    height: 1.9rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .copy-all-button:hover,
  .collapse-button:hover {
    background: rgba(255, 255, 255, 0.12);
  }

  .collapsed-strip {
    display: flex;
    gap: 0.5rem;
    width: 100%;
    overflow: hidden;
  }

  .collapsed-item {
    min-width: 0;
    max-width: 100%;
    flex: 1;
    border: 1px solid transparent;
    border-radius: 0.45rem;
    background: rgba(255, 255, 255, 0.03);
    color: inherit;
    text-align: left;
    display: flex;
    flex-direction: column;
    gap: 0.12rem;
    padding: 0.35rem 0.45rem;
    cursor: pointer;
    overflow: hidden;
  }

  .info-columns {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.8rem;
  }

  .info-column {
    min-width: 0;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 0.5rem;
    padding: 0.55rem;
    background: rgba(0, 0, 0, 0.1);
  }

  .column-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.45rem;
  }

  .column-header h4 {
    margin: 0;
    font-size: 0.85rem;
    font-weight: 600;
    opacity: 0.9;
  }

  .copy-column-button {
    border: 1px solid rgba(255, 255, 255, 0.14);
    background: rgba(0, 0, 0, 0.18);
    color: inherit;
    border-radius: 0.4rem;
    width: 1.65rem;
    height: 1.65rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .copy-column-button:hover {
    background: rgba(255, 255, 255, 0.12);
  }

  .system-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.45rem;
  }

  .system-row {
    min-width: 0;
    border: 1px solid transparent;
    border-radius: 0.45rem;
    background: rgba(255, 255, 255, 0.03);
    color: inherit;
    text-align: left;
    display: flex;
    flex-direction: column;
    gap: 0.12rem;
    padding: 0.4rem 0.5rem;
    cursor: pointer;
    transition:
      background 0.12s ease,
      border-color 0.12s ease;
  }

  .system-row:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.16);
  }

  .system-row.dragging {
    opacity: 0.55;
    transform: scale(0.98);
  }

  .system-label {
    font-size: 0.74rem;
    opacity: 0.75;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .system-value {
    font-size: 0.88rem;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .system-toast {
    position: absolute;
    right: 0.8rem;
    bottom: 0.8rem;
    background: rgba(12, 16, 22, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.14);
    color: #dbe7ff;
    font-size: 0.78rem;
    border-radius: 0.45rem;
    padding: 0.28rem 0.5rem;
    pointer-events: none;
  }

  @media (max-width: 700px) {
    .info-columns {
      grid-template-columns: 1fr;
    }

    .collapsed-strip {
      flex-direction: column;
    }
  }
</style>
