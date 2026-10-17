const { JSDOM, VirtualConsole } = require("jsdom"),
  fs = require("fs"),
  assert = require("node:assert/strict");
const root =
  require("node:path").resolve(__dirname, "../../hosted/web") +
  require("node:path").sep;
function create(draft = null) {
  const dom = new JSDOM(fs.readFileSync(root + "index.html", "utf8"), {
    url: "https://app.test/app",
    runScripts: "outside-only",
    virtualConsole: new VirtualConsole(),
  });
  const w = dom.window;
  let now = Date.now(),
    callback,
    error,
    cleared = [];
  w.Date.now = () => now;
  w.scrollTo = () => {};
  w.confirm = () => true;
  Object.defineProperty(w, "isSecureContext", { value: true });
  Object.defineProperty(w.navigator, "geolocation", {
    value: {
      watchPosition(success, failure) {
        callback = success;
        error = failure;
        return 17;
      },
      clearWatch(id) {
        cleared.push(id);
      },
      getCurrentPosition() {},
    },
  });
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
  w.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  w.HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  w.localStorage.setItem(
    "longevity-simulator-v1",
    JSON.stringify({
      profile: { name: "Alex", age: 30, height: 170, weight: 70, sex: "male" },
      habits: { exercise: 150, sleep: 8, plants: 5 },
      records: [],
      route: [],
      onboardingComplete: false,
      runDraft: draft,
    }),
  );
  w.eval(
    [
      "run-math.js",
      "runner.js",
      "journal.js",
      "account.js",
      "features.js",
      "home.js",
      "setup.js",
      "app.js",
    ]
      .map((n) => fs.readFileSync(root + n, "utf8"))
      .join("\n") +
      "\nensureRunnerMap=async()=>{};window.testState=state;Object.assign(window,{acceptRunPosition,finishRun,pauseRun,showRunReview,tickRunWatch,locateRunPreview});",
  );
  return {
    dom,
    w,
    advance(s) {
      now += s * 1000;
    },
    point(lat, accuracy = 5, alt = 100) {
      return callback({
        timestamp: now,
        coords: {
          latitude: lat,
          longitude: 0,
          accuracy,
          altitude: alt,
          altitudeAccuracy: 5,
        },
      });
    },
    error(e) {
      error(e);
    },
    cleared,
  };
}
(async () => {
  const waiting = create(),
    w = waiting.w,
    $ = (s) => w.document.querySelector(s);
  $("#run-start").click();
  assert.equal($("#run-start").textContent, "Getting GPS…");
  assert.equal($("#run-time-label").textContent, "GPS WAIT TIME");
  waiting.advance(12);
  w.tickRunWatch();
  assert.equal(
    $("#run-time").textContent,
    "00:12",
    "Wait clock visibly ticks before GPS",
  );
  waiting.point(0, 200);
  assert($("#run-feedback").textContent.includes("±200 m"));
  waiting.advance(34);
  w.tickRunWatch();
  assert.equal($("#run-status").textContent, "GPS unavailable — not recording");
  assert(!$("#gps-help").hidden);
  assert($("#gps-help-text").textContent.includes("45 seconds"));
  assert($("#gps-help-text").textContent.includes("200 m"));
  assert.equal($("#run-start").textContent, "Retry GPS");
  $("#gps-retry").click();
  assert.equal($("#run-time").textContent, "00:00");
  waiting.point(0, 5);
  assert.equal($("#run-time-label").textContent, "ACTIVE TIME");
  waiting.advance(5);
  w.tickRunWatch();
  assert.equal(
    $("#run-time").textContent,
    "00:05",
    "Stationary timer advances after usable fix",
  );
  assert.equal(
    $("#run-distance").textContent,
    "0.00",
    "No motion does not fabricate distance",
  );
  waiting.w.pauseRun();
  const unavailable = create();
  let requests = [];
  unavailable.w.navigator.geolocation.getCurrentPosition = (
    success,
    error,
    opts,
  ) => {
    requests.push(opts.enableHighAccuracy);
    error({ code: 2, message: "" });
  };
  await unavailable.w.locateRunPreview();
  assert.equal(
    requests.join(","),
    "true,false",
    "Precise attempt falls back once for map-only location",
  );
  assert(!unavailable.w.document.querySelector("#gps-help").hidden);
  assert(
    unavailable.w.document
      .querySelector("#run-feedback")
      .textContent.includes("could not determine"),
  );
  assert(!unavailable.w.document.querySelector("#run-locate").disabled);
  const coarse = create();
  requests = [];
  coarse.w.navigator.geolocation.getCurrentPosition = (
    success,
    error,
    opts,
  ) => {
    requests.push(opts.enableHighAccuracy);
    if (opts.enableHighAccuracy) error({ code: 3, message: "" });
    else
      success({
        timestamp: Date.now(),
        coords: { latitude: 40, longitude: -80, accuracy: 1200 },
      });
  };
  await coarse.w.locateRunPreview();
  assert(
    coarse.w.document
      .querySelector("#run-feedback")
      .textContent.includes("Approximate"),
  );
  assert(
    coarse.w.document
      .querySelector("#run-feedback")
      .textContent.includes("1200"),
  );
  assert.equal(
    coarse.w.testState.route.length,
    0,
    "Map preview never adds route points",
  );
  assert.equal(
    coarse.w.document.querySelector("#run-status").textContent,
    "Ready when you are",
  );
  assert.equal(
    coarse.w.document.querySelector("#run-time").textContent,
    "00:00",
  );
  const denied = create();
  requests = [];
  denied.w.navigator.geolocation.getCurrentPosition = (
    success,
    error,
    opts,
  ) => {
    requests.push(opts.enableHighAccuracy);
    error({ code: 1, message: "" });
  };
  await denied.w.locateRunPreview();
  assert.equal(
    requests.length,
    1,
    "Blocked permission is not retried automatically",
  );
  assert(
    denied.w.document
      .querySelector("#gps-help-text")
      .textContent.includes("permission is blocked"),
  );
  const cancel = create();
  cancel.w.document.querySelector("#run-start").click();
  cancel.w.document.querySelector("#run-pause").click();
  assert.equal(cancel.w.testState.runDraft, null);
  assert.equal(
    cancel.w.document.querySelector("#run-status").textContent,
    "Ready when you are",
  );
  await new Promise((r) => setImmediate(r));
  for (const d of [waiting, unavailable, coarse, denied, cancel])
    d.dom.window.close();
  console.log(
    "PASS: ticking GPS wait clock, acquisition timeout/retry, stationary active timer, explicit empty-message errors, map-only coarse fallback, denial, and cancel.",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
