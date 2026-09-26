/* store.js / api.js 单元测试（零依赖，直接 node tests/store-api.test.js 运行） */
const assert = require("assert");
const path = require("path");

// 浏览器环境垫片：被测模块向 window.APP 挂载
global.window = { MOCK: { pieces: [{ id: "s1", text: "原文片段", boxed: true }], segments: [{ id: "P1", text: "原文片段", type: "SF" }], relations: [], diagrams: [] } };

require(path.join(__dirname, "..", "src", "store.js"));
require(path.join(__dirname, "..", "src", "api.js"));
const { store, api } = global.window.APP;

let passed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log("  ok - " + name);
  } catch (e) {
    console.error("  FAIL - " + name + "\n    " + e.message);
    process.exitCode = 1;
  }
}

(async function () {
  console.log("store.js");
  await test("get 返回初始空数组", () => {
    assert.deepStrictEqual(store.get("pieces"), []);
  });
  await test("set 后 get 可取到新值", () => {
    store.set("pieces", [{ id: "s1" }]);
    assert.strictEqual(store.get("pieces").length, 1);
  });
  await test("set 触发 subscribe 回调（含新旧值）", () => {
    let seen = null;
    const off = store.subscribe((k, val, old) => { seen = { k, val, old }; });
    store.set("segments", [{ id: "P1" }]);
    assert.strictEqual(seen.k, "segments");
    assert.strictEqual(seen.val.length, 1);
    assert.deepStrictEqual(seen.old, []);
    off();
  });
  await test("取消订阅后不再回调", () => {
    let n = 0;
    const off = store.subscribe(() => n++);
    store.set("pieces", []);
    off();
    store.set("pieces", [{ id: "s2" }]);
    assert.strictEqual(n, 1);
  });
  await test("patch 批量更新多键", () => {
    store.patch({ pieces: [1, 2], relations: [3] });
    assert.strictEqual(store.get("pieces").length, 2);
    assert.strictEqual(store.get("relations").length, 1);
  });
  await test("touch 无变化也发通知", () => {
    let hit = false;
    const off = store.subscribe((k) => { if (k === "diagrams") hit = true; });
    store.touch("diagrams");
    off();
    assert.strictEqual(hit, true);
  });
  await test("get() 无参返回整体数据对象", () => {
    const all = store.get();
    assert.ok("pieces" in all && "segments" in all && "relations" in all && "diagrams" in all);
  });

  console.log("api.js");
  await test("loadAnnotation 返回 Promise 且含四类数据", async () => {
    const d = await api.loadAnnotation("T1");
    assert.strictEqual(d.pieces.length, 1);
    assert.strictEqual(d.segments[0].type, "SF");
    assert.deepStrictEqual(d.relations, []);
  });
  await test("loadAnnotation 深拷贝：改返回值不影响 MOCK", async () => {
    const d1 = await api.loadAnnotation("T1");
    d1.pieces[0].text = "被篡改";
    const d2 = await api.loadAnnotation("T1");
    assert.strictEqual(d2.pieces[0].text, "原文片段");
  });
  await test("submitCut resolve {diff:0}", async () => {
    const r = await api.submitCut([]);
    assert.strictEqual(r.diff, 0);
  });
  await test("submitAnnotation resolve {saved:true}", async () => {
    const r = await api.submitAnnotation({});
    assert.strictEqual(r.saved, true);
  });

  console.log("persist.js");
  // Node 环境垫片：localStorage / document / APP.state
  const mem = {};
  global.localStorage = {
    getItem: (k) => (k in mem ? mem[k] : null),
    setItem: (k, v) => { mem[k] = String(v); },
    removeItem: (k) => { delete mem[k]; }
  };
  global.document = { querySelector: () => null };
  global.APP = global.window.APP;
  global.APP.state = { currentTaskId: "T1" };
  require(path.join(__dirname, "..", "src", "persist.js"));
  const { persist } = global.window.APP;

  await test("save/load 往返一致", () => {
    store.patch({ pieces: [{ id: "s9", boxed: false }], relations: [{ id: "R9" }] });
    persist.save("TEST");
    const d = persist.load("TEST");
    assert.strictEqual(d.pieces[0].id, "s9");
    assert.strictEqual(d.relations[0].id, "R9");
    assert.ok(d.savedAt > 0);
  });
  await test("clear 后 load 返回 null", () => {
    persist.save("TMP");
    persist.clear("TMP");
    assert.strictEqual(persist.load("TMP"), null);
  });
  await test("api.loadAnnotation 优先返回草稿", async () => {
    const d = await api.loadAnnotation("TEST");
    assert.strictEqual(d.pieces[0].id, "s9");
    const m = await api.loadAnnotation("无草稿任务");
    assert.strictEqual(m.pieces[0].text, "原文片段");
  });
  await test("无草稿/无 MOCK 时返回空数组", async () => {
    const m = global.window.MOCK;
    global.window.MOCK = null;
    const d = await api.loadAnnotation("空空如也");
    global.window.MOCK = m;
    assert.deepStrictEqual(d.pieces, []);
  });

  console.log("\n" + passed + " passed" + (process.exitCode ? ", 有失败" : ""));
})();
