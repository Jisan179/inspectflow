# InspectFlow স্টাডি গাইড (বাংলায়, শুরু থেকে)

এই গাইডটা তাদের জন্য, যারা HTML, CSS, JavaScript হালকা জানে কিন্তু আধুনিক ওয়েব ডেভেলপমেন্ট (backend, database, login, hosting) জানে না। পড়ার পর আপনি বলতে পারবেন প্রজেক্টে কী চলছে, কীভাবে চলছে, কোন কোড কোথায়, এবং ডিফেন্সে কী জিজ্ঞেস করলে কী বলবেন।

এই গাইডের কোড-অংশগুলো প্রজেক্ট থেকে সরাসরি নেওয়া। পড়ার সময় VS Code-এ ওই ফাইল খুলে মিলিয়ে নিন। আপনার অংশ হলো **Tester অ্যাক্টর**, তাই সেই অংশটা সবচেয়ে বিস্তারিত।

---

## ভাগ ১. প্রজেক্টটা আসলে কী

### সমস্যা
একটা ওয়েব এজেন্সি ক্লায়েন্টের জন্য ওয়েবসাইট বানায়। লাইভ করার আগে সাইটটা একটা **staging** (পরীক্ষামূলক) ঠিকানায় রাখা হয়। ক্লায়েন্ট বা টেস্টার সেটা দেখে ভুল পায়, তারপর WhatsApp-এ লেখে: "চেকআউট কাজ করছে না।" ডেভেলপার জানে না কোন পেজে, কোন ব্রাউজারে, কী error এসেছিল। কয়েকবার মেসেজ আদান-প্রদান হয়, সময় যায়।

### আমাদের সমাধান: InspectFlow
1. টেস্টার staging সাইটে একটা **"Report issue"** বাটন দেখে (এটা আমাদের বানানো **widget**, একটা ছোট JavaScript ফাইল)।
2. বাটনে চাপলে পেজের স্ক্রিনশট আসে। টেস্টার তীর ও বক্স আঁকে, গোপন তথ্যে blur দেয়, আর কী ভুল লেখে।
3. widget নিজে নিজেই জমা রাখে: কোন পেজ, কোন ব্রাউজার, স্ক্রিনের মাপ, console-এর error, ব্যর্থ নেটওয়ার্ক রিকোয়েস্ট।
4. সব মিলিয়ে সার্ভারে একটা **ticket** তৈরি হয়। ডেভেলপার ড্যাশবোর্ডে দেখে, ঠিক করে, "Resolved" করে।
5. টেস্টার দেখে ঠিক হয়েছে কিনা: হলে **Verified**, না হলে আবার **Open**।
6. ক্লায়েন্ট একটা নির্দিষ্ট **build** (সফটওয়্যারের একটা সংস্করণ) অনুমোদন (approve) করে। অনুমোদন স্থায়ীভাবে সেই build-এর commit নম্বরের সাথে সংরক্ষিত থাকে। গুরুতর ticket বাকি থাকলে অনুমোদন আটকে যায়।
7. GitHub-এ কোড merge হলে ticket নিজে নিজে Resolved হয় (webhook)।

### চারজন অ্যাক্টর (ব্যবহারকারীর ধরন)
| অ্যাক্টর | কে | কী করে |
|---|---|---|
| **Tester / Client Reviewer** (আপনার) | টেস্টার বা ক্লায়েন্ট | widget দিয়ে বাগ রিপোর্ট, ফিক্স verify বা reopen, build approve |
| Developer | ডেভেলপার | ticket দেখে, কাজ শুরু ও Resolved, build তৈরি |
| Project Lead | প্রজেক্টের মালিক | সদস্য ও role, widget key, GitHub সংযোগ, সবকিছু |
| GitHub | বাইরের সিস্টেম | merge হলে সার্ভারকে জানায় |

একটা জিনিস মনে রাখবেন: কোডে এই role-এর নাম `TESTER_CLIENT`, `DEVELOPER`, `LEAD`। এটা **প্রজেক্ট ধরে** ঠিক হয়। একই মানুষ এক প্রজেক্টে Lead, অন্যটায় Tester হতে পারে।

---

## ভাগ ২. বড় ছবি: কী কী অংশ আছে

```
   টেস্টার (ব্রাউজার)
        |
        |  staging সাইটে widget ফাইল বসানো
        v
 +----------------+    HTTPS (JSON/ছবি)    +--------------------+     +---------------------+
 | ডেমো staging   | ---------------------> |   API (NestJS)     | --> | PostgreSQL (Supabase)|
 | সাইট + widget  |                        |   Render-এ চলে     |     |  টেবিলে সব তথ্য     |
 +----------------+                        |                    | --> | ছবির bucket (private)|
                                           +--------------------+     +---------------------+
 +----------------+    HTTPS                 ^       ^
 | ড্যাশবোর্ড     | -------------------------+       |
 | (Next.js,Vercel)|                                  | GitHub (সই করা webhook)
 +----------------+                                   |
```

**চারটা প্রোগ্রাম** আমরা লিখেছি, সব `apps/` ফোল্ডারে:

| ফোল্ডার | কী | ভাষা/টুল | কোথায় চলে |
|---|---|---|---|
| `apps/api` | সার্ভার (ব্যাকএন্ড): সব নিয়ম, লগইন, ডেটাবেস | TypeScript, NestJS, Prisma | Render |
| `apps/web` | ড্যাশবোর্ড (যা ব্রাউজারে দেখা যায়) | TypeScript, Next.js, React, Tailwind | Vercel |
| `apps/widget` | সেই ছোট বাটন + স্ক্রিনশট এডিটর | TypeScript, html2canvas, Konva | staging সাইটে বসে |
| `apps/staging` | ডেমো সাইট (সাধারণ HTML, CSS, JS), যেখানে widget বসানো | HTML, CSS, JavaScript | Vercel |

**ডেটাবেস** আলাদা প্রোগ্রাম, কোডে লেখা নয়। এটা Supabase-এর PostgreSQL।

### TypeScript কী?
JavaScript-এর মতোই, কিন্তু ভ্যারিয়েবলের ধরন (টাইপ) লিখতে হয়: `name: string`, `age: number`। ভুল ধরন দিলে কোড চালানোর আগেই VS Code লাল দাগ দেয়। ফাইলের নাম `.ts`। `.tsx` মানে React-এর HTML-সদৃশ অংশ আছে।

---

## ভাগ ৩. প্রয়োজনীয় শব্দ (সহজ উপমায়)

