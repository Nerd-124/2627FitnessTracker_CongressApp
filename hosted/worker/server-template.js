const ASSETS = __EMBEDDED_ASSETS__;
const securityHeaders = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(self)",
};
function reply(
  body,
  status = 200,
  type = "application/json; charset=utf-8",
  extra = {},
) {
  return new Response(body, {
    status,
    headers: { ...securityHeaders, "Content-Type": type, ...extra },
  });
}
async function identity(request) {
  const id = request.headers.get("oai-authenticated-user-id");
  const email = request.headers.get("oai-authenticated-user-email");
  if (!id || !email) return null;
  const name = request.headers.get("oai-authenticated-user-full-name");
  let decoded = null;
  if (
    name &&
    request.headers.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
  ) {
    try {
      decoded = decodeURIComponent(name);
    } catch {}
  }
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(id),
  );
  const storageKey = Array.from(new Uint8Array(bytes), (n) =>
    n.toString(16).padStart(2, "0"),
  ).join("");
  return { email, name: decoded || email, storageKey };
}
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (!["GET", "HEAD"].includes(request.method))
      return reply(
        JSON.stringify({ error: "Method not allowed" }),
        405,
        undefined,
        { Allow: "GET, HEAD" },
      );
    const user = await identity(request);
    if (path === "/api/account")
      return user
        ? reply(JSON.stringify(user))
        : reply(JSON.stringify({ error: "Sign-in required" }), 401);
    if (path === "/" || path === "/welcome")
      return reply(
        request.method === "HEAD" ? null : ASSETS["/welcome.html"].body,
        200,
        "text/html; charset=utf-8",
      );
    if (!user) {
      if (path === "/app" || path === "/app/" || path === "/index.html")
        return reply(null, 302, undefined, {
          Location: "/signin-with-chatgpt?return_to=%2Fapp",
        });
      return reply(JSON.stringify({ error: "Sign-in required" }), 401);
    }
    const asset =
      ASSETS[path === "/app" || path === "/app/" ? "/index.html" : path];
    if (!asset) return reply("Not found", 404, "text/plain; charset=utf-8");
    let body = asset.binary
      ? Uint8Array.from(atob(asset.body), (c) => c.charCodeAt(0))
      : asset.body;
    let headers = {};
    if (asset.type.startsWith("text/html")) {
      const nonce = crypto.randomUUID().replaceAll("-", "");
      const bootstrap = JSON.stringify(user)
        .replaceAll("<", "\\u003c")
        .replaceAll("\u2028", "\\u2028")
        .replaceAll("\u2029", "\\u2029");
      body = body.replace(
        "</head>",
        `<script nonce="${nonce}">window.LONGEVITY_ACCOUNT=${bootstrap};</script></head>`,
      );
      headers["Content-Security-Policy"] =
        `default-src 'self'; script-src 'self' 'nonce-${nonce}' https://cdn.jsdelivr.net 'unsafe-eval' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; img-src 'self' data: blob: https://tile.openstreetmap.org https://cdn.jsdelivr.net; connect-src 'self' https://cdn.jsdelivr.net https://api.open-meteo.com; worker-src 'self' blob:; base-uri 'self'; object-src 'none'`;
    }
    return reply(
      request.method === "HEAD" ? null : body,
      200,
      asset.type,
      headers,
    );
  },
};
