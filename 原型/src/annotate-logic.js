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

  window.APP = window.APP || {};
  window.APP.annotateLogic = {
    computeDeletion: computeDeletion,
    expandFormal: expandFormal
  };
})();