| শব্দ | সহজ কথায় |
|---|---|
| **API** | সার্ভারের "জানালা"। অন্য প্রোগ্রাম ঠিকানা (URL) দিয়ে অনুরোধ পাঠায়, উত্তর পায়। |
| **REST API** | ঠিকানা + ক্রিয়ার নিয়ম: `GET` (দেখা), `POST` (বানানো), `PATCH` (বদলানো), `DELETE` (মোছা)। যেমন `GET /projects` মানে প্রজেক্টের তালিকা দাও। |
| **JSON** | তথ্য পাঠানোর ফরম্যাট: `{ "name": "Tara", "age": 20 }` |
| **HTTP status code** | উত্তরের ফলাফল: `200` ঠিক, `201` তৈরি হলো, `400` তুমি ভুল তথ্য দিয়েছ, `401` তুমি কে চিনি না, `403` চিনি কিন্তু তোমার অনুমতি নেই, `404` পাইনি, `409` সংঘর্ষ (যেমন ইমেইল আগেই আছে), `429` খুব বেশি অনুরোধ, `500` সার্ভারের ভুল |
| **Database (ডেটাবেস)** | বড় এক্সেল ফাইলের মতো: টেবিল (শিট), সারি (row), কলাম। আমরা PostgreSQL ব্যবহার করি। |
| **Primary key (PK)** | প্রতি সারির অনন্য পরিচয় (`id`) |
| **Foreign key (FK)** | অন্য টেবিলের সারির দিকে ইঙ্গিত, যেমন Ticket-এর `projectId` কোন প্রজেক্টের |
| **ORM / Prisma** | SQL না লিখে TypeScript-এ ডেটাবেসের সাথে কথা বলার টুল: `prisma.user.findUnique(...)` |
| **Migration** | ডেটাবেসের কাঠামো বদলানোর সংরক্ষিত ধাপ (SQL ফাইল)। যেকোনো নতুন ডেটাবেসে এগুলো চালালে হুবহু একই টেবিল তৈরি হয়। |
| **Seed** | ডেমো ডেটা (ব্যবহারকারী, প্রজেক্ট, ticket) বসানোর স্ক্রিপ্ট |
| **Hash** | পাসওয়ার্ডকে এমন গোলমেলে লেখায় বদলানো, যা থেকে আসল পাসওয়ার্ড ফেরত পাওয়া যায় না। আমরা **bcrypt** ব্যবহার করি। |
| **JWT (টোকেন)** | লগইনের পর সার্ভার যে "প্রবেশপত্র" দেয়। পরের প্রতি অনুরোধে সেটা দেখাতে হয়। বিস্তারিত ভাগ ৭-এ। |
| **Guard** | দরজার প্রহরী। অনুরোধ ভেতরে ঢোকার আগে চেক করে: টোকেন আছে? অনুমতি আছে? |
| **DTO** | ইনপুটের "ফর্ম"। কোন ঘরে কী ধরনের তথ্য আসতে পারবে তার নিয়ম। ভুল হলে 400। |
| **Transaction** | একসাথে কয়েকটা কাজ, হয় সবগুলো হবে, নয় একটাও না (ATM-এ টাকা কাটা আর দেওয়া যেমন) |
| **Environment variable (.env)** | সিক্রেট ও সেটিং (পাসওয়ার্ড, ঠিকানা), যা কোডে লেখা হয় না, আলাদা রাখা হয় |
| **CORS** | ব্রাউজারের নিয়ম: কোন ওয়েবসাইট আমার API ডাকতে পারবে |
| **Webhook** | অন্য সেবা (GitHub) আমাদের ঠিকানায় নিজে থেকে খবর পাঠায় |
| **Middleware / Interceptor** | প্রতিটি অনুরোধের পথে বসানো ছোট কাজ (লগ রাখা, সময় মাপা) |

---

## ভাগ ৪. ফোল্ডারের মানচিত্র

```
inspectflow/
├─ apps/
│  ├─ api/                     <- ব্যাকএন্ড
│  │  ├─ prisma/
│  │  │  ├─ schema.prisma      <- ডেটাবেসের নকশা (সবচেয়ে গুরুত্বপূর্ণ)
│  │  │  ├─ migrations/        <- নকশা থেকে তৈরি SQL ধাপ (২টা)
│  │  │  └─ seed.ts            <- ডেমো ডেটা
│  │  ├─ src/
│  │  │  ├─ main.ts            <- সার্ভার চালু হয় এখান থেকে
│  │  │  ├─ app.setup.ts       <- নিরাপত্তা, CORS, validation চালু
│  │  │  ├─ app.module.ts      <- সব মডিউল জোড়া, global guard
│  │  │  ├─ config/            <- .env পড়া ও যাচাই
│  │  │  ├─ common/            <- সবার ব্যবহারের টুকরো (guard, filter, sanitize)
│  │  │  ├─ providers/         <- ডেটাবেস (prisma) ও storage (ছবি) সংযোগ
│  │  │  └─ modules/           <- এক ফিচার = এক ফোল্ডার
│  │  │     ├─ auth/  users/  access/  projects/
│  │  │     ├─ tickets/  builds/  reports/  files/  github/  activity/
│  │  └─ test/                 <- স্বয়ংক্রিয় টেস্ট
│  ├─ web/                     <- ড্যাশবোর্ড (Next.js)
│  ├─ widget/                  <- widget
│  └─ staging/                 <- ডেমো সাইট
├─ docs/                       <- ডকুমেন্ট, রিপোর্ট
├─ scripts/                    <- সাহায্যকারী স্ক্রিপ্ট
├─ render.yaml                 <- Render-এ কীভাবে চলবে
└─ .github/workflows/          <- স্বয়ংক্রিয় টেস্ট, keepalive
```

**NestJS-এর নিয়ম:** প্রতিটি ফিচার-ফোল্ডারে সাধারণত চারটা জিনিস থাকে।
- `xxx.controller.ts`: ঠিকানা ধরে (`@Get`, `@Post`)। কাজ শুধু অনুরোধ নেওয়া ও service-কে দেওয়া।
- `xxx.service.ts`: আসল যুক্তি ও ডেটাবেসের কাজ।
- `dto/xxx.dto.ts`: ইনপুটের নিয়ম।
- `xxx.module.ts`: এই চারটাকে একসাথে বাঁধে।

---

## ভাগ ৫. ডেটাবেস কীভাবে তৈরি হলো

### ধাপ ১: নকশা লেখা (`apps/api/prisma/schema.prisma`)
এই একটা ফাইলে ডেটাবেসের সবকিছু লেখা। উদাহরণ:

```prisma
model Ticket {
  id        String   @id @default(uuid())      // অনন্য পরিচয়
  projectId String                              // কোন প্রজেক্টের (FK)
  number    Int                                 // IF-1, IF-2 ... প্রজেক্ট অনুযায়ী
  title     String
  severity  TicketSeverity @default(MEDIUM)     // LOW/MEDIUM/HIGH/BLOCKER
  status    TicketStatus   @default(OPEN)       // OPEN/IN_PROGRESS/RESOLVED/VERIFIED
  ...
  @@unique([projectId, number])                 // একই প্রজেক্টে একই number দুবার না
}
```

`enum` মানে "নির্দিষ্ট কয়েকটা মানের তালিকা", যেমন `TicketStatus`। এতে ভুল বানান ঢুকতে পারে না।

### ধাপ ২: মোট ১৩টা টেবিল
| টেবিল | কী রাখে |
|---|---|
| `User` | ব্যবহারকারী: নাম, ইমেইল (অনন্য), `passwordHash` (আসল পাসওয়ার্ড নয়) |
| `Project` | প্রজেক্ট: নাম, staging ঠিকানা, widget key-র hash, অনুমোদিত সাইটের তালিকা, GitHub repo, `nextTicketNo` |
| `Membership` | কে কোন প্রজেক্টে কোন role-এ। **অনুমতির উৎস এটাই** |
| `Build` | build: নাম, branch, `commitSha`, অবস্থা (DRAFT/IN_REVIEW/APPROVED/REJECTED) |
| `BuildApproval` | কে কখন approve বা change চাইল, নোট, **কোন commit** |
| `Ticket` | বাগ রিপোর্ট |
| `Annotation` | ticket-এর ছবিতে আঁকা তীর, বক্স, blur-এর বিবরণ |
| `Artifact` | সংরক্ষিত স্ক্রিনশট ফাইলের তথ্য (ফাইল নিজে ডেটাবেসে না, bucket-এ) |
| `CapturedEvent` | console error, ব্যর্থ রিকোয়েস্ট |
| `Comment` | ticket-এর মন্তব্য |
| `WebhookDelivery` | GitHub-এর পাঠানো ঘটনার তালিকা (`deliveryId` অনন্য) |
| `RefreshToken` | লগইনের refresh টোকেনের hash (logout করলে বাতিল করার জন্য) |
| `ActivityLog` | কে কী করল তার ইতিহাস |

