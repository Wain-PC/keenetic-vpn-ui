const deviceList = document.getElementById("device-list");
const refreshBtn = document.getElementById("refresh-btn");
const filterInput = document.getElementById("filter-input");
const onlineOnly = document.getElementById("online-only");
const toastContainer = document.getElementById("toast-container");

const STORAGE_KEY = "keenetic-vpn-filters";
const pendingToggles = new Set();
let allDevices = [];
let fetchGeneration = 0;

function loadFilters() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) {
      onlineOnly.checked = true; // default for first visit
      return;
    }
    if (typeof saved.query === "string") filterInput.value = saved.query;
    onlineOnly.checked = saved.onlineOnly !== false; // default true
  } catch {
    onlineOnly.checked = true;
  }
}

function saveFilters() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    query: filterInput.value,
    onlineOnly: onlineOnly.checked,
  }));
}

loadFilters();

async function fetchDevices() {
  const gen = ++fetchGeneration;
  try {
    const res = await fetch("/api/devices");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (gen !== fetchGeneration) return; // stale response
    allDevices = await res.json();
    renderFilteredDevices();
  } catch (err) {
    if (gen !== fetchGeneration) return;
    deviceList.innerHTML = `<div class="error">Failed to load devices: ${escapeHtml(err.message)}</div>`;
  }
}

function renderFilteredDevices() {
  const query = filterInput.value.trim().toLowerCase();
  let filtered = allDevices;

  if (onlineOnly.checked) {
    filtered = filtered.filter((d) => d.active);
  }

  if (query) {
    filtered = filtered.filter((d) => matchesFilter(d, query));
  }

  renderDevices(filtered);
}

function matchesFilter(device, query) {
  return (
    (device.name && device.name.toLowerCase().includes(query)) ||
    (device.hostname && device.hostname.toLowerCase().includes(query)) ||
    (device.mac && device.mac.toLowerCase().includes(query)) ||
    (device.ip && device.ip.includes(query))
  );
}

function renderDevices(devices) {
  if (allDevices.length === 0) {
    deviceList.innerHTML = '<div class="loading">No devices found</div>';
    return;
  }

  if (devices.length === 0) {
    deviceList.innerHTML = '<div class="no-results">No devices match the filter</div>';
    return;
  }

  deviceList.innerHTML = devices
    .map(
      (d) => `
    <div class="device-card ${d.active ? "" : "inactive"}">
      <div class="device-info">
        <div class="device-name">
          <span class="status-dot ${d.active ? "online" : "offline"}"></span>
          ${escapeHtml(d.name || d.hostname || "Unknown device")}
        </div>
        <div class="device-meta">
          <span class="device-mac">${escapeHtml(d.mac)}</span>
          ${d.ip ? `<span>${escapeHtml(d.ip)}</span>` : ""}
        </div>
      </div>
      <div class="toggle-wrapper">
        <label class="toggle">
          <input
            type="checkbox"
            data-mac="${escapeHtml(d.mac)}"
            ${d.vpnEnabled ? "checked" : ""}
            ${pendingToggles.has(d.mac) ? "disabled" : ""}
          >
          <span class="toggle-slider"></span>
        </label>
        <span class="toggle-label">VPN</span>
      </div>
    </div>
  `
    )
    .join("");
}

// Event delegation for VPN toggle checkboxes
deviceList.addEventListener("change", (e) => {
  const checkbox = e.target;
  if (checkbox.tagName !== "INPUT" || !checkbox.dataset.mac) return;
  toggleVpn(checkbox.dataset.mac, checkbox.checked, checkbox);
});

async function toggleVpn(mac, enabled, checkbox) {
  if (pendingToggles.has(mac)) return;
  pendingToggles.add(mac);
  checkbox.disabled = true;

  try {
    const res = await fetch(`/api/devices/${encodeURIComponent(mac)}/vpn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const result = await res.json();

    if (result.verified) {
      showToast(
        `VPN ${enabled ? "enabled" : "disabled"} for ${mac}`,
        "success"
      );
    } else {
      showToast(`VPN changed but verification failed for ${mac}`, "error");
    }
  } catch (err) {
    showToast(`Failed to toggle VPN for ${mac}: ${err.message}`, "error");
    checkbox.checked = !enabled;
  } finally {
    pendingToggles.delete(mac);
    checkbox.disabled = false;
  }
}

function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// Filters (persist to localStorage on every change)
filterInput.addEventListener("input", () => { saveFilters(); renderFilteredDevices(); });
onlineOnly.addEventListener("change", () => { saveFilters(); renderFilteredDevices(); });

// Refresh button
refreshBtn.addEventListener("click", () => {
  refreshBtn.classList.add("spinning");
  fetchDevices().finally(() => {
    setTimeout(() => refreshBtn.classList.remove("spinning"), 600);
  });
});

// Initial load
fetchDevices();

// Auto-refresh every 30 seconds
setInterval(fetchDevices, 30000);
