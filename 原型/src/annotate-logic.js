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

  window.APP = window.APP || {};
  window.APP.annotateLogic = {
    computeDeletion: computeDeletion,
    expandFormal: expandFormal,
    NESTED_DEMO_ORDER: NESTED_DEMO_ORDER,
    NESTED_DEMO_PATTERNS: NESTED_DEMO_PATTERNS,
    buildNestedDemo: buildNestedDemo
  };
})();