**Tester-এর কাজে সবচেয়ে বেশি যেসব টেবিল:** `Membership`, `Ticket`, `Annotation`, `Artifact`, `CapturedEvent`, `Comment`, `BuildApproval`।

### ধাপ ৩: নকশা থেকে আসল টেবিল (migration)
1. নকশা লেখার পর Prisma-কে বলা হলো: "এই নকশা ও খালি ডেটাবেসের তফাত থেকে SQL বানাও।" ফলে `prisma/migrations/20261114104700_init/migration.sql` ফাইলটা তৈরি হলো। ওই ফাইলে `CREATE TABLE "Ticket" (...)` ধরনের লাইন আছে।
2. দ্বিতীয় migration `..._github_repo_unique` পরে যোগ হয়েছে (GitHub repo-র নাম অনন্য করতে)।
3. কোনো ডেটাবেসে `prisma migrate deploy` চালালে সব migration ক্রমানুসারে চলে এবং টেবিল তৈরি হয়। **Render-এ প্রতিবার সার্ভার চালুর আগে এই কমান্ড নিজে চলে** (`render.yaml`-এ `startCommand` দেখুন)।
4. `prisma generate` নকশা থেকে TypeScript-এর জন্য "প্রিসমেড" কোড বানায়, তাই `prisma.ticket.create({...})` লিখলে VS Code বলে দেয় কোন কোন ঘর আছে।

### ধাপ ৪: ডেমো ডেটা (seed) (`prisma/seed.ts`)
চারজন ডেমো ব্যবহারকারী (সবাই কাল্পনিক) তৈরি হয়:
- `lead@inspectflow.demo` (Lead), `dev@inspectflow.demo` (Developer), `tester@inspectflow.demo` ও `client@inspectflow.demo` (দুজনই Tester/Client role)
- পাসওয়ার্ড `Demo@12345` (সার্ভারে hash হয়ে রাখা হয়)
- একটা ডেমো প্রজেক্ট "Acme Shop", কয়েকটা build ও ticket।

### সম্পর্কগুলো কেমন (ER diagram-এর সারকথা)
- একজন User অনেক প্রজেক্টে থাকতে পারে, একটা প্রজেক্টে অনেক User থাকতে পারে। মাঝখানের সেতু হলো `Membership`, যেখানে role-ও আছে।
- Project → অনেক Build, অনেক Ticket।
- Ticket → অনেক Annotation, Artifact, CapturedEvent, Comment।
- Build → অনেক BuildApproval।
- প্রজেক্ট মুছলে তার সব ডেটা মুছে যায় (`onDelete: Cascade`)। কিন্তু যে User কোনো ticket বা approval করেছে তাকে মোছা যায় না (`Restrict`), যাতে ইতিহাস অক্ষুণ্ণ থাকে।

---

## ভাগ ৬. ব্যাকএন্ড চালু হওয়া ও একটা অনুরোধের যাত্রা

### সার্ভার চালু (`src/main.ts`)
```ts
const app = await NestFactory.create(AppModule, { rawBody: true });
configureApp(app);                       // নিরাপত্তা ইত্যাদি চালু
SwaggerModule.setup("api/docs", ...);    // /api/docs-এ ডকুমেন্ট পাতা
await app.listen(env.PORT, "0.0.0.0");   // অনুরোধ শোনা শুরু
```
`rawBody: true` মানে আসা অনুরোধের আসল বাইটগুলো রেখে দেওয়া। GitHub webhook-এর সই যাচাইয়ে এটা লাগে।

### `src/app.setup.ts` এ কী চালু হয়
- **Helmet**: নিরাপত্তা সংক্রান্ত HTTP header।
- **CORS**: ড্যাশবোর্ড রুটে শুধু নির্দিষ্ট ওয়েবসাইট (আমাদের Vercel ঠিকানা) API ডাকতে পারবে। widget রুটে (`/widget/*`, `/reports`) যেকোনো সাইট পাঠাতে পারে, কিন্তু সার্ভার নিজে প্রজেক্টের অনুমোদিত সাইট তালিকা মিলিয়ে দেখে।
- **ValidationPipe**: প্রতিটি DTO-র নিয়ম চালায়। অচেনা ঘর (`forbidNonWhitelisted`) থাকলে 400।
- **AllExceptionsFilter**: সব ভুলের উত্তর একই আকারে (`success:false, statusCode, message, path`)। stack trace বা ডেটাবেসের ভেতরের বার্তা কখনো বাইরে যায় না।

### প্রহরীদের ক্রম (`src/app.module.ts`)
```ts
providers: [
  { provide: APP_GUARD, useClass: JwtGuard },          // ১. টোকেন আছে?
  { provide: APP_GUARD, useClass: ProjectRolesGuard }, // ২. এই প্রজেক্টের সদস্য? role ঠিক?
  { provide: APP_GUARD, useClass: ThrottlerGuard },    // ৩. বেশি অনুরোধ করছে না তো?
]
```
এগুলো **global**: মানে প্রতিটি রুটে স্বয়ংক্রিয়ভাবে চলে। যে রুট টোকেন ছাড়া খোলা রাখতে হবে (login, register, health, webhook, widget) সেখানে `@Public()` বসানো।

### একটা অনুরোধের পুরো যাত্রা (উদাহরণ: Tester `GET /projects/:id/tickets` চাইল)
1. ব্রাউজার বা Postman `Authorization: Bearer <টোকেন>` সহ অনুরোধ পাঠায়।
2. `RequestLoggerMiddleware` লগ রাখে (query string বাদ, যাতে টোকেন লগে না যায়)।
3. `JwtGuard` + `JwtStrategy`: টোকেনের সই ও মেয়াদ যাচাই, ব্যবহারকারী ডেটাবেসে আছে কিনা দেখা।
4. `ProjectRolesGuard`: ঠিকানায় `projectId` আছে, তাই `ProjectAccessService.requireMember` চালিয়ে দেখে ব্যবহারকারী ওই প্রজেক্টের সদস্য কিনা।
5. `ThrottlerGuard`: মিনিটে ৩০০-র বেশি অনুরোধ নয় তো।
6. `TicketsController` → `TicketsService`: ডেটাবেস থেকে ticket আনে। **Tester হলে** শুধু তার নিজের রিপোর্ট করা ticket আনে (`where.reporterId = user.id`)।
7. `TimingInterceptor` `X-Response-Time` header বসায়। উত্তর ফেরত যায়।

---

## ভাগ ৭. লগইন ও টোকেন জেনারেশন (ধাপে ধাপে)

এটা ডিফেন্সের সবচেয়ে সম্ভাব্য প্রশ্ন।

### কেন টোকেন?
HTTP প্রতি অনুরোধে আগের কথা ভুলে যায়। তাই প্রতিবার ইমেইল-পাসওয়ার্ড পাঠানোর বদলে, লগইনের পর সার্ভার একটা **টোকেন** দেয়। পরের অনুরোধে ওটা দেখালেই চলে।

