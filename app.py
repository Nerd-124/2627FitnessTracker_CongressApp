"""Run the JavaScript interface with a Python server: python3 app.py.

Accounts reuse the Streamlit SQLite database. Health entries in this edition
stay in account-scoped browser storage; the Streamlit edition remains separate.
"""
import html
import json
import os
import secrets
import time
from http.cookies import SimpleCookie
from http.server import ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs
from longevity.storage import Database
from web_app import Handler as WebHandler

ROOT = Path(__file__).parent
DB = Database(Path(os.environ.get('LONGEVITY_DATA_DIR', ROOT / '.data')) / 'longevity.sqlite3')
SESSIONS = {}


class Handler(WebHandler):
    def user(self):
        cookie = SimpleCookie()
        try:
            cookie.load(self.headers.get('Cookie', ''))
            token = cookie.get('longevity_session')
            session = SESSIONS.get(token.value) if token else None
        except Exception:
            return None
        if session and session['expires'] > time.time():
            return session['user']
        return None

    def reply(self, body, status=200, cookie=None):
        self.send_response(status)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'DENY')
        if cookie:
            self.send_header('Set-Cookie', cookie)
        self.end_headers()
        self.wfile.write(body.encode())

    def redirect(self, cookie=None):
        self.send_response(303)
        self.send_header('Location', '/')
        self.send_header('Cache-Control', 'no-store')
        if cookie:
            self.send_header('Set-Cookie', cookie)
        self.end_headers()

    def login(self, error=''):
        self.reply('''<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Welcome · Longevity Simulator</title><link rel="stylesheet" href="/style.css">
<body><main style="max-width:560px;margin:8vh auto;padding:24px">
<p class="eyebrow">LONGEVITY SIMULATOR</p><h1>Your healthier future starts here.</h1>
<p>Sign in to your space, or create an account to begin.</p>
<section class="card" style="padding:28px;margin-top:28px">
<p role="alert">''' + html.escape(error) + '''</p>
<form method="post" action="/login" style="display:grid;gap:18px">
<label>Email<input name="email" type="email" autocomplete="email" required></label>
<label>Password<input name="password" type="password" autocomplete="current-password" required maxlength="256"></label>
<button type="submit" class="primary">Sign in →</button></form>
<details style="margin-top:28px"><summary>Create a new account</summary>
<form method="post" action="/register" style="display:grid;gap:18px;margin-top:20px">
<label>Your name<input name="name" autocomplete="name" required maxlength="80"></label>
<label>Email<input name="email" type="email" autocomplete="email" required></label>
<label>Password · at least 10 characters<input name="password" type="password" autocomplete="new-password" minlength="10" maxlength="256" required></label>
<button type="submit" class="primary">Create my account →</button></form></details></section>
<p style="margin-top:24px">Educational exploration, one day at a time.</p></main></body></html>''')

    def account(self, user):
        return {'storageKey': 'local-web-user-' + str(user['id']), 'email': user['email'], 'name': user['name']}

    def do_GET(self):
        path = self.path.split('?', 1)[0]
        if path == '/api/account':
            user=self.user()
            if not user:
                return self.send_error(401)
            self.send_response(200)
            self.send_header('Content-Type','application/json')
            self.send_header('Cache-Control','no-store')
            self.end_headers()
            self.wfile.write(json.dumps(self.account(user)).encode())
            return
        if path in ('/', '/app', '/index.html'):
            user = self.user()
            if not user:
                return self.login()
            page = (ROOT / 'static/index.html').read_text()
            script = '<script>window.LONGEVITY_ACCOUNT=' + json.dumps(self.account(user)).replace('<', chr(92) + 'u003c') + ';</script>'
            return self.reply(page.replace('<script src="run-math.js">', script + '<script src="run-math.js">'))
        # Only serve public assets. Never expose source, databases, or directories.
        allowed = { '/' + p.name for p in (ROOT / 'static').iterdir() if p.is_file() and p.name != 'index.html' }
        if path not in allowed:
            return self.send_error(404)
        super().do_GET()

    def do_POST(self):
        # Browser form requests must originate from this local server.
        origin = self.headers.get('Origin')
        if origin and origin != 'http://' + self.headers.get('Host', ''):
            return self.send_error(403)
        if self.headers.get('Sec-Fetch-Site') == 'cross-site':
            return self.send_error(403)
        if self.path == '/logout':
            cookie = SimpleCookie(self.headers.get('Cookie', ''))
            token = cookie.get('longevity_session')
            if token:
                SESSIONS.pop(token.value, None)
            return self.redirect('longevity_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0')
        if self.path in ('/login', '/register'):
            try:
                size = int(self.headers.get('Content-Length', '0'))
                if not 0 < size < 4096:
                    raise ValueError('Invalid form size.')
                data = parse_qs(self.rfile.read(size).decode())
                value = lambda name: data.get(name, [''])[0]
                if self.path == '/register':
                    user = DB.register(value('name'), value('email'), value('password'))
                else:
                    user = DB.sign_in(value('email'), value('password'))
                for key, session in list(SESSIONS.items()):
                    if session['expires'] <= time.time():
                        SESSIONS.pop(key, None)
                token = secrets.token_urlsafe(32)
                SESSIONS[token] = {'user': user, 'expires': time.time() + 43200}
                return self.redirect('longevity_session=' + token + '; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200')
            except (ValueError, UnicodeError) as exc:
                return self.login(str(exc))
        if not self.user():
            return self.send_error(401)
        super().do_POST()


if __name__ == '__main__':
    port = int(os.environ.get('PORT', '8000'))
    print(f'Longevity Simulator → http://127.0.0.1:{port}', flush=True)
    ThreadingHTTPServer(('127.0.0.1', port), Handler).serve_forever()
