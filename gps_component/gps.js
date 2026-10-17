/* The only custom JavaScript in the Python app.
 * Browsers require JavaScript to request their GPS sensor. This adapter only
 * forwards raw fixes to Python; it does not calculate distance or calories.
 */
let watchId = null;
let wakeLock = null;
let lastToken = null;
let points = [];
let sequence = 0;

function send(value) {
  window.parent.postMessage({
    isStreamlitMessage: true,
    type: "streamlit:setComponentValue",
    dataType: "json",
    value: { ...value, token: lastToken, sequence: ++sequence },
  }, window.location.origin);
}

function status(message) {
  document.getElementById("status").textContent = message;
}

function stop() {
  if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  watchId = null;
  if (wakeLock) wakeLock.release().catch(() => {});
  wakeLock = null;
}

function start() {
  stop();
  points = [];
  const currentToken = lastToken;
  if (!navigator.geolocation || !window.isSecureContext) {
    status("GPS requires a supported browser on HTTPS or localhost.");
    send({ status: "error", message: "Use HTTPS or localhost and allow precise location." });
    return;
  }
  status("Requesting location permission…");
  watchId = navigator.geolocation.watchPosition(
    (position) => {
      if (lastToken !== currentToken || watchId === null) return;
      points.push({
        lat: position.coords.latitude,
        lon: position.coords.longitude,
        ele: position.coords.altitude,
        accuracy: position.coords.accuracy,
        altitudeAccuracy: position.coords.altitudeAccuracy,
        timestamp: position.timestamp,
      });
      status("GPS fixes are being sent to Python.");
      send({ status: "fix", points });
      if (points.length >= 10000) {
        stop();
        send({ status: "error", message: "10,000-fix limit reached. Finish this session." });
      }
    },
    (error) => {
      if (lastToken !== currentToken) return;
      const messages = {
        1: "Location permission is blocked. Enable precise location for this browser.",
        2: "Device location is unavailable. Check Location Services or try a phone outdoors.",
        3: "Location lookup timed out. Retry outdoors with precise location enabled.",
      };
      stop();
      const message = messages[error.code] || "The browser could not provide location.";
      status(message);
      send({ status: "error", message });
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
  );
  if (navigator.wakeLock) {
    navigator.wakeLock.request("screen").then((lock) => {
      if (watchId === null || lastToken !== currentToken) lock.release();
      else wakeLock = lock;
    }).catch(() => {});
  }
}

window.addEventListener("message", (event) => {
  if (event.source !== window.parent || event.origin !== window.location.origin || !event.data || event.data.type !== "streamlit:render") return;
  const args = event.data.args;
  if (args.token === lastToken) return;
  lastToken = args.token;
  if (args.command === "start") start();
  else {
    stop();
    status("GPS is stopped. Start or resume using the Python controls above.");
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && watchId !== null) {
    stop();
    status("Paused because the app left the foreground.");
    send({ status: "hidden", message: "Auto-paused when the app left the foreground. Resume to continue." });
  }
});
window.addEventListener("pagehide", stop);
window.parent.postMessage({ isStreamlitMessage: true, type: "streamlit:componentReady", apiVersion: 1 }, window.location.origin);
window.parent.postMessage({ isStreamlitMessage: true, type: "streamlit:setFrameHeight", height: 45 }, window.location.origin);