### JWT-এর গঠন
`xxxxx.yyyyy.zzzzz` তিনটা অংশ, `.` দিয়ে আলাদা:
- **Header**: কোন অ্যালগরিদম।
- **Payload**: তথ্য, আমাদের ক্ষেত্রে `{ "sub": "ব্যবহারকারীর id", "email": "...", "exp": মেয়াদের সময় }`।
- **Signature**: header + payload-কে সার্ভারের গোপন চাবি (`JWT_ACCESS_SECRET`) দিয়ে সই করা।

গুরুত্বপূর্ণ: payload **এনক্রিপ্ট করা নয়**, যে কেউ পড়তে পারে (তাই ভেতরে পাসওয়ার্ড রাখি না)। কিন্তু **বদলানো যায় না**: কেউ payload বদলালে সই মিলবে না, সার্ভার 401 দেয়। সই বানানোর চাবি শুধু সার্ভারের কাছে।

### Register (`src/modules/auth/auth.service.ts`)
```ts
async register(dto: RegisterDto) {
  const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
  if (existing) throw new ConflictException("Email is already registered");   // 409

  const user = await this.prisma.user.create({
    data: {
      name: dto.name.trim(),
      email: dto.email,
      passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),  // ১২ রাউন্ড
    },
  });
  return this.buildSession(user);
}
```
- আসল পাসওয়ার্ড কোথাও রাখা হয় না। শুধু bcrypt hash।
- bcrypt ইচ্ছে করে ধীর (১২ রাউন্ড), যাতে কেউ ডেটাবেস চুরি করলেও কোটি কোটি পাসওয়ার্ড দ্রুত চেষ্টা করতে না পারে।
- ইনপুট যাচাই `dto/auth.dto.ts`-এ: নাম ২-৮০ অক্ষর, ইমেইল ঠিক ধরনের, পাসওয়ার্ড ৮-৭২ অক্ষর (bcrypt ৭২ বাইটের বেশি পড়ে না)।

### Login (একই ফাইলে `verifyCredentials`)
```ts
const user = await this.prisma.user.findUnique({ where: { email } });
const ok = user && (await bcrypt.compare(password, user.passwordHash));
if (!user || !ok) throw new UnauthorizedException("Invalid email or password");
```
ইমেইল ভুল আর পাসওয়ার্ড ভুল, দুই ক্ষেত্রেই **একই বার্তা**। এতে আক্রমণকারী জানতে পারে না কোন ইমেইল আমাদের সিস্টেমে আছে।

### টোকেন বানানো (`buildSession`)
```ts
const accessToken = await this.jwt.signAsync(
  { sub: user.id, email: user.email },
  { secret: env.JWT_ACCESS_SECRET, expiresIn: "15m" },
);
const refreshToken = randomSecret(48);              // ৪৮ বাইটের র‍্যান্ডম স্ট্রিং
await this.prisma.refreshToken.create({ data: {
  userId: user.id,
  tokenHash: sha256(refreshToken),                   // শুধু hash সংরক্ষণ
  expiresAt: new Date(Date.now() + 7 * 86_400_000),  // ৭ দিন
}});
```
দুই ধরনের টোকেন কেন?
- **Access token**: ১৫ মিনিটের স্বল্পায়ু। প্রতি অনুরোধে পাঠানো হয়। চুরি হলেও ক্ষতির সময় কম।
- **Refresh token**: ৭ দিনের। শুধু নতুন access token নিতে ব্যবহার হয়। ডেটাবেসে কেবল hash রাখা, তাই ডেটাবেস ফাঁস হলেও ব্যবহারযোগ্য না। **একবার ব্যবহারে বাতিল** হয়ে নতুন জোড়া আসে (`refresh()`), logout-এ বাতিল হয় (`logout()`)।

### টোকেন যাচাই (`jwt.strategy.ts` ও `jwt.guard.ts`)
```ts
super({ jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        ignoreExpiration: false, secretOrKey: env.JWT_ACCESS_SECRET });

async validate(payload) {
  if (payload.scope) throw new UnauthorizedException("Invalid token scope"); // widget টোকেন চলবে না
  const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) throw new UnauthorizedException("Account no longer exists");
  return user;     // এটাই req.user হয়ে যায়
}
```
টোকেনের সই ঠিক না বা মেয়াদ শেষ হলে Passport নিজেই 401 দেয়।

### ড্যাশবোর্ড টোকেন ধরে রাখে কীভাবে (`apps/web/src/lib/api.ts`)
- লগইনের পর দুই টোকেন ব্রাউজারের `localStorage`-এ রাখে।
- প্রতি অনুরোধে `Authorization: Bearer` header বসায়।
- 401 আসলে refresh টোকেন দিয়ে একবার নতুন টোকেন নিয়ে অনুরোধ আবার পাঠায়। তা-ও ব্যর্থ হলে `/login`-এ পাঠিয়ে দেয়।

### সীমাবদ্ধতা (সৎভাবে বলবেন)
`localStorage`-এ টোকেন রাখলে সাইটে cross-site-scripting ফাঁক থাকলে চুরি যেতে পারে। React সব লেখা নিজে escape করে, আর আমরা সার্ভারে লেখা plain data হিসেবে রাখি, এভাবে ঝুঁকি কমানো হয়েছে। রিপোর্টের Known limits-এ এটা লেখা আছে।

---

## ভাগ ৮. অনুমতি (authorization): কে কী করতে পারবে

### Authentication বনাম Authorization
- **Authentication**: তুমি কে? (লগইন, টোকেন)
- **Authorization**: তুমি কী করতে পারো? (role)

### Membership থেকে role (`modules/access/project-access.service.ts`)
```ts
const membership = await this.prisma.membership.findUnique({
  where: { userId_projectId: { userId, projectId } },
});
if (!membership) throw new NotFoundException("Project not found");        // 404
if (roles?.length && !roles.includes(membership.role)) {
  throw new ForbiddenException("Your project role does not allow this action"); // 403
}
```
- সদস্য না হলে **404** (বলে দেওয়া হয় না যে প্রজেক্টটা আসলে আছে, যাতে কেউ আন্দাজে খুঁজে বের করতে না পারে)।
- সদস্য কিন্তু role ঠিক নয়: **403**।

### রুটে role বসানো
`@ProjectRoles(ProjectRole.LEAD)` লিখলে শুধু Lead ওই রুট চালাতে পারে। এটা `common/decorators/project-roles.decorator.ts`-এ।

### Ticket-এর অবস্থা ও কে বদলাতে পারে (`modules/tickets/ticket-workflow.ts`)
```ts
export const TRANSITIONS = {
  OPEN:        { IN_PROGRESS: [DEVELOPER, LEAD], RESOLVED: [DEVELOPER, LEAD] },
  IN_PROGRESS: { OPEN: [DEVELOPER, LEAD],        RESOLVED: [DEVELOPER, LEAD] },
  RESOLVED:    { VERIFIED: [TESTER_CLIENT, LEAD], OPEN: [TESTER_CLIENT, LEAD] },
  VERIFIED:    { OPEN: [TESTER_CLIENT, LEAD] },
};
```
**মূল নিয়ম:** ডেভেলপার কাজ করে (শুরু, Resolved)। **টেস্টার নিশ্চিত করে (Verified) বা ফেরত দেয় (Open)।** ডেভেলপার নিজের ঠিক করা কাজ নিজে Verified করতে পারে না। এটা আপনার অংশের বড় পয়েন্ট।

### Blocking ticket
Severity `HIGH` বা `BLOCKER` আর অবস্থা `VERIFIED` না, এমন ticket build অনুমোদন আটকায়। এমনকি Resolved হলেও আটকায়, কারণ টেস্টার যাচাই না করা পর্যন্ত নিশ্চিত না।

---

