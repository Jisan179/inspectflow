"""Builds the Postman collection used for the report screenshots.
Run: python docs/report/make_collection.py   ->  docs/report/InspectFlow.postman_collection.json

Tokens and ids are chained between requests with pm.globals so each request
can be sent with one click. Demo accounts are the fictional seed users.
"""
import json, os, hmac, hashlib

BASE = "http://localhost:5001"
HERE = os.path.dirname(os.path.abspath(__file__))

def req(name, method, path, token=None, body=None, tests=None, extra_headers=None, raw_url=None):
    headers = []
    if token:
        headers.append({"key": "Authorization", "value": "Bearer {{%s}}" % token})
    for k, v in (extra_headers or {}).items():
        headers.append({"key": k, "value": v})
    r = {"method": method, "header": headers,
         "url": {"raw": raw_url or ("{{base}}" + path), "host": ["{{base}}"], "path": []}}
    # Postman only needs raw; keep structure minimal but valid
    r["url"] = raw_url or ("{{base}}" + path)
    if body is not None:
        r["header"].append({"key": "Content-Type", "value": "application/json"})
        r["body"] = {"mode": "raw", "raw": body if isinstance(body, str) else json.dumps(body, indent=2),
                     "options": {"raw": {"language": "json"}}}
    item = {"name": name, "request": r}
    if tests:
        item["event"] = [{"listen": "test", "script": {"type": "text/javascript", "exec": tests.strip().split("\n")}}]
    return item

def login_test(var):
    return f"""
const j = pm.response.json();
pm.test("200 OK and access token returned", () => {{ pm.response.to.have.status(200); pm.expect(j.accessToken).to.be.a("string"); }});
pm.globals.set("{var}", j.accessToken);
"""

items = []

items.append({"name": "1 Auth", "item": [
    req("01 Register (201)", "POST", "/auth/register",
        body='{\n  "name": "Report Student",\n  "email": "student{{$timestamp}}@example.test",\n  "password": "Password123"\n}',
        tests='pm.test("201 Created, no password hash returned", () => { pm.response.to.have.status(201); pm.expect(pm.response.text()).to.not.include("passwordHash"); });'),
    req("02 Register invalid body (400)", "POST", "/auth/register",
        body='{\n  "name": "A",\n  "email": "not-an-email",\n  "password": "short"\n}',
        tests='pm.test("400 with field messages", () => pm.response.to.have.status(400));'),
    req("03 Register duplicate email (409)", "POST", "/auth/register",
        body='{\n  "name": "Lina Again",\n  "email": "lead@inspectflow.demo",\n  "password": "Password123"\n}',
        tests='pm.test("409 Conflict", () => pm.response.to.have.status(409));'),
    req("04 Login Lead (200)", "POST", "/auth/login",
        body='{\n  "email": "lead@inspectflow.demo",\n  "password": "Demo@12345"\n}', tests=login_test("leadToken")),
    req("05 Login Developer (200)", "POST", "/auth/login",
        body='{\n  "email": "dev@inspectflow.demo",\n  "password": "Demo@12345"\n}', tests=login_test("devToken")),
    req("06 Login Tester (200)", "POST", "/auth/login",
        body='{\n  "email": "tester@inspectflow.demo",\n  "password": "Demo@12345"\n}', tests=login_test("testerToken")),
    req("07 Login Client (200)", "POST", "/auth/login",
        body='{\n  "email": "client@inspectflow.demo",\n  "password": "Demo@12345"\n}', tests=login_test("clientToken")),
    req("08 Login wrong password (401)", "POST", "/auth/login",
        body='{\n  "email": "lead@inspectflow.demo",\n  "password": "WrongPassword1"\n}',
        tests='pm.test("401 same message as unknown email", () => pm.response.to.have.status(401));'),
]})

