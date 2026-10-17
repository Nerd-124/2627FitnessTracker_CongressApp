const { JSDOM, VirtualConsole } = require("jsdom");
const fs = require("fs");
const assert = require("node:assert/strict");
const root =
  require("node:path").resolve(__dirname, "../../hosted/web") +
  require("node:path").sep;
const seed = {
  profile: {
    name: "Alex",
    age: 30,
    height: 170,
    weight: 70,
    sex: "unspecified",
  },
  habits: { exercise: 150, sleep: 8, plants: 5 },
  records: [],
  route: [],
  onboardingComplete: false,
};
function create(key, actual = key) {
  const dom = new JSDOM(fs.readFileSync(root + "index.html", "utf8"), {
    url: "https://app.test/app",
    runScripts: "outside-only",
    virtualConsole: new VirtualConsole(),
  });
  const w = dom.window;
  w.scrollTo = () => {};
  w.confirm = () => true;
  w.LONGEVITY_ACCOUNT = {
    storageKey: key,
    email: key + "@example.test",
    name: key,
  };
  w.fetch = async () => ({
    ok: true,
    json: async () => ({ storageKey: actual, email: actual + "@example.test" }),
  });
  w.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  w.HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  w.localStorage.setItem(
    "longevity-simulator-v1",
    JSON.stringify({ ...seed, profile: { ...seed.profile, name: "Legacy" } }),
  );
  w.localStorage.setItem("longevity-account-v1:A", JSON.stringify(seed));
  w.localStorage.setItem(
    "longevity-account-v1:B",
    JSON.stringify({ ...seed, profile: { ...seed.profile, name: "Blair" } }),
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
      .join("\n") + "\nObject.assign(window,{save});window.testState=state;",
  );
  return { dom, w };
}
const tick = () => new Promise((r) => setImmediate(r));
(async () => {
  const a = create("A");
  await tick();
  assert.equal(a.w.testState.profile.name, "Alex");
  assert.equal(
    a.w.document.querySelector("#account-email").textContent,
    "A@example.test",
  );
  assert(!a.w.document.querySelector("#legacy-import").hidden);
  a.w.document.querySelector("#setup-account").click();
  assert(a.w.document.querySelector("#account-dialog").open);
  a.w.document.querySelector("#import-legacy").click();
  assert(
    a.w.document
      .querySelector("#account-message")
      .textContent.includes("Confirm"),
  );
  a.w.testState.profile.name = "Changed";
  a.w.save();
  assert.equal(
    JSON.parse(a.w.localStorage.getItem("longevity-account-v1:A")).profile.name,
    "Changed",
  );
  assert.equal(
    JSON.parse(a.w.localStorage.getItem("longevity-account-v1:B")).profile.name,
    "Blair",
  );
  assert.equal(
    JSON.parse(a.w.localStorage.getItem("longevity-simulator-v1")).profile.name,
    "Legacy",
  );
  const b = create("B");
  await tick();
  assert.equal(b.w.testState.profile.name, "Blair");
  const mismatch = create("A", "B");
  await tick();
  await tick();
  assert(mismatch.w.document.body.classList.contains("session-paused"));
  mismatch.w.testState.profile.name = "Wrong session";
  mismatch.w.save();
  assert.equal(
    JSON.parse(mismatch.w.localStorage.getItem("longevity-account-v1:A"))
      .profile.name,
    "Alex",
    "Wrong-account session cannot save",
  );
  for (const c of [a, b, mismatch]) c.dom.window.close();
  console.log(
    "PASS: account-scoped records, explicit legacy-import confirmation, account panel, and wrong-session lock.",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
