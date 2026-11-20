(function () {
  var ITEMS = [
    { id: "png", label: "论证图示 PNG", data: false },
    { id: "jpg", label: "论证图示 JPG", data: false },
    { id: "svg", label: "论证图示 SVG", data: false },
    { id: "excel", label: "标注数据 Excel", data: true },
    { id: "json", label: "标注数据 JSON（供模型训练）", data: true },
    { id: "guide", label: "对应版本指南文档", data: false }
  ];
  var RO_NOTES = {
    teacher: "教师如需教学数据导出，请在教学展示中使用练习导出（待定）。"
  };
  var store = { checked: null, name: "导出_文书一_20260923", busy: false, records: null };
  var lastExport = { done: false, time: "", content: "" };
  var host = null;
  var canExp = false;

  function nowStr() {
    var t = new Date();
    function p(n) { return (n < 10 ? "0" : "") + n; }
    return t.getFullYear() + "-" + p(t.getMonth() + 1) + "-" + p(t.getDate()) + " " + p(t.getHours()) + ":" + p(t.getMinutes());
  }

  function guideVer() {
    return (APP.data.guide && APP.data.guide.version) || "v1.2";
  }

  function taskId() {
    return APP.state.currentTaskId || (APP.data.doc && APP.data.doc.taskId) || "T1";
  }

  function ensure() {
    if (!store.checked) {
      store.checked = {};
      ITEMS.forEach(function (it) { store.checked[it.id] = true; });
    }
    if (!store.records) {
      store.records = (APP.data.exports || []).map(function (r) {
        return { time: r.time, user: r.user, guide: r.guide, content: r.content };
      });
    }
  }

  function itemsHTML() {
    return ITEMS.map(function (it) {
      return '<label class="checkbox"><input type="checkbox" data-item="' + it.id + '"' +
        (store.checked[it.id] ? " checked" : "") + (canExp ? "" : " disabled") + "> " + APP.esc(it.label) + "</label>";
    }).join("");
  }

  function recordsHTML() {
    if (!store.records.length) return '<tr><td colspan="4" class="muted">暂无导出记录</td></tr>';
    return store.records.map(function (r) {
      return "<tr><td>" + APP.esc(r.time) + "</td><td>" + APP.esc(r.user) + "</td><td>" + APP.esc(r.guide) +
        "</td><td>" + APP.esc(r.content) + "</td></tr>";
    }).join("");
  }

  function layoutHTML() {
    return '<div class="page">' +
      '<div class="page-head"><div><h2>结果输出 / 导出</h2><div class="sub">导出后数据可查看但不可修改；如需重标需重新创建任务。</div></div>' +
      '<span class="spacer"></span>' +
      '<span class="tag gray">任务 ' + APP.esc(taskId()) + "</span>" +
      '<span class="tag gray">指南 ' + APP.esc(guideVer()) + "</span>" +
      (canExp ? "" : '<span class="tag gray">只读模式</span>') +
      "</div>" +
      (canExp ? "" : '<div class="notice mt12">' + APP.esc(RO_NOTES[APP.role()] || "当前角色为只读查看。") + "</div>") +
      '<div class="exp-layout">' +
      '<div class="exp-col">' +
      '<div class="card">' +
      '<h3 class="mb8">导出内容</h3>' +
      '<div class="small muted mb12">默认勾选全部内容，可按需调整。</div>' +
      '<div class="row mb12">' +
      '<button type="button" class="btn small" data-act="all"' + (canExp ? "" : ' aria-disabled="true" data-lock="只读模式：当前角色不能执行导出操作"') + ">全部</button>" +
      '<button type="button" class="btn small" data-act="data-only"' + (canExp ? "" : ' aria-disabled="true" data-lock="只读模式：当前角色不能执行导出操作"') + ">仅数据</button>" +
      "</div>" +
      '<div class="exp-items" data-slot="items">' + itemsHTML() + "</div>" +
      '<div class="mt12' + (lastExport.done ? "" : " hidden") + '" data-slot="progress">' +
      '<div class="row mb8"><span class="small muted">导出进度</span><span class="spacer"></span><span class="small exp-pct">' +
      (lastExport.done ? "100%" : "0%") + "</span></div>" +
      '<div class="progress"><i style="width:' + (lastExport.done ? "100%" : "0%") + '"></i></div>' +
      "</div>" +
      '<div class="row mt12">' +
      '<button type="button" class="btn primary" data-act="export" data-slot="export-btn"' + (canExp ? "" : ' aria-disabled="true" data-lock="只读模式：当前角色不能执行导出操作"') + ">导出</button>" +
      '<button type="button" class="btn ok' + (lastExport.done ? "" : " hidden") + '" data-act="download" data-slot="download"' + (canExp ? "" : ' aria-disabled="true" data-lock="只读模式：当前角色不能执行导出操作"') + ">下载压缩包</button>" +
      "</div>" +
      "</div>" +
      '<div class="card">' +
      '<h3 class="mb8">文件命名</h3>' +
      '<div class="form-row"><label for="exp-name">导出文件名称</label>' +
      '<input type="text" id="exp-name" value="' + APP.esc(store.name) + '"></div>' +
      '<div class="small muted">提示：导出需指明并附带对应版本的指南文档。</div>' +
      "</div>" +
      "</div>" +
      '<div class="exp-col">' +
      '<div class="card">' +
      '<h3 class="mb8">导出记录</h3>' +
      '<table class="table"><thead><tr><th>时间</th><th>用户</th><th>指南版本</th><th>内容</th></tr></thead>' +
      '<tbody data-slot="records">' + recordsHTML() + "</tbody></table>" +
      "</div>" +
      '<div class="notice">① 导出后数据不可再编辑，如需重标请重新创建任务。</div>' +
      '<div class="notice mt8">② 导出数据不加密，请妥善保管。</div>' +
      '<div class="notice info mt8">' +
      "<div>③ 再导入：将已导出的标注结果重新导入本系统。</div>" +
      '<button type="button" class="btn small mt8" data-act="reimport">导入标注结果</button>' +
      "</div>" +
      "</div>" +
      "</div>" +
      "</div>";
  }

  function paintItems() {
    var el = host.querySelector('[data-slot="items"]');
    if (el) el.innerHTML = itemsHTML();
  }

  function paintRecords() {
    var el = host.querySelector('[data-slot="records"]');
    if (el) el.innerHTML = recordsHTML();
  }

  function paintProgress(pct) {
    var wrap = host.querySelector('[data-slot="progress"]');
    if (!wrap) return;
    wrap.classList.remove("hidden");
    var bar = wrap.querySelector(".progress > i");
    var pctEl = wrap.querySelector(".exp-pct");
    if (bar) bar.style.width = pct + "%";
    if (pctEl) pctEl.textContent = pct + "%";
  }

  function runExport() {
    if (!canExp || store.busy) return;
    var picked = ITEMS.filter(function (it) { return store.checked[it.id]; });
    if (!picked.length) {
      APP.ui.toast("请至少选择一项导出内容", "warn");
      return;
    }
    store.busy = true;
    lastExport = { done: false, time: "", content: "" };
    var dl = host.querySelector('[data-slot="download"]');
    var eb = host.querySelector('[data-slot="export-btn"]');
    if (!host.querySelector('[data-slot="progress"]') || !dl) {
      store.busy = false;
      return;
    }
    dl.classList.add("hidden");
    if (eb) eb.disabled = true;
    paintProgress(0);
    var pct = 0;
    var timer = setInterval(function () {
      pct = Math.min(100, pct + 4);
      paintProgress(pct);
      if (pct >= 100) {
        clearInterval(timer);
        store.busy = false;
        APP.ui.toast("导出完成（演示）", "ok");
        var content = picked.map(function (it) { return it.label; }).join(" + ");
        var time = nowStr();
        store.records.unshift({ time: time, user: APP.roleName(), guide: guideVer(), content: content });
        lastExport = { done: true, time: time, content: content };
        paintRecords();
        var dl2 = host.querySelector('[data-slot="download"]');
        var eb2 = host.querySelector('[data-slot="export-btn"]');
        if (dl2) dl2.classList.remove("hidden");
        if (eb2) eb2.disabled = false;
      }
    }, 48);
  }

  function bind(root) {
    root.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-act]");
      if (!btn) return;
      var act = btn.getAttribute("data-act");
      if (!canExp && act !== "reimport") {
        APP.ui.toast(btn.getAttribute("data-lock") || "只读模式：当前角色不能执行导出操作", "warn");
        return;
      }
      if (act === "all") {
        ITEMS.forEach(function (it) { store.checked[it.id] = true; });
        paintItems();
        return;
      }
      if (act === "data-only") {
        ITEMS.forEach(function (it) { store.checked[it.id] = !!it.data; });
        paintItems();
        return;
      }
      if (act === "export") { runExport(); return; }
      if (act === "download") { APP.ui.toast("模拟下载"); return; }
      if (act === "reimport") { APP.ui.pending("导出结果再导入（用途待确认）"); }
    });
    root.addEventListener("change", function (e) {
      var key = e.target && e.target.getAttribute && e.target.getAttribute("data-item");
      if (!key) return;
      store.checked[key] = !!e.target.checked;
    });
    root.addEventListener("input", function (e) {
      if (e.target && e.target.id === "exp-name") store.name = e.target.value;
    });
  }

  APP.registerView("export", {
    title: "结果输出 / 导出",
    render: function (root) {
      canExp = ["admin", "adjudicator"].indexOf(APP.role()) !== -1;
      host = root;
      ensure();
      APP.ui.addStyle("view-export-ro", ".btn[aria-disabled=true]{opacity:.5;cursor:not-allowed}");
      APP.ui.addStyle("view-export",
        ".exp-layout{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:14px;align-items:start}\n" +
        ".exp-col{display:flex;flex-direction:column;gap:14px;min-width:0}\n" +
        ".exp-items{display:flex;flex-direction:column;gap:8px}\n" +
        "@media (max-width:1100px){.exp-layout{grid-template-columns:1fr}}");
      root.innerHTML = layoutHTML();
      bind(root);
    }
  });
})();
