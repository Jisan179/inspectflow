import { ApiClient } from "./api";
import { Collector } from "./collector";
import { WidgetUi } from "./ui";

/**
 * Entry point. Embed on a staging site with:
 *
 *   <script src="https://your-inspectflow-web/inspectflow-widget.js"
 *           data-key="if_pk_..." data-api="https://your-api" defer></script>
 *
 * Optional attributes: data-build-id, data-position="left|right".
 */
(function init() {
  const script = document.currentScript as HTMLScriptElement | null;
  const key = script?.dataset.key;
  const api = script?.dataset.api?.replace(/\/+$/, "");
  if (!key || !api) {
    console.warn("[InspectFlow] Missing data-key or data-api on the script tag.");
    return;
  }
  if ((window as any).InspectFlow) return; // already loaded

  // The API client must grab window.fetch BEFORE the collector patches it.
  const client = new ApiClient(api, key);
  const collector = new Collector({ capacity: 100, ignoreUrlPrefixes: [api] });
  collector.install();

  const ui = new WidgetUi({
    api: client,
    collector,
    projectKey: key,
    buildId: script?.dataset.buildId,
    position: script?.dataset.position === "left" ? "left" : "right",
  });

  const mount = () => ui.mount();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();

  (window as any).InspectFlow = { version: "1.0.0", open: () => ui.start() };
})();
