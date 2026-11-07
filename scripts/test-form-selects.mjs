// Regression tests for actual shared form components and native select event ordering.
import assert from "node:assert/strict";
import { build } from "esbuild";
import { chromium } from "@playwright/test";
const bundle = await build({
  stdin: {
    contents: `
    import React, { useState } from 'react';
    import { createRoot } from 'react-dom/client';
    import { EntityForm, Modal } from './app/erp/ui';
    const fields = [
      { key:'gender', label:'Хүйс', type:'select', required:true, options:[{value:'MALE',label:'Эрэгтэй'},{value:'FEMALE',label:'Эмэгтэй'}] },
      ...['doctor','service','method','status'].map(key=>({key,label:key,type:'select',required:true,options:[{value:key+'-a',label:key+' A'},{value:key+'-b',label:key+' B'}]})),
      {key:'patientId',label:'Өвчтөн',type:'patient',required:true},
      {key:'note',label:'Тэмдэглэл'}
    ];
    window.fetch=async()=>new Response(JSON.stringify({items:[{id:'patient-a',name:'Patient A',phone:'99112233'},{id:'patient-b',name:'Patient B',phone:'99112244'}]}),{headers:{'Content-Type':'application/json'}});
    function App(){const [open,setOpen]=useState(true);const [initial,setInitial]=useState({});return <><button onClick={()=>setOpen(true)}>Open</button>{open&&<Modal title='Select regression' onClose={()=>setOpen(false)}><EntityForm fields={fields} initial={initial} onCancel={()=>setOpen(false)} onSubmit={async data=>{window.__saved=data;setInitial(data);setOpen(false)}}/></Modal>}</>}
    createRoot(document.getElementById('root')).render(<App/>);
  `,
    resolveDir: process.cwd(),
    loader: "tsx",
  },
  bundle: true,
  write: false,
  format: "iife",
  platform: "browser",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: [
    {
      name: "unused-next-image",
      setup(b) {
        b.onResolve({ filter: /^next\/image$/ }, () => ({
          path: "image",
          namespace: "stub",
        }));
        b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
          contents: "export default function Image(){return null}",
          loader: "js",
        }));
      },
    },
  ],
});
const browser = await chromium.launch();
try {
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setContent('<div id="root"></div>');
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();
    const select = dialog.getByLabel(/^Хүйс/);
    // Native dropdowns emit input before change. Let React process each event,
    // unlike selectOption(), which emits both in one JavaScript task.
    await select.evaluate((el) => {
      el.value = "FEMALE";
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
    await select.evaluate((el) =>
      el.dispatchEvent(new Event("change", { bubbles: true })),
    );
    assert.equal(
      await select.inputValue(),
      "FEMALE",
      "selection must survive input/change event boundary",
    );
    for (const key of ["doctor", "service", "method", "status"]) {
      const field = dialog.getByRole("combobox", {
        name: new RegExp("^" + key),
      });
      await field.evaluate((el, value) => {
        el.value = value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }, key + "-b");
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
      await field.evaluate((el) =>
        el.dispatchEvent(new Event("change", { bubbles: true })),
      );
      assert.equal(await field.inputValue(), key + "-b");
    }
    const patient = dialog.getByRole("combobox", { name: /^Өвчтөн/ });
    await patient
      .locator('option[value="patient-b"]')
      .waitFor({ state: "attached" });
    await patient.evaluate((el) => {
      el.value = "patient-b";
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
    await patient.evaluate((el) =>
      el.dispatchEvent(new Event("change", { bubbles: true })),
    );
    assert.equal(await patient.inputValue(), "patient-b");
    // A text edit and modal guard rerender must not overwrite prior selections.
    await dialog
      .getByLabel("Тэмдэглэл", { exact: true })
      .fill("Keep selected values");
    await dialog.getByRole("button", { name: "Хадгалах", exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
    assert.deepEqual(await page.evaluate(() => window.__saved), {
      gender: "FEMALE",
      doctor: "doctor-b",
      service: "service-b",
      method: "method-b",
      status: "status-b",
      patientId: "patient-b",
      note: "Keep selected values",
    });
    await page.getByRole("button", { name: "Open", exact: true }).click();
    assert.equal(await dialog.getByLabel(/^Хүйс/).inputValue(), "FEMALE");
    assert.equal(
      await dialog.getByRole("combobox", { name: /^method/ }).inputValue(),
      "method-b",
    );
    const requiredSelect = dialog.getByRole("combobox", { name: /^method/ });
    await requiredSelect.selectOption("");
    await dialog.getByRole("button", { name: "Хадгалах", exact: true }).click();
    assert.equal(await requiredSelect.getAttribute("aria-invalid"), "true");
    await requiredSelect.evaluate((el) => {
      el.value = "method-b";
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
    await requiredSelect.evaluate((el) =>
      el.dispatchEvent(new Event("change", { bubbles: true })),
    );
    assert.equal(await requiredSelect.inputValue(), "method-b");
    assert.equal(await requiredSelect.getAttribute("aria-invalid"), null);
    for (const action of ["close", "cancel", "escape", "backdrop"]) {
      await dialog
        .getByLabel("Тэмдэглэл", { exact: true })
        .fill(`Unsaved ${action}`);
      if (action === "close")
        await dialog.getByRole("button", { name: "Хаах", exact: true }).click();
      if (action === "cancel")
        await dialog
          .getByRole("button", { name: "Болих", exact: true })
          .click();
      if (action === "escape") await page.keyboard.press("Escape");
      if (action === "backdrop")
        await dialog.click({ position: { x: 1, y: 1 } });
      await dialog.waitFor({ state: "hidden" });
      assert.equal(
        await page
          .getByText("Хадгалаагүй өөрчлөлтийг орхих уу?", { exact: true })
          .count(),
        0,
      );
      assert.equal(
        await page.evaluate(() => window.__saved.note),
        "Keep selected values",
      );
      await page.getByRole("button", { name: "Open", exact: true }).click();
      assert.equal(
        await dialog.getByLabel("Тэмдэглэл", { exact: true }).inputValue(),
        "Keep selected values",
      );
    }
    assert.deepEqual(errors, []);
    console.log(
      `PASS ${viewport.width}px: six selects persist; edited forms close/cancel/Escape/backdrop immediately without confirmation`,
    );
    await page.close();
  }
} finally {
  await browser.close();
}
