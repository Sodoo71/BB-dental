import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { proxy } from "../proxy";

describe("deployment origin handling", () => {
  it("serves API reads without APP_URL and still rejects cross-origin writes", () => {
    const previous = process.env.APP_URL;
    const previousMode = process.env.NODE_ENV;
    Object.assign(process.env, { NODE_ENV: "production" });
    delete process.env.APP_URL;
    try {
      assert.equal(proxy(new NextRequest("https://clinic.example/api/services")).status, 200);
      assert.equal(proxy(new NextRequest("https://clinic.example/api/services", { method: "POST", headers: { origin: "https://clinic.example" } })).status, 200);
      assert.equal(proxy(new NextRequest("https://clinic.example/api/services", { method: "POST", headers: { origin: "https://attacker.example" } })).status, 403);
      assert.equal(proxy(new NextRequest("https://clinic.example/api/services", { method: "POST" })).status, 403);
    } finally {
      if (previousMode === undefined) Reflect.deleteProperty(process.env, "NODE_ENV");
      else Object.assign(process.env, { NODE_ENV: previousMode });
      if (previous === undefined) delete process.env.APP_URL;
      else process.env.APP_URL = previous;
    }
  });
});
