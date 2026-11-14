// Demo staging site. Every defect below is DELIBERATE so testers have something
// real to report with InspectFlow. They are test scenarios, not product bugs.

// Scenario 1: dead button. The handler uses an object that is never defined, so
// clicking "Pay now" throws a TypeError and nothing visible happens.
document.getElementById("pay").addEventListener("click", function () {
  var paymentForm; // never assigned: deliberate defect
  paymentForm.submit();
});

// Scenario 2: failed API request. The server always answers 500 and the page
// silently ignores it (no message to the user). The Authorization header below
// is fake; it exists to prove InspectFlow never captures request headers.
document.getElementById("order").addEventListener("click", function () {
  fetch("/api/orders?token=demo-secret-token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer demo-secret-token" },
    body: JSON.stringify({ items: 2, total: 48, promo: document.getElementById("promo").value }),
  }).then(function () {
    /* response deliberately ignored */
  });
});

// Scenario 3: console error.
document.getElementById("promo-check").addEventListener("click", function () {
  console.error("Promo service unavailable: could not validate code", document.getElementById("promo").value || "(empty)");
});

// Scenario 4: missing resource. The endpoint does not exist and answers 404.
document.getElementById("load-reco").addEventListener("click", function () {
  fetch("/api/recommendations?session=abc123&user=42").then(function (r) {
    document.getElementById("status").textContent = r.ok ? "Loaded" : "";
  });
});