## ভাগ ৯. আপনার অংশ: Tester অ্যাক্টরের পুরো যাত্রা

নিচের প্রতিটি ধাপে বলা আছে কোন ফাইলে কী। এই পুরো যাত্রাটা একটা কাহিনী হিসেবে মুখস্থ করুন।

### ধাপ ক. staging সাইটে widget বসানো (`apps/staging/src/index.html`)
```html
<script src="inspectflow-widget.js" data-key="{{WIDGET_KEY}}" data-api="{{API_URL}}" defer></script>
```
একটা `<script>` ট্যাগ। `data-key` হলো প্রজেক্টের পাবলিক key (`if_pk_...`), `data-api` হলো সার্ভারের ঠিকানা। বিল্ডের সময় `{{...}}` জায়গায় আসল মান বসে।

### ধাপ খ. widget চালু (`apps/widget/src/index.ts`)
```ts
const client = new ApiClient(api, key);                       // সার্ভারের সাথে কথা বলার জন্য
const collector = new Collector({ capacity: 100, ignoreUrlPrefixes: [api] });
collector.install();                                          // পেজের error ধরা শুরু
const ui = new WidgetUi({ api: client, collector, projectKey: key, ... });
```
**ক্রমটা গুরুত্বপূর্ণ:** আগে `ApiClient` আসল `fetch` ফাংশন নিয়ে রাখে, তারপর `Collector` `fetch` বদলে দেয়। নইলে widget-এর নিজের অনুরোধও "ব্যর্থ রিকোয়েস্ট" হিসেবে রেকর্ড হতো।

### ধাপ গ. পেছনে ঘটনা জমানো (`collector.ts`, `ring-buffer.ts`)
Collector চুপচাপ এগুলো ধরে:
- `console.error(...)` (মূল ফাংশনকে মুড়ে দিয়ে, `patchConsole`)
- `window.onerror` ও `unhandledrejection` (ধরা না পড়া error)
- `fetch` ও `XMLHttpRequest` যেগুলো ব্যর্থ হলো (`patchFetch`, `patchXhr`)

**RingBuffer** শেষ ১০০টা ঘটনা রাখে, ১০১তম আসলে সবচেয়ে পুরনোটা বাদ যায়। তাই মেমরি অসীম বাড়ে না।

**কী রাখে না:** request বা response-এর header ও body, cookie, localStorage। শুধু method, URL (গোপন query মান মুছে), status code ও সময়। টেস্টারকে পাঠানোর আগে সবকিছু দেখানো হয়।

### ধাপ ঘ. Tester লগইন (`widget/src/ui.ts` `showLogin` → `api.ts` `login` → সার্ভারে `POST /widget/login`)
সার্ভারে (`reports.service.ts`, `widgetLogin`):
```ts
const user = await this.auth.verifyCredentials(email, dto.password);  // একই bcrypt যাচাই
const membership = await this.prisma.membership.findUnique({...});
if (!membership) throw new UnauthorizedException("You are not a member of this project");
const accessToken = await this.jwt.signAsync(
  { sub: user.id, scope: "widget", pid: project.id },      // এই টোকেন শুধু এই প্রজেক্টের widget-এর
  { secret: env.JWT_ACCESS_SECRET, expiresIn: "2h" },
);
```
- widget টোকেনে `scope: "widget"` ও `pid` (প্রজেক্ট) আছে। এটা **ড্যাশবোর্ড API-তে চলে না** (`JwtStrategy.validate` `scope` থাকলে অস্বীকার করে)।
- অর্থাৎ staging সাইটে লগইন করা টেস্টার ওই টোকেন দিয়ে অন্য কিছু করতে পারবে না।

### ধাপ ঙ. widget-এর নিরাপত্তা প্রহরী (`reports/widget.guard.ts`)
`/widget/*` ও `/reports` রুটে JWT global guard নেই, বদলে `WidgetGuard`:
1. **key যাচাই**: `X-InspectFlow-Key` header। শুরুর ১৪ অক্ষর (prefix) দিয়ে প্রজেক্ট খুঁজে, পুরো key-র SHA-256 hash ডেটাবেসের hash-এর সাথে `safeEqual` (সময়-নিরাপদ তুলনা) করে। key-র আসল রূপ ডেটাবেসে নেই।
2. **Origin যাচাই**: ব্রাউজারের `Origin` header প্রজেক্টের `allowedOrigins` তালিকায় আছে কিনা। না থাকলে **403** (Figure 6.11)। এটা **সার্ভারে** হয়, শুধু CORS-এ নয়, কারণ CORS কেবল ব্রাউজারকে আটকায়, Postman বা curl-কে না।
3. **widget টোকেন**: `Bearer` টোকেন যাচাই, `scope === "widget"` ও `pid` প্রজেক্টের সাথে মেলে কিনা, এবং ব্যবহারকারী সদস্য কিনা।

আর `@Throttle`: লগইনে মিনিটে ১০ বার, widget অনুরোধে মিনিটে ২০ বার সীমা (brute force আটকাতে)।

### ধাপ চ. স্ক্রিনশট ও এডিটর (`capture.ts`, `editor.ts`)
- `html2canvas` পেজের **দৃশ্যমান অংশ** DOM থেকে আবার এঁকে একটা `canvas` ছবি বানায়। এটা সত্যিকারের স্ক্রিন ক্যাপচার নয়, তাই কিছু CSS, ভিন্ন-সাইটের ছবি, iframe, video ঠিক আসে না। এটা প্রস্তাবনায় মেনে নেওয়া সীমাবদ্ধতা।
- `editor.ts`-এ Konva দিয়ে ARROW, BOX, BLUR আঁকা, undo, redo।

### ধাপ ছ. Blur যা আর ফেরানো যায় না (`widget/src/redact.ts`)
এটা আপনার সবচেয়ে শক্ত পয়েন্ট। সাধারণ "blur" ছবির উপর একটা আবরণ, নিচে আসল পিক্সেল থেকে যায়। আমরা তা করি না:
```ts
export function pixelate(data, width, height, rect, block = blockSizeFor(rect)) {
  for (let by = y0; by < y1; by += block) {
    for (let bx = x0; bx < x1; bx += block) {
      // ওই ব্লকের সব পিক্সেলের রঙের গড় বের করো
      // তারপর ব্লকের সব পিক্সেলে সেই এক রঙ লিখে দাও (আসল পিক্সেল মুছে যায়)
    }
  }
}
```
- ব্লক বড় (কমপক্ষে ১২ পিক্সেল), তাই লেখা পড়া যায় না।
- গড় নেওয়া **many-to-one**: বিভিন্ন আসল পিক্সেল একই গড় দেয়, তাই গড় থেকে আসলটা ফেরত পাওয়া অসম্ভব।
- ফাংশন সরাসরি ছবির ডেটা (`data`) বদলে দেয়। uploaded ছবিতে আসল অংশটার কোনো কপি থাকে না।
- `editor.export()` মূল স্ক্রিনশট আবার এঁকে সব blur অংশে `pixelate` চালায়, তারপর ওপরে তীর-বক্স বসায়, আর **শুধু এই চ্যাপ্টা (flattened) PNG** আপলোড হয়।
- প্রমাণ: unit test (`widget/test/redact.test.ts`) এবং আসল রানে সংরক্ষিত ছবির blur অংশে ৪৯,২৮৮ পিক্সেলে মাত্র ৯১টা ভিন্ন রং ছিল (বড় সমতল ব্লক)।

