(function () {
  var ROLE_HINTS = {
    admin: "管理任务、分配标注人员、指定仲裁员与指南版本。",
    teacher: "创建教学练习任务、发布标准样例与试题。",
    annotator: "完成分配给你的切割、要素与关系标注任务。",
    student: "完成指南学习、试标练习与比对练习。",
    adjudicator: "比对各份标注结果，裁定冲突并形成最终版本。",
    expert: "对核心概念分歧进行裁决并更新疑难问题说明文档。"
  };

  function taskActions(task, role) {
    var actions = [];
    if (role === "annotator" && task.status === "标注中") {
      actions.push({ label: "继续标注", kind: "primary", act: "annotate" });
    }
    if (role === "annotator" && task.teaching) {
      actions.push({ label: "进入练习", kind: "primary", act: "teaching" });
    }
    if (role === "annotator" && !task.teaching && (task.status === "待裁定" || task.status === "已完成")) {
      actions.push({ label: "查看比对结果", act: "compare" });
    }
    if ((role === "adjudicator" || role === "expert") && task.status === "待裁定") {
      actions.push({ label: "开始裁定", kind: "primary", act: "adjudicate" });
    }
    if (role === "admin" && task.status !== "教学练习") {
      actions.push({ label: "查看标注", act: "annotate" });
    }
    if (role === "teacher" && task.teaching) {
      actions.push({ label: "教学管理", kind: "primary", act: "teaching" });
    }
    if (role === "student" && task.teaching) {
      actions.push({ label: "开始练习", kind: "primary", act: "teaching" });
    }
    if (task.status === "已完成") {
      actions.push({ label: "导出", act: "export" });
    }
    actions.push({ label: "详情", act: "detail" });
    return actions;
  }

  function card(task, role) {
    var actions = taskActions(task, role).map(function (a) {
      return '<button type="button" class="btn small ' + (a.kind || "") + '" data-act="' + a.act + '" data-id="' + task.id + '">' + a.label + "</button>";
    }).join("");
    return (
      '<div class="card card-hover">' +
      '<div class="row mb8"><h3 style="margin:0">' + APP.esc(task.name) + "</h3><span class='spacer'></span>" + APP.ui.statusTag(task.status) + "</div>" +
      '<div class="kv mb8">' +
      "<dt>文书数量</dt><dd>" + task.docCount + " 份</dd>" +
      "<dt>指南版本</dt><dd><span class='code-chip'>" + APP.esc(task.guide) + "</span></dd>" +
      "<dt>标注人员</dt><dd>" + APP.esc(task.annotators.join("、")) + "（双人独立）</dd>" +
      "<dt>仲裁员</dt><dd>" + APP.esc(task.adjudicator) + "</dd>" +
      (task.due ? "<dt>截止日期</dt><dd>" + APP.esc(task.due) + "</dd>" : "") +
      "</div>" +
      '<div class="row mb8"><span class="small muted">进度</span><span class="spacer"></span><span class="small">' + task.progress + "%</span></div>" +
      APP.ui.progress(task.progress) +
      '<div class="row mt12">' + actions + "</div>" +
      "</div>"
    );
  }

  function adminSummary() {
    var tasks = (APP.data && APP.data.tasks) || [];
    var users = (APP.data && APP.data.users) || [];
    function count(s) {
      return tasks.filter(function (t) { return t.status === s; }).length;
    }
    return (
      '<div class="grid cols-4 mb16">' +
      '<div class="card pad-sm"><div class="small muted">任务总数</div><div class="score">' + tasks.length + '</div><div class="small muted">标注中 ' + count("标注中") + " · 待裁定 " + count("待裁定") + "</div></div>" +
      '<div class="card pad-sm"><div class="small muted">已完成</div><div class="score">' + count("已完成") + '</div><div class="small muted">教学练习 ' + count("教学练习") + "</div></div>" +
      '<div class="card pad-sm"><div class="small muted">人员</div><div class="score">' + users.length + '</div><div class="small muted">一人可多角色 · 可授予特权</div></div>' +
      '<div class="card pad-sm"><div class="small muted">指南版本</div><div class="score" style="font-size:18px">' + APP.esc((APP.data && APP.data.guide && APP.data.guide.version) || "v1.2") + '</div><div class="small muted">任务期间标签冻结</div></div>' +
      "</div>"
    );
  }

  function consistencyCard() {
    var c = (APP.data && APP.data.consistency) || {};
    var kappa = c.kappa != null ? c.kappa : "—";
    var threshold = c.threshold != null ? c.threshold : "—";
    var sample = c.sample != null ? c.sample : "—";
    var period = c.period || "每周";
    return (
      '<div class="card mt16">' +
      '<div class="row mb8"><h3 style="margin:0">标注一致性</h3><span class="spacer"></span><span class="tag green">Kappa ' + APP.esc(kappa) + "</span></div>" +
      '<dl class="kv">' +
      "<dt>一致性阈值</dt><dd>" + APP.esc(threshold) + "</dd>" +
      "<dt>样本量</dt><dd>" + APP.esc(sample) + " 份</dd>" +
      "<dt>计算周期</dt><dd>" + APP.esc(period) + "计算</dd>" +
      "</dl>" +
      '<p class="small muted mt8">一致性指标与典型分歧定期反馈（《指南》8.3）。</p>' +
      "</div>"
    );
  }

  function detail(task) {
    APP.ui.modal({
      title: task.name,
      body:
        "<p class='muted'>任务详情（原型示意）</p>" +
        "<dl class='kv'>" +
        "<dt>状态</dt><dd>" + APP.ui.statusTag(task.status) + "</dd>" +
        "<dt>指南版本</dt><dd>" + APP.esc(task.guide) + "</dd>" +
        "<dt>标注人员</dt><dd>" + APP.esc(task.annotators.join("、")) + "</dd>" +
        "<dt>仲裁员</dt><dd>" + APP.esc(task.adjudicator) + "</dd>" +
        "<dt>文书数量</dt><dd>" + task.docCount + " 份</dd>" +
        "<dt>截止日期</dt><dd>" + (task.due || "—") + "</dd>" +
        "</dl>",
      actions: [{ label: "关闭", kind: "primary" }]
    });
  }

  APP.registerView("tasks", {
    title: "任务列表",
    render: function (root) {
      var role = APP.role();
      var user = APP.currentUser();
      var tasks = APP.annotateLogic.visibleTasks(APP.data.tasks, user);
      var quick = "";
      if (role === "annotator") quick = '<button type="button" class="btn primary" data-quick="next">下一条任务</button>';
      if (role === "admin") quick = '<button type="button" class="btn primary" data-quick="create">新建标注任务</button>';
      if (role === "adjudicator" || role === "expert") quick = '<button type="button" class="btn primary" data-quick="adjudicate">查看待裁定任务</button>';
      if (role === "teacher" || role === "student") quick = '<button type="button" class="btn primary" data-quick="teaching">进入教学展示</button>';

      root.innerHTML =
        '<div class="page">' +
        '<div class="page-head"><div><h2>任务列表</h2><div class="sub">当前用户：' + APP.esc(user.name) + "（" + APP.roleName() + "）。" + ROLE_HINTS[role] + "</div></div><span class='spacer'></span>" + quick + "</div>" +
        (role === "admin" ? adminSummary() : "") +
        (tasks.length
          ? '<div class="grid cols-3">' + tasks.map(function (t) { return card(t, role); }).join("") + "</div>"
          : '<div class="empty">当前用户 ' + APP.esc(user.name) + " 名下暂无可见任务。</div>") +
        ((role === "admin" || role === "adjudicator" || role === "expert") ? consistencyCard() : "") +
        '<div class="notice info mt16">演示提示：任务列表已按「当前用户」隔离——标注员仅见分配给自己的文书，仲裁员仅见指定给自己的任务，学生/教师仅见教学练习；可切换右上角用户查看不同视角。</div>' +
        "</div>";

      root.addEventListener("click", function (e) {
        var quickBtn = e.target.closest("button[data-quick]");
        if (quickBtn) {
          var q = quickBtn.getAttribute("data-quick");
          if (q === "create") APP.goto("create");
          if (q === "next") {
            var t0 = tasks[0];
            if (!t0) { APP.ui.toast("名下暂无待标注任务", "warn"); return; }
            APP.state.currentTaskId = t0.id;
            APP.goto("annotate", { mode: "cut", taskId: t0.id });
          }
          if (q === "adjudicate") APP.goto("adjudicate");
          if (q === "teaching") APP.goto("teaching");
          return;
        }
        var btn = e.target.closest("button[data-act]");
        if (!btn) return;
        var task = APP.data.tasks.filter(function (t) { return t.id === btn.getAttribute("data-id"); })[0];
        var act = btn.getAttribute("data-act");
        APP.state.currentTaskId = task.id;
        if (act === "annotate") APP.goto("annotate", { mode: task.teaching ? "cut" : "cut", taskId: task.id });
        if (act === "adjudicate") APP.goto("adjudicate");
        if (act === "compare") APP.goto("adjudicate", { compare: true });
        if (act === "export") APP.goto("export");
        if (act === "teaching") { APP.state.practice = task.teaching; APP.goto("teaching"); }
        if (act === "detail") detail(task);
      });
    }
  });
})();
