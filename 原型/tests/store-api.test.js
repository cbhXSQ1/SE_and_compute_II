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

  console.log("annotate-logic.js");
  require(path.join(__dirname, "..", "src", "mock-data.js"));
  require(path.join(__dirname, "..", "src", "annotate-logic.js"));
  const { computeDeletion } = global.window.APP.annotateLogic;

  // 用 MOCK 真实关系链：R1 J(P4,P5) → R2 M(R1,P2) → R3 S(R2,P6)；R4 S(P7,P8)；
  // R5 J(P8,P6) → R6 M(R5,P3) → R7 S(R6,P9)；R8 S(P10,P12)；R9 A(P11,P10)；R10 S(P11,P13)
  const mockRels = global.window.MOCK.relations.map(r => ({ id: r.id, type: r.type, members: r.members.slice(), formal: r.formal }));
  const mkSegs = n => Array.from({ length: n }, (_, i) => ({ id: "P" + (i + 1), text: "t" + (i + 1), type: "" }));
  const mkDg = () => ({
    id: "dg", nodes: [{ id: "P3", x: 1, y: 1 }, { id: "P4", x: 2, y: 2 }],
    relNodes: [{ id: "s1", kind: "support", x: 0, y: 0 }, { id: "orphan", kind: "plus", x: 9, y: 9 }],
    edges: [{ from: "P3", to: "s1" }, { from: "s1", to: "P4" }]
  });

  await test("删除未参与关系的 P1：仅重编号，无关系删除", () => {
    const r = computeDeletion({ segments: mkSegs(13), relations: mockRels, diagrams: [] }, "P1");
    assert.deepStrictEqual(r.segments.map(s => s.id), Array.from({ length: 12 }, (_, i) => "P" + (i + 1)));
    assert.strictEqual(r.removed.length, 0);
    assert.ok(r.modified.some(m => m.id === "R1" && m.after === "J(P3, P4)"));
  });
  await test("删除 P3：R6 直接删除、R7 因嵌套引用 R6 级联删除", () => {
    const r = computeDeletion({ segments: mkSegs(13), relations: mockRels, diagrams: [] }, "P3");
    const ids = r.removed.map(x => x.id);
    assert.deepStrictEqual(ids, ["R6", "R7"]);
    assert.ok(r.removed[0].reason.includes("P3"));
    assert.ok(r.removed[1].reason.includes("R6"));
    assert.strictEqual(r.relations.some(x => x.id === "R7"), false);
  });
  await test("删除 P4：R1 成员不足删除，R2/R3 沿嵌套链级联删除", () => {
    const r = computeDeletion({ segments: mkSegs(13), relations: mockRels, diagrams: [] }, "P4");
    assert.deepStrictEqual(r.removed.map(x => x.id), ["R1", "R2", "R3"]);
  });
  await test("J 关系删除一个成员后仍≥2：保留并重算 formal", () => {
    const rels = [{ id: "R1", type: "J", members: ["P1", "P2", "P3"], formal: "J(P1, P2, P3)" }];
    const r = computeDeletion({ segments: mkSegs(3), relations: rels, diagrams: [] }, "P1");
    assert.strictEqual(r.removed.length, 0);
    assert.strictEqual(r.relations[0].formal, "J(P1, P2)");
    assert.deepStrictEqual(r.relations[0].members, ["P1", "P2"]);
  });
  await test("删除最后一个 P13：不重编号，R10 删除", () => {
    const r = computeDeletion({ segments: mkSegs(13), relations: mockRels, diagrams: [] }, "P13");
    assert.deepStrictEqual(r.removed.map(x => x.id), ["R10"]);
    assert.strictEqual(r.segments.length, 12);
    assert.strictEqual(r.segments[r.segments.length - 1].id, "P12");
  });
  await test("图示同步：移除被删节点与相连边、重映射 P 号、清理孤立关系节点", () => {
    const r = computeDeletion({ segments: mkSegs(4), relations: [], diagrams: [mkDg()] }, "P3");
    const dg = r.diagrams[0];
    assert.deepStrictEqual(dg.nodes.map(n => n.id), ["P3"]); // 原 P4 → P3
    assert.deepStrictEqual(dg.edges, [{ from: "s1", to: "P3" }]); // P3→s1 移除；s1→P4 保留并重映射
    assert.deepStrictEqual(dg.relNodes.map(n => n.id), ["s1"]); // orphan 变孤立被清理，s1 保留
  });
  await test("删除不存在的要素返回 null", () => {
    assert.strictEqual(computeDeletion({ segments: mkSegs(2), relations: [], diagrams: [] }, "P9"), null);
  });

  console.log("\n" + passed + " passed" + (process.exitCode ? ", 有失败" : ""));
})();
