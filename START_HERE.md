# Start here: learning your Python app

You do not need to read every file. Follow one small feature from input to output.

## 1. Read `app.py`

`main()` checks whether someone is signed in. Then it loads their profile and opens the screen they chose in the sidebar.

The `screens` dictionary connects a menu label to a Python module. For example, `"Daily journal": journal` means the menu opens the `render()` function in `screens/journal.py`.

## 2. Change something small in `screens/home.py`

The `GOALS` dictionary contains the daily habit descriptions. Try changing the wording of one goal, save the file, and rerun Streamlit when it offers to reload.

Streamlit widgets are regular Python function calls:

```python
choice = st.radio("Your daily focus", keys, format_func=GOALS.get)
completed = st.checkbox("I did this today")
```

`choice` contains the selected value. `completed` is `True` or `False`. A button decides when to save them.

## 3. Understand a calculation in `longevity/health.py`

```python
def calculate_bmi(weight_kg, height_cm):
    height_m = height_cm / 100
    return round(weight_kg / height_m ** 2, 1)
```

The inputs are parameters. `height_m` is a local variable. `return` gives the calculated value back to the screen. The interface does not need to know the formula.

Try the function in a VS Code Python terminal:

```python
from longevity.health import calculate_bmi
print(calculate_bmi(70, 172))
```

The tests in `tests/test_logic.py` show more examples with expected answers.

## 4. Follow a journal save

In `screens/journal.py`:

1. Python widgets collect bedtime, wake-up time, exercise, and meals.
2. `validate_entry()` checks those values and calculates sleep duration.
3. `db.save()` writes the record under the signed-in user's ID.
4. `st.rerun()` refreshes the screen.
5. The calendar and graph read those saved records.

The formulas are separate from the screen. You can test `validate_entry()` without starting a browser.

## 5. Leave the advanced code until later

- `storage.py` uses SQLite and password hashing. Understand its public methods before changing the implementation.
- `routes.py` contains trigonometry and interpolation. Start with its tests.
- `exercise.py` uses `st.fragment()` to refresh the live recorder without rebuilding every screen.
- `gps_component/gps.js` is only a sensor adapter. It is the small exception to writing the application in Python. You do not need to edit it for normal features.

Do not change scientific formulas just to get a different result. Keep the model explanation and tests consistent with any deliberate research-based change.

## 6. Make one change and check it

```bash
python -m unittest discover -s tests -v
```

Choose one feature, explain what its Python function does, and then change it. Understanding a small complete path is more useful than memorizing the whole project.
