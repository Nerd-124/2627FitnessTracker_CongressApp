# Run the polished web app

1. Open this project folder in VS Code.
2. Open Terminal → New Terminal.
3. Run `python3 app.py`.
4. Open http://127.0.0.1:8000 in your browser.

No package installation is needed for this version. Keep the terminal running.
Stop the server with Control+C. If Streamlit is running in the terminal,
press Control+C before starting this app.

Sign in with your existing local account, or expand Create a new account.
Accounts are stored in .data/longevity.sqlite3. Never share that directory.
Journal entries, routes and settings for this web edition are saved in
account-scoped browser storage. They are separate from Streamlit entries.
Export your data before clearing browser storage.

The previous Python-only interface is preserved as streamlit_app.py.
To use it: `python -m streamlit run streamlit_app.py` after installing requirements.txt.
