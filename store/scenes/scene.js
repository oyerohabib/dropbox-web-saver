// Helpers for driving an extension page inside a scene iframe before the screenshot is taken.
window.sceneFrame = function sceneFrame(iframe, { css = "", actions } = {}) {
  iframe.addEventListener("load", () => {
    const doc = iframe.contentDocument;
    if (css) {
      const style = doc.createElement("style");
      style.textContent = css;
      doc.head.append(style);
    }
    if (!actions) return;
    const run = (attempt = 0) => {
      if (!doc.querySelector("#root > *") && attempt < 40) {
        setTimeout(() => run(attempt + 1), 50);
        return;
      }
      setTimeout(() => actions(doc, iframe.contentWindow), 150);
    };
    run();
  });
};
