// Injected only into the main document at the configured HTTPS website origin.
(() => {
  if (window.location.origin !== '__WEBSITE_ORIGIN__' || window.top !== window) return;
  const channel = window.webkit?.messageHandlers?.nativeLocation;
  if (!channel) return;
  let sequence = 0, permissionState = 'prompt';
  const callbacks = new Map();
  const permission = new EventTarget();
  Object.defineProperty(permission, 'state', {get: () => permissionState});
  Object.defineProperty(permission, 'name', {value: 'geolocation'});
  permission.onchange = null;
  const send = message => channel.postMessage(message);
  const request = (success, error, options, watch) => {
    if (typeof success !== 'function') throw new TypeError('A success callback is required');
    const id = ++sequence;
    callbacks.set(id, {success, error, watch});
    const timeout = Number(options?.timeout);
    send({action: 'request', id, watch, timeout: Number.isFinite(timeout) && timeout >= 0 ? Math.min(timeout, 2147483647) : 15000});
    return id;
  };
  const geolocation = {
    getCurrentPosition(success, error, options) { request(success, error, options, false); },
    watchPosition(success, error, options) { return request(success, error, options, true); },
    clearWatch(id) { callbacks.delete(Number(id)); window.__longevityNative.drainingLocations = false; send({action: 'clear', id: Number(id)}); }
  };
  Object.defineProperty(navigator, 'geolocation', {configurable: true, value: geolocation});
  if (navigator.permissions?.query) {
    const query = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = descriptor => descriptor?.name === 'geolocation' ? Promise.resolve(permission) : query(descriptor);
  }
  Object.defineProperty(window, '__longevityNative', {value: {
    backgroundTracking: true,
    sessionContinuity: true,
    bridgeVersion: 7,
    protectedSteps: true,
    steps(options) { send({...options, action: 'steps'}); },
    receiveSteps(message) { window.dispatchEvent(new CustomEvent('longevity-steps', {detail: message})); },
    runStatus(status) { send({...status, action: 'runStatus'}); },
    drainingLocations: false,
    background() { if (typeof suspendRunForBackground === 'function') suspendRunForBackground(); },
    foreground(pending = false) { this.drainingLocations = Boolean(pending); if (typeof resumeRunFromBackground === 'function') resumeRunFromBackground(); },
    receiveBatch(messages, hasMore = false) {
      this.drainingLocations = Boolean(hasMore) && messages.some(message => callbacks.has(message.id));
      if (typeof resumeRunFromBackground === 'function') resumeRunFromBackground();
      window.__longevityNativeBatch = true;
      const acknowledged = [];
      try { for (const message of messages) if (this.receive({...message, position: {...message.position, backgroundReplay: true}})) acknowledged.push(message._sequence); }
      finally { window.__longevityNativeBatch = false; if (typeof completeNativeRunBatch === 'function') completeNativeRunBatch(); }
      return acknowledged;
    },
    permission(state) {
      permissionState = state;
      permission.dispatchEvent(new Event('change'));
      if (typeof permission.onchange === 'function') permission.onchange(new Event('change'));
    },
    receive(message) {
      const item = callbacks.get(message.id);
      if (!item) return false;
      if (!item.watch || message.error?.code === 1) callbacks.delete(message.id);
      if (message.error) {
        const error = Object.assign({PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3}, message.error);
        if (typeof item.error === 'function') item.error(error);
      } else item.success(message.position);
      return true;
    },
    pause() {
      // Compatible with older installed shells: preserve elapsed time even if
      // that shell must stop GPS while it is in the background.
      if (document.hidden && typeof suspendRunForBackground === 'function') suspendRunForBackground();
      else if (typeof resumeRunFromBackground === 'function') resumeRunFromBackground();

    }
  }});
  send({action: 'permission'});
})();