items.append({"name": "2 Authorization", "item": [
    req("09 Projects without token (401)", "GET", "/projects",
        tests='pm.test("401 Unauthorized", () => pm.response.to.have.status(401));'),
    req("10 Projects as Lead (200)", "GET", "/projects", token="leadToken",
        tests="""
const p = pm.response.json().find(x => x.name.startsWith("Acme"));
pm.test("Lead sees the demo project with role LEAD", () => { pm.response.to.have.status(200); pm.expect(p.myRole).to.eql("LEAD"); });
pm.globals.set("projectId", p.id);
"""),
    req("11 Tester edits project settings (403)", "PATCH", "/projects/{{projectId}}", token="testerToken",
        body='{\n  "name": "Hacked name"\n}',
        tests='pm.test("403 Forbidden for Tester role", () => pm.response.to.have.status(403));'),
    req("12 Other project id (404 hidden)", "GET", "/projects/11111111-1111-4111-8111-111111111111", token="devToken",
        tests='pm.test("404, existence not revealed", () => pm.response.to.have.status(404));'),
    req("13 Tester opens overview (403)", "GET", "/projects/{{projectId}}/overview", token="testerToken",
        tests='pm.test("403 Forbidden", () => pm.response.to.have.status(403));'),
    req("14 Lead overview (200)", "GET", "/projects/{{projectId}}/overview", token="leadToken",
        tests='pm.test("200 OK", () => pm.response.to.have.status(200));'),
    req("15 Project members (200)", "GET", "/projects/{{projectId}}/members", token="leadToken",
        tests='pm.test("200 OK", () => pm.response.to.have.status(200));'),
]})

items.append({"name": "3 Tickets", "item": [
    req("16 List tickets: search, sort, page (200)", "GET", "/projects/{{projectId}}/tickets?q=button&sort=severity&order=desc&page=1&limit=5",
        token="devToken", raw_url="{{base}}/projects/{{projectId}}/tickets?q=button&sort=severity&order=desc&page=1&limit=5",
        tests="""
const j = pm.response.json();
pm.test("200 with pagination metadata", () => { pm.response.to.have.status(200); pm.expect(j).to.have.keys("items","total","page","limit"); });
const t = j.items[0]; pm.globals.set("ticketId", t.id);
"""),
    req("17 List tickets bad sort (400)", "GET", "/projects/{{projectId}}/tickets?sort=password", token="devToken",
        raw_url="{{base}}/projects/{{projectId}}/tickets?sort=password",
        tests='pm.test("400 invalid query value", () => pm.response.to.have.status(400));'),
    req("18 Ticket detail with evidence (200)", "GET", "/tickets/{{ticketId}}", token="devToken",
        tests='pm.test("200 with events, annotations and signed screenshot URL", () => { const j = pm.response.json(); pm.response.to.have.status(200); pm.expect(j.events.length).to.be.above(0); pm.expect(j.artifacts[0].url).to.include("sig="); });'),
    req("19 Tester starts work (403)", "POST", "/tickets/{{ticketId}}/status", token="testerToken",
        body='{\n  "status": "IN_PROGRESS"\n}',
        tests='pm.test("403 Tester cannot start work", () => pm.response.to.have.status(403));'),
    req("20 Developer starts work (201)", "POST", "/tickets/{{ticketId}}/status", token="devToken",
        body='{\n  "status": "IN_PROGRESS",\n  "note": "Reproduced locally, working on a fix."\n}',
        tests='pm.test("201 status is IN_PROGRESS", () => { pm.response.to.have.status(201); pm.expect(pm.response.json().status).to.eql("IN_PROGRESS"); });'),
    req("21 Developer verifies own fix (403)", "POST", "/tickets/{{ticketId}}/status", token="devToken",
        body='{\n  "status": "VERIFIED"\n}',
        tests='pm.test("403, skipping steps and self-verification refused", () => pm.response.to.have.status(403));'),
    req("22 Link branch (201)", "POST", "/tickets/{{ticketId}}/link", token="devToken",
        body='{\n  "branch": "fix/pay-button",\n  "prNumber": 12\n}',
        tests='pm.test("201 branch and PR stored", () => { pm.response.to.have.status(201); pm.expect(pm.response.json().prNumber).to.eql(12); });'),
    req("23 Link invalid branch name (400)", "POST", "/tickets/{{ticketId}}/link", token="devToken",
        body='{\n  "branch": "bad branch;rm"\n}',
        tests='pm.test("400 validation error", () => pm.response.to.have.status(400));'),
]})