### ধাপ জ. রিপোর্ট পাঠানো (`widget/src/api.ts` `submit` → `POST /reports`)
`FormData` দিয়ে দুটো জিনিস পাঠায়: `payload` (JSON: বিবরণ, severity, পেজের URL, ব্রাউজার, ঘটনাগুলো, annotations) আর `screenshot` (PNG ফাইল)।

### ধাপ ঝ. সার্ভারে গ্রহণ (`reports.controller.ts` → `reports.service.ts` `submit`)
```ts
const payload = await this.parsePayload(rawPayload);          // JSON ঠিক? DTO নিয়ম মানে?
const image = await this.images.validateAndProcess(file?.buffer, file?.mimetype);
const storageKey = `tickets/${project.id}/${randomUUID()}.png`;
await this.storage.put(storageKey, image.buffer, image.mimeType);   // private bucket-এ রাখা
try {
  const ticket = await this.tickets.create({ ..., events: sanitizeEvents(payload.events), ... });
  return { id: ticket.id, number: ticket.number, status: ticket.status };
} catch (error) {
  await this.storage.delete(storageKey);     // ডেটাবেসে ব্যর্থ হলে ফাইলও মুছে দাও
  throw error;
}
```
সার্ভার যা যাচাই করে (**widget-এর কথায় বিশ্বাস করে না**):
- ছবির আকার সর্বোচ্চ ৫ MB, MIME ধরন (png/jpeg/webp), এবং **magic bytes** (ফাইলের প্রথম বাইট, যা আসল ধরন বলে দেয়)। নাম বদলে `.exe`-কে `.png` বানালে ধরা পড়ে (`files/image.service.ts`)।
- ছবি **sharp** লাইব্রেরি দিয়ে আবার PNG এনকোড হয় (লুকানো ডেটা বা metadata মুছে যায়)।
- `sanitizeEvents` (`common/utils/sanitize.ts`): `Bearer` টোকেন, JWT, `password`, `token`, `api_key`, `cookie`, `session` নামের মান `[REDACTED]` হয়; URL-এ গোপন query মান মোছা; সর্বোচ্চ ২০০ ঘটনা।
- widget-ও একই কাজ করে, সার্ভার আবার করে। **দুই স্তরের প্রতিরক্ষা**।

### ধাপ ঞ. Ticket তৈরি, transaction সহ (`tickets/tickets.service.ts` `create`)
```ts
return this.prisma.$transaction(async (tx) => {
  const { nextTicketNo } = await tx.project.update({
    where: { id: input.projectId },
    data: { nextTicketNo: { increment: 1 } },        // প্রজেক্টের কাউন্টার বাড়ানো
    select: { nextTicketNo: true },
  });
  const ticket = await tx.ticket.create({ data: {
    number: nextTicketNo - 1,
    ...,
    events: { create: input.events ?? [] },
    annotations: { create: input.annotations ?? [] },
    artifacts: input.artifact ? { create: { kind: ArtifactKind.SCREENSHOT, ...input.artifact } } : undefined,
  }});
  await this.activity.log({...}, tx);
  return ticket;
});
```
- Ticket, evidence, annotation, screenshot-record আর activity log **একসাথে** তৈরি হয়। মাঝে কিছু ব্যর্থ হলে সব বাতিল, তাই "অর্ধেক ticket" থাকতে পারে না।
- `update` কাউন্টার সারি লক করে, তাই দুজন একসাথে রিপোর্ট দিলে একই নম্বর (IF-5) পায় না।

### ধাপ ট. Tester ticket দেখে (`tickets.service.ts`)
- তালিকায়: `if (role === TESTER_CLIENT) where.reporterId = user.id;` অর্থাৎ শুধু নিজের রিপোর্ট।
- বিস্তারিতে: অন্যের ticket হলে 404; আর `events: role === TESTER_CLIENT ? false : {...}` অর্থাৎ **টেস্টার technical console/network লগ দেখে না**, ডেভেলপাররা দেখে।
- স্ক্রিনশট দেখানো হয় **signed URL** দিয়ে: ৫ মিনিটের মেয়াদি ঠিকানা (`SIGNED_URL_TTL_SECONDS=300`), কারণ bucket private।

### ধাপ ঠ. Verify বা Reopen
ডেভেলপার Resolved করলে টেস্টার `POST /tickets/:id/status` দিয়ে `VERIFIED` বা `OPEN` করে। `ticket-workflow.ts`-এর টেবিল দেখে অনুমতি ঠিক হয়। ডেভেলপার চেষ্টা করলে 403 (`Postman`-এ দেখানো যায়)।

### ধাপ ড. Build approve (`modules/builds/builds.service.ts` `decide`)
```ts
await this.access.requireMember(user.id, build.projectId, [TESTER_CLIENT]);   // শুধু Tester/Client
...
return this.prisma.$transaction(async (tx) => {
  await tx.$queryRaw`SELECT id FROM "Build" WHERE id = ${buildId} FOR UPDATE`;  // সারি লক
  const locked = await tx.build.findUniqueOrThrow({ where: { id: buildId } });
  if (locked.status !== BuildStatus.IN_REVIEW) throw new ConflictException(...); // আগেই সিদ্ধান্ত হয়ে গেছে

  if (dto.decision === ApprovalDecision.APPROVED) {
    const blocking = await tx.ticket.count({ where: { buildId, ...blockingWhere } });
    if (blocking > 0) throw new ConflictException(`Cannot approve: ${blocking} blocking ticket(s) are not verified yet`);
  }
  const approval = await tx.buildApproval.create({ data: { buildId, userId: user.id,
    decision: dto.decision, note: dto.note?.trim() || null, commitSha: locked.commitSha }});
  const updated = await tx.build.update({ where: { id: buildId }, data: { status: approved ? APPROVED : REJECTED }});
  await this.activity.log({...}, tx);
  return { approval, build: updated };
});
```
ব্যাখ্যা:
1. `FOR UPDATE`: ওই build সারি লক। দুজন ক্লায়েন্ট একসাথে ক্লিক করলে একজন অপেক্ষা করে, পরে দেখে "আর IN_REVIEW নেই", 409। test-এ তিনটা একসাথে পাঠিয়ে দেখা হয়েছে মাত্র একটা সফল হয় (`builds.e2e-spec.ts`)।
2. Blocking ticket থাকলে approve 409। এটা ব্যবসায়িক নিয়ম: যাচাই না করা গুরুতর বাগসহ build অনুমোদন চলবে না।
3. `commitSha` সেই মুহূর্তে build থেকে কপি করা হয়, তাই পরে build বদলালেও প্রমাণ থাকে "কোন কোড অনুমোদিত হয়েছিল"।
4. "Changes requested" দিলে নোট বাধ্যতামূলক (400 না দিলে)।
5. Draft build ক্লায়েন্ট দেখতেই পায় না (404)।
6. Transaction-এর মাঝে যেকোনো ধাপ ব্যর্থ হলে পুরোটা rollback (Figure 6.13)।

### ধাপ ঢ. ড্যাশবোর্ডে Tester-এর পেজ
`apps/web/src/app/app/` এর ভেতরে:
- `projects/[projectId]/tickets/page.tsx`: তালিকা, ফিল্টার
- `tickets/[ticketId]/page.tsx`: ticket বিস্তারিত, ছবি, status বাটন (শুধু অনুমোদিত বাটন দেখায়)
- `projects/[projectId]/builds/page.tsx` ও `builds/[buildId]/page.tsx`: build review ও approve বাটন

