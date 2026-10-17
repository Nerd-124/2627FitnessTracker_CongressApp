const { JSDOM } = require("jsdom");
const fs = require("fs");
const assert = require("node:assert/strict");
const root =
  require("node:path").resolve(__dirname, "../../static") +
  require("node:path").sep;
const html = fs.readFileSync(root + "index.html", "utf8");
function create(saved, fail = false) {
  const dom = new JSDOM(html, {
    url: "http://localhost:8000",
    runScripts: "outside-only",
  });
  const w = dom.window;
  w.scrollTo = () => {};
  w.confirm = () => true;
  let calls = 0;
  w.fetch = async () => {
    calls++;
    if (fail) throw Error("Test service unavailable");
    return {
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
    };
  };
  if (saved) w.localStorage.setItem("longevity-simulator-v1", saved);
  w.eval(
    fs.readFileSync(root + "run-math.js", "utf8") +
      "\n" +
      fs.readFileSync(root + "runner.js", "utf8") +
      "\n" +
      fs.readFileSync(root + "journal.js", "utf8") +
      "\n" +
      fs.readFileSync(root + "features.js", "utf8") +
      "\n" +
      fs.readFileSync(root + "home.js", "utf8") +
      "\n" +
      fs.readFileSync(root + "setup.js", "utf8") +
      "\n" +
      fs.readFileSync(root + "app.js", "utf8") +
      "\nObject.assign(window,{setupEstimates,openSetup,refreshHome,refreshScenario,openAppPage,localDate,parseEEG,routeSegments,renderEEGOptions,renderSessions,renderRoute});window.testState=state;",
  );
  return {
    dom,
    w,
    get calls() {
      return calls;
    },
  };
}
const tick = () => new Promise((r) => setImmediate(r));
function fill(w, name, value) {
  w.document.querySelector(`#setup-form [name="${name}"]`).value = value;
}
function submit(w) {
  w.document
    .querySelector("#setup-form")
    .dispatchEvent(new w.Event("submit", { cancelable: true, bubbles: true }));
}
async function main() {
  const fresh = create();
  const w = fresh.w;
  assert(w.document.body.classList.contains("setting-up"));
  assert.equal(fresh.calls, 0, "No calculation on demo defaults before setup");
  submit(w);
  assert.equal(w.setupStep, undefined);
  assert(
    !w.document.querySelector('[data-step="0"]').hidden,
    "Empty required fields block progress",
  );
  for (const [k, v] of Object.entries({
    name: "Alex <img>",
    age: 32,
    height: 180,
    weight: 80,
    sex: "male",
  }))
    fill(w, k, v);
  w.setupEstimates();
  assert.equal(w.document.querySelector("#setup-bmi").textContent, "24.7");
  submit(w);
  assert(!w.document.querySelector('[data-step="1"]').hidden);
  for (const [k, v] of Object.entries({
    bed: "23:00",
    wake: "23:00",
    exercise: 120,
    plants: 4,
  }))
    fill(w, k, v);
  submit(w);
  assert(
    !w.document.querySelector("#setup-error").hidden,
    "Invalid sleep schedule blocked",
  );
  fill(w, "wake", "07:00");
  fill(w, "breakfast", "Oatmeal");
  fill(w, "breakfastCalories", 350);
  submit(w);
  assert(!w.document.querySelector('[data-step="2"]').hidden);
  fill(w, "systolic", 100);
  fill(w, "diastolic", 120);
  submit(w);
  assert(!w.document.querySelector("#setup-error").hidden);
  fill(w, "diastolic", 70);
  fill(w, "heart", 65);
  submit(w);
  await tick();
  await tick();
  assert(
    !w.document.body.classList.contains("setting-up"),
    "Successful setup opens dashboard",
  );
  assert(
    w.document.querySelector("#home-title").textContent.includes("Alex <img>"),
  );
  assert.equal(
    w.document.querySelector("#home-title img"),
    null,
    "Name rendered as text",
  );
  const saved = w.localStorage.getItem("longevity-simulator-v1");
  const data = JSON.parse(saved);
  assert.equal(data.onboardingComplete, true);
  assert.equal(data.habits.sleep, 8);
  assert.equal(data.records.length, 1);
  assert.equal(data.records[0].breakfast, "Oatmeal");
  assert.equal(
    w.document.querySelector("#snapshot-heart").textContent,
    "65 bpm",
  );
  w.openSetup(true);
  assert.equal(
    w.document.querySelector('#setup-form [name="name"]').value,
    "Alex <img>",
  );
  fill(w, "name", "Casey");
  w.document.querySelector("#cancel-setup").click();
  assert(
    w.document.querySelector("#home-title").textContent.includes("Alex <img>"),
    "Cancel does not mutate profile",
  );
  w.openSetup(true);
  fill(w, "name", "Casey");
  submit(w);
  submit(w);
  submit(w);
  await tick();
  await tick();
  assert(w.document.querySelector("#home-title").textContent.includes("Casey"));
  assert.equal(
    JSON.parse(w.localStorage.getItem("longevity-simulator-v1")).records.length,
    1,
    "Editing does not duplicate journal entries",
  );
  w.document.querySelector("#exercise").value = 500;
  w.document.querySelector("#exercise").dispatchEvent(new w.Event("input"));
  w.document.querySelector("#reset").click();
  assert.equal(
    w.document.querySelector("#exercise").value,
    "120",
    "Reset restores saved starting habits",
  );
  // File and route feature integration.
  assert.equal(w.parseEEG("time_s,amplitude_uv\n0,-2\n1,3").raw, true);
  assert.equal(
    w.parseEEG("time_s,delta,theta,alpha,beta,gamma\n0,1,2,3,4,5\n1,2,3,4,5,6")
      .channels.length,
    5,
  );
  assert.throws(() => w.parseEEG("time_s,amplitude_uv\n1,2\n1,3"));
  assert.throws(() => w.parseEEG("time_s,amplitude_uv\n0,\n1,3"));
  const eeg = w.parseEEG("time_s,amplitude_uv\n0,-2\n1,3");
  w.testState.eegRecordings.push({
    id: "test-eeg",
    date: "2026-10-17",
    filename: "<test>.csv",
    ...eeg,
  });
  w.renderEEGOptions("test-eeg");
  assert(w.document.querySelector("#eeg-chart polyline"));
  assert(
    w.document
      .querySelector("#eeg-recording")
      .textContent.includes("<test>.csv"),
  );
  w.document.querySelector("#delete-eeg").click();
  assert.equal(w.testState.eegRecordings.length, 0);
  w.testState.route = [
    { lat: 40, lon: -80, ele: 100 },
    { lat: 40.001, lon: -80, ele: 110 },
    { lat: 40.002, lon: -80, ele: 100, breakBefore: true },
  ];
  assert.equal(
    w.routeSegments(w.testState.route).length,
    1,
    "Route breaks are not counted as travel",
  );
  w.renderRoute();
  assert(w.document.querySelector("#elevation-chart polyline"));
  assert(w.document.querySelector("#use-route").checked);
  w.document
    .querySelector("#activity-form")
    .dispatchEvent(new w.Event("submit", { cancelable: true }));
  await tick();
  assert(!w.document.querySelector("#save-activity").hidden);
  w.document.querySelector("#save-activity").click();
  assert.equal(w.testState.activities.length, 1);
  assert.equal(w.testState.activities[0].usedRoute, true);
  assert.equal(w.testState.activities[0].route.length, 3);
  assert(w.document.querySelector("#activity-history .record"));
  w.document.querySelector("#activity-history [data-remove]").click();
  assert.equal(w.testState.activities.length, 0);
  w.openAppPage("home");
  // Real action loop: selection, completion, undo, switching, and persistence.
  assert(w.document.querySelector("#home").classList.contains("active"));
  assert(w.document.querySelector("#complete-goal").disabled);
  w.document.querySelector('[data-goal="move"]').click();
  assert(!w.document.querySelector("#complete-goal").disabled);
  w.document.querySelector("#complete-goal").click();
  assert(w.testState.dailyGoals[w.localDate()].completed);
  assert(
    w.document.querySelector("#week-count").textContent.startsWith("1 day"),
  );
  const goalSaved = w.localStorage.getItem("longevity-simulator-v1");
  w.document.querySelector("#complete-goal").click();
  assert(!w.testState.dailyGoals[w.localDate()].completed);
  assert(
    w.document.querySelector("#week-count").textContent.startsWith("0 days"),
  );
  w.document.querySelector('[data-goal="rest"]').click();
  assert.equal(w.testState.dailyGoals[w.localDate()].type, "rest");
  w.document.querySelector('[data-destination="journal"]').click();
  assert(w.document.querySelector("#journal").classList.contains("active"));
  w.document.querySelector('[data-destination="simulator"]').click();
  assert(w.document.querySelector("#simulator").classList.contains("active"));
  w.document.querySelector("#sleep").value = 9;
  w.document.querySelector("#sleep").dispatchEvent(new w.Event("input"));
  assert(
    w.document
      .querySelector("#scenario-differences")
      .textContent.includes("1 hours / night more"),
  );
  w.document.querySelector("#scenario-to-plan").click();
  assert(w.document.querySelector("#home").classList.contains("active"));
  assert(
    w.document.querySelector(".avatar-footer").hidden,
    "Future-age controls are hidden",
  );
  assert(
    !w.document.querySelector(".model-details").open,
    "Model numbers are collapsed",
  );
  const goalReturn = create(goalSaved);
  assert.equal(
    goalReturn.w.document.querySelectorAll(".checked-day").length,
    1,
    "Check-in survives reload",
  );
  await tick();
  await tick();
  goalReturn.dom.window.close();
  const returning = create(saved);
  assert(
    !returning.w.document.body.classList.contains("setting-up"),
    "Returning user bypasses setup",
  );
  await tick();
  await tick();
  const legacy = create(
    JSON.stringify({
      profile: { age: 28, height: 172, weight: 70, sex: "unspecified" },
      habits: { exercise: 150, sleep: 8, plants: 5 },
      records: [],
      route: [],
    }),
  );
  assert(
    legacy.w.document.body.classList.contains("setting-up"),
    "Legacy demo data requires onboarding",
  );
  const failure = create(null, true);
  const fw = failure.w;
  for (const [k, v] of Object.entries({
    name: "Sam",
    age: 30,
    height: 170,
    weight: 65,
  }))
    fill(fw, k, v);
  submit(fw);
  for (const [k, v] of Object.entries({
    bed: "22:00",
    wake: "06:00",
    exercise: 150,
    plants: 5,
  }))
    fill(fw, k, v);
  submit(fw);
  submit(fw);
  await tick();
  assert(fw.document.body.classList.contains("setting-up"));
  assert(!fw.document.querySelector("#setup-error").hidden);
  assert.equal(
    fw.document.querySelector('#setup-form [name="name"]').value,
    "Sam",
  );
  assert(
    !fw.document.querySelector("#setup-next").disabled,
    "Failed launch is retryable",
  );
  await tick();
  await tick();
  for (const c of [fresh, returning, legacy, failure]) c.dom.window.close();
  console.log(
    "PASS: EEG parsing/visualization, segment breaks, saved exercise sessions, onboarding validation, personalization, journal initialization, edit/cancel, saved-habit reset, returning user, demo migration, and failure recovery.",
  );
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
