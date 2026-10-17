const { JSDOM } = require("jsdom");
const fs = require("fs");
const assert = require("node:assert/strict");
const root =
  require("node:path").resolve(__dirname, "../../static") +
  require("node:path").sep;
const fixture = [
  {
    date: "2024-02-01",
    bed: "23:00",
    wake: "06:00",
    sleepHours: 7,
    exerciseType: "Walking",
    duration: "",
    breakfast: "Oats",
  },
  {
    date: "2024-02-02",
    bed: "22:00",
    wake: "06:00",
    sleepHours: 8,
    exerciseType: "Walking",
    duration: "0",
    breakfastCalories: "0",
    heart: "65",
  },
  {
    date: "2024-02-04",
    bed: "00:00",
    wake: "06:00",
    sleepHours: 6,
    exerciseType: "Running",
    duration: "20",
    heart: "70",
    breakfast: "<img onerror=alert(1)>",
  },
];
const dom = new JSDOM(fs.readFileSync(root + "index.html", "utf8"), {
  url: "http://localhost:8000",
  runScripts: "outside-only",
});
const w = dom.window;
w.scrollTo = () => {};
w.confirm = () => true;
w.fetch = async () => ({
  ok: true,
  json: async () => ({
    score: 80,
    bmi: 24.7,
    bmr: [1600, 1700],
    years: [0, 5, 10, 15, 20, 25, 30],
    baseline: [65, 65, 65, 65, 65, 65, 65],
    scenario: [65, 70, 75, 78, 80, 81, 82],
    tips: ["Test insight"],
  }),
});
w.localStorage.setItem(
  "longevity-simulator-v1",
  JSON.stringify({
    profile: { name: "Alex", age: 30, height: 170, weight: 70, sex: "male" },
    habits: { exercise: 150, sleep: 8, plants: 5 },
    records: fixture,
    route: [],
    onboardingComplete: false,
  }),
);
w.eval(
  [
    "run-math.js",
    "runner.js",
    "journal.js",
    "features.js",
    "home.js",
    "setup.js",
    "app.js",
  ]
    .map((n) => fs.readFileSync(root + n, "utf8"))
    .join("\n") +
    "\nObject.assign(window,{selectJournalDay,journalValue,renderJournal,openJournalEditor});window.testState=state;",
);
const $ = (s) => w.document.querySelector(s);
const change = (selector) =>
  $(selector).dispatchEvent(new w.Event("change", { bubbles: true }));
w.selectJournalDay("2024-02-04");
assert.equal(
  w.document.querySelectorAll("#journal-calendar button").length,
  29,
  "Leap-year calendar",
);
assert.equal(
  w.document.querySelectorAll("#journal-calendar .has-data").length,
  3,
);
assert.equal(
  w.document.querySelectorAll("#trend-chart g[role=button]").length,
  3,
);
assert.equal(
  w.document.querySelectorAll("#trend-chart polyline").length,
  1,
  "Only Feb 1–2 join; Feb 3 gap stays blank",
);
assert.equal(
  $("#journal-day-content img"),
  null,
  "Meal text cannot inject HTML",
);
assert($("#journal-day-content").textContent.includes("<img onerror"));
assert.equal(w.journalValue(fixture[0], "calories"), null);
assert.equal(
  w.journalValue(fixture[1], "calories"),
  0,
  "A recorded zero is not missing",
);
assert.equal(w.journalValue(fixture[0], "duration"), null);
$("#calendar-kind").value = "heart";
change("#calendar-kind");
assert.equal(
  w.document.querySelectorAll("#journal-calendar .has-data").length,
  2,
);
$("#trend-metric").value = "duration";
change("#trend-metric");
assert.equal(
  w.document.querySelectorAll("#trend-chart g[role=button]").length,
  2,
);
assert($("#journal-trend-headline").textContent.includes("10 min"));
$("#journal-bars").click();
assert.equal(w.document.querySelectorAll("#trend-chart rect").length, 2);
const point = $('#trend-chart g[data-date="2024-02-02"]');
point.dispatchEvent(
  new w.KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
);
assert($("#journal-day-title").textContent.includes("2"));
assert($("#journal-day-content").textContent.includes("0 min"));
$("#journal-edit-day").click();
assert($("#journal-editor").open);
assert.equal($("#journal-form [name=date]").value, "2024-02-02");
assert.equal($("#journal-form [name=duration]").value, "0");
$("#journal-form [name=duration]").value = "25";
$("#journal-form [name=duration]").dispatchEvent(
  new w.Event("input", { bubbles: true }),
);
$("#journal-form").dispatchEvent(
  new w.Event("submit", { cancelable: true, bubbles: true }),
);
assert(!$("#journal-editor").open);
assert.equal(
  w.testState.records.find((r) => r.date === "2024-02-02").duration,
  "25",
);
assert($("#journal-day-content").textContent.includes("25 min"));
assert(
  JSON.parse(w.localStorage.getItem("longevity-simulator-v1")).records.some(
    (r) => r.duration === "25",
  ),
);
const count = w.testState.records.length;
w.confirm = () => false;
$(".journal-remove").click();
assert.equal(w.testState.records.length, count);
w.confirm = () => true;
$(".journal-remove").click();
assert.equal(w.testState.records.length, count - 1);
assert($("#journal-day-content").textContent.includes("blank day"));
$("#calendar-prev").click();
assert($("#journal-month-title").textContent.includes("January"));
assert.equal(
  w.document.querySelectorAll("#journal-calendar button").length,
  31,
);
$("#journal-range").value = "7";
change("#journal-range");
assert.equal(
  w.document.querySelectorAll("#trend-chart g[role=button]").length,
  0,
);
assert($("#journal-trend-headline").textContent.includes("No exercise"));
w.selectJournalDay("2024-02-01");
$("#journal-range").value = "month";
change("#journal-range");
w.openJournalEditor("2024-02-01");
$("#journal-form [name=notes]").value = "Unsaved";
$("#journal-form [name=notes]").dispatchEvent(
  new w.Event("input", { bubbles: true }),
);
w.openJournalEditor("2024-02-01");
assert.equal($("#journal-form [name=notes]").value, "Unsaved");
w.confirm = () => false;
w.openJournalEditor("2024-02-04");
assert.equal(
  $("#journal-form [name=date]").value,
  "2024-02-01",
  "Cancel preserves unsaved edits",
);
dom.window.close();
console.log(
  "PASS: leap-month bubbles, metric filters, missing-value gaps, zero values, bar/keyboard navigation, edit/save refresh, deletion, range empty states, and unsaved edits.",
);
