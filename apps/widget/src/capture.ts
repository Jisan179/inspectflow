import html2canvas from "html2canvas";

/**
 * Takes a screenshot of the visible part of the page with html2canvas.
 *
 * Known limitations of html2canvas (it re-draws the page from the DOM, it is
 * not a true screen capture):
 *  - some CSS (certain filters, blend modes, newer color functions) renders
 *    differently or not at all;
 *  - cross-origin images and fonts appear only if the server sends CORS
 *    headers; otherwise they are left blank;
 *  - iframes, video, canvas WebGL content and browser UI are not captured.
 * These are accepted in the project proposal.
 */
export async function captureViewport(ignore: Element[]): Promise<HTMLCanvasElement> {
  const canvas = await html2canvas(document.documentElement, {
    x: window.scrollX,
    y: window.scrollY,
    width: window.innerWidth,
    height: window.innerHeight,
    windowWidth: document.documentElement.clientWidth,
    windowHeight: window.innerHeight,
    scale: 1,
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
    ignoreElements: (el) => ignore.includes(el),
  });
  if (!canvas.width || !canvas.height) {
    throw new Error("The page could not be captured");
  }
  return canvas;
}
