import { createRequire } from "node:module";
import fs from "node:fs";
const req = createRequire(process.cwd() + "/package.json");
const { build } = req("esbuild");
const { chromium, expect } = req("@playwright/test");
// Staff checks use real components with isolated response fixtures, not authenticated E2E.
const base = process.env.UI_BASE_URL || "http://localhost:3111";
const output = process.env.UI_QA_OUTPUT || "/private/tmp/bb-ui-refactor";
fs.mkdirSync(output, { recursive: true });
const slice = process.env.UI_QA_SLICE || "all";
const widths = [375, 390, 430, 768, 1024, 1280, 1440, 1920];
const nav = `import React from 'react';export const go=url=>{window.__auditPath=url;window.dispatchEvent(new Event('audit-route'))};export function usePathname(){return React.useSyncExternalStore(cb=>{window.addEventListener('audit-route',cb);return()=>window.removeEventListener('audit-route',cb)},()=>window.__auditPath||'/erp')}export function useParams(){const path=usePathname();return React.useMemo(()=>({section:path.split('?')[0].split('/').slice(2)}),[path])}export function useSearchParams(){const path=usePathname();return React.useMemo(()=>new URLSearchParams(path.split('?')[1]),[path])}export function useRouter(){return{push:go,refresh(){}}}export const notFound=()=>{throw Error('not found')};`;
const link = `import React from 'react';import{go}from'next/navigation';export default function Link({href,onClick,children,...props}){return <a {...props} href={href} onClick={e=>{onClick?.(e);if(!e.defaultPrevented&&!props.target){e.preventDefault();go(href)}}}>{children}</a>}`;
const img = `import React from'react';export default function Image({fill,unoptimized,priority,preload,...props}){return <img {...props}/>} `;
const measure = () => {
  const visible = (e) => {
    const r = e.getBoundingClientRect(),
      s = getComputedStyle(e);
    return (
      r.width > 0 &&
      r.height > 0 &&
      s.visibility !== "hidden" &&
      s.display !== "none" &&
      r.right > 0 &&
      r.left < innerWidth
    );
  };
  const small = [
    ...document.querySelectorAll(
      "button,a,input[type=checkbox],input[type=radio]",
    ),
  ]
    .filter(visible)
    .map((e) => {
      const r = e.getBoundingClientRect();
      return {
        label: (e.getAttribute("aria-label") || e.textContent || e.tagName)
          .trim()
          .slice(0, 65),
        width: Math.round(r.width),
        height: Math.round(r.height),
      };
    })
    .filter((r) => r.width < 24 || r.height < 24);
  const unlabelled = [
    ...document.querySelectorAll("input:not([type=hidden]),select,textarea"),
  ]
    .filter(visible)
    .filter(
      (e) =>
        !e.getAttribute("aria-label") &&
        !e.getAttribute("aria-labelledby") &&
        !e.labels?.length,
    )
    .map((e) => ({
      tag: e.tagName,
      type: e.type,
      class: e.className,
      placeholder: e.getAttribute("placeholder"),
    }));
  const overflow = [...document.querySelectorAll("main *")]
    .filter((e) => {
      const r = e.getBoundingClientRect();
      return (
        visible(e) &&
        r.right > innerWidth + 2 &&
        !e.closest(".erp-table-wrap,.table-scroll")
      );
    })
    .slice(0, 5)
    .map((e) => ({
      tag: e.tagName,
      class: e.className,
      right: Math.round(e.getBoundingClientRect().right),
    }));
  return {
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
    scrollWidth: document.documentElement.scrollWidth,
    smallTargets: small.slice(0, 8),
    unlabelled,
    overflowElements: overflow,
    headings: [...document.querySelectorAll("h1")]
      .filter(visible)
      .map((e) => e.textContent.trim()),
    tables: [...document.querySelectorAll(".erp-table-wrap")].map((e) => ({
      scrolls: e.scrollWidth > e.clientWidth,
      keyboardFocusable: e.tabIndex >= 0,
    })),
    sidebar: document.querySelector(".erp-sidebar")
      ? {
          width: Math.round(
            document.querySelector(".erp-sidebar").getBoundingClientRect()
              .width,
          ),
          offscreen:
            document.querySelector(".erp-sidebar").getBoundingClientRect()
              .right <= 0,
          hiddenLinksInTabOrder: [
            ...document.querySelectorAll(".erp-sidebar a[href]"),
          ].filter((e) => e.tabIndex >= 0).length,
        }
      : null,
  };
};
(async () => {
  const browser = await chromium.launch();
  const p = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    colorScheme: "light",
  });
  const results = {
    widths,
    public: [],
    erp: [],
    states: [],
    dialogs: [],
    errors: [],
  };
  p.setDefaultTimeout(10000);
  p.on("pageerror", (e) => results.errors.push(e.message));
  await p.route("**/api/branding", (r) => r.fulfill({ json: { logoUrl: "" } }));
  let publicLong = false;
  await p.route("**/api/public/**", (r) =>
    r.fulfill({
      json: {
        clinic: {
          clinicName: publicLong
            ? "BB Dental Clinic ".repeat(40)
            : "BB Dental Clinic",
        },
        services: [
          {
            id: "qa-service",
            name: "Шүдний үзлэг",
            category: "Үзлэг",
            price: 45000,
          },
        ],
        doctors: [
          { id: "qa-doctor", name: "Содбилэг", specialty: "Шүдний эмч" },
        ],
        suggestions: [],
        slots: [],
        appointments: [],
      },
    }),
  );
  if (slice === "all")
    for (const theme of ["light", "dark"]) {
      for (const width of widths) {
        await p.setViewportSize({ width, height: 900 });
        for (const route of [
          "/",
          "/login",
          "/register",
          "/forgot-password",
          "/reset-password",
        ]) {
          await p.goto(base + route);
          await p.locator(route === "/" ? "#home" : ".login-form").waitFor();
          await p.evaluate((theme) => {
            localStorage.setItem("bb-theme", theme);
            document.documentElement.dataset.theme = theme;
          }, theme);
          await p.evaluate(() => document.fonts.ready);
          const m = await p.evaluate(measure);
          results.public.push({ theme, width, route, ...m });
          if (m.overflow)
            await p.screenshot({
              path:
                output +
                "/public-" +
                route.replaceAll("/", "_") +
                "-" +
                width +
                ".png",
            });
        }
        console.log("public widths checked", theme, width);
      }
    }
  results.publicLong = [];
  if (slice === "all") {
    publicLong = true;
    for (const width of [375, 1440]) {
      await p.setViewportSize({ width, height: 900 });
      await p.goto(base + "/");
      await p.locator("#home").waitFor();
      await expect(p.locator(".brand-name").first()).toContainText(
        "BB Dental Clinic BB Dental Clinic",
      );
      const m = await p.evaluate(measure);
      results.publicLong.push({ width, ...m });
      if (m.overflow) throw Error("Long clinic name overflow");
    }
    publicLong = false;
  }
  await p.goto(base + "/login");
  await p.locator(".login-form").waitFor();
  const sheets = await p
    .locator("link[rel=stylesheet]")
    .evaluateAll((es) => es.map((e) => e.href));
  const css = (
    await Promise.all(
      sheets.map(async (href) => (await p.request.get(href)).text()),
    )
  ).join("\n");
  const repo = process.cwd();
  const source = `import React from'react';import{createRoot}from'react-dom/client';import{ErpShell}from'${repo}/app/erp/shell.tsx';import{ErpWorkspace}from'${repo}/app/erp/workspace.tsx';import{ClinicBrandingProvider}from'${repo}/app/components/clinic-branding.tsx';import{ThemeToggle}from'none';`;
  const entry =
    source.replace("import{ThemeToggle}from'none';", "") +
    `
const root=createRoot(document.getElementById('audit-root'));window.__auditRole='ADMIN';window.__auditMode='populated';window.__auditNavigate=path=>{window.__auditPath=path;window.dispatchEvent(new Event('audit-route'))};
const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ulaanbaatar',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const doctor={id:'qa-doctor',name:'Содбилэг',specialty:'Шүдний эмч',schedules:Array.from({length:7},(_,weekday)=>({id:'s'+weekday,weekday,startTime:'09:00',endTime:'18:00'})),leaves:[],appointments:[]};
const entity={id:'qa-record',name:'Аудитын бүртгэл',phone:'99112233',email:'audit@example.test',role:'DOCTOR',active:true,approvalStatus:'APPROVED',doctorId:'qa-doctor',patientId:'qa-patient',serviceId:'qa-service',date,startTime:'10:00',endTime:'10:30',weekday:1,kind:'BLOCKED_RANGE',status:'PENDING',amount:45000,price:45000,duration:30,quantity:5,minimum:2,sku:'QA-01',unit:'ширхэг',reason:'Аудитын шалтгаан',title:'Баримтын гарчиг',type:'CONSENT',createdAt:new Date().toISOString(),entity:'patients',entityId:'qa-patient',actorId:'qa-user',patient:{id:'qa-patient',name:'Аудитын өвчтөн',phone:'99112233'},doctor:{id:'qa-doctor',name:'Содбилэг'},service:{id:'qa-service',name:'Шүдний үзлэг'},notes:[],treatments:[],appointments:[],payments:[],transfers:[]};
window.__auditRequests=[];window.fetch=async(input,init={})=>{const path=String(input);if(init.method==='PATCH'&&path.includes('/settings/logoUrl')&&window.__auditFailPersist){await new Promise(r=>setTimeout(r,700));return new Response(JSON.stringify({error:'Persistence failed fixture'}),{status:503});}window.__auditRequests.push({path,method:init.method||'GET',body:init.body});if(path.includes('q=slow'))await new Promise(r=>setTimeout(r,900));if(init.method&&init.method!=='GET'&&window.__auditDelaySave)await new Promise(r=>setTimeout(r,900));if(init.method&&init.method!=='GET'&&window.__auditMutationError)return new Response(JSON.stringify({error:'Mutation failed fixture'}),{status:503});if(window.__auditMode==='error')return new Response(JSON.stringify({error:'Аудитын туршилтын холболтын алдаа'}),{status:503});if(window.__auditMode==='loading')return new Promise(()=>{});const empty=window.__auditMode==='empty';const data=path==='/api/upload'?{url:'/images/default-logo.png'}:path.includes('/branding')?{logoUrl:''}:path.includes('/options')?{doctors:empty?[]:[doctor],services:empty?[]:[{id:'qa-service',name:'Шүдний үзлэг',price:45000,duration:30}]}:path.includes('/roster')?(window.__auditTeam||{doctors:empty?[]:[doctor],nurses:[]}):path.includes('/telegram-settings')?{configured:false,source:'none',booking:true,transfer:true,recovery:true,canStoreToken:false}:path.includes('/settings')?{items:[{key:'clinicName',value:'BB Dental Clinic'}]}:path==='/api/profile'?{...entity,id:'qa-user',name:'Аудитын ажилтан',doctor,role:window.__auditRole}:path.includes('/patients/')?entity:path.includes('/reports')||path.includes('/dashboard')?{revenue:45000,expense:0,net:45000,appointmentCount:1,patientCount:1,statuses:{PENDING:1},methods:{CASH:45000},byService:[],byDoctor:[],monthly:[]}:path.includes('/availability')?{slots:['10:00']}: {items:empty?[]:[path.includes('q=fast')?{...entity,name:'Fast search result'}:path.includes('q=slow')?{...entity,name:'Slow search result'}:window.__auditMode==='long'?{...entity,name:'УртНэр'.repeat(80),title:'УртБаримт'.repeat(80)}:entity],total:empty?0:1};return new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}})};
window.__auditMount=role=>{window.__auditRole=role;root.render(<ClinicBrandingProvider key={role}><ErpShell user={{id:'qa-user',name:'Аудитын ажилтан',phone:'99112233',role,doctorId:role==='DOCTOR'?'qa-doctor':undefined}}><ErpWorkspace/></ErpShell></ClinicBrandingProvider>)};window.__auditMount('ADMIN');`;
  const bundle = await build({
    stdin: { contents: entry, resolveDir: repo, loader: "tsx" },
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    jsx: "automatic",
    plugins: [
      {
        name: "audit-next",
        setup(b) {
          b.onResolve({ filter: /^next\/(navigation|link|image)$/ }, (a) => ({
            path: a.path,
            namespace: "audit",
          }));
          b.onLoad({ filter: /.*/, namespace: "audit" }, (a) => ({
            contents:
              a.path === "next/navigation"
                ? nav
                : a.path === "next/link"
                  ? link
                  : img,
            loader: "tsx",
            resolveDir: repo,
          }));
        },
      },
    ],
  });
  await p.route(base + "/__ui-fixture", (r) =>
    r.fulfill({
      contentType: "text/html",
      body: '<html lang="mn"><head></head><body><div id="audit-root"></div></body></html>',
    }),
  );
  await p.goto(base + "/__ui-fixture");
  await p.addStyleTag({ content: css });
  await p.addScriptTag({ content: bundle.outputFiles[0].text });
  if (slice === "schedule") {
    const date = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ulaanbaatar",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const future = new Date(Date.parse(`${date}T12:00:00Z`) + 8 * 86400000)
      .toISOString()
      .slice(0, 10);
    const next = new Date(Date.parse(`${date}T12:00:00Z`) + 9 * 86400000)
      .toISOString()
      .slice(0, 10);
    await p.evaluate(
      ({ date, future, next }) => {
        const schedules = Array.from({ length: 7 }, (_, weekday) => ({
          id: "s" + weekday,
          weekday,
          startTime: "09:00",
          endTime: "18:00",
        }));
        window.__auditTeam = {
          doctors: [
            {
              id: "qa-doctor",
              name: "Миний эмч",
              specialty: "Шүдний эмч",
              schedules,
              leaves: [
                {
                  id: "official-day",
                  doctorId: "qa-doctor",
                  date: future,
                  startTime: "09:00",
                  endTime: "18:00",
                  kind: "SCHEDULE_OVERRIDE",
                  status: "APPROVED",
                  reason: "Official day",
                },
                {
                  id: "pending-day",
                  doctorId: "qa-doctor",
                  date: next,
                  startTime: "14:00",
                  endTime: "18:00",
                  kind: "SCHEDULE_OVERRIDE",
                  status: "PENDING",
                  reason: "Proposed day",
                },
              ],
              appointments: [],
            },
            {
              id: "colleague",
              name: "Хамт ажиллах эмч",
              specialty: "Гажиг засал",
              schedules,
              leaves: [],
              appointments: [],
            },
          ],
          nurses: [date, future].map((date, index) => ({
            id: "nurse-" + index,
            name: "Хамт ажиллах сувилагч",
            date,
            startTime: "09:00",
            endTime: "18:00",
          })),
        };
        window.__auditNavigate("/erp/schedules");
        window.__auditMount("DOCTOR");
      },
      { date, future, next },
    );
    await expect(
      p.getByRole("heading", { name: "Ажлын хуваарь", exact: true }),
    ).toBeVisible();
    await expect(
      p.getByRole("button", { name: "Ажиллах цаг засах", exact: true }),
    ).toBeDisabled();
    await expect(p.locator(".roster-day-detail")).toContainText(
      "Хамт ажиллах эмч",
    );
    await expect(p.locator(".roster-day-detail")).toContainText(
      "Хамт ажиллах сувилагч",
    );
    await p.getByLabel("Хуваарийн сар").fill(future.slice(0, 7));
    await p
      .getByRole("button", { name: new RegExp("^" + future + ":") })
      .click();
    await expect(
      p.getByRole("button", { name: "Ажиллах цаг засах", exact: true }),
    ).toBeEnabled();
    await p
      .getByRole("button", { name: "Ажиллах цаг засах", exact: true })
      .click();
    const dialog = p.getByRole("dialog");
    await dialog
      .getByRole("button", { name: "14:00–18:00", exact: true })
      .click();
    await dialog
      .getByRole("button", { name: "Хүсэлт илгээх", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    const edit = await p.evaluate(() =>
      window.__auditRequests.findLast(
        (r) =>
          r.method === "PATCH" && r.path === "/api/erp/leaves/official-day",
      ),
    );
    if (JSON.parse(edit.body).startTime !== "14:00")
      throw Error("Schedule edit did not preserve selected time");
    await expect(p.locator(".schedule-own-day")).toContainText("09:00–18:00");
    await p
      .getByRole("button", { name: "Хуваарь цуцлах", exact: true })
      .click();
    await p
      .getByRole("button", { name: "Цуцлах хүсэлт баталгаажуулах" })
      .click();
    await expect(p.getByRole("dialog")).toHaveCount(0);
    if (
      !(await p.evaluate(() =>
        window.__auditRequests.some(
          (r) =>
            r.method === "DELETE" && r.path === "/api/erp/leaves/official-day",
        ),
      ))
    )
      throw Error("Cancellation request missing");
    for (const role of ["DOCTOR", "ADMIN", "RECEPTION"]) {
      await p.evaluate((role) => {
        window.__auditMount(role);
        window.__auditNavigate("/erp/schedules");
      }, role);
      if (role === "RECEPTION") {
        await expect(
          p.getByRole("button", { name: "Хуваарь үүсгэх", exact: true }),
        ).toHaveCount(0);
        await expect(p.locator(".schedule-row-actions button")).toHaveCount(0);
      }
      for (const theme of ["light", "dark"]) {
        await p.evaluate(
          (theme) => (document.documentElement.dataset.theme = theme),
          theme,
        );
        for (const width of [375, 1440]) {
          await p.setViewportSize({ width, height: 1000 });
          await expect(p.locator(".roster-days button").first()).toBeVisible();
          const m = await p.evaluate(measure);
          if (m.overflow)
            throw Error(`Schedule overflow at ${width}px for ${role}`);
          await p.screenshot({
            path: `${output}/schedule-${role}-${theme}-${width}.png`,
            fullPage: true,
          });
        }
      }
    }
    await p.evaluate(() => window.__auditMount("ADMIN"));
    await p.getByLabel("Хамгаалах хоног").fill("14");
    await p.getByRole("button", { name: "Хугацаа хадгалах" }).click();
    if (
      !(await p.evaluate(() =>
        window.__auditRequests.some(
          (r) =>
            r.method === "PATCH" &&
            r.path === "/api/erp/settings/scheduleLockDays" &&
            JSON.parse(r.body).value === "14",
        ),
      ))
    )
      throw Error("Admin policy update missing");
    await p.getByRole("button", { name: "Батлах", exact: true }).click();
    if (
      !(await p.evaluate(() =>
        window.__auditRequests.some(
          (r) => r.path === "/api/erp/leave-review/pending-day",
        ),
      ))
    )
      throw Error("Admin review missing");
    for (const section of ["dashboard", "services", "patients", "settings"]) {
      await p.evaluate(
        (section) => window.__auditNavigate("/erp/" + section),
        section,
      );
      await expect(p.locator(".erp-content h1")).toHaveCount(1);
      if ((await p.evaluate(measure)).overflow)
        throw Error("Theme overflow on " + section);
    }
    if (results.errors.length) throw Error(results.errors.join("\n"));
    for (const route of ["/", "/login", "/register", "/booking"]) {
      for (const width of [375, 1440]) {
        await p.setViewportSize({ width, height: 1000 });
        await p.goto(base + route);
        await p
          .locator(
            route === "/"
              ? "#home"
              : route === "/booking"
                ? "#booking"
                : ".login-form",
          )
          .waitFor();
        for (const theme of ["light", "dark"]) {
          await p.evaluate(
            (theme) => (document.documentElement.dataset.theme = theme),
            theme,
          );
          const m = await p.evaluate(measure);
          if (m.overflow)
            throw Error(`Public theme overflow on ${route} at ${width}px`);
          await p.screenshot({
            path: `${output}/public-${route.replaceAll("/", "_")}-${theme}-${width}.png`,
            fullPage: true,
          });
        }
      }
    }
    console.log(
      "PASS schedule: month/date selection, time presets, protected dates, pending edits/cancellation, coworkers/nurses, admin policy/review, three roles, light/dark, 375/1440px and representative ERP screens.",
    );
    await browser.close();
    return;
  }
  const modules = {
    ADMIN: [
      "dashboard",
      "patients",
      "appointments",
      "calendar",
      "doctors",
      "users",
      "services",
      "treatments",
      "payments",
      "expenses",
      "inventory",
      "documents",
      "reports",
      "settings",
      "schedules",
      "leaves",
      "profile",
      "audit",
    ],
    DOCTOR: [
      "dashboard",
      "schedules",
      "calendar",
      "appointments",
      "patients",
      "treatments",
      "documents",
      "profile",
      "services",
      "doctors",
      "leaves",
    ],
    RECEPTION: [
      "dashboard",
      "patients",
      "appointments",
      "calendar",
      "payments",
      "inventory",
      "documents",
      "treatments",
      "services",
      "doctors",
      "schedules",
      "leaves",
    ],
  };
  if (slice === "all")
    for (const theme of ["light", "dark"]) {
      await p.evaluate(
        (theme) => (document.documentElement.dataset.theme = theme),
        theme,
      );
      for (const width of widths) {
        await p.setViewportSize({ width, height: 900 });
        for (const [role, sections] of Object.entries(modules)) {
          await p.evaluate((role) => window.__auditMount(role), role);
          for (const section of sections) {
            await p.evaluate(
              (section) => window.__auditNavigate("/erp/" + section),
              section,
            );
            await expect(p.locator(".erp-content h1")).toHaveCount(1);
            await expect(
              p.locator(
                ".erp-content .brand-loader,.erp-content .erp-skeleton",
              ),
            ).toHaveCount(0);
            await p.evaluate(() => document.fonts.ready);
            const m = await p.evaluate(measure);
            results.erp.push({ theme, width, role, section, ...m });
            if (m.overflow && width === 375)
              await p.screenshot({
                path: output + "/erp-" + role + "-" + section + ".png",
              });
          }
        }
        console.log("ERP width checked", theme, width);
        fs.writeFileSync(
          output + "/results.json",
          JSON.stringify(results, null, 2),
        );
      }
    }

  results.contrast = [];
  results.primaryContrast = [];
  results.headers = [];
  results.modalMatrix = [];
  if (slice === "all" || slice === "dialogs") {
    await p.evaluate(() => {
      window.__auditMount("ADMIN");
      window.__auditMode = "populated";
    });
    for (const theme of ["light", "dark"]) {
      await p.evaluate(
        (theme) => (document.documentElement.dataset.theme = theme),
        theme,
      );
      for (const width of widths) {
        await p.setViewportSize({ width, height: 900 });
        await p.evaluate(() => window.__auditNavigate("/erp/dashboard"));
        await p.locator(".metric-card").first().waitFor();
        results.headers.push(
          await p.evaluate(() => ({
            theme: document.documentElement.dataset.theme,
            width: innerWidth,
            height: document
              .querySelector(".erp-topbar")
              .getBoundingClientRect().height,
            search: document
              .querySelector(".erp-global-search")
              .getBoundingClientRect().height,
          })),
        );
        if (width === 1440) {
          const contrast = await p.evaluate(() => {
            const rgb = (s) =>
              (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
            const lum = (values) =>
              values
                .map((v) => {
                  v /= 255;
                  return v <= 0.04045
                    ? v / 12.92
                    : ((v + 0.055) / 1.055) ** 2.4;
                })
                .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
            return [
              ".metric-card > small",
              ".erp-kicker",
              ".erp-breadcrumb",
              ".erp-user small",
              ".nav-group > p",
            ].map((selector) => {
              const e = document.querySelector(selector);
              const bg = e.closest(
                ".metric-card,.erp-topbar,.erp-sidebar,.erp-shell",
              );
              const fgL = lum(rgb(getComputedStyle(e).color)),
                bgL = lum(rgb(getComputedStyle(bg).backgroundColor));
              return {
                selector,
                ratio:
                  (Math.max(fgL, bgL) + 0.05) / (Math.min(fgL, bgL) + 0.05),
              };
            });
          });
          results.contrast.push({ theme, values: contrast });
          if (contrast.some((v) => v.ratio < 4.5))
            throw Error(
              "Secondary text contrast below 4.5: " + JSON.stringify(contrast),
            );
        }
        for (const section of [
          "patients",
          "appointments",
          "treatments",
          "schedules",
          "leaves",
          "inventory",
          "documents",
          "payments",
          "expenses",
          "doctors",
          "users",
        ]) {
          await p.evaluate(
            (section) => window.__auditNavigate("/erp/" + section),
            section,
          );
          if (width === 1440 && section === "patients") {
            const ratio = await p
              .locator(".workspace-heading-actions .erp-primary")
              .evaluate((e) => {
                const lum = (s) =>
                  (s.match(/[\d.]+/g) || [])
                    .slice(0, 3)
                    .map(Number)
                    .map((v) => {
                      v /= 255;
                      return v <= 0.04045
                        ? v / 12.92
                        : ((v + 0.055) / 1.055) ** 2.4;
                    })
                    .reduce(
                      (a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i],
                      0,
                    );
                const style = getComputedStyle(e),
                  fg = lum(style.color),
                  bg = lum(style.backgroundColor);
                return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
              });
            results.primaryContrast.push({ theme, ratio });
            if (ratio < 4.5) throw Error("Primary button contrast below 4.5");
          }
          await p
            .getByRole("button", {
              name:
                section === "users"
                  ? "Ажилтан нэмэх"
                  : section === "appointments"
                    ? "Цаг товлох"
                    : "Шинээр нэмэх",
              exact: true,
            })
            .click();
          const dialog = p.getByRole("dialog");
          await expect(dialog).toHaveAccessibleName(/.+/);
          const m = await p.evaluate(measure);
          const d = await dialog.evaluate((e) => ({
            width: e.getBoundingClientRect().width,
            clientWidth: e.clientWidth,
            scrollWidth: e.scrollWidth,
            closeWidth: e
              .querySelector(".modal-header button")
              .getBoundingClientRect().width,
          }));
          results.modalMatrix.push({ theme, width, section, ...m, dialog: d });
          if (
            m.overflow ||
            d.scrollWidth > d.clientWidth + 1 ||
            m.unlabelled.length ||
            d.closeWidth < 44
          )
            throw Error(`Modal geometry/labels: ${theme} ${width} ${section}`);
          await p.getByRole("button", { name: "Болих", exact: true }).click();
          await expect(dialog).toHaveCount(0);
        }
        console.log("Dialog width checked", theme, width);
        fs.writeFileSync(
          output + "/results.json",
          JSON.stringify(results, null, 2),
        );
      }
    }
  }
  await p.setViewportSize({ width: 1440, height: 900 });
  await p.evaluate(() => {
    window.__auditMount("ADMIN");
    window.__auditMode = "populated";
    window.__auditNavigate("/erp/dashboard");
  });
  await p.getByRole("button", { name: "Цэс хураах", exact: true }).click();
  await expect(p.locator(".erp-sidebar")).toHaveCSS("width", "96px");
  await p.getByRole("button", { name: "Цэс дэлгэх", exact: true }).click();
  await expect(p.locator(".erp-sidebar")).toHaveCSS("width", "256px");
  await expect(p.locator(".erp-content .erp-skeleton")).toHaveCount(0);
  await p.screenshot({ path: output + "/erp-desktop.png" });
  await p.setViewportSize({ width: 375, height: 900 });
  await p.evaluate(() => {
    window.__auditMode = "populated";
    window.__auditMount("ADMIN");
    window.__auditNavigate("/erp/patients");
  });
  await p.getByRole("button", { name: "Шинээр нэмэх", exact: true }).click();
  await p.getByRole("dialog").waitFor();
  results.dialogs.push(
    await p.locator("dialog").evaluate((e) => ({
      label: e.getAttribute("aria-label"),
      labelledby: e.getAttribute("aria-labelledby"),
      width: e.getBoundingClientRect().width,
      clientHeight: e.clientHeight,
      scrollHeight: e.scrollHeight,
      innerPadding: getComputedStyle(e.children[1]).padding,
    })),
  );
  await p.getByRole("button", { name: "Болих", exact: true }).click();

  results.interactions = [];
  await expect(p.locator(".erp-skeleton")).toHaveCount(0);
  await p.screenshot({ path: output + "/erp-mobile.png" });
  await expect(p.locator(".erp-sidebar")).toHaveAttribute("inert", "");
  const opener = p.getByRole("button", { name: "Цэс нээх", exact: true });
  await opener.click();
  await expect(p.locator(".erp-main")).toHaveAttribute("inert", "");
  await expect(p.locator(".erp-sidebar")).toHaveAttribute("aria-modal", "true");
  await p.keyboard.press("Shift+Tab");
  if (
    !(await p.evaluate(() => !!document.activeElement.closest(".erp-sidebar")))
  )
    throw Error("Focus escaped mobile drawer");
  await p.keyboard.press("Escape");
  await expect(opener).toBeFocused();
  results.interactions.push(
    "Mobile closed inert, open focus containment, Escape and focus return",
  );
  await p.evaluate(() => {
    window.__auditNavigate("/erp/appointments");
  });
  await p.getByRole("button", { name: "Цаг товлох", exact: true }).click();
  await expect(p.getByRole("dialog")).toHaveAccessibleName(
    "Үзлэгийн цаг товлох",
  );
  const patient = p.getByLabel(
    "Бүртгэлтэй өвчтөн сонгох (эсвэл доор шинээр бүртгэх)",
    { exact: true },
  );
  if ((await patient.getAttribute("required")) !== null)
    throw Error("Optional patient picker is required");
  await p.getByLabel("Шинэ өвчтөний нэр", { exact: true }).fill("Шинэ өвчтөн");
  await p.getByLabel("Шинэ өвчтөний утас", { exact: true }).fill("99112233");
  await p.getByLabel("Боломжит цагийн өдөр").fill("2099-01-02");
  await expect(p.getByLabel("Шинэ өвчтөний нэр", { exact: true })).toHaveValue(
    "Шинэ өвчтөн",
  );
  await p
    .getByRole("combobox", { name: "Эхлэх цаг", exact: true })
    .selectOption("10:00");
  await p
    .getByRole("button", { name: "Цаг баталгаажуулах", exact: true })
    .click();
  await expect(p.getByRole("dialog")).toHaveCount(0);
  const payload = await p.evaluate(() =>
    window.__auditRequests.findLast(
      (r) => r.method === "POST" && r.path === "/api/erp/appointments",
    ),
  );
  if (!payload || JSON.parse(payload.body).name !== "Шинэ өвчтөн")
    throw Error("New patient appointment payload missing");
  results.interactions.push(
    "Appointment optional patient, preserved draft across date changes, new patient submission payload",
  );
  await p.evaluate(() => {
    window.__auditMutationError = true;
  });
  await p.getByLabel(/Төлөв өөрчлөх/).selectOption("CONFIRMED");
  await expect(
    p.getByRole("alert").filter({ hasText: "Mutation failed fixture" }),
  ).toBeVisible();
  await expect(p.locator(".erp-table")).toBeVisible();
  results.interactions.push(
    "Mutation failure retains current appointment table",
  );
  await p.evaluate(() => {
    window.__auditMutationError = false;
    window.__auditMode = "error";
    window.__auditNavigate("/erp/settings");
  });
  await expect(p.getByRole("alert")).toBeVisible();
  await expect(p.locator(".settings-editor")).toHaveCount(0);
  await p.evaluate(() => (window.__auditMode = "populated"));
  await p.getByRole("button", { name: "Дахин оролдох", exact: true }).click();
  await expect(p.locator(".settings-editor")).toBeVisible();
  results.interactions.push(
    "Failed settings load blocks default-value editing; retry restores form",
  );
  await p.evaluate(() => {
    window.__auditMount("DOCTOR");
    window.__auditNavigate("/erp/reports");
  });
  await expect(p.getByRole("alert")).toContainText("Энэ хэсэгт хандах эрхгүй");
  await expect(p.locator(".metric-card")).toHaveCount(0);
  results.interactions.push(
    "Unauthorized doctor report section shows access state",
  );
  await p.evaluate(() => {
    window.__auditMount("ADMIN");
    window.__auditNavigate("/erp/services");
  });
  await p.getByRole("button", { name: "Шинээр нэмэх", exact: true }).click();
  await p
    .getByRole("textbox", { name: "Үйлчилгээний нэр", exact: true })
    .fill("Хадгалаагүй үйлчилгээ");
  await p.getByRole("button", { name: "Хаах", exact: true }).click();
  await expect(p.getByRole("dialog")).toHaveCount(0);
  results.interactions.push(
    "Edited dialog closes immediately without discard confirmation",
  );

  await p.evaluate(() => window.__auditNavigate("/erp/schedules"));
  const dayButtons = p.locator(".roster-days button");
  await dayButtons.first().focus();
  await p.keyboard.press("ArrowRight");
  await expect(dayButtons.nth(1)).toBeFocused();
  await p.keyboard.press("Enter");
  await expect(dayButtons.nth(1)).toHaveAttribute("aria-pressed", "true");
  results.interactions.push(
    "Calendar arrow focus and Enter selection preserve native buttons",
  );
  await p
    .getByRole("button", { name: "Долоо хоног засах", exact: true })
    .click();
  await p
    .getByRole("button", { name: "Даваа–Баасан 09:00–18:00", exact: true })
    .click();
  await p
    .getByRole("button", { name: "Долоо хоногийг хадгалах", exact: true })
    .click();
  await expect(p.getByRole("dialog")).toHaveCount(0);
  const week = await p.evaluate(() =>
    JSON.parse(
      window.__auditRequests.findLast(
        (r) => r.path === "/api/erp/schedule-week" && r.method === "POST",
      ).body,
    ),
  );
  if (week.days.length !== 7 || week.days.filter((d) => d.off).length !== 2)
    throw Error("Weekly payload changed");
  results.interactions.push(
    "Weekly weekday preset preserves seven-day payload and two days off",
  );
  await p.evaluate(() => window.__auditNavigate("/erp/patients"));
  await p
    .getByLabel(/Карт харах/)
    .first()
    .click();
  await expect(p.getByRole("dialog")).toHaveAccessibleName(
    "Өвчтөний мэдээллийн карт",
  );
  await expect(p.locator(".patient-card")).toBeVisible();
  await p.getByRole("button", { name: "Хаах", exact: true }).click();
  results.interactions.push("Patient detail request loads into named modal");
  await p.evaluate(() => window.__auditNavigate("/erp/payments"));
  await p.getByLabel(/Төлбөр хүчингүй болгох/).click();
  await p
    .getByRole("textbox", { name: "Хүчингүй болгох шалтгаан", exact: true })
    .fill("QA шалтгаан");
  await p.getByRole("button", { name: "Хүчингүй болгох", exact: true }).click();
  await expect(p.getByRole("dialog")).toHaveCount(0);
  const voided = await p.evaluate(() =>
    JSON.parse(
      window.__auditRequests.findLast(
        (r) => r.path === "/api/erp/payments/qa-record" && r.method === "PATCH",
      ).body,
    ),
  );
  if (voided.reason !== "QA шалтгаан")
    throw Error("Payment reason payload changed");
  results.interactions.push(
    "Payment void dialog preserves required reason payload",
  );
  await p.evaluate(() => window.__auditNavigate("/erp/settings"));
  await p.getByRole("button", { name: "Лого ба тайлан", exact: true }).click();
  await p.evaluate(() => (window.__auditFailPersist = true));
  await p
    .locator("input[type=file]")
    .setInputFiles("public/images/default-logo.png");
  await expect(
    p.getByRole("button", { name: "Зураг илгээж байна…", exact: true }),
  ).toBeDisabled();
  await expect(
    p.getByRole("alert").filter({ hasText: "Persistence failed fixture" }),
  ).toBeVisible();
  await expect(p.locator(".image-upload-preview img")).toHaveCount(0);
  await p.evaluate(() => (window.__auditFailPersist = false));
  results.interactions.push(
    "Image upload awaits persistence; save failure is caught and retains original image",
  );

  await p.evaluate(() => window.__auditNavigate("/erp/services"));
  await p.getByLabel("Бүртгэл хайх", { exact: true }).fill("slow");
  await expect
    .poll(() =>
      p.evaluate(() =>
        window.__auditRequests.some(
          (r) => r.path.includes("/services?") && r.path.includes("q=slow"),
        ),
      ),
    )
    .toBe(true);
  await p.getByLabel("Бүртгэл хайх", { exact: true }).fill("fast");
  await expect(p.locator(".erp-table")).toContainText("Fast search result");
  await p.waitForTimeout(950);
  await expect(p.locator(".erp-table")).toContainText("Fast search result");
  results.interactions.push(
    "Delayed old search response cannot replace the newer result",
  );
  await p.evaluate(() => {
    window.__auditDelaySave = true;
    window.__auditNavigate("/erp/services");
  });
  await p.getByRole("button", { name: "Шинээр нэмэх", exact: true }).click();
  await p
    .getByRole("textbox", { name: "Үйлчилгээний нэр", exact: true })
    .fill("Busy guard service");
  await p.getByRole("textbox", { name: "Ангилал", exact: true }).fill("QA");
  await p.getByRole("button", { name: "Хадгалах", exact: true }).click();
  await p.getByRole("button", { name: "Хаах", exact: true }).click();
  await expect(
    p.getByText("Хадгалж дуустал түр хүлээнэ үү.", { exact: true }),
  ).toBeVisible();
  await expect(
    p.getByRole("button", { name: "Өөрчлөлтийг орхих", exact: true }),
  ).toHaveCount(0);
  await expect(p.getByRole("dialog")).toHaveCount(0);
  await p.evaluate(() => (window.__auditDelaySave = false));
  results.interactions.push("Pending save cannot be dismissed or discarded");
  await p.evaluate(() => window.__auditNavigate("/erp/services"));
  await p.getByRole("button", { name: /^Устгах \/ идэвхгүй болгох/ }).click();
  await expect(p.getByRole("dialog")).toHaveAccessibleName("Идэвхгүй болгох");
  await p.getByRole("button", { name: "Идэвхгүй болгох", exact: true }).click();
  await expect(p.getByRole("dialog")).toHaveCount(0);
  if (
    !(await p.evaluate(() =>
      window.__auditRequests.some(
        (r) =>
          r.path === "/api/erp/services/qa-record" && r.method === "DELETE",
      ),
    ))
  )
    throw Error("Deactivate endpoint changed");
  results.interactions.push(
    "Deactivate confirmation names the original operation and preserves DELETE endpoint",
  );
  results.longText = [];
  if (slice === "all" || slice === "interactions")
    for (const theme of ["light", "dark"])
      for (const width of widths) {
        await p.evaluate(
          (theme) => (document.documentElement.dataset.theme = theme),
          theme,
        );
        await p.setViewportSize({ width, height: 900 });
        await p.evaluate(() => {
          window.__auditMode = "long";
          window.__auditNavigate("/erp/patients?q=long");
        });
        await p.locator(".erp-table").waitFor();
        const m = await p.evaluate(measure);
        results.longText.push({ theme, width, ...m });
        if (m.overflow) throw Error("Long table text overflow");
      }
  await p.evaluate(() => (window.__auditMode = "populated"));
  for (const mode of ["empty", "error", "loading"]) {
    await p.evaluate((mode) => {
      window.__auditMode = mode;
      window.__auditNavigate("/erp/services?q=" + mode);
    }, mode);
    if (mode === "loading") await p.locator(".erp-skeleton").waitFor();
    else if (mode === "error") await p.getByRole("alert").first().waitFor();
    else await p.locator(".erp-empty").waitFor();
    results.states.push({
      mode,
      loader: await p.locator(".brand-loader").count(),
      empty: await p.locator(".erp-empty").count(),
      alert: await p.getByRole("alert").count(),
      h1: await p.locator(".erp-content h1").allTextContents(),
    });
  }
  fs.writeFileSync(output + "/results.json", JSON.stringify(results, null, 2));
  console.log(
    JSON.stringify({
      publicChecks: results.public.length,
      erpChecks: results.erp.length,
      overflows: [...results.public, ...results.erp]
        .filter((r) => r.overflow)
        .map((r) => ({
          width: r.width,
          role: r.role,
          screen: r.section || r.route,
          scrollWidth: r.scrollWidth,
        })),
      modalChecks: results.modalMatrix.length,
      contrast: results.contrast,
      primaryContrast: results.primaryContrast,
      headers: results.headers,
      dialogs: results.dialogs,
      states: results.states,
      interactions: results.interactions,
      errors: results.errors,
    }),
  );
  await browser.close();
  if (
    results.errors.length ||
    [...results.public, ...results.erp].some((r) => r.overflow)
  )
    throw Error("Browser errors or document overflow; inspect results.json");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
