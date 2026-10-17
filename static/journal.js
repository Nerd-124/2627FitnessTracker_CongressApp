"use strict";
let journalMonth = null,
  journalSelected = null,
  journalChartMode = "line";
const journalMetrics = {
  sleepHours: { label: "Sleep", unit: "hours", short: "h" },
  duration: { label: "Exercise", unit: "minutes", short: "min" },
  calories: { label: "Recorded meal calories", unit: "kcal", short: "kcal" },
  heart: { label: "Heart rate", unit: "bpm", short: "bpm" },
  systolic: { label: "Systolic pressure", unit: "mmHg", short: "mmHg" },
  diastolic: { label: "Diastolic pressure", unit: "mmHg", short: "mmHg" },
  glucose: { label: "Glucose", unit: "mg/dL", short: "mg/dL" },
};
function journalDayDate(date) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}
function journalDateLabel(date) {
  return journalDayDate(date).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
function journalValue(record, key) {
  if (!record) return null;
  if (key === "calories") {
    const values = ["breakfastCalories", "lunchCalories", "dinnerCalories"]
      .map((k) => record[k])
      .filter((v) => v !== "" && v != null && Number.isFinite(Number(v)));
    return values.length ? values.reduce((n, v) => n + Number(v), 0) : null;
  }
  const value = record[key];
  return value !== "" && value != null && Number.isFinite(Number(value))
    ? Number(value)
    : null;
}
function journalBounds() {
  const range = $("#journal-range").value;
  if (range === "month")
    return {
      start: localDate(
        new Date(journalMonth.getFullYear(), journalMonth.getMonth(), 1, 12),
      ),
      end: localDate(
        new Date(
          journalMonth.getFullYear(),
          journalMonth.getMonth() + 1,
          0,
          12,
        ),
      ),
      label: journalMonth.toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      }),
    };
  const end = new Date();
  const start = new Date(
    end.getFullYear(),
    end.getMonth(),
    end.getDate() - Number(range) + 1,
    12,
  );
  return {
    start: localDate(start),
    end: localDate(end),
    label: `Last ${range} days`,
  };
}
function journalRangeRecords() {
  const { start, end } = journalBounds();
  return [...state.records]
    .filter((r) => r.date >= start && r.date <= end)
    .sort((a, b) => a.date.localeCompare(b.date));
}
function formatJournalNumber(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
function renderJournalSummary() {
  const records = journalRangeRecords(),
    sleep = records
      .map((r) => journalValue(r, "sleepHours"))
      .filter((v) => v !== null),
    exercise = records
      .map((r) => journalValue(r, "duration"))
      .filter((v) => v !== null),
    mealDays = records.filter((r) =>
      ["breakfast", "lunch", "dinner"].some(
        (k) => r[k] || journalValue(r, k + "Calories") !== null,
      ),
    );
  const stats = [
    ["Days recorded", records.length, "Journal entries in this range"],
    [
      "Average sleep",
      sleep.length
        ? formatJournalNumber(sleep.reduce((a, b) => a + b, 0) / sleep.length) +
          " h"
        : "—",
      sleep.length
        ? sleep.length + " nights with sleep data"
        : "Add your first night",
    ],
    [
      "Exercise recorded",
      exercise.length
        ? formatJournalNumber(exercise.reduce((a, b) => a + b, 0)) + " min"
        : "—",
      "Journal entries only; route sessions are separate",
    ],
    ["Days with meals", mealDays.length, "At least one meal or calorie entry"],
  ];
  const box = $("#journal-summary");
  box.replaceChildren();
  for (const [label, value, note] of stats) {
    const card = document.createElement("article");
    card.innerHTML = `<span>${label}</span><strong>${value}</strong><small>${note}</small>`;
    box.append(card);
  }
}
function renderJournalCalendar() {
  const title = journalMonth.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  $("#journal-month-title").textContent = title;
  const box = $("#journal-calendar");
  box.setAttribute("aria-label", title + " journal dates");
  box.replaceChildren();
  const first = new Date(
      journalMonth.getFullYear(),
      journalMonth.getMonth(),
      1,
      12,
    ),
    days = new Date(
      journalMonth.getFullYear(),
      journalMonth.getMonth() + 1,
      0,
      12,
    ).getDate(),
    kind = $("#calendar-kind").value;
  for (let i = 0; i < first.getDay(); i++) {
    const empty = document.createElement("span");
    empty.className = "calendar-spacer";
    box.append(empty);
  }
  for (let day = 1; day <= days; day++) {
    const date = localDate(
      new Date(journalMonth.getFullYear(), journalMonth.getMonth(), day, 12),
    );
    const record = state.records.find((r) => r.date === date);
    const value =
      kind === "all" ? (record ? 1 : null) : journalValue(record, kind);
    const button = document.createElement("button");
    button.className =
      "calendar-bubble" +
      (value !== null ? " has-data" : "") +
      (date === journalSelected ? " selected" : "") +
      (date === localDate() ? " is-today" : "");
    button.dataset.date = date;
    button.textContent = day;
    button.setAttribute("aria-pressed", String(date === journalSelected));
    const description =
      kind === "all"
        ? record
          ? "entry recorded"
          : "no entry"
        : value === null
          ? "not recorded"
          : formatJournalNumber(value) + " " + journalMetrics[kind].unit;
    button.setAttribute(
      "aria-label",
      journalDateLabel(date) + ", " + description,
    );
    button.title = button.getAttribute("aria-label");
    button.onclick = () => {
      selectJournalDay(date);
      $(`#journal-calendar button[data-date="${date}"]`)?.focus();
    };
    button.onkeydown = (event) => {
      const offsets = {
        ArrowLeft: -1,
        ArrowRight: 1,
        ArrowUp: -7,
        ArrowDown: 7,
      };
      if (event.key in offsets) {
        event.preventDefault();
        const next = journalDayDate(date);
        next.setDate(next.getDate() + offsets[event.key]);
        selectJournalDay(localDate(next));
        $(`#journal-calendar button[data-date="${localDate(next)}"]`)?.focus();
      }
    };
    box.append(button);
  }
}
function selectJournalDay(date) {
  journalSelected = date;
  const selected = journalDayDate(date);
  if (
    selected.getMonth() !== journalMonth.getMonth() ||
    selected.getFullYear() !== journalMonth.getFullYear()
  )
    journalMonth = new Date(selected.getFullYear(), selected.getMonth(), 1, 12);
  renderJournal();
}
function renderJournalDay() {
  const record = state.records.find((r) => r.date === journalSelected);
  $("#journal-day-title").textContent = journalDateLabel(journalSelected);
  $("#journal-edit-day").textContent = record
    ? "Edit this day →"
    : "Record this day →";
  const box = $("#journal-day-content");
  box.replaceChildren();
  if (!record) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent =
      "A blank day is a place to begin. Record sleep, movement, meals, or a measurement to add it to your calendar.";
    box.append(p);
    return;
  }
  const grid = document.createElement("div");
  grid.className = "journal-day-grid";
  for (const key of [
    "sleepHours",
    "duration",
    "calories",
    "heart",
    "systolic",
    "diastolic",
    "glucose",
  ]) {
    const value = journalValue(record, key);
    if (value === null) continue;
    const item = document.createElement("div");
    const label = document.createElement("small");
    label.textContent = journalMetrics[key].label;
    const strong = document.createElement("strong");
    strong.textContent =
      formatJournalNumber(value) + " " + journalMetrics[key].short;
    item.append(label, strong);
    grid.append(item);
  }
  box.append(grid);
  if (record.bed && record.wake) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = `Bedtime ${record.bed} → wake-up ${record.wake} · ${record.duration !== "" && record.duration != null && record.exerciseType ? record.exerciseType : "Exercise type not recorded"}`;
    box.append(p);
  }
  for (const key of ["breakfast", "lunch", "dinner", "notes"])
    if (record[key]) {
      const p = document.createElement("p");
      p.className = "journal-day-note";
      const label = document.createElement("strong");
      label.textContent =
        key === "notes"
          ? "Notes: "
          : key[0].toUpperCase() + key.slice(1) + ": ";
      p.append(label, document.createTextNode(record[key]));
      box.append(p);
    }
  const remove = document.createElement("button");
  remove.className = "text-button journal-remove";
  remove.textContent = "Remove this journal entry";
  remove.onclick = () => {
    if (!confirm("Remove the journal entry for " + journalSelected + "?"))
      return;
    state.records = state.records.filter((r) => r.date !== journalSelected);
    save();
    renderRecords();
    toast("Journal entry removed. Your calendar and graph are updated.");
  };
  box.append(remove);
}
function renderJournalChart() {
  const key = $("#trend-metric").value,
    metric = journalMetrics[key],
    bounds = journalBounds();
  const rows = journalRangeRecords()
    .map((r) => ({ date: r.date, value: journalValue(r, key) }))
    .filter((r) => r.value !== null);
  const svg = $("#trend-chart");
  svg.replaceChildren();
  svg.setAttribute(
    "aria-label",
    `${metric.label} in ${bounds.label}. Choose a point to view its day.`,
  );
  const header = $("#journal-trend-headline");
  header.replaceChildren();
  const unit = document.createElement("small");
  unit.textContent = bounds.label + " · " + metric.unit;
  header.append(unit);
  if (!rows.length) {
    const p = document.createElement("p");
    p.textContent =
      "No " + metric.label.toLowerCase() + " values in this range yet.";
    header.append(p);
    $("#journal-graph-readout").textContent =
      "Try another measurement or time range, or record a day.";
    svg.innerHTML =
      '<text x="400" y="140" text-anchor="middle" fill="#8a9a7a" font-size="14">Your next entry can start this graph.</text>';
    return;
  }
  const mean = rows.reduce((n, r) => n + r.value, 0) / rows.length;
  const strong = document.createElement("strong");
  strong.textContent = formatJournalNumber(mean) + " " + metric.short;
  const summary = document.createElement("span");
  summary.textContent = ` average across ${rows.length} recorded ${rows.length === 1 ? "day" : "days"}`;
  header.append(strong, summary);
  if (rows.length > 1) {
    const delta = rows.at(-1).value - rows[0].value;
    const change = document.createElement("p");
    change.textContent = `First → latest: ${formatJournalNumber(rows[0].value)} → ${formatJournalNumber(rows.at(-1).value)} ${metric.short} (${delta > 0 ? "+" : ""}${formatJournalNumber(delta)}).`;
    header.append(change);
  }
  $("#journal-graph-readout").textContent =
    rows.length === 1
      ? "One recorded value. Add another day to explore a change."
      : "Hover, focus, or tap a point to see the value. Select it to review that day.";
  const NS = "http://www.w3.org/2000/svg";
  function el(tag, attrs, text) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (text != null) e.textContent = text;
    return e;
  }
  const W = 800,
    H = 280,
    left = 58,
    right = 24,
    top = 20,
    bottom = 44;
  const values = rows.map((r) => r.value),
    max = Math.max(...values),
    min = Math.min(...values);
  const zero = ["sleepHours", "duration", "calories"].includes(key),
    ymin = zero ? 0 : Math.max(0, min - Math.max(2, (max - min) * 0.2)),
    ymax = Math.max(ymin + 1, max + Math.max(zero ? 1 : 2, (max - min) * 0.2));
  const start = journalDayDate(bounds.start).getTime(),
    end = journalDayDate(bounds.end).getTime();
  const x = (date) =>
      left +
      ((journalDayDate(date).getTime() - start) / (end - start || 86400000)) *
        (W - left - right),
    y = (value) =>
      H - bottom - ((value - ymin) / (ymax - ymin)) * (H - top - bottom);
  for (let i = 0; i <= 4; i++) {
    const v = ymin + ((ymax - ymin) * i) / 4;
    svg.append(
      el("line", {
        x1: left,
        x2: W - right,
        y1: y(v),
        y2: y(v),
        stroke: "#e3e9dc",
        "stroke-dasharray": "3 4",
      }),
    );
    svg.append(
      el(
        "text",
        {
          x: left - 9,
          y: y(v) + 4,
          "text-anchor": "end",
          fill: "#86967b",
          "font-size": 11,
        },
        formatJournalNumber(v),
      ),
    );
  }
  for (let i = 0; i < 4; i++) {
    const stamp = start + ((end - start) * i) / 3;
    const date = new Date(stamp);
    svg.append(
      el(
        "text",
        {
          x: left + ((W - left - right) * i) / 3,
          y: H - 15,
          "text-anchor": "middle",
          fill: "#86967b",
          "font-size": 11,
        },
        date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      ),
    );
  }
  if (journalChartMode === "line") {
    let segment = [];
    const flush = () => {
      if (segment.length > 1)
        svg.append(
          el("polyline", {
            points: segment.map((r) => `${x(r.date)},${y(r.value)}`).join(" "),
            fill: "none",
            stroke: "#719258",
            "stroke-width": 3,
            "stroke-linejoin": "round",
          }),
        );
      segment = [];
    };
    for (const row of rows) {
      if (
        segment.length &&
        Math.round(
          (journalDayDate(row.date) - journalDayDate(segment.at(-1).date)) /
            86400000,
        ) !== 1
      )
        flush();
      segment.push(row);
    }
    flush();
  }
  for (const row of rows) {
    const group = el("g", {
      role: "button",
      tabindex: 0,
      "data-date": row.date,
      "aria-label": `${journalDateLabel(row.date)}: ${row.value} ${metric.unit}. View entry.`,
    });
    group.append(el("title", {}, `${row.date}: ${row.value} ${metric.unit}`));
    if (journalChartMode === "bars") {
      const width = Math.max(
        4,
        Math.min(
          24,
          ((W - left - right) / (Math.max(1, (end - start) / 86400000) + 1)) *
            0.65,
        ),
      );
      group.append(
        el("rect", {
          x: x(row.date) - width / 2,
          y: y(row.value),
          width,
          height: Math.max(2, H - bottom - y(row.value)),
          rx: 3,
          fill: row.date === journalSelected ? "#365f42" : "#9ab77d",
        }),
      );
    } else {
      group.append(
        el("circle", {
          cx: x(row.date),
          cy: y(row.value),
          r: row.date === journalSelected ? 7 : 5,
          fill: "#fff",
          stroke: row.date === journalSelected ? "#365f42" : "#719258",
          "stroke-width": 3,
        }),
      );
    }
    group.append(
      el("circle", {
        cx: x(row.date),
        cy: y(row.value),
        r: 13,
        fill: "transparent",
      }),
    );
    const read = () => {
      $("#journal-graph-readout").textContent =
        journalDateLabel(row.date) +
        " · " +
        metric.label +
        ": " +
        formatJournalNumber(row.value) +
        " " +
        metric.unit;
    };
    group.addEventListener("mouseenter", read);
    group.addEventListener("focus", read);
    group.addEventListener("click", () => {
      selectJournalDay(row.date);
      $(`#trend-chart g[data-date="${row.date}"]`)?.focus();
    });
    group.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectJournalDay(row.date);
      }
    });
    svg.append(group);
  }
}
function renderJournal() {
  if (!journalMonth) return;
  renderJournalSummary();
  renderJournalCalendar();
  renderJournalDay();
  renderJournalChart();
}
function openJournalEditor(date) {
  const form = $("#journal-form");
  if (form.dataset.dirty === "true") {
    if (form.elements.namedItem("date").value === date) {
      $("#journal-editor").open = true;
      $("#journal-editor").scrollIntoView?.({
        behavior: "smooth",
        block: "start",
      });
      return;
    }
    if (!confirm("Switch days and discard unsaved changes?")) return;
  }
  form.elements.namedItem("date").value = date;
  prefillJournal();
  form.dataset.dirty = "false";
  journalSelected = date;
  const d = journalDayDate(date);
  journalMonth = new Date(d.getFullYear(), d.getMonth(), 1, 12);
  renderJournal();
  $("#journal-editor-title").textContent = state.records.some(
    (r) => r.date === date,
  )
    ? "Edit your day"
    : "Record a day";
  $("#journal-editor").open = true;
  $("#journal-editor").scrollIntoView?.({ behavior: "smooth", block: "start" });
  form.elements.namedItem("bed").focus({ preventScroll: true });
}
function initializeJournal() {
  const now = new Date();
  journalMonth = new Date(now.getFullYear(), now.getMonth(), 1, 12);
  journalSelected = localDate();
  const oldRecords = renderRecords;
  renderRecords = function () {
    oldRecords();
    renderJournal();
  };
  renderTrend = renderJournalChart;
  $("#trend-metric").onchange = renderJournalChart;
  $("#journal-range").onchange = () => {
    renderJournalSummary();
    renderJournalChart();
  };
  $("#calendar-kind").onchange = renderJournalCalendar;
  $("#calendar-prev").onclick = () => {
    journalMonth = new Date(
      journalMonth.getFullYear(),
      journalMonth.getMonth() - 1,
      1,
      12,
    );
    renderJournal();
  };
  $("#calendar-next").onclick = () => {
    journalMonth = new Date(
      journalMonth.getFullYear(),
      journalMonth.getMonth() + 1,
      1,
      12,
    );
    renderJournal();
  };
  $("#calendar-today").onclick = () => selectJournalDay(localDate());
  $("#journal-new").onclick = () => openJournalEditor(localDate());
  $("#journal-edit-day").onclick = () => openJournalEditor(journalSelected);
  for (const mode of ["line", "bars"])
    $("#journal-" + mode).onclick = () => {
      journalChartMode = mode;
      for (const kind of ["line", "bars"]) {
        $("#journal-" + kind).classList.toggle("active", kind === mode);
        $("#journal-" + kind).setAttribute(
          "aria-pressed",
          String(kind === mode),
        );
      }
      renderJournalChart();
    };
  const form = $("#journal-form");
  form.addEventListener("input", () => (form.dataset.dirty = "true"));
  form.elements.namedItem("date").addEventListener("change", () => {
    journalSelected = form.elements.namedItem("date").value;
    form.dataset.dirty = "false";
    if (journalSelected) selectJournalDay(journalSelected);
  });
  const saveDay = form.onsubmit;
  form.onsubmit = (event) => {
    if (!form.reportValidity()) {
      event.preventDefault();
      return;
    }
    const values = Object.fromEntries(new FormData(form));
    const valid =
      sleepHours(values.bed, values.wake) > 0 &&
      !(
        values.systolic &&
        values.diastolic &&
        Number(values.diastolic) >= Number(values.systolic)
      );
    saveDay(event);
    if (valid) {
      form.dataset.dirty = "false";
      selectJournalDay(values.date);
      $("#journal-editor").open = false;
      $("#journal-day").scrollIntoView?.({
        behavior: "smooth",
        block: "nearest",
      });
    }
  };
  renderJournal();
}
