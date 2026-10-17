import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const source = await readFile(
  new URL("../hosted/dist/server/index.js", import.meta.url),
  "utf8",
);
const worker = (
  await import(
    "data:text/javascript;base64," + Buffer.from(source).toString("base64")
  )
).default;
const base = "https://longevity-simulator-lab.idealapple4.chatgpt.site";
const headers = (id = "person-a", email = "a@example.test", name = "Alex") => ({
  "oai-authenticated-user-id": id,
  "oai-authenticated-user-email": email,
  "oai-authenticated-user-full-name": encodeURIComponent(name),
  "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
});
const get = (path, head = {}) =>
  worker.fetch(new Request(base + path, { headers: head }));
assert.equal((await get("/")).status, 200);
assert((await (await get("/")).text()).includes("Continue with ChatGPT"));
assert.equal((await get("/api/account")).status, 401);
const redirect = await get("/app");
assert.equal(redirect.status, 302);
assert.equal(
  redirect.headers.get("Location"),
  "/signin-with-chatgpt?return_to=%2Fapp",
);
for (const path of ["/app.js", "/account.js", "/model.py", "/index.html"])
  assert.notEqual((await get(path)).status, 200);
assert.equal(
  (await get("/api/account", { "oai-authenticated-user-id": "person-a" }))
    .status,
  401,
);
const a = await (await get("/api/account", headers())).json(),
  b = await (await get("/api/account", headers("person-b"))).json();
assert.notEqual(a.storageKey, b.storageKey);
assert.equal(a.storageKey.length, 64);
assert.equal(a.name, "Alex");
assert.equal(
  a.storageKey,
  (await (await get("/api/account", headers())).json()).storageKey,
);
const response = await get(
  "/app",
  headers("x", "x@example.test", "</script><script>alert(1)</script>"),
);
const body = await response.text();
assert(
  !body.includes(
    'window.LONGEVITY_ACCOUNT={"email":"x@example.test","name":"</script>',
  ),
);
assert(body.includes("\\u003c/script>"));
assert(
  response.headers.get("Content-Security-Policy").includes("object-src 'none'"),
);
assert.equal(response.headers.get("Cache-Control"), "private, no-store");
assert.equal((await get("/app.js", headers())).status, 200);
assert.equal((await get("/missing", headers())).status, 404);
assert.equal(
  (
    await worker.fetch(
      new Request(base + "/api/account", {
        method: "POST",
        headers: headers(),
      }),
    )
  ).status,
  405,
);
console.log(
  "PASS: login entry, unauthorized redirects/assets, identity checks, isolated account IDs, safe bootstrap, no-store headers, and method restrictions.",
);