এই পেজগুলো `lib/api.ts` দিয়ে ব্যাকএন্ডকে ডাকে। ইন্টারফেস শুধু বাটন লুকায়, **আসল নিরাপত্তা সার্ভারের guard-এ**। ফ্রন্টএন্ডের বাটন লুকানো নিরাপত্তা নয়, কারণ কেউ সরাসরি API ডাকতে পারে।

---

## ভাগ ১০. আরও নিরাপত্তা ও ভালো চর্চা

| বিষয় | কোথায় | কী |
|---|---|---|
| পাসওয়ার্ড | `auth.service.ts` | bcrypt hash |
| টোকেন | `auth.service.ts` | স্বল্পায়ু access, single-use refresh, hash করে রাখা |
| ইনপুট যাচাই | `dto/*.ts`, `app.setup.ts` | class-validator, অচেনা ঘর বাতিল |
| SQL injection | Prisma | প্যারামিটারযুক্ত কোয়েরি, নিজে SQL জোড়া লাগাই না (এক জায়গায় `$queryRaw` লক-এর জন্য, তা-ও প্যারামিটারযুক্ত) |
| ফাইল আপলোড | `files/image.service.ts` | আকার, ধরন, magic bytes, পুনঃএনকোড |
| Rate limit | `ThrottlerGuard` | লগইনে ১০/মিনিট, widget-এ ২০/মিনিট, সাধারণ ৩০০/মিনিট |
| ডেটা ফাঁস | সব `service`-এ | `passwordHash`, key hash, webhook secret কখনো উত্তরে যায় না |
| ভুলের বার্তা | `all-exceptions.filter.ts` | stack trace বাইরে যায় না |
| ছবি | Supabase private bucket | সরাসরি লিংক নেই, ৫ মিনিটের signed URL |
| সিক্রেট | `.env`, Render env | কোডে বা Git-এ নেই |

---

## ভাগ ১১. GitHub webhook (অন্যদের অংশ, কিন্তু গল্পের অংশ)
`modules/github/github.controller.ts` ও `github.service.ts`:
1. GitHub merge হলে `POST /webhooks/github` পাঠায়, সাথে `X-Hub-Signature-256`।
2. সার্ভার raw body-কে প্রজেক্টের webhook secret দিয়ে HMAC-SHA256 করে সই মেলায় (সময়-নিরাপদ তুলনা)। ভুল হলে 401।
3. `WebhookDelivery` টেবিলে `deliveryId` অনন্য, তাই একই ঘটনা দ্বিতীয়বার এলে insert ব্যর্থ হয়ে transaction rollback, উত্তর `duplicate: true`।
4. merged pull request হলে ওই প্রজেক্টের লিঙ্ক করা ticket Resolved হয়।

---

## ভাগ ১২. টেস্টিং
- **API টেস্ট (Jest + আসল PostgreSQL)**: `apps/api/test/*.e2e-spec.ts` (auth, projects-authz, tickets, builds, reports, github, rate-limit, crud-extras) ও `src/**/*.spec.ts`। মোট ১৬২টা, সব পাস।
- **Widget টেস্ট (Jest + jsdom)**: `apps/widget/test/*.test.ts`, ২১টা পাস (blur অপরিবর্তনীয়, ring buffer, console/fetch/XHR ধরা, secret মোছা)।
- **কোন টেস্ট কী প্রমাণ করে** (Tester অংশের জন্য): `reports.e2e-spec.ts` (widget থেকে রিপোর্ট জমা, ভুল origin/key/ফাইল বাতিল), `builds.e2e-spec.ts` (approval, race, ভুল role), `tickets.e2e-spec.ts` (lifecycle, Tester সীমা), `projects-authz.e2e-spec.ts` (অন্য প্রজেক্টে 404)।
- চালানোর কমান্ড: `pnpm test` (রুট ফোল্ডারে, লোকাল ডেটাবেস লাগে)।

---

## ভাগ ১৩. ফ্রি হোস্টিং: কী করা হয়েছে (ওভারভিউ)

| সেবা | কাজ | কেন |
|---|---|---|
| **GitHub** | কোড রাখা। এখান থেকে Render ও Vercel কোড টানে | ফ্রি, `main`-এ পুশ করলে স্বয়ংক্রিয় ডিপ্লয় |
| **Supabase** | PostgreSQL ডেটাবেস + private ছবির bucket | ফ্রি, কার্ড লাগে না |
| **Render** | API চালানো (`render.yaml` থেকে) | ফ্রি, কিন্তু ১৫ মিনিট নিষ্ক্রিয় থাকলে ঘুমায় |
| **Vercel** | ড্যাশবোর্ড ও ডেমো সাইট | ফ্রি, দ্রুত, Next.js-এর জন্য তৈরি |

### ধাপগুলো
1. **Supabase**: নতুন প্রজেক্ট। ডেটাবেসের connection URL (session pooler) নেওয়া হলো। Storage-এ `inspectflow-screenshots` নামের **private** bucket, আর S3 access key জোড়া।
2. **Render**: GitHub রিপো সংযুক্ত, Blueprint দিয়ে `render.yaml` পড়ে service তৈরি। Environment variable বসানো:
   - `DATABASE_URL` (Supabase-এর URL; পাসওয়ার্ডে `#` থাকলে `%23` লিখতে হয়, নইলে URL কেটে যায়, আমাদের প্রথম ডিপ্লয় এভাবেই ব্যর্থ হয়েছিল)
   - `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `STORAGE_DRIVER=s3`
   - `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `COOKIE_SECRET` (Render নিজে বানিয়েছে)
   - `FRONTEND_URL`, `CORS_ORIGINS` (ড্যাশবোর্ডের Vercel ঠিকানা)
   - `PUBLIC_API_URL` (Render-এর নিজের ঠিকানা)
   - চালুর কমান্ড: migration চালাও, তারপর সার্ভার চালু। প্রথমবার ডেমো ডেটার জন্য `RUN_SEED=true` দিয়ে একবার চালিয়ে পরে `false`।
3. **Vercel**: দুটো আলাদা প্রজেক্ট (একই রিপো): Root Directory `apps/web` (ড্যাশবোর্ড) ও `apps/staging` (ডেমো সাইট)। ড্যাশবোর্ডে `NEXT_PUBLIC_API_URL` = Render-এর ঠিকানা।
4. **সংযোগ**: সব ঠিকানা পরস্পরকে জানানো, তারপর smoke test (২১টা চেক পাস)।
5. **ঘুম**: Render ফ্রি প্ল্যানে ১৫ মিনিট পর ঘুমায়, জাগতে প্রায় ১ মিনিট। তাই প্রদর্শনের আগে `https://inspectflow-api.onrender.com/health` খুলে জাগিয়ে নিন।

বিস্তারিত: `docs/DEPLOYMENT.md`।

---

## ভাগ ১৪. ডিফেন্সের সম্ভাব্য প্রশ্ন ও উত্তর

**১. টোকেন কীভাবে তৈরি হয়?**
লগইনে ইমেইল-পাসওয়ার্ড মিললে `auth.service.ts`-এর `buildSession` JWT বানায় (`sub`, `email`, মেয়াদ ১৫ মিনিট), সার্ভারের গোপন চাবি দিয়ে সই করে। সাথে একটা র‍্যান্ডম refresh টোকেন, যার শুধু hash ডেটাবেসে থাকে।

**২. JWT কি নিরাপদ? কেউ বদলে ফেললে?**
payload পড়া যায় কিন্তু বদলালে সই মেলে না, 401। চাবি শুধু সার্ভারের কাছে। তাই ভেতরে পাসওয়ার্ড রাখি না।

