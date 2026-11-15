// Stitches the request strip and response strip of each Postman shot (drops the empty middle).
const path = require("path");
const sharp = require(path.join(__dirname, "../../apps/api/node_modules/sharp"));
const dir = path.join(__dirname, "images/shots");
// [name, requestStripHeight]
const files = { "p01-register-201": 170, "p02-register-409": 170, "p03-register-400": 170, "p04-login-200": 170, "p05-projects-401": 170,
  "p06-tickets-search-200": 250, "p07-tester-patch-403": 170, "p08-status-201": 170, "p09-approve-409": 170, "p10-webhook-401": 170, "p11-widget-403": 170 };
(async () => {
  for (const [n, top] of Object.entries(files)) {
    const src = path.join(dir, n + ".png");
    const { width, height } = await sharp(src).metadata();
    const bottomStart = 385;
    const a = await sharp(src).extract({ left: 0, top: 0, width, height: top }).toBuffer();
    const b = await sharp(src).extract({ left: 0, top: bottomStart, width, height: height - bottomStart }).toBuffer();
    await sharp({ create: { width, height: top + height - bottomStart + 6, channels: 3, background: "#1c1c1c" } })
      .composite([{ input: a, left: 0, top: 0 }, { input: b, left: 0, top: top + 6 }])
      .png().toFile(path.join(dir, n + "-c.png"));
  }
})();
