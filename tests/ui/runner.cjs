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
  const a = create(),
    w = a.w,
    $ = (s) => w.document.querySelector(s);
  $("#run-start").click();
  assert($("#run-status").textContent.includes("Waiting"));
  a.point(0, 200);
  assert.equal(w.testState.runDraft.points.length, 0);
  a.point(0);
  assert($("#run-status").textContent.includes("Recording"));
  a.advance(20);
  a.point(0.001, 5, 110);
  assert.equal(w.testState.runDraft.points.length, 2);
  assert($("#run-distance").textContent !== "0.00");
  $("#run-pause").click();
  assert($("#run-status").textContent.includes("Paused"));
  const draft = JSON.parse(
    w.localStorage.getItem("longevity-simulator-v1"),
  ).runDraft;
  assert.equal(draft.seconds, 20);
  a.advance(10);
  $("#run-start").click();
  a.point(0.01, 5, 110);
  a.advance(20);
  a.point(0.011, 5, 120);
  $("#run-finish").click();
  assert.equal(w.testState.activities.length, 1);
  const saved = w.testState.activities[0];
  assert.equal(saved.minutes, 40 / 60, "Paused time excluded");
  assert(
    Math.abs(saved.result.distance - 0.222) < 0.002,
    "Paused location jump excluded",
  );
  assert.equal(saved.route[2].breakBefore, true);
  assert.equal(w.testState.runDraft, null);
  assert(!$("#run-playback").hidden);
  assert(!$("#run-review").hidden);
  assert.equal($("#run-splits").children.length, 1);
  assert(a.cleared.length >= 2);
  assert.equal($("#run-status").textContent, "✓ Saved session");
  assert(saved.result.calories > 0);
  $("#run-scrub").value = 500;
  $("#run-scrub").dispatchEvent(new w.Event("input"));
  assert($("#run-replay-readout").textContent.includes("mi"));
  assert($("#elevation-chart [data-replay-cursor]"));
  $("#run-play").click();
  assert($("#run-play").textContent.includes("Pause"));
  $("#run-play").click();
  assert($("#run-play").textContent.includes("Play"));
  $("#run-unit").value = "km";
  $("#run-unit").dispatchEvent(new w.Event("change"));
  assert.equal($("#run-split-title").textContent, "Kilometer splits");
  assert($("#run-distance-label").textContent.includes("KILOMETERS"));
  const recovery = create(draft);
  assert(
    recovery.w.document
      .querySelector("#run-status")
      .textContent.includes("Paused"),
  );
  assert(
    recovery.w.document
      .querySelector("#run-start")
      .textContent.includes("Resume"),
  );
  recovery.w.document.querySelector("#run-start").click();
  recovery.point(0.001);
  Object.defineProperty(recovery.w.document, "hidden", {
    value: true,
    configurable: true,
  });
  recovery.w.document.dispatchEvent(new recovery.w.Event("visibilitychange"));
  assert(
    recovery.w.document
      .querySelector("#run-status")
      .textContent.includes("Paused"),
    "Leaving foreground auto-pauses",
  );
  const denied = create();
  denied.w.document.querySelector("#run-start").click();
  denied.error({ code: 1, message: "Denied" });
  assert(
    denied.w.document
      .querySelector("#run-feedback")
      .textContent.includes("permission"),
  );
  assert(
    denied.w.document
      .querySelector("#run-status")
      .textContent.includes("unavailable"),
  );
  assert(!denied.w.document.querySelector("#gps-help").hidden);
  await new Promise((r) => setImmediate(r));
  for (const d of [a, recovery, denied]) d.dom.window.close();
  console.log(
    "PASS: GPS permission/accuracy, live fixes, pause/resume gaps, automatic finish/save, replay controls, elevation cursor, units, draft recovery, and foreground interruption.",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
