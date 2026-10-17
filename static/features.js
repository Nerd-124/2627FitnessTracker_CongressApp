"use strict";
let routeMap = null,
  routeLayer = null,
  mapPromise = null,
  latestActivity = null,
  gpsStarted = null,
  recordingTimer = null;
function routeSegments(points) {
  const segments = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i];
    if (b.breakBefore) continue;
    const meters = distance(a, b);
    if (meters < 0.01) continue;
    segments.push({
      distance_m: meters,
      elevation_delta_m: a.ele != null && b.ele != null ? b.ele - a.ele : null,
    });
  }
  return segments;
}
function signalPlot(svg, rows, xkey, ykey, color = "#6d905b") {
  if (!rows.length) {
    svg.innerHTML = "";
    return;
  }
  const w = 800,
    h = 220,
    pad = 45;
  const xs = rows.map((p) => Number(p[xkey])),
    ys = rows.map((p) => Number(p[ykey]));
  const minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minY = Math.min(...ys),
    maxY = Math.max(...ys);
  const x = (v) => pad + ((v - minX) / (maxX - minX || 1)) * (w - 2 * pad),
    y = (v) => h - pad - ((v - minY) / (maxY - minY || 1)) * (h - 2 * pad);
  let body = "";
  for (let i = 0; i < 4; i++) {
    const val = minY + ((maxY - minY) * i) / 3;
    body += `<line x1="${pad}" x2="${w - pad}" y1="${y(val)}" y2="${y(val)}" stroke="#e3e9dc"/><text x="${pad - 7}" y="${y(val) + 3}" text-anchor="end" fill="#85967a" font-size="10">${val.toFixed(1)}</text>`;
  }
  const stride = Math.max(1, Math.ceil(rows.length / 1000));
  const drawn = rows.filter(
    (_, i) => i % stride === 0 || i === rows.length - 1,
  );
  body += `<polyline points="${drawn.map((p) => `${x(Number(p[xkey]))},${y(Number(p[ykey]))}`).join(" ")}" fill="none" stroke="${color}" stroke-width="2"/><text x="${pad}" y="205" fill="#85967a" font-size="10">${minX.toFixed(1)}</text><text x="${w - pad}" y="205" text-anchor="end" fill="#85967a" font-size="10">${maxX.toFixed(1)}</text>`;
  svg.innerHTML = body;
}
function renderSleep() {
  const box = $("#sleep-history");
  box.replaceChildren();
  const rows = [...state.records]
    .filter((r) => r.bed && r.wake)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 14);
  if (!rows.length)
    box.innerHTML =
      '<p class="muted">No nights recorded yet. Add bedtime and wake-up time in your journal.</p>';
  for (const r of rows) {
    const el = document.createElement("div");
    el.className = "record";
    el.innerHTML = `<strong>${escapeHTML(r.date)}</strong><p>Bed ${escapeHTML(r.bed)} → wake ${escapeHTML(r.wake)} · ${escapeHTML(r.sleepHours)} hours</p>`;
    box.append(el);
  }
}
function parseEEG(text) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .trim()
    .split(/\r?\n/);
  if (lines.length < 3 || lines.length > 5001)
    throw Error("CSV needs 2–5,000 data rows.");
  const headers = lines
    .shift()
    .split(",")
    .map((x) => x.trim().toLowerCase());
  const raw = headers.includes("amplitude_uv");
  const channels = raw
    ? ["amplitude_uv"]
    : ["delta", "theta", "alpha", "beta", "gamma"];
  if (
    !headers.includes("time_s") ||
    channels.some((k) => !headers.includes(k)) ||
    new Set(headers).size !== headers.length
  )
    throw Error(
      "Use the downloaded CSV header: time_s,amplitude_uv or time_s,delta,theta,alpha,beta,gamma.",
    );
  const rows = lines.map((line, i) => {
    const values = line.split(",").map((x) => x.trim());
    if (values.length !== headers.length)
      throw Error(`Column count differs on row ${i + 2}.`);
    const row = {};
    for (const key of ["time_s", ...channels]) {
      const val = values[headers.indexOf(key)];
      if (val === "" || !Number.isFinite(Number(val)))
        throw Error(`Missing or invalid ${key} on row ${i + 2}.`);
      row[key] = Number(val);
      if ((key === "time_s" || !raw) && row[key] < 0)
        throw Error("Time and band power must be nonnegative.");
    }
    return row;
  });
  if (rows.some((r, i) => i > 0 && r.time_s <= rows[i - 1].time_s))
    throw Error("time_s must increase on every row.");
  return { rows, channels, raw };
}
function renderEEGOptions(selected) {
  const selector = $("#eeg-recording");
  selector.replaceChildren();
  for (const r of state.eegRecordings) {
    const opt = document.createElement("option");
    opt.value = r.id;
    opt.textContent = `${r.date} · ${r.filename}`;
    selector.append(opt);
  }
  if (!state.eegRecordings.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No imports yet";
    selector.append(opt);
  }
  if (selected) selector.value = selected;
  renderEEG();
}
function renderEEG() {
  const recording = state.eegRecordings.find(
    (r) => r.id === $("#eeg-recording").value,
  );
  const channel = $("#eeg-channel");
  const previous = channel.value;
  channel.replaceChildren();
  $("#delete-eeg").disabled = !recording;
  if (!recording) {
    $("#eeg-chart").innerHTML = "";
    $("#eeg-caption").textContent = "Import a recording to view your own data.";
    return;
  }
  for (const key of recording.channels) {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent =
      key === "amplitude_uv" ? "Raw EEG (µV)" : key + " band (device units)";
    channel.append(opt);
  }
  if (recording.channels.includes(previous)) channel.value = previous;
  drawEEG();
}
function drawEEG() {
  const r = state.eegRecordings.find((r) => r.id === $("#eeg-recording").value);
  if (!r) return;
  signalPlot($("#eeg-chart"), r.rows, "time_s", $("#eeg-channel").value);
  $("#eeg-caption").textContent =
    `${r.rows.length} imported samples · ${(r.rows.at(-1).time_s - r.rows[0].time_s).toFixed(1)} seconds · horizontal axis: seconds; vertical axis: ${r.raw ? "µV" : "device band-power units"}. Display may be thinned to 1,000 points. No sleep stages inferred.`;
}
function renderSessions() {
  const box = $("#activity-history");
  box.replaceChildren();
  if (!state.activities.length)
    box.innerHTML =
      '<p class="muted">Calculate an activity, then save it here.</p>';
  for (const r of [...state.activities].sort((a, b) =>
    b.date.localeCompare(a.date),
  )) {
    const el = document.createElement("div");
    el.className = "record";
    el.innerHTML = `<div class="record-head"><strong>${escapeHTML(r.date)} · ${r.mode === "run" ? "Run" : "Walk"}</strong><span><button class="text-button" data-open>Open session</button><button class="text-button" data-remove>Remove</button></span></div><p>${escapeHTML(r.minutes)} min · ${r.result.distance} km · ${r.result.speed} km/h average · ${r.result.gain} m ascent</p><p>${r.result.calories} estimated kcal · ${escapeHTML(r.temperature)}°C · ${escapeHTML(r.humidity)}% humidity</p><p>${r.usedRoute ? "Route slopes used" : "Manual distance and ascent"} · ${escapeHTML(r.weight)} kg at calculation time</p>`;
    el.querySelector("[data-open]").onclick = () => {
      if (watchId !== null) {
        toast("Stop GPS recording before opening another session.");
        return;
      }
      state.route = r.route.map((p) => ({ ...p }));
      renderRoute();
      for (const key of [
        "mode",
        "minutes",
        "distance",
        "gain",
        "temperature",
        "humidity",
        "date",
      ]) {
        const input = $("#activity-form").elements.namedItem(key);
        if (input)
          input.value =
            key === "distance"
              ? r.result.distance
              : key === "gain"
                ? r.result.gain
                : r[key];
      }
      $("#use-route").checked = r.usedRoute;
      save();
      openAppPage("activity");
      toast("Saved session loaded. Recalculate if you change its inputs.");
    };
    el.querySelector("[data-remove]").onclick = () => {
      state.activities = state.activities.filter((x) => x.id !== r.id);
      save();
      renderSessions();
    };
    box.append(el);
  }
}
async function loadStreetMap() {
  if (routeMap) {
    routeMap.invalidateSize();
    drawStreetRoute();
    return;
  }
  if (!mapPromise)
    mapPromise = (async () => {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css";
      document.head.append(css);
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src =
          "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js";
        script.onload = resolve;
        script.onerror = () =>
          reject(Error("Map library could not load. Check your connection."));
        document.head.append(script);
      });
    })();
  try {
    await mapPromise;
    $("#route-map").hidden = false;
    routeMap = L.map("route-map").setView([20, 0], 2);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(routeMap);
    drawStreetRoute();
    $("#load-map").textContent = "Refresh map view";
  } catch (err) {
    mapPromise = null;
    toast(err.message);
  }
}
function drawStreetRoute() {
  if (!routeMap) return;
  if (routeLayer) routeMap.removeLayer(routeLayer);
  const segments = [];
  let current = [];
  for (const p of state.route) {
    if (p.breakBefore && current.length) {
      segments.push(current);
      current = [];
    }
    current.push([p.lat, p.lon]);
  }
  if (current.length) segments.push(current);
  if (!segments.length) return;
  routeLayer = L.polyline(segments, { color: "#507b43", weight: 4 }).addTo(
    routeMap,
  );
  routeMap.invalidateSize();
  routeMap.fitBounds(routeLayer.getBounds(), {
    padding: [25, 25],
    maxZoom: 17,
  });
}
function showElevation() {
  let meters = 0;
  const rows = [];
  state.route.forEach((p, i) => {
    if (i && !p.breakBefore) meters += distance(state.route[i - 1], p);
    if (p.ele != null) rows.push({ km: meters / 1000, elevation: p.ele });
  });
  signalPlot($("#elevation-chart"), rows, "km", "elevation");
  $("#elevation-caption").textContent = rows.length
    ? `Elevation profile · km horizontally, meters vertically. ${rows.length} of ${state.route.length} points have altitude. GPS noise can inflate ascent; no automatic elevation correction applied.`
    : "No altitude data. Enter elevation gain manually; no terrain height is inferred from a map.";
  if (state.route.length > 1) $("#use-route").checked = true;
  drawStreetRoute();
}
function invalidateEnergy() {
  latestActivity = null;
  $("#save-activity").hidden = true;
  $("#energy").replaceChildren();
}
function initializeFeatures() {
  window.addEventListener("pagehide", () => {
    if (recordingTimer) clearInterval(recordingTimer);
    recordingTimer = null;
  });
  $("#eeg-date").value = localDate();
  $("#activity-form [name=date]").value = localDate();
  renderSleep();
  renderEEGOptions();
  renderSessions();
  const originalRender = renderRoute;
  renderRoute = function () {
    originalRender();
    showElevation();
    invalidateEnergy();
  };
  if (state.route.length) renderRoute();
  const originalRecords = renderRecords;
  renderRecords = function () {
    originalRecords();
    renderSleep();
  };
  $("#sleep-to-journal").onclick = () => {
    prefillJournal();
    openAppPage("journal");
  };
  $("#eeg-recording").onchange = renderEEG;
  $("#eeg-channel").onchange = drawEEG;
  $("#delete-eeg").onclick = () => {
    state.eegRecordings = state.eegRecordings.filter(
      (r) => r.id !== $("#eeg-recording").value,
    );
    save();
    renderEEGOptions();
  };
  $("#eeg-file").onchange = async (e) => {
    try {
      const file = e.target.files[0];
      if (!file) return;
      if (!$("#eeg-date").value)
        throw Error("Choose the recording date first.");
      if (file.size > 1_000_000) throw Error("CSV must be smaller than 1 MB.");
      if (state.eegRecordings.length >= 10)
        throw Error(
          "Remove an old recording first; this browser keeps up to 10.",
        );
      const parsed = parseEEG(await file.text());
      const record = {
        id: crypto.randomUUID(),
        date: $("#eeg-date").value,
        filename: file.name,
        ...parsed,
      };
      state.eegRecordings.push(record);
      save();
      renderEEGOptions(record.id);
      $("#eeg-status").textContent =
        "Your recording was imported. Select a signal below.";
    } catch (err) {
      $("#eeg-status").textContent = err.message;
    }
    e.target.value = "";
  };
  $("#load-map").onclick = loadStreetMap;
  $("#activity-form").addEventListener("input", invalidateEnergy);
  $("#use-route").onchange = invalidateEnergy;
  $("#activity-form").onsubmit = async (e) => {
    e.preventDefault();
    invalidateEnergy();
    try {
      const values = Object.fromEntries(new FormData(e.target));
      const usedRoute = $("#use-route").checked;
      if (usedRoute && state.route.length < 2)
        throw Error("Load a route first, or turn off route slopes.");
      const segments = usedRoute ? routeSegments(state.route) : [];
      if (usedRoute && !segments.length)
        throw Error("This route has no measurable segments.");
      const result = await api("/api/activity", {
        ...values,
        segments,
        weight: state.profile.weight,
      });
      latestActivity = {
        id: crypto.randomUUID(),
        ...values,
        weight: state.profile.weight,
        usedRoute,
        route: usedRoute ? state.route.map((p) => ({ ...p })) : [],
        result,
      };
      $("#energy").innerHTML =
        `<div class="energy-number">${result.calories} <small>estimated kcal</small></div><p>${result.flat} level-route kcal + ${result.uphill} uphill kcal</p><p class="muted">${result.distance} km · ${result.speed} km/h average · ${result.gain} m ascent · steepest uphill segment ${result.max_grade}%</p><p class="muted">${usedRoute ? result.segment_count + " route segments evaluated" : "Manual ascent approximation"}${result.unknown_elevation ? " · " + result.unknown_elevation + " segments missing altitude (ascent omitted)" : ""}</p><p>${escapeHTML(result.heat)} ${result.heat_index_c != null ? "Shade heat index: " + result.heat_index_c + "°C." : ""}</p><p class="note">${escapeHTML(result.weather_model)} ${escapeHTML(result.caution)}</p><p class="note">${escapeHTML(result.model)} Illustrative range ${result.low}–${result.high} kcal.</p>`;
      $("#save-activity").hidden = false;
    } catch (err) {
      toast(err.message);
    }
  };
  $("#save-activity").onclick = () => {
    if (!latestActivity) return;
    state.activities.push(latestActivity);
    save();
    latestActivity = null;
    $("#save-activity").hidden = true;
    renderSessions();
    toast("Exercise session saved with its route, weather, and estimate.");
  };
  $("#current-weather").onclick = async () => {
    const point = state.route.at(-1);
    if (!point) {
      toast("Record GPS or import a route to choose a weather location.");
      return;
    }
    $("#current-weather").disabled = true;
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${point.lat}&longitude=${point.lon}&current=temperature_2m,relative_humidity_2m&timezone=auto`;
      const response = await fetch(url);
      if (!response.ok)
        throw Error("Weather service unavailable. Enter conditions manually.");
      const data = await response.json();
      const current = data.current;
      if (
        !current ||
        !Number.isFinite(current.temperature_2m) ||
        !Number.isFinite(current.relative_humidity_2m)
      )
        throw Error("Weather response did not contain measurements.");
      $("#activity-form [name=temperature]").value = current.temperature_2m;
      $("#activity-form [name=humidity]").value = current.relative_humidity_2m;
      $("#weather-status").textContent =
        `Open-Meteo current conditions · ${current.time} (${data.timezone}). These may differ from conditions during an older route.`;
      invalidateEnergy();
    } catch (err) {
      toast(err.message);
    } finally {
      $("#current-weather").disabled = false;
    }
  };
  const gpsButton = $("#gps"),
    originalGPS = gpsButton.onclick;
  gpsButton.onclick = () => {
    originalGPS();
    if (watchId !== null) {
      gpsStarted = Date.now();
      recordingTimer = setInterval(() => {
        if (watchId !== null)
          $("#activity-form [name=minutes]").value = Math.max(
            1,
            (Date.now() - gpsStarted) / 60000,
          ).toFixed(1);
      }, 1000);
    }
  };
  const originalStop = stopGPS;
  stopGPS = function () {
    if (recordingTimer) {
      clearInterval(recordingTimer);
      recordingTimer = null;
    }
    originalStop();
  };
  document
    .querySelector('nav button[data-page="activity"]')
    .addEventListener("click", () => {
      if (routeMap) setTimeout(() => routeMap.invalidateSize(), 50);
    });
}