**৩. পাসওয়ার্ড কীভাবে রাখো?**
bcrypt hash, ১২ রাউন্ড, আসল পাসওয়ার্ড কোথাও না।

**৪. Authentication আর authorization-এর তফাত?**
Authentication: তুমি কে (টোকেন)। Authorization: কী করতে পারো (Membership role)।

**৫. 401 আর 403 আর 404 কখন?**
401: টোকেন নেই বা ভুল। 403: সদস্য কিন্তু role-এর অনুমতি নেই। 404: তুমি ওই প্রজেক্টের সদস্য না, আমরা অস্তিত্বই জানাই না।

**৬. Tester কী পারে, কী পারে না?**
পারে: widget দিয়ে রিপোর্ট, নিজের ticket দেখা, Resolved ticket Verified বা Open, build approve বা change request। পারে না: অন্যের ticket বা technical লগ দেখা, কাজ শুরু করা, প্রজেক্ট সেটিং বদলানো, overview দেখা।

**৭. Blur কীভাবে অপরিবর্তনীয়?**
পিক্সেল ব্লকের গড় রং দিয়ে আসল পিক্সেল **ওভাররাইট** করি। গড় থেকে আসল ফেরানো যায় না। শুধু চ্যাপ্টা ছবি আপলোড হয়। `redact.ts`।

**৮. Widget-এর key সবাই দেখতে পায়, তাহলে নিরাপত্তা কোথায়?**
key পাবলিক পরিচয়। নিরাপত্তা আসে (ক) অনুমোদিত origin তালিকা সার্ভারে যাচাই, (খ) লগইন করা টেস্টারের widget টোকেন, (গ) ওই টোকেন শুধু ওই প্রজেক্টে, (ঘ) rate limit।

**৯. CORS থাকলে origin চেক আবার কেন?**
CORS শুধু ব্রাউজারকে আটকায়। Postman বা curl আটকায় না। তাই সার্ভারেও `Origin` মিলিয়ে দেখি।

**১০. Transaction কেন?**
Ticket তৈরিতে কয়েক টেবিল বদলায়। মাঝপথে ব্যর্থ হলে অর্ধেক ডেটা থাকত। Transaction-এ সব সফল বা কিছুই না। Approval-এও একই।

**১১. দুজন একসাথে approve চাপলে?**
সারি লক (`FOR UPDATE`): একজন সফল, অন্যজন 409। test আছে।

**১২. Build approval-এ commit কেন সংরক্ষণ?**
"কোন কোড অনুমোদিত হয়েছিল" তার প্রমাণ। পরে build বদলালেও রেকর্ড অপরিবর্তিত।

**১৩. Migration কী, কেন?**
ডেটাবেসের কাঠামো বদলের সংরক্ষিত ধাপ। যেকোনো খালি ডেটাবেসে চালালে হুবহু একই টেবিল। Render-এ প্রতিবার চালুর সময় চলে।

**১৪. Prisma কেন, TypeORM নয়?**
প্রস্তাবনায় Prisma নির্দিষ্ট ছিল। ইনস্ট্রাক্টরের গাইডে TypeORM-এর কথা আছে, তাই এটা আগে জিজ্ঞেস করে নিন, ইনস্ট্রাক্টর মেনে নিয়েছেন কিনা।

**১৫. DTO কী?**
ইনপুটের নিয়মের ক্লাস। `ValidationPipe` ভুল ইনপুট আটকায়, 400।

**১৬. ফ্রি হোস্টিংয়ে কী সীমা?**
Render ১৫ মিনিট পর ঘুমায় (প্রথম অনুরোধে প্রায় ১ মিনিট), ফাইল সিস্টেম স্থায়ী নয় (তাই ছবি Supabase-এ), ফ্রি ডেটাবেস ৩০ দিনে মুছে যায় (তাই Supabase)।

**১৭. কোনটা আপনি নিজে বানিয়েছেন, কোনটা AI-র সাহায্যে?**
সৎভাবে বলুন: প্রজেক্টটা Claude (AI সহায়ক) এর সাহায্যে বানানো, রিপোর্টের AI usage কলামে তা লেখা। আপনি প্রতিটি অংশ পড়ে, চালিয়ে বুঝেছেন, এবং ব্যাখ্যা করতে পারেন।

**১৮. আসল GitHub merge দিয়ে পরীক্ষা করেছ?**
না, সঠিক সই করা অনুরোধ দিয়ে পরীক্ষা হয়েছে। সৎ উত্তর রিপোর্টে লেখা আছে।

**১৯. widget-এর সীমাবদ্ধতা?**
html2canvas DOM থেকে আবার আঁকে, তাই কিছু CSS, ভিন্ন-সাইটের ছবি, iframe, video ঠিক আসে না।

**২০. পরে কী যোগ করবে?**
আসল GitHub merge পরীক্ষা, ইমেইল বিজ্ঞপ্তি, session replay, browser extension, Playwright দিয়ে UI টেস্ট।

---

## ভাগ ১৫. কোন ক্রমে পড়বেন (৩ দিনের পরিকল্পনা)

**দিন ১: বুঝুন**
1. এই গাইডের ভাগ ১-৫ পড়ুন।
2. `prisma/schema.prisma` খুলে `User`, `Membership`, `Ticket`, `BuildApproval` দেখুন।
3. রিপোর্টের ER diagram (Figure 3.2) ও use case diagram (Figure 3.1) দেখুন।

**দিন ২: কোড পড়ুন (আপনার অংশ)**
1. `auth.service.ts` (লগইন, টোকেন), `jwt.strategy.ts`, `jwt.guard.ts`।
2. `project-access.service.ts`, `project-roles.guard.ts`, `ticket-workflow.ts`।
3. `widget.guard.ts`, `reports.service.ts`, `tickets.service.ts` (`create`)।
4. `builds.service.ts` (`decide`)।
5. widget: `index.ts`, `collector.ts`, `redact.ts`, `sanitize.ts`।

**দিন ৩: চালিয়ে দেখুন ও অনুশীলন**
1. Postman-এ লগইন, টোকেন, 401/403/409 চালান (রিপোর্টের Chapter 6 মিলিয়ে)।
2. ড্যাশবোর্ডে `tester@inspectflow.demo` দিয়ে ঢুকে ticket ও build দেখুন, আর `dev@inspectflow.demo` দিয়ে একই ticket দেখে তফাত লক্ষ করুন।
3. স্যারের কাছে ধাপে ধাপে ভাগ ৯-এর কাহিনী বলার অনুশীলন করুন (ধাপ ক থেকে ড)।
4. ভাগ ১৪-র প্রশ্নগুলো নিজে জোরে উত্তর দিন।

---

## শেষ কথা
- আপনার মূল গল্প: **"Tester একটা বাটনে চেপে স্ক্রিনশট, আঁকা, আর স্বয়ংক্রিয় টেকনিক্যাল তথ্যসহ রিপোর্ট পাঠায়। সার্ভার সব যাচাই করে একটা ticket তৈরি করে। ডেভেলপার ঠিক করলে Tester যাচাই করে, তারপর ক্লায়েন্ট নির্দিষ্ট commit-এর build অনুমোদন করে।"** এই এক বাক্য থেকে পুরো ডিফেন্স গড়ানো যায়।
- কোনো প্রশ্নের উত্তর না জানলে আন্দাজে বলবেন না। "এই ফাইলে দেখাচ্ছি" বলে কোড খুলে দেখান।
- কোড পড়ে কোনো জায়গা না বুঝলে আমাকে ফাইলের নাম ও লাইন দিন, আমি ব্যাখ্যা করব।
