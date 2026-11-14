// Controlled failure for the demo: this endpoint always answers 500.
// Works as a Vercel serverless function and is also mounted by server.mjs.
module.exports = function handler(req, res) {
  res.statusCode = 500;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ error: "Payment provider unavailable (demo failure)" }));
};
