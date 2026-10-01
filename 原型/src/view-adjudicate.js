(function () {
  var KIND_CLS = { "标签选择": "blue", "标注边界": "amber", "关系指向": "violet" };
  var FILTERS = ["全部", "标签选择", "标注边界", "关系指向"];
  var DOC_RECORDS = [
    { time: "2026-09-20 10:20", user: "李管理", text: "P5 是否作为独立要素：两位标注员理解不一致，待仲裁确认。" },
    { time: "2026-09-21 14:05", user: "王仲裁", text: "R9 反对关系方向判定，参照《指南》第 5.3 节关系指向规范。" },
    { time: "2026-09-22 09:30", user: "孙专家", text: "SM 与 SF 的区分：以是否存在规范判断标志词为准。" }
  ];
  var RO_NOTES = {
    annotator: "标注者可查看最终裁定结果并与自身标注比对（只读）；裁定操作请由仲裁员执行。",
    student: "学生为只读查看；请在教学展示中完成练习。",
    teacher: "教师为只读查看。",
    expert: "领域专家：裁决核心概念分歧并更新疑难问题说明文档；逐项的认可/重标请由仲裁员执行。"
  };
  var store = { filter: "全部", single: false, diffs: null, expert: [], docs: null, picked: "", viewAs: "A" };
  var host = null;
  var canAdj = false;
  var canExpert = false;

  function nowStr() {
    var t = new Date();
    function p(n) { return (n < 10 ? "0" : "") + n; }
    return t.getFullYear() + "-" + p(t.getMonth() + 1) + "-" + p(t.getDate()) + " " + p(t.getHours()) + ":" + p(t.getMinutes());
  }

  function ensure() {
    if (!store.docs) store.docs = DOC_RECORDS.slice();
    if (store.diffs) return;
    var src = (APP.data.adjudication && APP.data.adjudication.diffs) || [];
    store.diffs = src.map(function (d) {
      return { id: d.id, kind: d.kind, target: d.target, desc: d.desc, a: d.a, b: d.b, resolved: !!d.resolved, result: "" };
    });
    if (!store.picked && store.diffs.length) store.picked = store.diffs[0].id;
  }

  function kindCls(kind) { return KIND_CLS[kind] || "gray"; }

  function roOff() { return canAdj ? "" : ' aria-disabled="true"'; }
  function roOffExpert() { return canExpert ? "" : ' aria-disabled="true"'; }

  function find(id) {
    return store.diffs.filter(function (d) { return d.id === id; })[0];
  }

  function visibleDiffs() {
    return store.diffs.filter(function (d) { return store.filter === "全部" || d.kind === store.filter; });
  }

  function findRel(id) {
    var arr = APP.data.relations || [];
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].id === id) return arr[i];
    }
    return null;
  }

  function collectSegs(ids, known, out, depth) {
    (ids || []).forEach(function (id) {
      if (out.indexOf(id) >= 0) return;
      if (known[id]) { out.push(id); return; }
      if (depth <= 0 || !/^R\d+$/i.test(id)) return;
      var rel = findRel(id);
      if (rel) collectSegs(rel.members, known, out, depth - 1);
    });
  }

  function targetSegs(target) {
    var t = String(target || "").trim().toUpperCase();
    var known = {};
    (APP.data.segments || []).forEach(function (s) { known[s.id] = true; });
    var out = [];
    if (/^R\d+$/.test(t)) {
      var rel = findRel(t);
      if (rel) collectSegs(rel.members, known, out, 5);
      return out;
    }
    t.split("-").forEach(function (part) {
      var id = part.trim();
      if (known[id] && out.indexOf(id) < 0) out.push(id);
    });
    return out;
  }

  function pickedTarget() {
    var d = store.picked ? find(store.picked) : null;
    return d ? d.target : "";
  }

  function countText() {
    var done = store.diffs.filter(function (d) { return d.resolved; }).length;
    return "已处理 " + done + " / " + store.diffs.length;
  }

  function actionsHTML(d) {
    var dis = d.resolved ? " disabled" : roOff();
    if (store.single) {
      return '<button type="button" class="btn small primary" data-act="confirm" data-id="' + d.id + '"' + dis + ">确认通过</button>" +
        '<button type="button" class="btn small ghost" data-act="revise" data-id="' + d.id + '"' + dis + ">修订标注</button>";
    }
    return '<button type="button" class="btn small" data-act="accept-a" data-id="' + d.id + '"' + dis + ">认可 A</button>" +
      '<button type="button" class="btn small primary" data-act="accept-b" data-id="' + d.id + '"' + dis + ">认可 B</button>" +
      '<button type="button" class="btn small ghost" data-act="rebook" data-id="' + d.id + '"' + dis + ">重标</button>";
  }

  function cardHTML(d) {
    return '<div class="diff-card' + (d.resolved ? " is-done" : "") + (store.picked === d.id ? " picked" : "") + '" data-diff="' + d.id + '">' +
      '<div class="diff-head">' +
      '<span class="tag ' + kindCls(d.kind) + '">' + APP.esc(d.kind) + "</span>" +
      '<span class="code-chip">' + APP.esc(d.target) + "</span>" +
      '<span class="desc">' + APP.esc(d.desc) + "</span>" +
      '<span class="spacer"></span>' +
      (d.resolved ? '<span class="tag green">已裁定 ✓</span>' : "") +
      "</div>" +
      '<div class="adj-pair">' +
      '<div class="diff-a"><b>A（刘标注）：</b>' + APP.esc(d.a) + "</div>" +
      '<div class="diff-b"><b>B（陈标注）：</b>' + APP.esc(d.b) + "</div>" +
      "</div>" +
      (d.result ? '<div class="small muted mt8">裁定结果：' + APP.esc(d.result) + "</div>" : "") +
      '<div class="row mt8">' + actionsHTML(d) + "</div>" +
      "</div>";
  }

  function listHTML() {
    var arr = visibleDiffs();
    if (!arr.length) return '<div class="empty">该分类下暂无差异项</div>';
    return arr.map(cardHTML).join("");
  }

  function recordHTML(r) {
    return '<div class="list-item"><div class="txt wrap"><b>' + APP.esc(r.user) + '</b> <span class="small muted">' +
      APP.esc(r.time) + "</span><br>" + APP.esc(r.text) + "</div></div>";
  }

  function expertHTML() {
    if (!store.expert.length) return '<div class="small muted">暂无专家裁决记录</div>';
    return '<div class="list">' + store.expert.map(recordHTML).join("") + "</div>";
  }

  function docsHTML() {
    if (!store.docs || !store.docs.length) return '<div class="small muted">暂无说明文档记录</div>';
    return '<div class="list">' + store.docs.map(recordHTML).join("") + "</div>";
  }

  function sidebarHTML() {
    return '<div class="card">' +
      "<h3>疑难问题说明文档（示意）</h3>" +
      '<div class="small muted mb12">依据《指南》8.2.4：分歧经领域专家裁决后，结论同步写入说明文档。</div>' +
      '<div data-slot="docs">' + docsHTML() + "</div>" +
      '<h4 class="mt16">专家裁决记录</h4>' +
      '<div class="mb12" data-slot="expert">' + expertHTML() + "</div>" +
      (APP.role() === "annotator" ? "" : '<button type="button" class="btn primary" data-act="expert"' + roOffExpert() + ">提交专家裁决</button>") +
      "</div>";
  }

  function myCompareHTML() {
    if (APP.role() !== "annotator") return "";
    var asA = store.viewAs !== "B";
    var rows = store.diffs.map(function (d) {
      var mine = asA ? d.a : d.b;
      var verdict = '<span class="tag gray">待裁定</span>';
      if (d.result) {
        var aligned;
        if (/^认可\s*A/.test(d.result)) aligned = asA;
        else if (/^认可\s*B/.test(d.result)) aligned = !asA;
        else aligned = true;
        verdict = aligned ? '<span class="tag green">与裁定一致</span>' : '<span class="tag amber">与裁定不同</span>';
      }
      return "<tr>" +
        '<td><span class="code-chip">' + APP.esc(d.target) + "</span></td>" +
        "<td>" + APP.esc(mine) + "</td>" +
        "<td>" + (d.result ? APP.esc(d.result) : '<span class="muted">未裁定</span>') + "</td>" +
        "<td>" + verdict + "</td></tr>";
    }).join("");
    return '<div class="card">' +
      '<div class="row mb8"><h3 style="margin:0">我的标注结果与最终裁定比对</h3><span class="spacer"></span>' +
      '<label class="small muted">以谁的视角 <select data-view-as style="width:auto;display:inline-block">' +
      '<option value="A"' + (asA ? " selected" : "") + ">标注员A（刘标注）</option>" +
      '<option value="B"' + (!asA ? " selected" : "") + ">标注员B（陈标注）</option>" +
      "</select></label></div>" +
      '<div class="small muted mb8">依《指南》8.2.4：标注者可查看最终裁定结果，并与自己的标注结果进行比对。</div>' +
      '<table class="table"><thead><tr><th style="width:90px">差异点</th><th>我的标注</th><th>最终裁定</th><th style="width:120px">比对</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="4" class="muted">暂无差异项</td></tr>') + "</tbody></table></div>";
  }

  function paperHTML() {
    var segs = APP.data.segments || [];
    var body = segs.length ? segs.map(function (s) {
      return '<span class="seg" data-pid="' + APP.esc(s.id) + '" title="' + APP.esc(s.id + (s.type ? "：" + s.type : "")) + '">' +
        '<sup class="no">' + APP.esc(s.id) + "</sup>" + APP.esc(s.text) + "</span>";
    }).join("") : '<span class="seg">' + APP.esc((APP.data.doc && APP.data.doc.reasonText) || "") + "</span>";
    return '<div class="card adj-paper">' +
      "<h3>原文（文书一裁判理由）</h3>" +
      '<div class="small muted mb8">点击右侧差异卡片，可在此定位对应原文片段。</div>' +
      '<div class="paper">' + body + "</div>" +
      "</div>";
  }

  function layoutHTML() {
    var compareView = APP.role() === "annotator";
    var roTag = (canAdj || canExpert) ? "" : '<span class="tag gray">只读模式</span>';
    var roNote = canAdj ? "" : '<div class="notice mt12">' + APP.esc(RO_NOTES[APP.role()] || "当前角色为只读查看。") + "</div>";
    return '<div class="page">' +
      '<div class="page-head"><div><h2>' + (compareView ? "比对结果" : "裁定工作台") + '</h2><div class="sub">' +
      (compareView ? "查看最终裁定结果，并与自己的标注结果进行比对（只读）" : "双人独立标注结果比对：自动/半自动比对，人工裁定（依《指南》8.2.4）") + "</div></div>" +
      '<span class="spacer"></span>' +
      '<span class="tag gray">指南 ' + APP.esc((APP.data.guide && APP.data.guide.version) || "v1.2") + "</span>" +
      '<span class="tag gray">文书 ' + APP.esc((APP.data.doc && APP.data.doc.id) || "D1") + "</span>" +
      roTag +
      "</div>" +
      roNote +
      '<div class="toolbar adj-toolbar">' +
      '<div class="tabs">' + FILTERS.map(function (f) {
        return '<button type="button" class="' + (store.filter === f ? "active" : "") + '" data-act="filter" data-f="' + f + '">' + f + "</button>";
      }).join("") + "</div>" +
      '<span class="spacer"></span>' +
      '<span class="small muted" data-slot="count">' + countText() + "</span>" +
      '<button type="button" class="btn' + (store.single ? " toggled" : "") + '" data-act="single">单版本模式</button>' +
      (compareView ? "" :
        '<button type="button" class="btn" data-act="expert"' + roOffExpert() + ">提交专家裁决</button>" +
        '<button type="button" class="btn primary" data-act="finish"' + roOff() + ">完成裁定</button>") +
      "</div>" +
      '<div class="adj-layout">' +
      paperHTML() +
      '<div class="adj-main">' +
      '<div class="adj-list' + (store.single ? " adj-single" : "") + '">' + listHTML() + "</div>" +
      '<div data-slot="mycompare">' + myCompareHTML() + "</div>" +
      sidebarHTML() +
      "</div>" +
      "</div>" +
      '<div class="notice info mt16">自动/半自动比对仅用于识别不一致点，最终裁定由人工完成；标注者可查看最终裁定结果与自身结果进行比对。</div>' +
      "</div>";
  }

  function paintTabs() {
    Array.prototype.forEach.call(host.querySelectorAll('[data-act="filter"]'), function (b) {
      b.classList.toggle("active", b.getAttribute("data-f") === store.filter);
    });
  }

  function paintList() {
    var list = host.querySelector(".adj-list");
    if (!list) return;
    list.classList.toggle("adj-single", store.single);
    list.innerHTML = listHTML();
    var c = host.querySelector('[data-slot="count"]');
    if (c) c.textContent = countText();
    paintPick();
  }

  function paintSidebar() {
    var docs = host.querySelector('[data-slot="docs"]');
    if (docs) docs.innerHTML = docsHTML();
    var el = host.querySelector('[data-slot="expert"]');
    if (el) el.innerHTML = expertHTML();
  }

  function paintPick() {
    Array.prototype.forEach.call(host.querySelectorAll("[data-diff]"), function (c) {
      c.classList.toggle("picked", c.getAttribute("data-diff") === store.picked);
    });
    var paper = host.querySelector(".adj-paper .paper");
    if (!paper) return;
    var ids = targetSegs(pickedTarget());
    Array.prototype.forEach.call(paper.querySelectorAll(".seg"), function (s) {
      s.classList.toggle("picked", ids.indexOf(s.getAttribute("data-pid")) >= 0);
    });
    var el = paper.querySelector(".seg.picked");
    if (!el) return;
    var pr = paper.getBoundingClientRect();
    var er = el.getBoundingClientRect();
    if (er.top < pr.top || er.bottom > pr.bottom) {
      paper.scrollTop += er.top - pr.top - paper.clientHeight / 3;
    }
  }

  function pickDiff(id) {
    if (!id || store.picked === id) return;
    store.picked = id;
    paintPick();
  }

  function resolve(d, note) {
    d.resolved = true;
    d.result = note;
    paintList();
    APP.ui.toast("已裁定：" + d.target, "ok");
  }

  function rebook(d) {
    APP.ui.modal({
      title: "重标：" + d.target,
      body: '<p class="muted">请填写新的标注结果，提交后将作为最终裁定结果记录。</p>' +
        '<textarea id="adj-rebook-input" placeholder="例：SM / 拆分（2 个要素）/ A(P11, P10)"></textarea>',
      actions: [
        { label: "取消" },
        {
          label: "确认重标", kind: "primary", onClick: function () {
            var el = document.getElementById("adj-rebook-input");
            var v = el ? el.value.trim() : "";
            if (!v) {
              APP.ui.toast("请先填写重标结果", "warn");
              return false;
            }
            resolve(d, "重标：" + v);
          }
        }
      ]
    });
  }

  function expertModal() {
    APP.ui.modal({
      title: "提交领域专家裁决",
      body: '<p class="muted">请描述分歧点与裁决理由，提交后同步更新《疑难问题说明文档》。</p>' +
        '<textarea id="adj-expert-input" placeholder="例：P4 应标为 SM 还是 SF？涉及《指南》第 4.2 节……"></textarea>',
      actions: [
        { label: "取消" },
        {
          label: "提交", kind: "primary", onClick: function () {
            var el = document.getElementById("adj-expert-input");
            var v = el ? el.value.trim() : "";
            if (!v) {
              APP.ui.toast("请填写分歧说明", "warn");
              return false;
            }
            var rec = { time: nowStr(), user: APP.roleName(), text: v };
            store.expert.unshift(rec);
            store.docs.unshift({
              time: rec.time,
              user: rec.user,
              text: "专家裁决：" + (v.length > 60 ? v.slice(0, 60) + "…" : v)
            });
            paintSidebar();
            APP.ui.toast("已提交领域专家裁决，并同步更新疑难问题说明文档");
          }
        }
      ]
    });
  }

  function finish() {
    var open = store.diffs.filter(function (d) { return !d.resolved; }).length;
    if (open > 0) {
      APP.ui.modal({
        title: "暂不能完成裁定",
        body: "<p>还有 " + open + " 项未闭环，请完成全部差异项裁定后再提交。</p>",
        actions: [{ label: "知道了", kind: "primary" }]
      });
      return;
    }
    APP.ui.confirm("全部差异项已闭环，确认形成最终版本并进入导出？", function () {
      APP.ui.toast("已形成最终版本（版本化保存）", "ok");
      APP.goto("export");
    });
  }

  function bind(root) {
    root.addEventListener("click", function (e) {
      var card = e.target.closest("[data-diff]");
      if (card) pickDiff(card.getAttribute("data-diff"));
      var btn = e.target.closest("[data-act]");
      if (!btn) return;
      var act = btn.getAttribute("data-act");
      if (act === "expert") {
        if (!canExpert) { APP.ui.toast("只读模式：当前角色不能提交专家裁决", "warn"); return; }
        expertModal();
        return;
      }
      if (!canAdj && act !== "filter" && act !== "single") {
        APP.ui.toast("只读模式：当前角色不能执行裁定操作", "warn");
        return;
      }
      if (act === "filter") {
        store.filter = btn.getAttribute("data-f");
        var vis = visibleDiffs();
        if (store.picked && !vis.some(function (x) { return x.id === store.picked; })) {
          store.picked = vis.length ? vis[0].id : "";
        }
        paintTabs();
        paintList();
        return;
      }
      if (act === "single") {
        store.single = !store.single;
        btn.classList.toggle("toggled", store.single);
        paintList();
        return;
      }
      if (act === "finish") { finish(); return; }
      var d = find(btn.getAttribute("data-id"));
      if (!d) return;
      if (act === "accept-a") resolve(d, "认可 A：" + d.a);
      if (act === "accept-b") resolve(d, "认可 B：" + d.b);
      if (act === "rebook" || act === "revise") rebook(d);
      if (act === "confirm") resolve(d, "确认通过（单版本）");
    });
    root.addEventListener("change", function (e) {
      var sel = e.target && e.target.closest ? e.target.closest("[data-view-as]") : null;
      if (!sel) return;
      store.viewAs = sel.value === "B" ? "B" : "A";
      var el = host.querySelector('[data-slot="mycompare"]');
      if (el) el.innerHTML = myCompareHTML();
    });
  }

  APP.registerView("adjudicate", {
    title: "裁定工作台",
    render: function (root) {
      canAdj = ["adjudicator", "admin"].indexOf(APP.role()) !== -1;
      canExpert = ["expert", "admin"].indexOf(APP.role()) !== -1;
      host = root;
      ensure();
      APP.ui.addStyle("view-adjudicate",
        ".adj-layout{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);gap:14px;align-items:start}\n" +
        ".adj-main{display:flex;flex-direction:column;gap:10px;min-width:0}\n" +
        ".adj-list{display:flex;flex-direction:column;gap:10px}\n" +
        ".adj-pair{display:grid;grid-template-columns:1fr 1fr;gap:8px}\n" +
        ".adj-list.adj-single .diff-b{display:none}\n" +
        ".adj-list.adj-single .adj-pair{grid-template-columns:1fr}\n" +
        ".diff-head .desc{font-size:12px;color:var(--muted)}\n" +
        ".diff-card{cursor:pointer}\n" +
        ".diff-card.is-done{border-color:#bfe3d0;background:#fbfefc}\n" +
        ".diff-card.picked{border-color:var(--primary);box-shadow:0 0 0 2px var(--primary-weak)}\n" +
        ".btn.toggled{background:var(--primary-weak);border-color:#bcd0f5;color:var(--primary);font-weight:600}\n" +
        ".btn[aria-disabled=true]{opacity:.5;cursor:not-allowed}\n" +
        ".adj-toolbar .tabs{border-bottom:0;margin-bottom:0}\n" +
        "@media (max-width:1100px){.adj-layout{grid-template-columns:1fr}}\n" +
        "@media (max-width:760px){.adj-pair{grid-template-columns:1fr}}");
      root.innerHTML = layoutHTML();
      bind(root);
      paintPick();
    }
  });
})();
