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

  console.log("annotate-logic.js · 嵌套演示");
  const { buildNestedDemo, NESTED_DEMO_PATTERNS, NESTED_DEMO_ORDER } = global.window.APP.annotateLogic;
  const demoSegs = n => Array.from({ length: n }, (_, i) => "P" + (i + 1));
  const cases = {
    "J-in-M": ["M(J(P1, P2), P3)", 2, "R20", "R21"],
    "M-in-J": ["J(M(P1, P3), M(P2, P4))", 3, "R20", "R22"],
    "J-in-S": ["S(J(P1, P2), P3)", 2, "R20", "R21"],
    "M-in-S": ["S(M(P1, P2), P3)", 2, "R20", "R21"],
    "S-in-A": ["A(P3, S(P1, P2))", 2, "R20", "R21"],
    multi: ["S(M(J(P1, P2), P3), P4)", 3, "R20", "R22"]
  };
  for (const key of NESTED_DEMO_ORDER) {
    await test("嵌套演示 " + NESTED_DEMO_PATTERNS[key].name + "：" + cases[key][0], () => {
      const [formal, count, firstId, lastId] = cases[key];
      const r = buildNestedDemo(key, demoSegs(4), 20);
      assert.strictEqual(r.error, undefined);
      assert.strictEqual(r.rels.length, count);
      assert.strictEqual(r.rels[0].id, firstId);
      assert.strictEqual(r.rels[count - 1].id, lastId);
      assert.strictEqual(r.rels[count - 1].formal, formal);
      assert.ok(r.rels.every(x => x.demo === true && x.demoKey === key));
    });
  }
  await test("嵌套演示：M-in-J 外层成员为两个内层 M 关系", () => {
    const r = buildNestedDemo("M-in-J", demoSegs(4), 1);
    assert.deepStrictEqual(r.rels[2].members, ["R1", "R2"]);
  });
  await test("嵌套演示：要素不足返回 error.need", () => {
    const r = buildNestedDemo("multi", ["P1", "P2"], 1);
    assert.strictEqual(r.rels, undefined);
    assert.strictEqual(r.need, 4);
  });
  await test("嵌套演示：未知形式返回 error", () => {
    assert.strictEqual(buildNestedDemo("nope", demoSegs(4), 1).error, "未知嵌套形式");
  });

  console.log("annotate-logic.js · 切割规则辅助");
  const { suggestCut } = global.window.APP.annotateLogic;
  await test("规则1：按句号首切，标点保留在片段末尾", () => {
    const r = suggestCut("第一句。第二句！第三句？");
    assert.deepStrictEqual(r.pieces.map(p => p.text), ["第一句。", "第二句！", "第三句？"]);
    assert.ok(r.pieces.every(p => p.rules.includes("句号为界")));
  });
  await test("规则2：句内按逗号、分号切出子句", () => {
    const r = suggestCut("甲方应付款，乙方应交货；双方均无异议。");
    assert.deepStrictEqual(r.pieces.map(p => p.text), ["甲方应付款，", "乙方应交货；", "双方均无异议。"]);
    assert.ok(r.pieces[0].rules.includes("逗号/分号子句"));
    assert.ok(r.pieces[1].rules.includes("逗号/分号子句"));
    assert.ok(r.pieces[2].rules.includes("句号为界"));
  });
  await test("规则3：双引号内容整体保留，内部逗号不切断", () => {
    const r = suggestCut("合同约定“先付款，后交货”，双方照此履行。");
    const quote = r.pieces.find(p => p.text.indexOf("“") >= 0);
    assert.ok(quote, "应存在含引号片段");
    assert.strictEqual(quote.text, "合同约定“先付款，后交货”，");
    assert.ok(quote.rules.includes("引号整体"));
  });
  await test("规则4：过渡语并入其后第一个子句", () => {
    const r = suggestCut("本案中，双方存在合同关系。因此，被告应付款。");
    assert.deepStrictEqual(r.pieces.map(p => p.text), ["本案中，双方存在合同关系。", "因此，被告应付款。"]);
    assert.strictEqual(r.mergedTransitions, 2);
    assert.ok(r.pieces[0].rules.includes("过渡语并入后一要素"));
  });
  await test("文末过渡语无子句可并入时不产生空片段", () => {
    const r = suggestCut("陈述完毕。综上，");
    assert.deepStrictEqual(r.pieces.map(p => p.text), ["陈述完毕。", "综上，"]);
  });
  await test("mock 裁判理由文本可完整切割且无空白片段", () => {
    const r = suggestCut(global.window.MOCK.doc.reasonText);
    assert.ok(r.pieces.length >= 10);
    assert.ok(r.pieces.every(p => p.text.trim().length > 0));
    assert.strictEqual(r.pieces[0].text.indexOf("本院认为，"), 0);
    assert.strictEqual(r.pieces[r.pieces.length - 1].text, "判决如下：");
    assert.ok(r.mergedTransitions >= 2);
  });

  console.log("annotate-logic.js · 阶段历史版本");
  const { makeSnapshot, STAGE_NAMES } = global.window.APP.annotateLogic;
  const histState = () => ({
    pieces: [{ id: "s1", boxed: true }, { id: "s2", boxed: false }],
    segments: [{ id: "P1", type: "SF" }],
    relations: [{ id: "R1", type: "S" }],
    diagrams: [{ id: "dg1" }],
    history: [{ fake: true }]
  });
  await test("快照含编号/阶段/操作者/时间/统计", () => {
    const v = makeSnapshot(histState(), "cut", "标注员", 1);
    assert.strictEqual(v.id, "V1");
    assert.strictEqual(v.seq, 1);
    assert.strictEqual(v.stage, "cut");
    assert.strictEqual(v.stageName, STAGE_NAMES.cut);
    assert.strictEqual(v.operator, "标注员");
    assert.ok(!isNaN(Date.parse(v.ts)));
    assert.deepStrictEqual(v.counts, { pieces: 1, segments: 1, relations: 1, diagrams: 1 });
  });
  await test("快照为深拷贝：提交后再改状态不影响已存版本", () => {
    const st = histState();
    const v = makeSnapshot(st, "elements", "x", 2);
    st.segments.push({ id: "P2" });
    st.relations[0].type = "A";
    assert.strictEqual(v.snapshot.segments.length, 1);
    assert.strictEqual(v.snapshot.relations[0].type, "S");
  });
  await test("快照内容不含 history 本身，避免无限膨胀", () => {
    const v = makeSnapshot(histState(), "diagram", "x", 3);
    assert.strictEqual(v.snapshot.history, undefined);
    assert.deepStrictEqual(Object.keys(v.snapshot).sort(), ["diagrams", "pieces", "relations", "segments"]);
  });
  await test("空状态也能生成快照且统计为 0", () => {
    const v = makeSnapshot({}, "relations", "", 1);
    assert.deepStrictEqual(v.counts, { pieces: 0, segments: 0, relations: 0, diagrams: 0 });
  });

  console.log("annotate-logic.js · 相邻版本差异对比");
  const { diffStates } = global.window.APP.annotateLogic;
  const base = {
    pieces: [{ id: "s1", text: "甲句。", boxed: true }, { id: "s2", text: "乙句。", boxed: false }],
    segments: [{ id: "P1", text: "甲句。", type: "SF" }, { id: "P2", text: "乙句。", type: "" }],
    relations: [{ id: "R1", type: "S", members: ["P1", "P2"], formal: "S(P1, P2)" }],
    diagrams: [{ id: "dg1", nodes: [] }]
  };
  await test("V1 对空基线：全部识别为新增/加框", () => {
    const d = diffStates(null, base);
    assert.ok(d.hasChanges);
    assert.strictEqual(d.pieces.boxedAdded.length, 1);
    assert.deepStrictEqual(d.segments.added, ["P1", "P2"]);
    assert.deepStrictEqual(d.relations.added.map(r => r.id), ["R1"]);
    assert.deepStrictEqual(d.diagrams.added, ["dg1"]);
  });
  await test("要素类型标注：空→SF 记入 typeChanged", () => {
    const cur = JSON.parse(JSON.stringify(base));
    cur.segments[1].type = "GF";
    const d = diffStates(base, cur);
    assert.strictEqual(d.segments.typeChanged.length, 1);
    assert.deepStrictEqual(d.segments.typeChanged[0], { id: "P2", before: "未标注", after: "GF" });
  });
  await test("删除要素重编号：P2 消失记入 removed，存活关系 formal 更新记入 changed", () => {
    const cur = {
      pieces: base.pieces,
      segments: [{ id: "P1", text: "甲句。", type: "SF" }],
      relations: [{ id: "R1", type: "S", members: ["P1"], formal: "S(P1)" }],
      diagrams: base.diagrams
    };
    const d = diffStates(base, cur);
    assert.deepStrictEqual(d.segments.removed, ["P2"]);
    assert.strictEqual(d.relations.changed[0].id, "R1");
    assert.strictEqual(d.relations.changed[0].after, "S(P1)");
  });
  await test("切割调整按文本比对加框集合，id 重排不影响", () => {
    const cur = {
      pieces: [{ id: "x1", text: "甲句。", boxed: true }, { id: "x2", text: "乙句。", boxed: true }, { id: "x3", text: "丙句。", boxed: false }],
      segments: base.segments, relations: base.relations, diagrams: base.diagrams
    };
    const d = diffStates(base, cur);
    assert.deepStrictEqual(d.pieces.boxedAdded, ["乙句。"]);
    assert.strictEqual(d.pieces.boxedAfter, 2);
  });
  await test("两版完全一致时 hasChanges 为 false", () => {
    const d = diffStates(base, JSON.parse(JSON.stringify(base)));
    assert.strictEqual(d.hasChanges, false);
  });

  console.log("annotate-logic.js · 论证图示自动布局");
  const { buildDiagram } = global.window.APP.annotateLogic;
  const layerOf = (dg, id) => {
    const n = dg.nodes.concat(dg.relNodes).find(x => x.id === id);
    return Math.round((n.x - 90) / 175);
  };
  await test("空关系表：返回空图且画布有最小尺寸", () => {
    const d = buildDiagram([]);
    assert.strictEqual(d.nodes.length, 0);
    assert.strictEqual(d.relNodes.length, 0);
    assert.strictEqual(d.edges.length, 0);
    assert.ok(d.width >= 500 && d.height >= 620);
  });
  await test("J 组合：命题在第 0 层、关系节点第 1 层，连边无箭头", () => {
    const d = buildDiagram([{ id: "R1", type: "J", members: ["P4", "P5"] }]);
    assert.strictEqual(layerOf(d, "P4"), 0);
    assert.strictEqual(layerOf(d, "P5"), 0);
    assert.strictEqual(layerOf(d, "R1"), 1);
    assert.strictEqual(d.relNodes[0].kind, "plus");
    assert.deepStrictEqual(d.edges.map(e => e.arrow), [false, false]);
  });
  await test("S 嵌套链：最终结论命题位于最右层，关系节点到结论带箭头", () => {
    const rels = [
      { id: "R1", type: "J", members: ["P1", "P2"] },
      { id: "R2", type: "S", members: ["R1", "P3"] }
    ];
    const d = buildDiagram(rels);
    assert.strictEqual(layerOf(d, "R1"), 1);
    assert.strictEqual(layerOf(d, "R2"), 2);
    assert.strictEqual(layerOf(d, "P3"), 3);
    const arrowEdges = d.edges.filter(e => e.arrow).map(e => [e.from, e.to]);
    assert.deepStrictEqual(arrowEdges, [["R2", "P3"]]);
  });
  await test("A 反对：关系节点为 attack 且指向被反对者", () => {
    const d = buildDiagram([{ id: "R1", type: "A", members: ["P1", "P2"] }]);
    assert.strictEqual(d.relNodes[0].kind, "attack");
    assert.deepStrictEqual(d.edges.filter(e => e.arrow).map(e => [e.from, e.to]), [["R1", "P2"]]);
  });
  await test("I 同一：slash 节点、连边无箭头", () => {
    const d = buildDiagram([{ id: "R1", type: "I", members: ["P1", "P2"] }]);
    assert.strictEqual(d.relNodes[0].kind, "slash");
    assert.ok(d.edges.every(e => !e.arrow));
  });
  await test("同层节点不重叠，所有坐标在画布范围内", () => {
    const d = buildDiagram(mockRels);
    const all = d.nodes.concat(d.relNodes);
    const byX = {};
    all.forEach(n => {
      assert.ok(n.x >= 20 && n.x <= d.width - 20, "x 越界:" + n.id);
      assert.ok(n.y >= 20 && n.y <= d.height - 20, "y 越界:" + n.id);
      (byX[n.x] = byX[n.x] || []).push(n.y);
    });
    Object.keys(byX).forEach(x => {
      const ys = byX[x].slice().sort((a, b) => a - b);
      for (let i = 1; i < ys.length; i++) assert.ok(ys[i] - ys[i - 1] >= 50, "同层节点重叠 x=" + x);
    });
  });
  await test("MOCK 全量关系：10 个关系节点、20 条边，结论 P6/P9/P12/P13 在右层", () => {
    const d = buildDiagram(mockRels);
    assert.strictEqual(d.relNodes.length, 10);
    assert.strictEqual(d.edges.length, 20);
    [["P6", "R3"], ["P9", "R7"], ["P12", "R8"], ["P13", "R10"]].forEach(([p, r]) => {
      assert.ok(layerOf(d, p) > layerOf(d, r), p + " 应在 " + r + " 的结论侧（更右层）");
    });
  });
  await test("异常成环数据不死循环且节点齐全", () => {
    const rels = [
      { id: "R1", type: "S", members: ["R2", "P1"] },
      { id: "R2", type: "S", members: ["R1", "P2"] }
    ];
    const d = buildDiagram(rels);
    assert.strictEqual(d.relNodes.length, 2);
    assert.strictEqual(d.nodes.length, 2);
  });

  console.log("annotate-logic.js · 图示拖拽建关系");
  const { buildRelation } = global.window.APP.annotateLogic;
  await test("正常建立 S：方向有序、formal 正确、分配新编号", () => {
    const r = buildRelation([], "R11", "P1", "P2", "S");
    assert.strictEqual(r.ok, true);
    assert.deepStrictEqual(r.rel, { id: "R11", type: "S", members: ["P1", "P2"], formal: "S(P1, P2)" });
  });
  await test("A/J/M 类型均可建立", () => {
    ["A", "J", "M"].forEach(t => {
      const r = buildRelation([], "R1", "P1", "P2", t);
      assert.strictEqual(r.rel.type, t);
      assert.strictEqual(r.rel.formal, t + "(P1, P2)");
    });
  });
  await test("起止相同被拒绝", () => {
    const r = buildRelation([], "R1", "P1", "P1", "S");
    assert.strictEqual(r.ok, false);
    assert.ok(r.reason.indexOf("不能相同") >= 0);
  });
  await test("非法类型被拒绝", () => {
    assert.strictEqual(buildRelation([], "R1", "P1", "P2", "X").ok, false);
    assert.strictEqual(buildRelation([], "R1", "P1", "P2", "I").ok, false);
  });
  await test("S 有向：同向重复拒绝，反向允许（语义不同）", () => {
    const exist = [{ id: "R1", type: "S", members: ["P1", "P2"], formal: "S(P1, P2)" }];
    assert.strictEqual(buildRelation(exist, "R2", "P1", "P2", "S").ok, false);
    assert.strictEqual(buildRelation(exist, "R2", "P2", "P1", "S").ok, true);
  });
  await test("J 无序：成员互换仍识别为重复；不同类型不混淆", () => {
    const exist = [{ id: "R1", type: "J", members: ["P1", "P2"], formal: "J(P1, P2)" }];
    assert.strictEqual(buildRelation(exist, "R2", "P2", "P1", "J").ok, false);
    assert.strictEqual(buildRelation(exist, "R2", "P1", "P2", "M").ok, true);
  });

  console.log("annotate-logic.js · 切割差异度（双人比对，阈值 10%）");
  const { computeCutDiff, visibleTasks } = global.window.APP.annotateLogic;
  await test("差异度：切割完全一致为 0%", () => {
    assert.strictEqual(computeCutDiff(["甲句。", "乙句。"], ["甲句。", "乙句。"], "甲句。乙句。"), 0);
  });
  await test("差异度：无共同边界为 100%", () => {
    assert.strictEqual(computeCutDiff(["甲句。乙句。", "丙句。"], ["甲句。", "乙句。丙句。"], "甲句。乙句。丙句。"), 100);
  });
  await test("差异度：mock 双人切割仅在 P3 分合不同，差异度落在阈值内", () => {
    const cuts = global.window.MOCK.cuts.T1.D1;
    const d = computeCutDiff(cuts["刘标注"], cuts["陈标注"], global.window.MOCK.docData.D1.reasonText);
    assert.ok(d > 0 && d <= 10, "差异度应在 (0, 10] 之间，实际 " + d);
  });

  console.log("annotate-logic.js · 任务隔离（按当前用户角色过滤）");
  const ts = global.window.MOCK.tasks;
  await test("管理员可见全部任务", () => {
    assert.strictEqual(visibleTasks(ts, { name: "李管理", role: "admin" }).length, 4);
  });
  await test("教师/学生仅见教学练习", () => {
    assert.deepStrictEqual(visibleTasks(ts, { name: "赵老师", role: "teacher" }).map(t => t.id), ["T4"]);
    assert.deepStrictEqual(visibleTasks(ts, { name: "张三", role: "student" }).map(t => t.id), ["T4"]);
  });
  await test("标注员仅见分配给自己的正式任务", () => {
    assert.deepStrictEqual(visibleTasks(ts, { name: "刘标注", role: "annotator" }).map(t => t.id), ["T1", "T2", "T3"]);
    assert.deepStrictEqual(visibleTasks(ts, { name: "张三", role: "annotator" }).map(t => t.id), []);
  });
  await test("仲裁员仅见指定给自己的任务", () => {
    assert.deepStrictEqual(visibleTasks(ts, { name: "王仲裁", role: "adjudicator" }).map(t => t.id), ["T1", "T2", "T3"]);
  });
  await test("领域专家仅见待裁定任务", () => {
    assert.deepStrictEqual(visibleTasks(ts, { name: "孙专家", role: "expert" }).map(t => t.id), ["T2"]);
  });

  console.log("\n" + passed + " passed" + (process.exitCode ? ", 有失败" : ""));
})();
