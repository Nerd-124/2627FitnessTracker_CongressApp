import streamlit as st


def render(db, user, profile):
    st.title("Understand the numbers")
    st.markdown(
        """
### Health estimates
BMI is weight in kilograms divided by height in meters squared. Resting energy uses the published Mifflin–St Jeor equation. Neither is a complete assessment of a person.

The habit index and future curve are illustrations. Their weights and starting value are design choices; they do not predict lifespan, biological age, or disease risk.

### Exercise energy
Walking and running estimates use ACSM-style oxygen-cost equations. Uphill adds energy, downhill is treated as flat, and the total includes resting energy during active time. Temperature and humidity are stored as context, not given an invented calorie multiplier. No trained AI is connected.

### GPS and sleep
GPS has measurement error. Missing altitude is not zero. Median smoothing and a 3-meter ascent threshold reduce noise, but do not remove it. Paused sections and gaps are not connected. Brainwaves require a compatible EEG device; the app only plots imported data and does not infer sleep stages.

### Sources
- [WHO physical activity guidance](https://www.who.int/news-room/fact-sheets/detail/physical-activity)
- [CDC sleep information](https://www.cdc.gov/sleep/about/index.html)
- [Mifflin et al., 1990](https://pubmed.ncbi.nlm.nih.gov/2305711/)
- ACSM's Guidelines for Exercise Testing and Prescription, metabolic equations

### Read the implementation
The formulas are in `longevity/health.py`, route analysis is in `longevity/routes.py`, and GPS filtering is in `longevity/recorder.py`. These are ordinary Python files you can study without understanding the interface.
"""
    )
