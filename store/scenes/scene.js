// Helpers for driving an extension page inside a scene iframe before the screenshot is taken.
window.sceneFrame = function sceneFrame(iframe, { css = "", actions } = {}) {
  const prepare = () => {
    const doc = iframe.contentDocument;
    if (!doc?.querySelector("#root")) return;
    if (css && !doc.getElementById("scene-overrides")) {
      const style = doc.createElement("style");
      style.id = "scene-overrides";
      style.textContent = css;
      doc.head.append(style);
    }
    if (!actions || doc.documentElement.dataset.sceneReady) return;
    const run = (attempt = 0) => {
      if (!doc.querySelector("#root > *") && attempt < 40) {
        setTimeout(() => run(attempt + 1), 50);
        return;
      }
      doc.documentElement.dataset.sceneReady = "1";
      setTimeout(() => actions(doc, iframe.contentWindow), 150);
    };
    run();
  };
  iframe.addEventListener("load", prepare);
  prepare();
};
