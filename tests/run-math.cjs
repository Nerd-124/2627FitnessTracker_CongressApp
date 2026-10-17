const fs = require("fs"),
  vm = require("vm"),
  assert = require("node:assert/strict");
const context = {};
vm.runInNewContext(
  fs.readFileSync(
    require("node:path").resolve(__dirname, "../hosted/web/run-math.js"),
    "utf8",
  ) + ";globalThis.RM=RunMath;",
  context,
);
const R = context.RM;
const p = (lat, ele, elapsed, breakBefore = false) => ({
  lat,
  lon: 0,
  ele,
  elapsed,
  breakBefore,
  time: new Date(1700000000000 + elapsed * 1000).toISOString(),
});
let a = R.analyze([p(0, 100, 0), p(0.001, 110, 10), p(0.002, 120, 20)], 20);
assert(Math.abs(a.distance - 222.39) < 0.1);
assert.equal(a.gain, 20);
assert(
  R.energy(a, 20, 70, "walk") > R.energy({ ...a, gain: 0 }, 20, 70, "walk"),
);
const gap = R.analyze(
  [p(0, 100, 0), p(0.001, 100, 10), p(0.01, 100, 20, true), p(0.011, 100, 30)],
  30,
);
assert(Math.abs(gap.distance - 222.39) < 0.1);
assert.equal(gap.gaps, 1);
const during = R.at(gap, 0.5);
assert(during.inGap);
assert.equal(
  during.lat,
  0.001,
  "Playback holds last location during gap, not an invented connector",
);
a = R.analyze([p(0, null, 0), p(0.02, null, 600)], 600);
const splits = R.splits(a);
assert.equal(splits.length, 2);
assert.equal(splits[0].partial, false);
assert.equal(splits[1].partial, true);
assert(Math.abs(splits.reduce((n, s) => n + s.seconds, 0) - 600) < 1e-8);
assert.equal(a.altitudePoints, 0);
assert.equal(a.gain, 0);
const short = R.analyze(
  [p(0, 100, 0), p(0.001, 101, 10), p(0.002, 102, 20), p(0.003, 103, 30)],
  30,
);
assert.equal(
  short.gain,
  3,
  "Small incremental rises aggregate at the three-meter threshold",
);
const dated = R.analyze([
  { lat: 0, lon: 0, ele: null, time: "2026-10-17T12:00:00Z" },
  { lat: 0.001, lon: 0, ele: null, time: "2026-10-17T12:00:20Z" },
]);
assert.equal(dated.duration, 20);
assert(dated.timed);
const untimed = R.analyze(
  [
    { lat: 0, lon: 0, ele: 0 },
    { lat: 0.001, lon: 0, ele: 0 },
  ],
  100,
);
assert.equal(untimed.timed, false);
assert.equal(untimed.points.at(-1).elapsed, 100);
const xml = R.toGPX(gap.points, "A & <run>");
assert(xml.includes("A &amp; &lt;run&gt;"));
assert.equal((xml.match(/<trkseg>/g) || []).length, 2);
assert.equal(R.clock(3661), "1:01:01");
console.log(
  "PASS: GPS distance, filtered elevation, uphill energy, pauses/gaps, replay, mile splits, GPX timing/export, and clocks.",
);
