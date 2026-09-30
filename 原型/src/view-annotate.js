(function () {
  var M = APP.data || window.MOCK || {};
  var DEF_HINT = "将鼠标悬停或点击标签可查看定义；先选中左侧要素，再点击标签完成标注。";
  var READONLY_MSG = "只读模式：当前角色不能修改标注";
  var READONLY_BLOCKED = {
    "submit": true,
    "re-extract": true, "suggest-cut": true, "drag-range": true, "submit-cut": true,
    "pre-number": true, "delete-elem": true, "submit-elements": true,
    "make-rel": true, "submit-relations": true,
    "rebuild-diagram": true, "submit-diagram": true
  };

  var TABS = [
    { id: "cut", label: "文本切割" },
    { id: "elements", label: "要素标注" },
    { id: "relations", label: "关系标注" },
    { id: "diagram", label: "论证图示" }
  ];
  var TAB_IDS = TABS.map(function (t) { return t.id; });

  var NON_PROPS = [
    { code: "IS", name: "争议焦点", def: "当事人之间争议的、需要法院裁判的核心问题。" },
    { code: "", name: "态度声明", def: "对当事人主张、证据或诉讼行为表明采纳、不予采纳等态度的表述。" },
    { code: "", name: "总结性陈述", def: "对已认定事实、推理过程或整体结论作概括性复述的表述。" },
    { code: "", name: "判决依据", def: "判决所援引法律规范或裁判理由的指引性表述（如“依照……规定”）。" },
    { code: "", name: "判决结果", def: "判决主文，即对当事人权利义务的最终处理结果。" },
    { code: "", name: "其他非论证成分", def: "不属于上述类别，也不参与论证结构（既不支持也不反对）的表述。" }
  ];

  var PROPS = [
    { code: "SF", name: "个别事实判断", def: "对具体个案事实（时间、地点、行为、数额等）作出的判断。" },
    { code: "GF", name: "一般事实判断", def: "脱离开具体个案的、对一般事实或经验规律的判断。" },
    { code: "SM", name: "个别规范判断", def: "将一般规范适用于本案具体情形后得出的个别规范（应当、可以、不得）。" },
    { code: "SM-C", name: "合同及合同解释", def: "由合同条款及其解释形成的个别规范判断。" },
    { code: "GM-L", name: "法律条文", def: "广义法源意义上的法律条文，含司法解释；表述与法条原文完全一致的属条文。" },
    { code: "GM-I", name: "法律解释", def: "对法律条文的解释性表述；只有当其与法条完全一致时才归入条文（GM-L）。" },
    { code: "GM-U", name: "习惯与行业惯例", def: "以习惯、行业惯例为依据形成的规范判断。" },
    { code: "GM-M", name: "道德与价值观念", def: "以道德、价值观念为依据形成的规范判断。" },
    { code: "GM-O", name: "其他规范判断", def: "不属于上述类型的一般规范判断。" }
  ];

  var ALL_TAGS = NON_PROPS.concat(PROPS);
  var GEN_TITLE = "根据当前关系表生成（演示）";

  var REL_TYPES = [
    { code: "S", name: "支持", cls: "green", rule: "支持关系：恰好选择 2 个要素，前件支持后件。" },
    { code: "A", name: "反对", cls: "red", rule: "反对关系：恰好选择 2 个要素，前件反对后件。" },
    { code: "J", name: "组合", cls: "blue", rule: "组合关系：至少选择 2 个要素，组合为复合命题后整体参与论证。" },
    { code: "M", name: "匹配", cls: "violet", rule: "匹配关系：恰好选择 2 个要素；匹配关系发生在个别判断与一般判断之间。" },
    { code: "I", name: "同一", cls: "amber", rule: "同一关系：至少选择 2 个要素，表示同一命题。" }
  ];

  var S = {
    ready: false,
    rendered: false,
    tab: "cut",
    cutSubmitted: false,
    picked: "",
    relType: "",
    relPicked: [],
    dg: 0,
    zoom: false,
    adminDetail: false
  };
  var hostRoot = null;
  var dragState = null;
  var canEdit = false;

  APP.ui.addStyle("view-annotate",
    "button.tag{font-family:inherit;font-size:12px;cursor:pointer}" +
    ".diagram.va-zoom{transform:scale(.8);transform-origin:top center}" +
    ".diagram .rel-node{cursor:grab}" +
    ".legend i.plus,.legend i.slash{display:inline-flex;align-items:center;justify-content:center;font-style:normal;font-weight:700;font-size:9px;line-height:1;color:var(--ink)}" +
    ".list-item.va-disabled{opacity:.55;cursor:not-allowed}" +
    ".va-disabled{opacity:.5;cursor:not-allowed}" +
    ".btn.va-disabled:hover{border-color:var(--line);background:#fff}" +
    ".btn.primary.va-disabled:hover{background:var(--primary);border-color:var(--primary)}" +
    ".paper.va-disabled .seg{cursor:not-allowed}" +
    ".diagram.va-disabled{opacity:1;cursor:default}" +
    ".diagram.va-disabled .rel-node{cursor:not-allowed}" +
    ".va-rel-table td{padding:6px 8px;font-size:12px}" +
    ".va-body .notice{font-size:12px}"
  );

  function ensure() {
    if (S.ready) return;
    S.ready = true;
    APP.api.loadAnnotation(APP.state.currentTaskId).then(function (d) {
      APP.store.patch({
        pieces: (d.pieces || []).map(function (p) {
          return { id: p.id, text: p.text, boxed: !!p.boxed };
        }),
        segments: (d.segments || []).map(function (s) {
          return { id: s.id, text: s.text, type: s.type || "" };
        }),
        relations: (d.relations || []).map(function (r) {
          return { id: r.id, type: r.type, members: r.members.slice(), formal: r.formal };
        }),
        diagrams: d.diagrams || [],
        history: []
      });
      S.cutSubmitted = APP.store.get("pieces").length > 0;
      if (hostRoot && document.body.contains(hostRoot)) {
        S.rendered = false;
        renderView(hostRoot, APP.state.params);
      }
    });
  }

  function tagValue(t) { return t.code || t.name; }

  function tagByValue(val) {
    for (var i = 0; i < ALL_TAGS.length; i++) {
      if (tagValue(ALL_TAGS[i]) === val) return ALL_TAGS[i];
    }
    return null;
  }

  function tagName(val) {
    var t = tagByValue(val);
    return t ? t.name : val;
  }

  function relTypeByCode(code) {
    for (var i = 0; i < REL_TYPES.length; i++) {
      if (REL_TYPES[i].code === code) return REL_TYPES[i];
    }
    return null;
  }

  function segById(id) {
    for (var i = 0; i < APP.store.get("segments").length; i++) {
      if (APP.store.get("segments")[i].id === id) return APP.store.get("segments")[i];
    }
    return null;
  }

  function curDiagram() { return APP.store.get("diagrams")[S.dg]; }

  function bodyEl() { return hostRoot.querySelector(".va-body"); }

  function setTab(id) {
    if (TAB_IDS.indexOf(id) < 0 || id === S.tab) return;
    S.tab = id;
    APP.state.annotateMode = id;
    Array.prototype.forEach.call(hostRoot.querySelectorAll("button[data-tab]"), function (b) {
      b.classList.toggle("active", b.getAttribute("data-tab") === id);
    });
    paint();
  }

  function paint() {
    var body = bodyEl();
    var ps = [];
    var ls = [];
    Array.prototype.forEach.call(body.querySelectorAll(".paper"), function (p) { ps.push(p.scrollTop); });
    Array.prototype.forEach.call(body.querySelectorAll(".list"), function (p) { ls.push(p.scrollTop); });
    body.innerHTML = RENDER[S.tab]();
    Array.prototype.forEach.call(body.querySelectorAll(".paper"), function (p, i) {
      if (ps[i] != null) p.scrollTop = ps[i];
    });
    Array.prototype.forEach.call(body.querySelectorAll(".list"), function (p, i) {
      if (ls[i] != null) p.scrollTop = ls[i];
    });
  }

  function readOnlyNotice(role) {
    if (role === "admin") return "管理员为只读查看；标注修改请由标注员执行，差异请在裁定工作台处理。";
    if (role === "adjudicator" || role === "expert") return "请前往裁定工作台处理差异；此处仅供对照原文与标注结果。";
    if (role === "student") return "学生仅可在试标练习中操作，请从『教学展示 → 试标练习』进入。";
    if (role === "teacher") return "教师为只读查看；练习相关管理请在『教学展示』中进行。";
    return "当前角色为只读查看，标注修改请由标注员执行。";
  }

  function headHtml() {
    var practice = !!APP.state.practice;
    var guide = (M.guide && M.guide.version) || "v1.2";
    var doc = M.doc || {};
    var taskId = APP.state.currentTaskId || doc.taskId || "T1";
    var notices = "";
    if (practice) notices += '<div class="notice info small mb12">练习数据与正式任务数据隔离（细节待确认，见问题清单）</div>';
    if (!canEdit) notices += '<div class="notice info small mb12">' + APP.esc(readOnlyNotice(APP.role())) + "</div>";
    var back = APP.role() === "admin" && S.adminDetail
      ? '<button type="button" class="btn small" data-act="admin-back">返回总览</button>' : "";
    return '<div class="page-head">' +
      "<div><h2>标注工作台</h2>" +
      '<div class="sub">任务 ' + APP.esc(taskId) + " · 文书《" + APP.esc(doc.title || "") + "》</div></div>" +
      '<span class="spacer"></span>' +
      '<div class="row">' + back +
      '<span class="tag gray">指南 ' + APP.esc(guide) + "</span>" +
      (canEdit ? "" : '<span class="tag gray">只读模式</span>') +
      '<button type="button" class="tag green" data-act="save">已保存</button>' +
      '<button type="button" class="btn small" data-act="show-history">历史版本</button>' +
      (practice ? '<span class="tag violet">练习模式</span>' +
        '<button type="button" class="btn small" data-act="exit-practice">退出练习</button>' : "") +
      '<button type="button" class="btn primary' + (canEdit ? "" : " va-disabled") + '" data-act="submit">' + (practice ? "提交练习" : "提交") + "</button>" +
      "</div></div>" +
      notices;
  }

  function currentStageText() {
    var tasks = (APP.data && APP.data.tasks) || [];
    var tid = (APP.data && APP.data.doc && APP.data.doc.taskId) || APP.state.currentTaskId;
    var t = null;
    for (var i = 0; i < tasks.length; i++) {
      if (tasks[i].id === tid) { t = tasks[i]; break; }
    }
    return t ? t.status : "标注中";
  }

  function renderAdminOverview(root) {
    var doc = (APP.data && APP.data.doc) || {};
    var adj = (APP.data && APP.data.adjudication) || {};
    var diffs = adj.diffs || [];
    var guide = (APP.data && APP.data.guide) || {};
    var cons = (APP.data && APP.data.consistency) || {};

    var boxed = APP.store.get("pieces").filter(function (p) { return p.boxed; }).length;
    var cutPct = APP.store.get("pieces").length ? Math.round(boxed / APP.store.get("pieces").length * 100) : 0;
    var annotated = APP.store.get("segments").filter(function (s) { return !!s.type; }).length;
    var annPct = APP.store.get("segments").length ? Math.round(annotated / APP.store.get("segments").length * 100) : 0;

    var KIND_ORDER = ["标签选择", "标注边界", "关系指向"];
    var counts = {};
    diffs.forEach(function (d) { counts[d.kind] = (counts[d.kind] || 0) + 1; });
    var parts = [];
    KIND_ORDER.forEach(function (k) { if (counts[k]) parts.push(k + " " + counts[k]); });
    Object.keys(counts).forEach(function (k) {
      if (KIND_ORDER.indexOf(k) < 0) parts.push(k + " " + counts[k]);
    });

    function stageRow(label, right, pct) {
      return '<div class="mb12"><div class="row mb8"><span class="small">' + APP.esc(label) +
        '</span><span class="spacer"></span>' + right + "</div>" + APP.ui.progress(pct, pct >= 100) + "</div>";
    }

    function num2(v) {
      if (v == null) return "—";
      return typeof v === "number" ? v.toFixed(2) : v;
    }

    var cutRight = '<span class="tag ' + (cutPct >= 100 ? "green" : "amber") + '">' +
      (cutPct >= 100 ? "已完成" : boxed + " / " + APP.store.get("pieces").length) + "</span>";
    var elemRight = '<span class="tag ' + (annPct >= 100 ? "green" : "amber") + '">' +
      annotated + " / " + APP.store.get("segments").length + "</span>";
    var diffHtml = diffs.length
      ? '<div class="notice mb12">差异 <b>' + diffs.length + "</b> 处（" + APP.esc(parts.join(" · ")) + "）</div>"
      : '<div class="notice ok mb12">双人结果一致，暂无差异</div>';

    root.innerHTML = '<div class="page">' +
      '<div class="page-head">' +
      '<div><div class="row"><h2 style="margin:0">标注工作台</h2><span class="tag gray">管理视角</span></div>' +
      '<div class="sub">管理员视角：查看文书标注进度与状态；标注明细以只读方式查看。</div></div>' +
      '<span class="spacer"></span>' +
      '<div class="row">' +
      '<button type="button" class="btn primary" data-act="admin-detail">查看标注明细（只读）</button>' +
      '<button type="button" class="btn" data-act="adjudicate">前往裁定</button>' +
      '<button type="button" class="btn" data-act="export">导出</button>' +
      "</div></div>" +
      '<div class="grid cols-2">' +
      '<div class="card"><h3>文书信息</h3><dl class="kv">' +
      "<dt>标题</dt><dd>" + APP.esc(doc.title || "—") + "</dd>" +
      '<dt>案号</dt><dd class="mono">' + APP.esc(doc.caseNo || "—") + "</dd>" +
      "<dt>法院</dt><dd>" + APP.esc(doc.court || "—") + "</dd>" +
      "<dt>案由</dt><dd>" + APP.esc(doc.cause || "—") + "</dd>" +
      "<dt>文书类型</dt><dd>" + APP.esc(doc.type || "—") + "</dd>" +
      "</dl></div>" +
      '<div class="card"><h3>流程阶段</h3>' +
      stageRow("切割", cutRight, cutPct) +
      stageRow("要素标注", elemRight, annPct) +
      stageRow("关系标注", '<span class="tag green">' + APP.store.get("relations").length + " 条</span>", 100) +
      stageRow("图示", '<span class="tag green">' + APP.store.get("diagrams").length + " 个</span>", 100) +
      '<div class="notice">当前阶段：' + APP.esc(currentStageText()) + "</div></div>" +
      '<div class="card"><h3>双人标注状态</h3>' +
      '<div class="row mb8"><span class="tag green">已提交</span><span class="small">' +
      APP.esc(adj.versionA || "标注员A（刘标注）") + '</span><span class="spacer"></span><span class="small muted">独立标注</span></div>' +
      '<div class="row mb8"><span class="tag green">已提交</span><span class="small">' +
      APP.esc(adj.versionB || "标注员B（陈标注）") + '</span><span class="spacer"></span><span class="small muted">独立标注</span></div>' +
      diffHtml +
      '<button type="button" class="btn small" data-act="adjudicate">前往裁定</button></div>' +
      '<div class="card"><h3>指南与一致性</h3><dl class="kv">' +
      '<dt>指南版本</dt><dd><span class="code-chip">' + APP.esc(guide.version || "v1.2") +
      "</span> 任务绑定，标签冻结</dd>" +
      '<dt>一致性 Kappa</dt><dd><span class="tag green">' + APP.esc(num2(cons.kappa)) +
      "</span> 阈值 " + APP.esc(num2(cons.threshold)) +
      " · " + APP.esc(cons.period || "每周") + "计算</dd>" +
      "</dl></div>" +
      "</div></div>";
  }

  function renderCut() {
    var boxed = APP.store.get("pieces").filter(function (p) { return p.boxed; }).length;
    var pIdx = 0;
    return '<div class="toolbar">' +
      '<span class="small muted">已加框要素数：<b class="va-box-count">' + boxed + "</b> / " + APP.store.get("pieces").length + "</span>" +
      '<button type="button" class="btn small' + (canEdit ? "" : " va-disabled") + '" data-act="re-extract">重新提取</button>' +
      '<button type="button" class="btn small' + (canEdit ? "" : " va-disabled") + '" data-act="suggest-cut">按规则预切割</button>' +
      '<button type="button" class="btn small' + (canEdit ? "" : " va-disabled") + '" data-act="drag-range">手动拖动调整</button>' +
      "</div>" +
      '<div class="paper' + (canEdit ? "" : " va-disabled") + '">' + APP.store.get("pieces").map(function (p) {
        if (p.boxed) pIdx++;
        return '<span class="seg' + (p.boxed ? " boxed" : "") + '" data-piece="' + p.id + '">' +
          (p.boxed ? '<sup class="no">P' + pIdx + "</sup>" : "") +
          APP.esc(p.text) + "</span>";
      }).join("") + "</div>" +
      '<div class="row mt12"><button type="button" class="btn primary' + (canEdit ? "" : " va-disabled") + '" data-act="submit-cut">提交切割</button>' +
      '<span class="small muted">点击加框/去框，按原文顺序自动编号 P1, P2, P3…</span></div>';
  }
  function tagButton(t, pickedType, locked) {
    var val = tagValue(t);
    var cls = (pickedType === val ? "active" : "") + (locked ? (pickedType === val ? " " : "") + "va-disabled" : "");
    return '<button type="button" class="' + cls + '" data-tag="' + APP.esc(val) + '" title="' + APP.esc(t.def) + '">' +
      '<span class="code">' + APP.esc(t.code || "·") + "</span>" + APP.esc(t.name) + "</button>";
  }

  function renderElements() {
    var annotated = APP.store.get("segments").filter(function (s) { return !!s.type; });
    var untyped = APP.store.get("segments").filter(function (s) { return !s.type; });
    var picked = segById(S.picked);
    var pickedType = picked ? picked.type : "";
    var tagsLocked = !canEdit && !!picked;

    var left = APP.store.get("segments").map(function (s) {
      var cls = "seg" + (s.type ? " boxed alt" : "") + (s.id === S.picked ? " picked" : "");
      var tip = s.type ? ' title="' + APP.esc(s.id + "：" + tagName(s.type)) + '"' : "";
      return '<span class="' + cls + '" data-seg="' + s.id + '"' + tip + ">" +
        '<sup class="no">' + s.id + "</sup>" + APP.esc(s.text) + "</span>";
    }).join("");

    var mid = '<div class="tag-panel">' +
      '<div class="tag-group"><h4>非命题要素</h4><div class="tag-options">' +
      NON_PROPS.map(function (t) { return tagButton(t, pickedType, tagsLocked); }).join("") + "</div></div>" +
      '<div class="tag-group"><h4>命题要素</h4><div class="tag-options">' +
      PROPS.map(function (t) { return tagButton(t, pickedType, tagsLocked); }).join("") + "</div></div>" +
      '<div class="notice info small va-def-line">' + APP.esc(DEF_HINT) + "</div>" +
      '<div class="row">' +
      '<button type="button" class="btn small' + (canEdit ? "" : " va-disabled") + '" data-act="pre-number">先编号后补标签</button>' +
      '<button type="button" class="btn small danger' + (canEdit ? "" : " va-disabled") + '" data-act="delete-elem">删除所选要素</button>' +
      "</div></div>";

    var stat = "共 " + APP.store.get("segments").length + " 个要素，已标注 " + annotated.length + " 个" +
      (untyped.length ? "（" + untyped.map(function (s) { return s.id; }).join("、") + " 未标注）" : "（全部已标注）");

    var right = "<div>" +
      '<div class="small muted mb8">' + stat + "</div>" +
      (untyped.length ? '<div class="notice small mb8">仍有 ' + untyped.length + " 个要素未标注：" +
        untyped.map(function (s) { return s.id; }).join("、") + "，请补充类型后再提交。</div>" : "") +
      '<div class="list">' + APP.store.get("segments").map(function (s) {
        var tip = s.id + "：" + (s.type ? tagName(s.type) : "未标注");
        return '<div class="list-item' + (s.id === S.picked ? " active" : "") + '" data-seg="' + s.id + '" title="' + APP.esc(tip) + '">' +
          '<span class="idx">' + s.id + '</span><span class="txt">' + APP.esc(s.text) + "</span>" +
          (s.type ? '<span class="tag green">' + APP.esc(s.type) + "</span>" : '<span class="tag amber">未标注</span>') +
          "</div>";
      }).join("") + "</div>" +
      '<div class="row mt12"><button type="button" class="btn primary' + (canEdit ? "" : " va-disabled") + '" data-act="submit-elements">提交要素标注</button></div></div>';

    return '<div class="workbench">' +
      '<div><div class="small muted mb8">原文（点击选择要素）</div><div class="paper">' + left + "</div></div>" +
      mid + right + "</div>";
  }

  function renderRelations() {
    var left = '<div><div class="small muted mb8">选择两个或多个已标注要素（按点击顺序参与形式化表达）</div>' +
      '<div class="list">' + APP.store.get("segments").map(function (s) {
        var active = S.relPicked.indexOf(s.id) >= 0;
        var disabled = !s.type;
        return '<div class="list-item' + (active ? " active" : "") + (disabled ? " va-disabled" : "") +
          '" data-rel-pick="' + s.id + '" title="' + APP.esc(disabled ? "未标注要素不可参与关系" : s.text) + '">' +
          '<span class="idx">' + s.id + '</span><span class="txt">' + APP.esc(s.text) + "</span>" +
          (s.type ? '<span class="tag green">' + APP.esc(s.type) + "</span>" : '<span class="tag amber">未标注</span>') +
          "</div>";
      }).join("") + "</div></div>";

    var relBtns = REL_TYPES.map(function (r) {
      return '<button type="button" class="' + (S.relType === r.code ? "active" : "") + '" data-rel-type="' + r.code + '">' +
        '<span class="code">' + r.code + "</span>" + r.name + "</button>";
    }).join("");
    var cur = relTypeByCode(S.relType);
    var rule = cur ? cur.rule : "请选择关系类型；已选要素将按点击顺序写入形式化表达。";

    var mid = '<div class="tag-panel">' +
      '<div class="tag-group"><h4>关系类型（单选）</h4><div class="tag-options">' + relBtns + "</div></div>" +
      '<div class="small muted">' + APP.esc(rule) + "</div>" +
      '<div class="small">已选要素：' + (S.relPicked.length
        ? S.relPicked.map(function (id) { return '<span class="code-chip">' + APP.esc(id) + "</span>"; }).join(" ")
        : '<span class="muted">未选择</span>') + "</div>" +
      '<div class="row"><button type="button" class="btn primary' + (canEdit ? "" : " va-disabled") + '" data-act="make-rel">生成关系</button></div>' +
      nestedDemoHtml() +
      "</div>";

    var rows = APP.store.get("relations").map(function (r) {
      var rt = relTypeByCode(r.type) || { name: r.type, cls: "gray" };
      return "<tr>" +
        '<td><span class="mono">' + APP.esc(r.id) + "</span>" + (r.demo ? ' <span class="tag violet">演示</span>' : "") + "</td>" +
        '<td><span class="tag ' + rt.cls + '">' + APP.esc(r.type) + " " + APP.esc(rt.name) + "</span></td>" +
        "<td>" + r.members.map(function (m) { return '<span class="code-chip">' + APP.esc(m) + "</span>"; }).join(" ") + "</td>" +
        '<td><span class="code-chip">' + APP.esc(r.formal) + "</span></td>" +
        '<td><button type="button" class="btn small danger' + (canEdit ? "" : " va-disabled") + '" data-del-rel="' + APP.esc(r.id) + '">删除</button></td>' +
        "</tr>";
    }).join("");

    var right = "<div>" +
      '<table class="table va-rel-table"><thead><tr><th>编号</th><th>类型</th><th>成员</th><th>形式化表达</th><th></th></tr></thead>' +
      "<tbody>" + (rows || '<tr><td colspan="5" class="muted">暂无关系</td></tr>') + "</tbody></table>" +
      '<div class="notice info mt12">独立支持与组合支持不可混同：分别独立支持写作多条 S(pi, pj)；合取支持写作 S(J(...), pj)。</div>' +
      '<div class="row mt12"><button type="button" class="btn primary' + (canEdit ? "" : " va-disabled") + '" data-act="submit-relations">提交关系标注</button>' +
      '<span class="small muted">提交后留痕为历史版本，可在右上角「历史版本」查看</span></div>' +
      "</div>";

    return '<div class="workbench">' + left + mid + right + "</div>";
  }
  function svgHeight(dg) {
    var maxY = 0;
    (dg.nodes || []).concat(dg.relNodes || []).forEach(function (n) {
      if (n.y > maxY) maxY = n.y;
    });
    return Math.max(620, maxY + 60);
  }

  function svgFor(dg) {
    if (!dg) return "";
    var pos = {};
    (dg.nodes || []).forEach(function (n) { pos[n.id] = n; });
    (dg.relNodes || []).forEach(function (n) { pos[n.id] = n; });

    var edges = (dg.edges || []).map(function (e) {
      var a = pos[e.from];
      var b = pos[e.to];
      if (!a || !b) return "";
      var attr = 'stroke="#98a2b3" stroke-width="1.5"';
      if (e.demo) attr += ' stroke-dasharray="4 3"';
      if (e.arrow) attr += ' marker-end="url(#arrow)"';
      return '<line x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y + '" ' + attr + "></line>";
    }).join("");

    var nodes = (dg.nodes || []).map(function (n) {
      return '<g class="node" data-kind="node" data-id="' + APP.esc(n.id) + '" transform="translate(' + n.x + "," + n.y + ')">' +
        '<rect x="-34" y="-15" width="68" height="30" rx="6" fill="#fff" stroke="#1f2430"></rect>' +
        '<text text-anchor="middle" y="4">' + APP.esc(n.id) + "</text></g>";
    }).join("");

    var rels = (dg.relNodes || []).map(function (n) {
      var body;
      if (n.kind === "slash") {
        body = '<rect x="-13" y="-9" width="26" height="18" rx="4" fill="#fff" stroke="#1f2430"></rect>' +
          '<text text-anchor="middle" y="4">/</text>';
      } else {
        var fill = n.kind === "support" ? "#1f2430" : "#fff";
        var label = n.kind === "plus" ? '<text text-anchor="middle" y="4">+</text>' : "";
        body = '<circle r="12" fill="' + fill + '" stroke="#1f2430"></circle>' + label;
      }
      return '<g class="rel-node" data-kind="rel" data-id="' + APP.esc(n.id) + '" transform="translate(' + n.x + "," + n.y + ')">' + body + "</g>";
    }).join("");

    return '<svg viewBox="0 0 800 ' + svgHeight(dg) + '" role="img" aria-label="' + APP.esc(dg.title || "") + '" xmlns="http://www.w3.org/2000/svg">' +
      '<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">' +
      '<path d="M0,0 L7,3 L0,6 z" fill="#667085"></path></marker></defs>' +
      edges + nodes + rels + "</svg>";
  }

  function redrawSvg() {
    var host = hostRoot.querySelector(".va-svg-host");
    var dg = curDiagram();
    if (host && dg) host.innerHTML = svgFor(dg);
  }

  function relById(id) {
    for (var i = 0; i < APP.store.get("relations").length; i++) {
      if (APP.store.get("relations")[i].id === id) return APP.store.get("relations")[i];
    }
    return null;
  }

  function relKind(type) {
    if (type === "S") return "support";
    if (type === "A") return "attack";
    if (type === "I") return "slash";
    return "plus";
  }

  function buildDiagramFromRelations() {
    var pos = {};
    var seq = 0;
    var cache = {};

    function depthOf(id, seen) {
      var r = relById(id);
      if (!r) return 0;
      if (cache[id] != null) return cache[id];
      if (seen[id]) return 0;
      seen[id] = true;
      var d = 0;
      r.members.forEach(function (m) {
        if (relById(m)) d = Math.max(d, depthOf(m, seen));
      });
      seen[id] = false;
      cache[id] = d + 1;
      return cache[id];
    }

    APP.store.get("relations").forEach(function (r) {
      pos[r.id] = { id: r.id, kind: relKind(r.type), depth: depthOf(r.id, {}), seq: seq++ };
    });
    APP.store.get("relations").forEach(function (r) {
      r.members.forEach(function (m) {
        if (!pos[m]) pos[m] = { id: m, kind: "", depth: 0, seq: seq++ };
      });
    });

    var list = Object.keys(pos).map(function (k) { return pos[k]; });
    list.sort(function (a, b) { return a.depth - b.depth || a.seq - b.seq; });
    var layer = {};
    list.forEach(function (n) {
      var i = layer[n.depth] || 0;
      layer[n.depth] = i + 1;
      n.x = 80 + n.depth * 190;
      n.y = 90 + i * 80;
    });
    list.forEach(function (n) {
      if (!n.kind) return;
      var minY = Infinity;
      var maxY = -Infinity;
      relById(n.id).members.forEach(function (m) {
        if (!pos[m]) return;
        minY = Math.min(minY, pos[m].y);
        maxY = Math.max(maxY, pos[m].y);
      });
      if (minY !== Infinity) n.y = Math.round((minY + maxY) / 2);
    });

    var nodes = [];
    var relNodes = [];
    list.forEach(function (n) {
      if (n.kind) relNodes.push({ id: n.id, kind: n.kind, x: n.x, y: n.y });
      else nodes.push({ id: n.id, x: n.x, y: n.y });
    });

    var edges = [];
    APP.store.get("relations").forEach(function (r) {
      var members = r.members;
      if (r.type === "S" || r.type === "A") {
        edges.push({ from: members[0], to: r.id });
        edges.push({ from: r.id, to: members[1], arrow: true });
      } else if (r.type === "M") {
        members.slice(0, members.length - 1).forEach(function (m) {
          edges.push({ from: m, to: r.id });
        });
        edges.push({ from: r.id, to: members[members.length - 1], arrow: true });
      } else {
        members.forEach(function (m) {
          edges.push({ from: m, to: r.id });
        });
      }
    });

    return { id: "dg-gen", title: GEN_TITLE, generated: true, nodes: nodes, relNodes: relNodes, edges: edges };
  }

  function rebuildDiagram() {
    var dg = buildDiagramFromRelations();
    var idx = -1;
    for (var i = 0; i < APP.store.get("diagrams").length; i++) {
      if (APP.store.get("diagrams")[i].generated) { idx = i; break; }
    }
    if (idx < 0) {
      APP.store.get("diagrams").push(dg);
      idx = APP.store.get("diagrams").length - 1;
    } else {
      APP.store.get("diagrams")[idx] = dg;
    }
    S.dg = idx;
    paint();
  }

  function afterRelChange() {
    var dg = curDiagram();
    if (dg && dg.generated) {
      rebuildDiagram();
      APP.ui.toast("关系已更新，图示已自动重建（演示）");
      return true;
    }
    APP.ui.toast("关系已更新，可点『按关系表重建图示』刷新");
    return false;
  }

  function renderDiagram() {
    var dg = curDiagram();
    var subTabs = APP.store.get("diagrams").map(function (t, i) {
      return '<button type="button" data-dg="' + i + '"' + (i === S.dg ? ' class="active"' : "") + ">" + APP.esc(t.title) + "</button>";
    }).join("");
    var legend = '<div class="legend">' +
      '<span><i class="fill"></i>支持</span>' +
      "<span><i></i>反对</span>" +
      '<span><i class="plus">+</i>组合/匹配</span>' +
      '<span><i class="slash">/</i>同一</span>' +
      "</div>";
    return '<div class="tabs">' + subTabs + "</div>" +
      '<div class="row mb8">' + legend + '<span class="spacer"></span>' +
      '<button type="button" class="btn small' + (canEdit ? "" : " va-disabled") + '" data-act="rebuild-diagram">按关系表重建图示（演示）</button>' +
      '<button type="button" class="btn small" data-act="zoom">缩放示意</button>' +
      '<button type="button" class="btn primary' + (canEdit ? "" : " va-disabled") + '" data-act="submit-diagram">提交仲裁员审查</button></div>' +
      (dg ? '<div class="diagram' + (S.zoom ? " va-zoom" : "") + (canEdit ? "" : " va-disabled") + '" id="va-diagram"><div class="va-svg-host">' + svgFor(dg) + "</div></div>"
        : '<div class="empty">暂无图示数据</div>') +
      '<div class="notice info mt12">命题节点以带框序号表示；命题类型仅存在于标注表/数据库，不进入图示（依《指南》6.1）。</div>';
  }

  function nextRelId() {
    var max = 0;
    APP.store.get("relations").forEach(function (r) {
      var m = /^R(\d+)$/.exec(r.id);
      if (m) max = Math.max(max, Number(m[1]));
    });
    return "R" + (max + 1);
  }

  function togglePiece(el) {
    if (!canEdit) {
      APP.ui.toast(READONLY_MSG, "warn");
      return;
    }
    var id = el.getAttribute("data-piece");
    var p = null;
    APP.store.get("pieces").forEach(function (x) { if (x.id === id) p = x; });
    if (!p) return;
    p.boxed = !p.boxed;
    paint();
  }

  function onTag(val) {
    var tag = tagByValue(val);
    var s = segById(S.picked);
    if (!s) {
      APP.ui.modal({
        title: "标签定义 · " + (tag ? tag.name : val),
        body: "<p>" + APP.esc(tag ? tag.def : "") + "</p>" +
          '<p class="muted small">' + (canEdit ? "先选中左侧要素，再点击标签即可完成标注。" : "只读模式：标签定义仅供查看，不能用于标注。") + "</p>",
        actions: [{ label: "知道了", kind: "primary" }]
      });
      return;
    }
    if (!canEdit) {
      APP.ui.toast(READONLY_MSG, "warn");
      return;
    }
    s.type = val;
    APP.ui.toast(s.id + " 已标注为 " + val);
    paint();
  }

  function toggleRelPick(id) {
    var s = segById(id);
    if (!s || !s.type) {
      APP.ui.toast("未标注要素不可参与关系，请先补标类型", "warn");
      return;
    }
    var i = S.relPicked.indexOf(id);
    if (i >= 0) S.relPicked.splice(i, 1);
    else S.relPicked.push(id);
    paint();
  }

  function delRel(id) {
    if (!canEdit) {
      APP.ui.toast(READONLY_MSG, "warn");
      return;
    }
    var rels = APP.store.get("relations");
    var target = null;
    rels.forEach(function (r) { if (r.id === id) target = r; });
    if (target && target.demoKey) {
      var key = target.demoKey;
      var p = APP.annotateLogic.NESTED_DEMO_PATTERNS[key];
      var n = rels.filter(function (r) { return r.demoKey === key; }).length;
      APP.store.set("relations", rels.filter(function (r) { return r.demoKey !== key; }));
      APP.ui.toast("已删除整套「" + (p ? p.name : key) + "」演示（" + n + " 条关系）");
    } else {
      APP.store.set("relations", rels.filter(function (r) { return r.id !== id; }));
      APP.ui.toast("已删除关系 " + id + "（演示）");
    }
    if (!afterRelChange()) paint();
  }

  function makeRel() {
    var type = S.relType;
    var ids = S.relPicked.slice();
    if (!type) {
      APP.ui.toast("请先选择关系类型", "warn");
      return;
    }
    if (type === "J" || type === "I") {
      if (ids.length < 2) {
        APP.ui.toast(relTypeByCode(type).name + "关系至少需要选择 2 个要素（当前 " + ids.length + " 个）", "warn");
        return;
      }
    } else if (ids.length !== 2) {
      if (type === "M") {
        APP.ui.toast("匹配关系需选择 2 个要素（当前 " + ids.length + " 个）；匹配关系发生在个别判断与一般判断之间", "warn");
      } else {
        APP.ui.toast(relTypeByCode(type).name + "关系必须恰好选择 2 个要素（当前 " + ids.length + " 个）", "warn");
      }
      return;
    }
    var rel = { id: nextRelId(), type: type, members: ids, formal: type + "(" + ids.join(", ") + ")" };
    APP.store.get("relations").push(rel);
    S.relPicked = [];
    APP.ui.toast("已生成 " + rel.formal + "（" + rel.id + "）");
    if (!afterRelChange()) paint();
  }

  // 《指南》六种嵌套形式演示：一键插入整套关系链（内层→外层）
  function nestedDemoHtml() {
    var L = APP.annotateLogic;
    var inserted = {};
    APP.store.get("relations").forEach(function (r) { if (r.demoKey) inserted[r.demoKey] = true; });
    var btns = L.NESTED_DEMO_ORDER.map(function (key) {
      var p = L.NESTED_DEMO_PATTERNS[key];
      var done = !!inserted[key];
      return '<button type="button" class="btn small' + ((canEdit && !done) ? "" : " va-disabled") +
        '" data-demo-key="' + key + '" title="' + APP.esc(p.expr) + (done ? "（已插入）" : "") + '">' +
        APP.esc(p.name) + "</button>";
    }).join("");
    return '<div class="small muted mt8">嵌套关系演示（依《指南》六种形式，悬停看形式化表达）：</div>' +
      '<div class="tag-options">' + btns + "</div>";
  }

  function addNestedDemo(key) {
    if (!canEdit) {
      APP.ui.toast(READONLY_MSG, "warn");
      return;
    }
    var L = APP.annotateLogic;
    var p = L.NESTED_DEMO_PATTERNS[key];
    if (!p) return;
    var rels = APP.store.get("relations");
    if (rels.some(function (r) { return r.demoKey === key; })) {
      APP.ui.toast("「" + p.name + "」演示已在关系表中", "warn");
      return;
    }
    var segs = APP.store.get("segments");
    var typed = segs.filter(function (s) { return !!s.type; });
    var pool = (typed.length >= p.need ? typed : segs).slice(0, p.need).map(function (s) { return s.id; });
    if (pool.length < p.need) {
      APP.ui.toast("当前要素不足，该形式至少需要 " + p.need + " 个要素", "warn");
      return;
    }
    var max = 0;
    rels.forEach(function (r) {
      var m = /^R(\d+)$/.exec(r.id);
      if (m) max = Math.max(max, Number(m[1]));
    });
    var res = L.buildNestedDemo(key, pool, max + 1);
    if (res.error) {
      APP.ui.toast(res.error, "warn");
      return;
    }
    res.rels.forEach(function (r) { rels.push(r); });
    APP.store.touch("relations");
    APP.ui.toast("已插入「" + p.name + "」演示：" + res.rels[res.rels.length - 1].formal);
    if (!afterRelChange()) paint();
  }

  function deriveSegmentsFromCut() {
    if (APP.store.get("segments").length > 0) {
      APP.store.patch({ segments: [], relations: [], diagrams: [] });
    }
    var pIdx = 0;
    APP.store.get("pieces").forEach(function (p) {
      if (!p.boxed) return;
      pIdx++;
      APP.store.get("segments").push({ id: "P" + pIdx, text: p.text, type: "" });
    });
    S.cutSubmitted = true;
    S.dg = 0;
    S.picked = "";
    S.relPicked = [];
    S.relType = "";
  }

  function suggestCut() {
    if (!canEdit) {
      APP.ui.toast(READONLY_MSG, "warn");
      return;
    }
    var text = (M.doc && M.doc.reasonText) || "";
    var res = APP.annotateLogic.suggestCut(text);
    if (!res.pieces.length) {
      APP.ui.toast("未找到可切割文本", "warn");
      return;
    }
    var willReset = APP.store.get("segments").length > 0;
    var rows = res.pieces.map(function (p, i) {
      return "<tr><td class='mono'>" + (i + 1) + "</td><td>" + APP.esc(p.text) + "</td><td>" +
        p.rules.map(function (r) { return '<span class="tag violet">' + APP.esc(r) + "</span>"; }).join(" ") +
        "</td></tr>";
    }).join("");
    APP.ui.modal({
      title: "按《指南》规则预切割",
      body: '<p class="small muted">系统已执行四条机械规则：①句号（。！？）为界首切；②句内按逗号、分号切出子句；③双引号内容整体保留；④过渡语（如“本院认为，”“本案中，”“综上所述，”）并入其后第一个子句' +
        (res.mergedTransitions ? "（本次并入 <b>" + res.mergedTransitions + "</b> 处）" : "") + '。</p>' +
        '<p class="small"><b>规则②的语义判定不自动执行</b>：连续子句若为同一性质且相互间无支持/反对关系，应合并为一个要素，请在应用后人工合并（点击去框即可）。</p>' +
        (willReset ? '<div class="notice small mb8"><b>注意：</b>切割已提交并进入后续阶段，应用预切割将清空已生成的要素、关系与图示，需重新标注。</div>' : "") +
        '<p class="small muted">共生成 <b>' + res.pieces.length + '</b> 个建议片段（默认全部加框）：</p>' +
        '<div style="max-height:38vh;overflow:auto;border:1px solid var(--border,#ddd);border-radius:6px">' +
        '<table class="table va-rel-table"><thead><tr><th style="width:36px">#</th><th>建议片段</th><th style="width:170px">依据</th></tr></thead>' +
        "<tbody>" + rows + "</tbody></table></div>",
      actions: [
        { label: "取消", kind: "" },
        {
          label: "应用预切割", kind: "primary", onClick: function () {
            APP.store.set("pieces", res.pieces.map(function (p, i) {
              return { id: "s" + (i + 1), text: p.text, boxed: true };
            }));
            if (willReset) {
              APP.store.patch({ segments: [], relations: [], diagrams: [] });
              S.cutSubmitted = false;
              S.dg = 0;
              S.picked = "";
              S.relPicked = [];
              S.relType = "";
            }
            paint();
            APP.ui.toast("已按规则预切割为 " + res.pieces.length + " 个片段，请人工核对/合并后提交", "ok");
          }
        }
      ]
    });
  }

  // 阶段历史：每次正式提交压入一个只读快照（内存保存，刷新即清空；与草稿分离）
  function recordStage(stage, note) {
    var hist = APP.store.get("history");
    var v = APP.annotateLogic.makeSnapshot(APP.store.get(), stage, APP.roleName(), hist.length + 1, note);
    hist.push(v);
    APP.store.touch("history");
    return v;
  }

  function fmtTs(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    function p(n) { return n < 10 ? "0" + n : "" + n; }
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) +
      " " + p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
  }

  function shortText(t, n) {
    n = n || 22;
    return t.length > n ? t.slice(0, n) + "…" : t;
  }

  function showHistory() {
    var hist = APP.store.get("history");
    var body;
    if (!hist.length) {
      body = '<p class="small muted">暂无历史版本。各阶段（文本切割、要素标注、关系标注、论证图示）每次正式提交后，系统会自动保存一个只读快照，供仲裁追溯与过程复现。</p>' +
        '<p class="small muted">说明：历史版本仅保存于本次会话内存中（原型演示），不随草稿持久化。</p>';
    } else {
      var rows = hist.slice().reverse().map(function (v) {
        return "<tr><td class='mono'>" + v.id + "</td>" +
          "<td><span class='tag violet'>" + APP.esc(v.stageName) + "</span>" +
          (v.note ? '<div class="small muted">' + APP.esc(v.note) + "</div>" : "") + "</td>" +
          "<td class='small'>" + fmtTs(v.ts) + "</td>" +
          "<td class='small'>" + APP.esc(v.operator) + "</td>" +
          "<td class='small muted'>片段 " + v.counts.pieces + " · 要素 " + v.counts.segments +
          " · 关系 " + v.counts.relations + " · 图示 " + v.counts.diagrams + "</td>" +
          "<td><button type='button' class='btn small' data-hist-ver='" + v.seq + "'>查看差异</button></td></tr>";
      }).join("");
      body = '<p class="small muted">共 <b>' + hist.length + "</b> 个已提交版本（最新在上）。点「查看差异」可看该版本相对上一版的具体变化，标注员可在确认后回滚（回滚前会自动备份当前状态）。</p>" +
        '<div style="max-height:46vh;overflow:auto;border:1px solid var(--border,#ddd);border-radius:6px">' +
        '<table class="table va-rel-table"><thead><tr><th style="width:52px">版本</th><th style="width:120px">阶段</th><th style="width:150px">提交时间</th><th style="width:80px">操作者</th><th>内容统计</th><th style="width:86px">操作</th></tr></thead>' +
        "<tbody>" + rows + "</tbody></table></div>";
    }
    APP.ui.modal({
      title: "历史版本（各阶段提交留痕）",
      body: body,
      actions: [{ label: "关闭", kind: "primary" }]
    });
    var modalEl = document.getElementById("modal-root");
    if (modalEl && !modalEl._histBound) {
      modalEl._histBound = true;
      modalEl.addEventListener("click", function (e) {
        var t = e.target.closest ? e.target.closest("button[data-hist-ver]") : null;
        if (t) showVersionDetail(Number(t.getAttribute("data-hist-ver")));
      });
    }
  }

  function diffBlockHtml(title, items, render) {
    if (!items.length) return "";
    return '<div class="small mt8"><b>' + title + "（" + items.length + "）</b><ul class='small mt4'>" +
      items.map(render).join("") + "</ul></div>";
  }

  function showVersionDetail(seq) {
    var hist = APP.store.get("history");
    var idx = -1;
    hist.forEach(function (v, i) { if (v.seq === seq) idx = i; });
    if (idx < 0) return;
    var v = hist[idx];
    var prevSnap = idx > 0 ? hist[idx - 1].snapshot : null;
    var d = APP.annotateLogic.diffStates(prevSnap, v.snapshot);
    var esc = APP.esc;
    var chip = function (cls, t) { return '<span class="tag ' + cls + '">' + esc(t) + "</span>"; };

    var body = '<p class="small">版本 <b>' + v.id + '</b> · ' + chip("violet", v.stageName) +
      " · " + fmtTs(v.ts) + " · 操作者 " + esc(v.operator) + "</p>" +
      (v.note ? '<p class="small muted">' + esc(v.note) + "</p>" : "") +
      '<p class="small muted">相对 ' + (idx > 0 ? "上一版 " + hist[idx - 1].id : "空初始状态") + " 的具体变化：</p>";

    if (!d.hasChanges) {
      body += '<div class="notice small">与上一版内容完全相同（无数据变化）。</div>';
    } else {
      body += diffBlockHtml("切割：新加框片段", d.pieces.boxedAdded, function (t) {
        return "<li>" + chip("green", "加框") + " " + esc(shortText(t, 40)) + "</li>";
      });
      body += diffBlockHtml("切割：取消加框片段", d.pieces.boxedRemoved, function (t) {
        return "<li>" + chip("amber", "去框") + " " + esc(shortText(t, 40)) + "</li>";
      });
      body += diffBlockHtml("要素：新增", d.segments.added, function (id) {
        return "<li><span class='code-chip'>" + esc(id) + "</span></li>";
      });
      body += diffBlockHtml("要素：删除（后续自动重编号）", d.segments.removed, function (id) {
        return "<li><span class='code-chip'>" + esc(id) + "</span></li>";
      });
      body += diffBlockHtml("要素：类型标注/修改", d.segments.typeChanged, function (c) {
        return "<li><span class='code-chip'>" + esc(c.id) + "</span> " + esc(c.before) +
          ' <span class="muted">→</span> ' + chip("green", c.after) + "</li>";
      });
      body += diffBlockHtml("关系：新增", d.relations.added, function (r) {
        return "<li><span class='code-chip'>" + esc(r.id) + "</span> " + esc(r.formal) + "</li>";
      });
      body += diffBlockHtml("关系：删除（级联）", d.relations.removed, function (r) {
        return "<li><span class='code-chip'>" + esc(r.id) + "</span> " + esc(r.formal) + "</li>";
      });
      body += diffBlockHtml("关系：形式化表达更新", d.relations.changed, function (r) {
        return "<li><span class='code-chip'>" + esc(r.id) + "</span> " + esc(r.before) +
          ' <span class="muted">→</span> ' + esc(r.after) + "</li>";
      });
      body += diffBlockHtml("图示：新增/删除", d.diagrams.added.concat(d.diagrams.removed), function (id) {
        return "<li><span class='code-chip'>" + esc(id) + "</span></li>";
      });
    }

    var actions = [{
      label: "返回列表", kind: "", onClick: function () { showHistory(); return false; }
    }];
    if (canEdit) actions.push({ label: "回滚到此版本", kind: "primary", onClick: function () { confirmRollback(v); return false; } });
    APP.ui.modal({
      title: "版本差异 " + v.id + "（" + v.stageName + "）",
      body: body,
      actions: actions
    });
  }

  function confirmRollback(v) {
    if (!canEdit) {
      APP.ui.toast(READONLY_MSG, "warn");
      return;
    }
    APP.ui.modal({
      title: "回滚确认：恢复到 " + v.id,
      body: "<p>将把当前工作区数据恢复为版本 <b>" + v.id + "（" + APP.esc(v.stageName) + "，" + fmtTs(v.ts) +
        "）</b> 时的内容，并停留在该阶段。</p>" +
        '<div class="notice small mb8"><b>非破坏式回滚：</b>系统会先把<b>当前状态</b>自动另存为一个「回滚前备份」版本，之后再覆盖工作区；若回滚有误，可在历史列表中再滚回该备份。</div>' +
        '<p class="small muted">回滚后切割/要素/关系/图示四类数据都会回到当时状态，可继续编辑并重新提交。</p>',
      actions: [
        { label: "取消", kind: "" },
        {
          label: "确认回滚", kind: "primary", onClick: function () {
            var backup = recordStage("backup", "回滚到 " + v.id + " 前的自动备份");
            var snap = JSON.parse(JSON.stringify(v.snapshot));
            APP.store.patch(snap);
            S.cutSubmitted = snap.pieces.some(function (p) { return p.boxed; });
            S.picked = "";
            S.relPicked = [];
            S.relType = "";
            S.dg = 0;
            setTab(v.stage === "backup" ? "cut" : v.stage);
            paint();
            APP.ui.toast("已回滚到 " + v.id + "；当前旧状态已备份为 " + backup.id, "ok");
          }
        }
      ]
    });
  }

  function submitCut() {
    var boxed = APP.store.get("pieces").filter(function (p) { return p.boxed; });
    var count = boxed.length;
    if (!count) {
      APP.ui.toast("请先加框至少一个切割片段", "warn");
      return;
    }
    var pNos = boxed.map(function (_, i) {
      var idx = 0;
      for (var j = 0; j < APP.store.get("pieces").length; j++) {
        if (APP.store.get("pieces")[j].boxed) idx++;
        if (APP.store.get("pieces")[j].id === boxed[i].id) return "P" + idx;
      }
      return "";
    });
    var range = pNos.length === 1 ? pNos[0] : pNos[0] + "–" + pNos[pNos.length - 1];
    var diff = Math.min(100, Math.round(Math.abs(count - APP.store.get("pieces").length) / APP.store.get("pieces").length * 100));
    var passed = diff <= 10;

    APP.ui.modal({
      title: "提交切割",
      body: "<p>当前切割：<b>" + count + " 个</b>要素片段（" + APP.esc(range) + "）</p>" +
        '<p>模拟比对差异度：<b>' + diff + '%</b>（阈值 10%）—— ' +
        (passed ? "<span class='ok-text'>通过 ✓</span>" : "<span class='err-text'>超过阈值</span>") + "</p>" +
        '<p class="small muted">' + (passed
          ? "差异度在 10% 以内，可以进入要素标注阶段。"
          : "差异度超过 10%，建议返回调整切割后再提交。") + "</p>" +
        '<p class="small muted">提交后将根据加框结果自动生成要素序号（P1, P2, P3…），进入要素标注阶段。</p>',
      actions: [
        { label: "返回调整", kind: "" },
        { label: "确认提交", kind: "primary", onClick: function () {
          deriveSegmentsFromCut();
          var v = recordStage("cut");
          setTab("elements");
          APP.ui.toast("切割已提交，自动生成 " + count + " 个要素（P1–P" + count + "），已留痕为历史版本 " + v.id, "ok");
        } }
      ]
    });
  }

  function submitElements() {
    var un = APP.store.get("segments").filter(function (s) { return !s.type; });
    if (!un.length) {
      var v = recordStage("elements");
      APP.ui.toast("要素标注已提交，已留痕为历史版本 " + v.id + "（演示）");
      return;
    }
    APP.ui.modal({
      title: "提交前检查",
      body: "<p>以下要素尚未标注类型：</p><ul class='small'>" +
        un.map(function (s) { return "<li><b>" + APP.esc(s.id) + "</b> " + APP.esc(s.text) + "</li>"; }).join("") +
        "</ul><p class='warn-text'>存在未标注要素，正式流程应补齐后再提交；原型中可继续提交以便演示。</p>",
      actions: [
        { label: "返回修改" },
        { label: "仍然提交", kind: "primary", onClick: function () {
          var v2 = recordStage("elements");
          APP.ui.toast("已提交（含未标注要素，演示），已留痕为历史版本 " + v2.id);
        } }
      ]
    });
  }

  function deleteElem() {
    var s = segById(S.picked);
    if (!s) {
      APP.ui.toast("请先选择要删除的要素", "warn");
      return;
    }
    var res = APP.annotateLogic.computeDeletion({
      segments: APP.store.get("segments"),
      relations: APP.store.get("relations"),
      diagrams: APP.store.get("diagrams")
    }, s.id);

    var n = APP.store.get("segments").length;
    var num = parseInt(s.id.slice(1), 10);
    var body = "<p>删除要素 <b>" + APP.esc(s.id) + "</b> 后，后续要素将按原文顺序自动重编号" +
      (num < n ? "（P" + (num + 1) + "–P" + n + " → P" + num + "–P" + (n - 1) + "）" : "") + "。</p>";

    if (res.removed.length || res.modified.length) {
      body += '<div class="notice info small mt12"><b>对已建立关系的影响：</b></div>';
      if (res.removed.length) {
        body += '<div class="small mt8">以下关系将一并删除：</div><ul class="small mt4">' +
          res.removed.map(function (r) {
            return "<li><span class='code-chip'>" + APP.esc(r.id) + "</span> " + APP.esc(r.formal) +
              '<span class="muted"> — ' + APP.esc(r.reason) + "</span></li>";
          }).join("") + "</ul>";
      }
      if (res.modified.length) {
        body += '<div class="small mt8">以下关系的成员编号将同步更新：</div><ul class="small mt4">' +
          res.modified.map(function (r) {
            return "<li><span class='code-chip'>" + APP.esc(r.id) + "</span> " +
              APP.esc(r.before) + " → <b>" + APP.esc(r.after) + "</b></li>";
          }).join("") + "</ul>";
      }
    } else {
      body += '<p class="small muted mt8">该要素未参与任何关系。</p>';
    }
    body += '<p class="small muted mt8">论证图示中该命题节点及相关连线将同步移除。</p>';

    APP.ui.modal({
      title: "删除要素 " + s.id,
      body: body,
      actions: [
        { label: "取消" },
        {
          label: "确认删除", kind: "primary", onClick: function () {
            APP.store.patch({
              segments: res.segments,
              relations: res.relations,
              diagrams: res.diagrams
            });
            S.picked = "";
            var removedIds = {};
            res.removed.forEach(function (r) { removedIds[r.id] = true; });
            S.relPicked = S.relPicked.filter(function (id) {
              return id !== s.id && !removedIds[id];
            }).map(function (id) {
              return id.charAt(0) === "P" && res.pmap[id] ? res.pmap[id] : id;
            });
            paint();
            var msg = "已删除 " + s.id + "，后续要素已重编号";
            APP.ui.toast(res.removed.length ? msg + "；" + res.removed.length + " 条关系已一并删除" : msg, res.removed.length ? "warn" : "ok");
          }
        }
      ]
    });
  }

  function submitRelations() {
    var n = APP.store.get("relations").length;
    APP.ui.modal({
      title: "提交关系标注",
      body: "<p>当前关系表共 <b>" + n + "</b> 条关系（含嵌套关系的内层关系）。</p>" +
        '<p class="small muted">提交后该阶段结果将留痕为历史版本，供仲裁员审查与过程复现；提交后仍可返回修改，再次提交会生成新版本。</p>',
      actions: [
        { label: "取消" },
        { label: "确认提交", kind: "primary", onClick: function () {
          var v = recordStage("relations");
          APP.ui.toast("关系标注已提交，已留痕为历史版本 " + v.id);
        } }
      ]
    });
  }

  function submitDiagram() {
    APP.ui.modal({
      title: "提交仲裁员审查",
      body: "<p>图示将提交仲裁员审查，检查项：</p><ul class='small'>" +
        "<li><b>错误刻画</b>：支持 / 反对 / 组合 / 匹配 / 同一是否与标注表一致</li>" +
        "<li><b>符号错误</b>：节点形状、连线箭头与图例规范是否一致</li>" +
        "<li><b>遗漏</b>：命题与关系是否完整呈现</li></ul>",
      actions: [
        { label: "取消" },
        { label: "确认提交", kind: "primary", onClick: function () {
          var v = recordStage("diagram");
          APP.ui.toast("已提交仲裁员审查，已留痕为历史版本 " + v.id);
        } }
      ]
    });
  }

  function act(name) {
    if (!canEdit && READONLY_BLOCKED[name]) {
      APP.ui.toast(READONLY_MSG, "warn");
      return;
    }
    if (name === "admin-detail") { S.adminDetail = true; renderView(hostRoot, APP.state.params); return; }
    if (name === "admin-back") { S.adminDetail = false; renderView(hostRoot, APP.state.params); return; }
    if (name === "adjudicate") { APP.goto("adjudicate"); return; }
    if (name === "export") { APP.goto("export"); return; }
    if (name === "save") { APP.ui.toast("已保存到草稿"); return; }
    if (name === "submit") { APP.ui.toast(APP.state.practice ? "已提交练习（演示）" : "已提交（演示）"); return; }
    if (name === "re-extract") { APP.ui.toast("已按指南重新提取切割片段（演示）"); return; }
    if (name === "suggest-cut") { suggestCut(); return; }
    if (name === "drag-range") { APP.ui.pending("手动拖动调整切割范围"); return; }
    if (name === "submit-cut") { submitCut(); return; }
    if (name === "pre-number") { APP.ui.toast("已启用「先编号后补标签」（演示）：新要素可暂缺类型，编号保留，待后续补标"); return; }
    if (name === "delete-elem") { deleteElem(); return; }
    if (name === "submit-elements") { submitElements(); return; }
    if (name === "make-rel") { makeRel(); return; }
    if (name === "submit-relations") { submitRelations(); return; }
    if (name === "show-history") { showHistory(); return; }
    if (name === "rebuild-diagram") { rebuildDiagram(); APP.ui.toast("已按关系表重建图示（演示）"); return; }
    if (name === "exit-practice") {
      APP.state.practice = false;
      APP.goto("annotate", { mode: S.tab });
      APP.ui.toast("已退出练习模式");
      return;
    }
    if (name === "zoom") {
      S.zoom = !S.zoom;
      var d = hostRoot.querySelector("#va-diagram");
      if (d) d.classList.toggle("va-zoom", S.zoom);
      return;
    }
    if (name === "submit-diagram") { submitDiagram(); return; }
  }

  function onMouseDown(e) {
    if (!canEdit) return;
    if (e.button !== 0 || S.tab !== "diagram") return;
    var g = e.target.closest ? e.target.closest(".node, .rel-node") : null;
    if (!g) return;
    var svg = hostRoot.querySelector("#va-diagram svg");
    if (!svg) return;
    e.preventDefault();
    dragState = {
      kind: g.getAttribute("data-kind"),
      id: g.getAttribute("data-id"),
      rect: svg.getBoundingClientRect()
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  function onMouseMove(e) {
    if (!dragState) return;
    var dg = curDiagram();
    if (!dg) return;
    var scale = 800 / dragState.rect.width;
    var x = Math.round((e.clientX - dragState.rect.left) * scale);
    var y = Math.round((e.clientY - dragState.rect.top) * scale);
    x = Math.max(20, Math.min(780, x));
    y = Math.max(20, Math.min(svgHeight(dg) - 20, y));
    var list = dragState.kind === "rel" ? dg.relNodes : dg.nodes;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === dragState.id) {
        list[i].x = x;
        list[i].y = y;
        break;
      }
    }
    redrawSvg();
  }

  function onMouseUp() {
    dragState = null;
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  }

  function onMouseOver(e) {
    var b = e.target.closest ? e.target.closest("button[data-tag]") : null;
    if (!b || (e.relatedTarget && b.contains(e.relatedTarget))) return;
    var line = hostRoot.querySelector(".va-def-line");
    var tag = tagByValue(b.getAttribute("data-tag"));
    if (line && tag) line.textContent = "「" + (tag.code ? tag.code + " " : "") + tag.name + "」" + tag.def;
  }

  function onMouseOut(e) {
    var b = e.target.closest ? e.target.closest("button[data-tag]") : null;
    if (!b || (e.relatedTarget && b.contains(e.relatedTarget))) return;
    var line = hostRoot.querySelector(".va-def-line");
    if (line) line.textContent = DEF_HINT;
  }

  function onClick(e) {
    var t = e.target.closest ? e.target.closest("button[data-tab]") : null;
    if (t) { setTab(t.getAttribute("data-tab")); return; }
    t = e.target.closest ? e.target.closest("button[data-act]") : null;
    if (t) { act(t.getAttribute("data-act")); return; }
    t = e.target.closest ? e.target.closest("button[data-tag]") : null;
    if (t) { onTag(t.getAttribute("data-tag")); return; }
    t = e.target.closest ? e.target.closest("button[data-rel-type]") : null;
    if (t) { S.relType = t.getAttribute("data-rel-type"); paint(); return; }
    t = e.target.closest ? e.target.closest("[data-piece]") : null;
    if (t) { togglePiece(t); return; }
    t = e.target.closest ? e.target.closest("[data-rel-pick]") : null;
    if (t) { toggleRelPick(t.getAttribute("data-rel-pick")); return; }
    t = e.target.closest ? e.target.closest("[data-seg]") : null;
    if (t) { S.picked = t.getAttribute("data-seg"); paint(); return; }
    t = e.target.closest ? e.target.closest("button[data-del-rel]") : null;
    if (t) { delRel(t.getAttribute("data-del-rel")); return; }
    t = e.target.closest ? e.target.closest("button[data-demo-key]") : null;
    if (t) { addNestedDemo(t.getAttribute("data-demo-key")); return; }
    t = e.target.closest ? e.target.closest("button[data-dg]") : null;
    if (t) { S.dg = Number(t.getAttribute("data-dg")) || 0; paint(); return; }
  }

  var RENDER = {
    cut: renderCut,
    elements: renderElements,
    relations: renderRelations,
    diagram: renderDiagram
  };

  function renderView(root, params) {
    ensure();
    hostRoot = root;
    canEdit = APP.role() === "annotator" || (APP.role() === "student" && APP.state.practice);
    if (APP.role() === "admin" && !S.adminDetail) {
      renderAdminOverview(root);
      root.addEventListener("click", onClick);
      return;
    }
    if (params && TAB_IDS.indexOf(params.mode) >= 0) S.tab = params.mode;
    else if (!S.rendered) S.tab = S.cutSubmitted ? (APP.store.get("segments").filter(function (s) { return s.type; }).length ? "relations" : "elements") : "cut";
    S.rendered = true;
    APP.state.annotateMode = S.tab;
    root.innerHTML =
      '<div class="page">' +
      headHtml() +
      '<div class="tabs">' + TABS.map(function (t) {
        return '<button type="button" data-tab="' + t.id + '"' + (S.tab === t.id ? ' class="active"' : "") + ">" + t.label + "</button>";
      }).join("") + "</div>" +
      '<div class="va-body"></div>' +
      "</div>";
    paint();
    root.addEventListener("click", onClick);
    root.addEventListener("mousedown", onMouseDown);
    root.addEventListener("mouseover", onMouseOver);
    root.addEventListener("mouseout", onMouseOut);
  }

  APP.registerView("annotate", {
    title: "标注工作台",
    render: renderView,
    leave: function () {
      S.adminDetail = false;
      dragState = null;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }
  });
})();
