export function registerOffline(notify: (message: string) => void) {
  if (!("serviceWorker" in navigator) || !import.meta.env.PROD) return;
  const register = () => {
    navigator.serviceWorker
      .register(import.meta.env.BASE_URL + "sw.js", {
        scope: import.meta.env.BASE_URL,
      })
      .then((reg) => {
        const installed = () => {
          if (reg.active) notify("OFFLINE READY / The whole city is cached.");
        };
        if (reg.active) installed();
        reg.addEventListener("updatefound", () => {
          const worker = reg.installing;
          worker?.addEventListener("statechange", () => {
            if (worker.state === "installed") {
              notify(
                navigator.serviceWorker.controller
                  ? "UPDATE READY / Install it from Options."
                  : "OFFLINE READY / Play anywhere.",
              );
            }
          });
        });
      })
      .catch(() =>
        notify("Offline cache unavailable. Reconnect and reload to retry."),
      );
  };
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}
