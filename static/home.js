"use strict";
const goalDescriptions = {
  move: {
    title: "Take a 10-minute walk",
    help: "Choose a time and place that works for you. When you have finished, check in here.",
  },
  rest: {
    title: "Wind down before bed",
    help: "Set aside 15 minutes for a quiet activity before your usual bedtime. Check in after you try it.",
  },
  food: {
    title: "Add a colorful serving",
    help: "Choose a fruit or vegetable to add to a meal today. Check in after your meal.",
  },
};
function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function refreshHome() {
  const name = state.profile.name?.trim();
  $("#home-title").textContent = name
    ? `One small step, ${name}.`
    : "A small step for today.";
  $("#home-date").textContent = new Date()
    .toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    })
    .toUpperCase();
  const goal = state.dailyGoals?.[localDate()];
  const valid = goal && goalDescriptions[goal.type];
  document.querySelectorAll("[data-goal]").forEach((el) => {
    const selected = valid && el.dataset.goal === goal.type;
    el.classList.toggle("selected", !!selected);
    el.setAttribute("aria-pressed", String(!!selected));
  });
  $("#goal-guidance").textContent = valid
    ? goal.completed
      ? `You checked in: ${goalDescriptions[goal.type].title.toLowerCase()}. You can undo this if needed.`
      : goalDescriptions[goal.type].help
    : "Choose an action above to make a plan.";
  $("#complete-goal").disabled = !valid;
  $("#complete-goal").textContent = valid
    ? goal.completed
      ? "✓ Done today · Undo"
      : "I did this today ✓"
    : "Choose an action first";
  const box = $("#week-progress");
  box.replaceChildren();
  let count = 0;
  for (let offset = 6; offset >= 0; offset--) {
    const day = new Date();
    day.setDate(day.getDate() - offset);
    const item = state.dailyGoals?.[localDate(day)];
    const complete = !!(item?.completed && goalDescriptions[item.type]);
    if (complete) count++;
    const cell = document.createElement("div");
    cell.className = complete ? "checked-day" : "unchecked-day";
    const dateLabel = day.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    cell.setAttribute(
      "aria-label",
      `${dateLabel}: ${complete ? "checked in" : "no check-in"}`,
    );
    cell.innerHTML = `<span>${complete ? "✓" : "·"}</span><small></small>`;
    cell.querySelector("small").textContent = day.toLocaleDateString(
      undefined,
      { weekday: "narrow" },
    );
    box.append(cell);
  }
  $("#week-count").textContent =
    `${count} ${count === 1 ? "day" : "days"} checked in this week`;
  $("#journey-message").textContent = goal?.completed
    ? "You made time for yourself today. That is worth noticing."
    : count
      ? "Keep making room for small actions that fit your life."
      : "Your first check-in is a place to begin.";
  const today = state.records.some((r) => r.date === localDate());
  $("#journal-home-status").textContent = today
    ? "Review today’s entry →"
    : "Add today’s entry →";
  refreshScenario();
}
function refreshScenario() {
  if (!$("#scenario-differences")) return;
  const base = state.baselineHabits || state.habits;
  const definitions = [
    ["exercise", "Weekly movement", "minutes / week"],
    ["sleep", "Nightly sleep", "hours / night"],
    ["plants", "Fruit & vegetables", "servings / day"],
  ];
  const box = $("#scenario-differences");
  box.replaceChildren();
  let changes = 0;
  for (const [key, label, unit] of definitions) {
    const before = Number(base[key]),
      after = Number(state.habits[key]),
      delta = Math.round((after - before) * 10) / 10;
    if (delta) changes++;
    const row = document.createElement("div");
    row.className = "comparison-row";
    const title = document.createElement("strong");
    title.textContent = label;
    const values = document.createElement("span");
    values.textContent = `${before} → ${after} ${unit}`;
    const note = document.createElement("small");
    note.textContent =
      delta === 0
        ? "Same as your starting routine"
        : `${Math.abs(delta)} ${unit} ${delta > 0 ? "more" : "less"}`;
    row.append(title, values, note);
    box.append(row);
  }
  $("#scenario-summary").textContent = changes
    ? `${changes === 1 ? "One habit is" : changes + " habits are"} different from your starting routine.`
    : "Your starting routine. What would you like to try?";
  $("#scenario-to-plan").disabled = !changes;
}
function chooseGoal(type) {
  const day = localDate();
  const current = state.dailyGoals[day];
  if (current?.type === type) return;
  if (
    current?.completed &&
    !confirm("Switch today’s focus? This will clear today’s check-in.")
  )
    return;
  state.dailyGoals[day] = { type, completed: false };
  save();
  refreshHome();
}
function initializeHome() {
  document
    .querySelectorAll("[data-goal]")
    .forEach((el) => (el.onclick = () => chooseGoal(el.dataset.goal)));
  $("#complete-goal").onclick = () => {
    const goal = state.dailyGoals[localDate()];
    if (!goal || !goalDescriptions[goal.type]) return;
    goal.completed = !goal.completed;
    save();
    refreshHome();
    toast(
      goal.completed
        ? "Your check-in is saved. A small step counts."
        : "Today’s check-in was undone.",
    );
  };
  document.querySelectorAll("[data-destination]").forEach(
    (el) =>
      (el.onclick = () => {
        if (el.dataset.destination === "journal") {
          prefillJournal();
        }
        openAppPage(el.dataset.destination);
      }),
  );
  $("#home-profile").onclick = () => openSetup(true);
  $("#scenario-to-plan").onclick = () => {
    const base = state.baselineHabits || state.habits;
    const type =
      state.habits.exercise !== base.exercise
        ? "move"
        : state.habits.sleep !== base.sleep
          ? "rest"
          : "food";
    chooseGoal(type);
    openAppPage("home");
    $("#goal-guidance").scrollIntoView?.({
      behavior: "smooth",
      block: "center",
    });
    toast("Choose the small action that fits your day.");
  };
  refreshHome();
}