items.append({"name": "4 Builds and approval", "item": [
    req("24 Builds as Client (200)", "GET", "/projects/{{projectId}}/builds", token="clientToken",
        tests="""
const b = pm.response.json().find(x => x.status === "IN_REVIEW");
pm.test("Client sees non-draft builds with blocking counts", () => { pm.response.to.have.status(200); pm.expect(b.blockingTickets).to.be.above(0); });
pm.globals.set("buildId", b.id);
"""),
    req("25 Review page data (200)", "GET", "/builds/{{buildId}}/review", token="clientToken",
        tests='pm.test("canApprove is false while blocking tickets exist", () => pm.expect(pm.response.json().canApprove).to.eql(false));'),
    req("26 Approve with blocking tickets (409)", "POST", "/builds/{{buildId}}/decision", token="clientToken",
        body='{\n  "decision": "APPROVED",\n  "note": "Ship it"\n}',
        tests='pm.test("409 approval blocked", () => pm.response.to.have.status(409));'),
    req("27 Developer approves build (403)", "POST", "/builds/{{buildId}}/decision", token="devToken",
        body='{\n  "decision": "APPROVED"\n}',
        tests='pm.test("403 only Tester/Client may decide", () => pm.response.to.have.status(403));'),
    req("28 Register a build (201)", "POST", "/projects/{{projectId}}/builds", token="devToken",
        body='{\n  "name": "Sprint 3: search",\n  "branch": "release/sprint-3",\n  "commitSha": "1a2b3c4d5e6f",\n  "previewUrl": "http://localhost:4000"\n}',
        tests='pm.test("201 build created as DRAFT", () => { pm.response.to.have.status(201); pm.expect(pm.response.json().status).to.eql("DRAFT"); });'),
]})

items.append({"name": "5 Widget and webhook", "item": [
    req("29 Widget config without key (401)", "GET", "/widget/config",
        tests='pm.test("401 missing key", () => pm.response.to.have.status(401));'),
    req("30 Widget config foreign origin (403)", "GET", "/widget/config",
        extra_headers={"X-InspectFlow-Key": "if_pk_demo_acme_staging_key_0001", "Origin": "https://evil.example"},
        tests='pm.test("403 origin not allowed", () => pm.response.to.have.status(403));'),
    req("31 Widget config allowed origin (200)", "GET", "/widget/config",
        extra_headers={"X-InspectFlow-Key": "if_pk_demo_acme_staging_key_0001", "Origin": "http://localhost:4000"},
        tests='pm.test("200 and capture list returned", () => { pm.response.to.have.status(200); pm.expect(pm.response.json().captures.length).to.be.above(2); });'),
    req("32 GitHub webhook bad signature (401)", "POST", "/webhooks/github",
        body='{\n  "action": "closed",\n  "number": 12,\n  "repository": { "full_name": "demo-org/acme-shop" },\n  "pull_request": { "number": 12, "merged": true, "head": { "ref": "fix/pay-button" } }\n}',
        extra_headers={"X-GitHub-Event": "pull_request", "X-GitHub-Delivery": "report-bad-sig-1", "X-Hub-Signature-256": "sha256=0000000000000000000000000000000000000000000000000000000000000000"},
        tests='pm.test("401 invalid signature rejected", () => pm.response.to.have.status(401));'),
    req("33 Health (200)", "GET", "/health",
        tests='pm.test("200 database up", () => pm.expect(pm.response.json().database).to.eql("up"));'),
]})

collection = {
    "info": {"name": "InspectFlow API (report)", "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"},
    "variable": [{"key": "base", "value": BASE}],
    "item": items,
}
out = os.path.join(HERE, "InspectFlow.postman_collection.json")
json.dump(collection, open(out, "w", encoding="utf-8"), indent=2)
print("wrote", out, sum(len(g["item"]) for g in items), "requests")
