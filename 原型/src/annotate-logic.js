(function () {
  // 标注业务规则（纯函数，不依赖 DOM/store，便于单元测试）

  // 递归展开形式化表达：成员中的 Rx 替换为该关系自身的 formal
  function expandFormal(rel, rels) {
    return rel.type + "(" + rel.members.map(function (m) {
      if (m.charAt(0) === "R") {
        for (var i = 0; i < rels.length; i++) {
          if (rels[i].id === m) return expandFormal(rels[i], rels);
        }
        return m;
      }
      return m;
    }).join(", ") + ")";
  }

  // 计算删除某要素后的完整结果（不修改入参）
  // state: { segments:[{id,text,type}], relations:[{id,type,members,formal}], diagrams:[...] }
  // 返回 { segments, relations, diagrams, lastId, removed:[{id,formal,reason}], modified:[{id,before,after}] }
  function computeDeletion(state, delId) {
    var segments = state.segments || [];
    var relations = state.relations || [];
    var diagrams = state.diagrams || [];

    var pos = -1;
    for (var i = 0; i < segments.length; i++) {
      if (segments[i].id === delId) { pos = i; break; }
    }
    if (pos < 0) return null;

    // 1. 要素重编号：删除位置之后的要素编号前移
    var pmap = {};
    segments.forEach(function (s, i) {
      if (i > pos) pmap[s.id] = "P" + i; // 删除后其位置变为 i-1，新编号 P+i
    });
    var newSegments = segments.filter(function (s) {
      return s.id !== delId;
    }).map(function (s, i) {
      return { id: "P" + (i + 1), text: s.text, type: s.type };
    });

    // 2. 关系级联：成员不足或嵌套引用失效的关系迭代删除
    var live = relations.map(function (r) {
      return { id: r.id, type: r.type, members: r.members.slice(), formal: r.formal, demo: r.demo };
    });
    var removed = [];
    var guard = 0;
    while (guard++ < 100) {
      var liveIds = live.map(function (r) { return r.id; });
      var survivors = [];
      var died = [];
      live.forEach(function (r) {
        var deadRefs = r.members.filter(function (m) {
          return m.charAt(0) === "R" && liveIds.indexOf(m) < 0;
        });
        var aliveMembers = r.members.filter(function (m) {
          if (m.charAt(0) === "R") return liveIds.indexOf(m) >= 0;
          return m !== delId;
        }).length;
        if (deadRefs.length || aliveMembers < 2) {
          var reason = deadRefs.length
            ? "嵌套引用的 " + deadRefs.join("、") + " 已随之失效"
            : "成员包含被删除的 " + delId;
          died.push({ rel: r, reason: reason });
        } else {
          survivors.push(r);
        }
      });
      died.forEach(function (d) {
        removed.push({ id: d.rel.id, formal: d.rel.formal, reason: d.reason });
      });
      live = survivors;
      if (!died.length) break;
    }

    // 3. 存活关系：映射 P 号并重算形式化表达
    var modified = [];
    live.forEach(function (r) {
      var before = r.formal;
      r.members = r.members.filter(function (m) {
        return m !== delId;
      }).map(function (m) {
        return m.charAt(0) === "P" && pmap[m] ? pmap[m] : m;
      });
      r.formal = expandFormal(r, live);
      if (r.formal !== before) modified.push({ id: r.id, before: before, after: r.formal });
    });

    // 4. 图示同步：移除被删命题节点与相连边，映射其余 P 号；清理孤立关系节点
    function mapEndpoint(x) {
      return x.charAt(0) === "P" && pmap[x] ? pmap[x] : x;
    }
    var newDiagrams = diagrams.map(function (dg) {
      var nodes = dg.nodes.filter(function (n) {
        return n.id !== delId;
      }).map(function (n) {
        var copy = {};
        Object.keys(n).forEach(function (k) { copy[k] = n[k]; });
        copy.id = pmap[n.id] || n.id;
        return copy;
      });
      var edges = dg.edges.filter(function (e) {
        return e.from !== delId && e.to !== delId;
      }).map(function (e) {
        var copy = {};
        Object.keys(e).forEach(function (k) { copy[k] = e[k]; });
        copy.from = mapEndpoint(copy.from);
        copy.to = mapEndpoint(copy.to);
        return copy;
      });
      var connected = {};
      edges.forEach(function (e) { connected[e.from] = true; connected[e.to] = true; });
      var relNodes = dg.relNodes.filter(function (n) { return connected[n.id]; });
      var copyDg = {};
      Object.keys(dg).forEach(function (k) {
        if (k !== "nodes" && k !== "edges" && k !== "relNodes") copyDg[k] = dg[k];
      });
      copyDg.nodes = nodes;
      copyDg.edges = edges;
      copyDg.relNodes = relNodes;
      return copyDg;
    });

    return {
      segments: newSegments,
      relations: live,
      diagrams: newDiagrams,
      pmap: pmap,
      removed: removed,
      modified: modified
    };
  }

  // ===== 嵌套关系演示（依《指南》六种嵌套形式）=====
  // step.members：数字 = 取用 segIds 的第几个要素；"@k" = 引用第 k 个内层关系
  var NESTED_DEMO_ORDER = ["J-in-M", "M-in-J", "J-in-S", "M-in-S", "S-in-A", "multi"];
  var NESTED_DEMO_PATTERNS = {
    "J-in-M": {
      name: "组合内嵌于匹配", expr: "M(J(ps1, ps2), pg)", need: 3,
      steps: [{ type: "J", members: [0, 1] }, { type: "M", members: ["@0", 2] }]
    },
    "M-in-J": {
      name: "匹配内嵌于组合", expr: "J(M(ps1, pg1), M(ps2, pg2))", need: 4,
      steps: [{ type: "M", members: [0, 2] }, { type: "M", members: [1, 3] }, { type: "J", members: ["@0", "@1"] }]
    },
    "J-in-S": {
      name: "组合内嵌于支持", expr: "S(J(pi1, pi2), pj)", need: 3,
      steps: [{ type: "J", members: [0, 1] }, { type: "S", members: ["@0", 2] }]
    },
    "M-in-S": {
      name: "匹配内嵌于支持", expr: "S(M(ps, pg), pj)", need: 3,
      steps: [{ type: "M", members: [0, 1] }, { type: "S", members: ["@0", 2] }]
    },
    "S-in-A": {
      name: "支持内嵌于反对", expr: "A(po, S(pi, pj))", need: 3,
      steps: [{ type: "S", members: [0, 1] }, { type: "A", members: [2, "@0"] }]
    },
    multi: {
      name: "多层嵌套", expr: "S(M(J(ps1, ps2), pg), pj)", need: 4,
      steps: [{ type: "J", members: [0, 1] }, { type: "M", members: ["@0", 2] }, { type: "S", members: ["@1", 3] }]
    }
  };

  // 生成一整套嵌套演示关系（内层→外层），id 从 R{startNum} 起连续编号
  function buildNestedDemo(key, segIds, startNum) {
    var p = NESTED_DEMO_PATTERNS[key];
    if (!p) return { error: "未知嵌套形式" };
    if (!segIds || segIds.length < p.need) return { error: "要素不足", need: p.need };
    var chosen = segIds.slice(0, p.need);
    var rels = [];
    p.steps.forEach(function (st) {
      rels.push({
        id: "R" + (startNum + rels.length),
        type: st.type,
        members: st.members.map(function (m) {
          return typeof m === "number" ? chosen[m] : rels[Number(m.slice(1))].id;
        }),
        formal: "",
        demo: true,
        demoKey: key
      });
    });
    rels.forEach(function (r) { r.formal = expandFormal(r, rels); });
    return { rels: rels };
  }

  // ===== 文本切割规则辅助（依需求 2.1.5 /《指南》四条规则）=====
  // 规则1：句号（含！？）为界第一次切割；规则3：双引号内容整体保留不被标点切断；
  // 规则2：句内按逗号、分号切出子句（同性质子句是否合并需人工判断，不自动合并）；
  // 规则4：过渡语与其后第一个子句切在一起。
  var TRANSITIONS = ["理由如下", "综上所述", "综上来看", "据此", "因此", "所以", "由此", "本院认为", "本案中"];

  function splitKeepPunct(s, re) {
    var out = [], buf = "";
    for (var i = 0; i < s.length; i++) {
      buf += s[i];
      if (re.test(s[i])) { out.push(buf); buf = ""; }
    }
    if (buf) out.push(buf);
    return out;
  }

  function suggestCut(rawText) {
    var text = String(rawText == null ? "" : rawText);
    // 规则3：占位保护双引号整体
    var quotes = [];
    var safe = text.replace(/“[^”]*”/g, function (m) { quotes.push(m); return "\u0001" + (quotes.length - 1) + "\u0002"; });
    var restore = function (t) {
      return t.replace(/\u0001(\d+)\u0002/g, function (_, i) { return quotes[Number(i)]; });
    };

    // 规则1：句末标点为界；规则2：句内逗号/分号再切
    var units = [];
    splitKeepPunct(safe, /[。！？!?]/).forEach(function (sent) {
      if (!sent) return;
      splitKeepPunct(sent, /[，；,;]/).forEach(function (p) { if (p) units.push(p); });
    });

    var rulesOf = function (u, extra) {
      var rules = extra ? extra.slice() : [];
      var plain = restore(u);
      var tail = plain.slice(-1);
      if (plain.indexOf("“") >= 0 || plain.indexOf("”") >= 0) rules.push("引号整体");
      if (/[。！？!?]$/.test(plain)) rules.push("句号为界");
      if (/[，；,;]$/.test(tail)) rules.push("逗号/分号子句");
      return rules;
    };

    var pieces = [];
    var mergedTransitions = 0;
    for (var i = 0; i < units.length; i++) {
      var u = units[i];
      // 规则4：仅由过渡语 + 逗号/冒号构成的子句，并入后一子句
      var head = restore(u).trim().replace(/[，：:]$/, "");
      var isTransition = /[，：:]$/.test(restore(u).trim()) && TRANSITIONS.indexOf(head) >= 0;
      if (isTransition && i + 1 < units.length) {
        u += units[i + 1];
        i++;
        mergedTransitions++;
        pieces.push({ text: restore(u), rules: rulesOf(u, ["过渡语并入后一要素"]) });
      } else {
        var t = restore(u);
        if (t.trim()) pieces.push({ text: t, rules: rulesOf(u, null) });
      }
    }
    return { pieces: pieces, quoteCount: quotes.length, mergedTransitions: mergedTransitions };
  }

  // ===== 阶段历史版本（需求 2.1.5 / 2.1.10：各阶段提交快照，供追溯与复现）=====
  var STAGE_NAMES = {
    cut: "文本切割",
    elements: "要素标注",
    relations: "关系标注",
    diagram: "论证图示",
    backup: "回滚前备份"
  };

  // 每次阶段提交生成一个只读快照版本（提交级，非操作级）；note 用于回滚备份等标记
  function makeSnapshot(state, stage, operator, seq, note) {
    var pieces = (state && state.pieces) || [];
    var segments = (state && state.segments) || [];
    var relations = (state && state.relations) || [];
    var diagrams = (state && state.diagrams) || [];
    return {
      id: "V" + seq,
      seq: seq,
      stage: stage,
      stageName: STAGE_NAMES[stage] || stage,
      operator: operator || "",
      ts: new Date().toISOString(),
      note: note || "",
      counts: {
        pieces: pieces.filter(function (p) { return p.boxed; }).length,
        segments: segments.length,
        relations: relations.length,
        diagrams: diagrams.length
      },
      snapshot: JSON.parse(JSON.stringify({
        pieces: pieces, segments: segments, relations: relations, diagrams: diagrams
      }))
    };
  }

  // 相邻版本自动对比：prev 为 null 时以全空状态为基线（用于 V1）
  function diffStates(prev, cur) {
    prev = prev || { pieces: [], segments: [], relations: [], diagrams: [] };
    cur = cur || { pieces: [], segments: [], relations: [], diagrams: [] };
    var norm = function (x) { return x || []; };
    var out = {
      pieces: { boxedBefore: 0, boxedAfter: 0, boxedAdded: [], boxedRemoved: [] },
      segments: { added: [], removed: [], typeChanged: [] },
      relations: { added: [], removed: [], changed: [] },
      diagrams: { before: 0, after: 0, added: [], removed: [] },
      hasChanges: false
    };
    var mark = function () { out.hasChanges = true; };

    // 切割片段：重新预切割会重排 id，故按文本比对加框集合
    var pPrev = {}, pCur = {};
    norm(prev.pieces).forEach(function (p) { pPrev[p.text] = !!p.boxed; });
    norm(cur.pieces).forEach(function (p) { pCur[p.text] = !!p.boxed; });
    Object.keys(pPrev).forEach(function (t) { if (pPrev[t]) out.pieces.boxedBefore++; });
    Object.keys(pCur).forEach(function (t) { if (pCur[t]) out.pieces.boxedAfter++; });
    Object.keys(pCur).forEach(function (t) {
      if (pCur[t] && !pPrev[t]) { out.pieces.boxedAdded.push(t); mark(); }
    });
    Object.keys(pPrev).forEach(function (t) {
      if (pPrev[t] && !pCur[t]) { out.pieces.boxedRemoved.push(t); mark(); }
    });

    // 要素：按 id 比对存在性与类型
    var sPrev = {}, sCur = {};
    norm(prev.segments).forEach(function (s) { sPrev[s.id] = s; });
    norm(cur.segments).forEach(function (s) { sCur[s.id] = s; });
    Object.keys(sCur).forEach(function (id) {
      if (!sPrev[id]) { out.segments.added.push(id); mark(); }
      else if ((sPrev[id].type || "") !== (sCur[id].type || "")) {
        out.segments.typeChanged.push({ id: id, before: sPrev[id].type || "未标注", after: sCur[id].type || "未标注" });
        mark();
      }
    });
    Object.keys(sPrev).forEach(function (id) {
      if (!sCur[id]) { out.segments.removed.push(id); mark(); }
    });

    // 关系：按 id 比对；formal 变了即记为修改（含重编号/嵌套重算）
    var rPrev = {}, rCur = {};
    norm(prev.relations).forEach(function (r) { rPrev[r.id] = r; });
    norm(cur.relations).forEach(function (r) { rCur[r.id] = r; });
    Object.keys(rCur).forEach(function (id) {
      if (!rPrev[id]) { out.relations.added.push({ id: id, formal: rCur[id].formal }); mark(); }
      else if (rPrev[id].formal !== rCur[id].formal) {
        out.relations.changed.push({ id: id, before: rPrev[id].formal, after: rCur[id].formal });
        mark();
      }
    });
    Object.keys(rPrev).forEach(function (id) {
      if (!rCur[id]) { out.relations.removed.push({ id: id, formal: rPrev[id].formal }); mark(); }
    });

    // 图示：按 id 比对
    var dPrev = {}, dCur = {};
    norm(prev.diagrams).forEach(function (d) { dPrev[d.id] = d; });
    norm(cur.diagrams).forEach(function (d) { dCur[d.id] = d; });
    out.diagrams.before = norm(prev.diagrams).length;
    out.diagrams.after = norm(cur.diagrams).length;
    Object.keys(dCur).forEach(function (id) { if (!dPrev[id]) { out.diagrams.added.push(id); mark(); } });
    Object.keys(dPrev).forEach(function (id) { if (!dCur[id]) { out.diagrams.removed.push(id); mark(); } });

    return out;
  }

  // ===== 论证图示自动布局（依需求 2.1.8：由命题与关系自动生成）=====
  function diagramKind(type) {
    if (type === "S") return "support";
    if (type === "A") return "attack";
    if (type === "I") return "slash";
    return "plus";
  }

  // 由关系表生成图示节点/边与分层坐标（纯函数；边方向即推理方向）：
  // S/A：m0 → 关系节点 → m1（结论位）；M：前 n-1 个成员 → 关系节点 → 末成员；J/I：成员 → 关系节点（无向）
  function buildDiagram(relations) {
    var rels = relations || [];
    var relMap = {};
    rels.forEach(function (r) { relMap[r.id] = r; });

    var arcs = [];
    function addArc(from, to, arrow) { arcs.push({ from: from, to: to, arrow: !!arrow }); }
    rels.forEach(function (r) {
      var m = r.members || [];
      if (r.type === "S" || r.type === "A") {
        if (m.length >= 2) { addArc(m[0], r.id); addArc(r.id, m[1], true); }
      } else if (r.type === "M") {
        m.slice(0, m.length - 1).forEach(function (x) { addArc(x, r.id); });
        if (m.length) addArc(r.id, m[m.length - 1], true);
      } else {
        m.forEach(function (x) { addArc(x, r.id); });
      }
    });

    var ids = {};
    rels.forEach(function (r) { ids[r.id] = true; });
    arcs.forEach(function (a) { ids[a.from] = true; ids[a.to] = true; });
    var all = Object.keys(ids);
    var pred = {}, succ = {};
    all.forEach(function (id) { pred[id] = []; succ[id] = []; });
    arcs.forEach(function (a) {
      pred[a.to].push(a.from);
      succ[a.from].push(a.to);
    });

    // longest-path 分层：迭代至稳定；异常成环时 n 轮强制停止（层值有界）
    var layer = {};
    all.forEach(function (id) { layer[id] = 0; });
    for (var iter = 0; iter <= all.length; iter++) {
      var changed = false;
      all.forEach(function (id) {
        var v = 0;
        pred[id].forEach(function (p) { v = Math.max(v, (layer[p] || 0) + 1); });
        if (v !== layer[id]) { layer[id] = v; changed = true; }
      });
      if (!changed) break;
    }

    var maxLayer = 0;
    all.forEach(function (id) { maxLayer = Math.max(maxLayer, layer[id]); });
    var buckets = [];
    for (var b = 0; b <= maxLayer; b++) buckets.push([]);
    function numOf(id) { var m = /^[PR](\d+)$/.exec(id); return m ? Number(m[1]) : 9999; }
    // 初始稳定序：命题在前、关系在后，各自按编号
    all.sort(function (a, b2) {
      var ra = relMap[a] ? 1 : 0, rb = relMap[b2] ? 1 : 0;
      return ra - rb || numOf(a) - numOf(b2) || (a < b2 ? -1 : 1);
    });
    all.forEach(function (id) { buckets[layer[id]].push(id); });

    // barycenter 往返扫描，减少层间连线交叉；无邻居节点保持原位
    function rankOf(L, id) { return buckets[L].indexOf(id); }
    function pass(forward) {
      var L = forward ? 1 : maxLayer - 1;
      for (; forward ? L <= maxLayer : L >= 0; L += forward ? 1 : -1) {
        var neighborLayer = L + (forward ? -1 : 1);
        var scored = buckets[L].map(function (id) {
          var neighbors = forward ? pred[id] : succ[id];
          var sum = 0, c = 0;
          neighbors.forEach(function (n) {
            if (layer[n] === neighborLayer) { sum += rankOf(neighborLayer, n); c++; }
          });
          return { id: id, b: c ? sum / c : rankOf(L, id) };
        });
        scored.sort(function (x, y) { return x.b - y.b; });
        buckets[L] = scored.map(function (s) { return s.id; });
      }
    }
    pass(true); pass(false); pass(true); pass(false);

    var X0 = 90, DX = 175, Y0 = 80, DY = 82;
    var pos = {}, maxCount = 0;
    buckets.forEach(function (bucket, L) {
      maxCount = Math.max(maxCount, bucket.length);
      bucket.forEach(function (id, i) { pos[id] = { x: X0 + L * DX, y: Y0 + i * DY }; });
    });

    var nodes = [], relNodes = [];
    buckets.forEach(function (bucket) {
      bucket.forEach(function (id) {
        if (relMap[id]) relNodes.push({ id: id, kind: diagramKind(relMap[id].type), x: pos[id].x, y: pos[id].y });
        else nodes.push({ id: id, x: pos[id].x, y: pos[id].y });
      });
    });

    return {
      nodes: nodes,
      relNodes: relNodes,
      edges: arcs.map(function (a) { return { from: a.from, to: a.to, arrow: a.arrow }; }),
      width: Math.max(500, X0 + maxLayer * DX + 110),
      height: Math.max(620, Y0 + maxCount * DY + 30)
    };
  }

  // 图示区拖拽建立两命题关系（仅 P→P）：校验并构造关系对象（纯函数）
  // S/A 有序（a 为支持/反对者，b 为被支持/反对者）；J/M 成员无序
  function buildRelation(relations, nextId, a, b, type) {
    if (!a || !b || a === b) return { ok: false, reason: "起止要素不能相同" };
    if (["S", "A", "J", "M"].indexOf(type) < 0) return { ok: false, reason: "未知关系类型" };
    var dup = (relations || []).some(function (r) {
      if (r.type !== type) return false;
      var m = r.members;
      if (type === "S" || type === "A") return m[0] === a && m[1] === b;
      return m.length === 2 &&
        ((m[0] === a && m[1] === b) || (m[0] === b && m[1] === a));
    });
    if (dup) return { ok: false, reason: "关系已存在：" + type + "(" + a + ", " + b + ")" };
    return { ok: true, rel: { id: nextId, type: type, members: [a, b], formal: type + "(" + a + ", " + b + ")" } };
  }

  window.APP = window.APP || {};
  window.APP.annotateLogic = {
    computeDeletion: computeDeletion,
    expandFormal: expandFormal,
    suggestCut: suggestCut,
    TRANSITIONS: TRANSITIONS,
    makeSnapshot: makeSnapshot,
    diffStates: diffStates,
    STAGE_NAMES: STAGE_NAMES,
    NESTED_DEMO_ORDER: NESTED_DEMO_ORDER,
    NESTED_DEMO_PATTERNS: NESTED_DEMO_PATTERNS,
    buildNestedDemo: buildNestedDemo,
    buildDiagram: buildDiagram,
    buildRelation: buildRelation
  };
})();
