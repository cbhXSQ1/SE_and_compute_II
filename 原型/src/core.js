window.APP = (function () {
  var state = {
    role: "admin",
    view: "tasks",
    params: {},
    currentTaskId: "T1",
    currentDocId: "D1",
    practice: false,
    annotateMode: "cut"
  };
  var views = {};
  var ROLE_NAMES = {
    admin: "管理员",
    teacher: "教师",
    annotator: "标注员",
    student: "学生",
    adjudicator: "仲裁员",
    expert: "领域专家"
  };
  var NAV = [
    { id: "tasks", label: "任务列表", roles: ["admin", "teacher", "annotator", "student", "adjudicator", "expert"] },
    { id: "people", label: "人员管理", roles: ["admin"] },
    { id: "create", label: "任务创建", roles: ["admin", "teacher"] },
    { id: "annotate", label: "标注工作台", roles: ["admin", "annotator", "student"] },
    { id: "adjudicate", label: "裁定", roles: ["admin", "adjudicator", "expert"] },
    { id: "export", label: "导出", roles: ["admin", "adjudicator"] },
    { id: "teaching", label: "教学展示", roles: ["admin", "teacher", "student"] }
  ];

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function registerView(id, def) {
    views[id] = def;
  }

  function currentView() {
    return views[state.view];
  }

  function goto(id, params, skipHistory) {
    var prev = currentView();
    if (prev && prev.leave) prev.leave();
    state.view = id;
    state.params = params || {};
    if (id !== "annotate" && id !== "teaching") state.practice = false;
    var host = document.getElementById("view-root");
    host.innerHTML = "";
    var root = document.createElement("div");
    host.appendChild(root);
    var view = views[id];
    if (!view) {
      root.innerHTML = '<div class="page"><div class="empty">该页面尚未实现</div></div>';
    } else {
      view.render(root, state.params);
    }
    updateNav();
    if (!skipHistory) {
      try { history.pushState(null, "", "#" + id); } catch (e) {}
    }
    window.scrollTo(0, 0);
  }

  function updateNav() {
    var nav = document.getElementById("topnav");
    if (!nav) return;
    Array.prototype.forEach.call(nav.querySelectorAll("button"), function (b) {
      b.classList.toggle("active", b.getAttribute("data-view") === state.view);
    });
  }

  function canView(id) {
    var item = NAV.filter(function (n) { return n.id === id; })[0];
    if (!item || !item.roles) return true;
    return item.roles.indexOf(state.role) !== -1;
  }

  function renderTopbar() {
    var topbar = document.getElementById("topbar");
    var roleOptions = Object.keys(ROLE_NAMES).map(function (k) {
      return '<option value="' + k + '"' + (k === state.role ? " selected" : "") + ">" + ROLE_NAMES[k] + "</option>";
    }).join("");
    topbar.innerHTML =
      '<div class="brand">法律论证标注系统<small>原型 · 裁判文书论证结构标注</small></div>' +
      '<nav class="nav" id="topnav">' +
      NAV.filter(function (n) {
        return !n.roles || n.roles.indexOf(state.role) !== -1;
      }).map(function (n) {
        return '<button type="button" data-view="' + n.id + '">' + n.label + "</button>";
      }).join("") +
      "</nav>" +
      '<div class="spacer"></div>' +
      '<span class="chip"><span class="dot"></span>指南 ' + esc((window.MOCK && window.MOCK.guide.version) || "v1.2") + "</span>" +
      '<div class="role-select">当前角色<select id="role-switch">' + roleOptions + "</select></div>";
    document.getElementById("role-switch").addEventListener("change", function (e) {
      state.role = e.target.value;
      renderTopbar();
      if (canView(state.view)) goto(state.view, state.params);
      else goto("tasks");
    });
    document.getElementById("topnav").addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-view]");
      if (btn) goto(btn.getAttribute("data-view"));
    });
  }

  function statusTag(status) {
    var map = {
      "待标注": "gray", "标注中": "blue", "已提交": "blue", "待裁定": "amber",
      "已裁定": "green", "已完成": "green", "教学练习": "violet", "已提交练习": "violet"
    };
    var cls = map[status] || "gray";
    return '<span class="tag ' + cls + '">' + esc(status) + "</span>";
  }

  function progress(pct, green) {
    return '<div class="progress' + (green ? " green" : "") + '"><i style="width:' + Math.max(0, Math.min(100, pct)) + '%"></i></div>';
  }

  function toast(msg, kind) {
    var wrap = document.getElementById("toasts");
    var el = document.createElement("div");
    el.className = "toast " + (kind || "");
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(function () { el.remove(); }, 2800);
  }

  function closeModal() {
    document.getElementById("modal-root").innerHTML = "";
  }

  function modal(opts) {
    opts = opts || {};
    var root = document.getElementById("modal-root");
    var actions = (opts.actions || []).map(function (a, i) {
      return '<button type="button" class="btn ' + (a.kind || "") + '" data-idx="' + i + '">' + esc(a.label) + "</button>";
    }).join("");
    root.innerHTML =
      '<div class="modal-mask"><div class="modal' + (opts.wide ? " wide" : "") + '">' +
      '<div class="modal-head"><h3>' + esc(opts.title || "") + '</h3><button type="button" class="modal-close">×</button></div>' +
      '<div class="modal-body">' + (opts.body || "") + "</div>" +
      (actions ? '<div class="modal-actions">' + actions + "</div>" : "") +
      "</div></div>";
    root.querySelector(".modal-close").addEventListener("click", closeModal);
    Array.prototype.forEach.call(root.querySelectorAll(".modal-actions button"), function (b) {
      b.addEventListener("click", function () {
        var a = opts.actions[Number(b.getAttribute("data-idx"))];
        var keep = a.onClick && a.onClick();
        if (keep !== false) closeModal();
      });
    });
  }

  function confirmDialog(msg, onOk) {
    modal({
      title: "确认操作",
      body: "<p>" + esc(msg) + "</p>",
      actions: [
        { label: "取消", kind: "" },
        { label: "确认", kind: "primary", onClick: onOk }
      ]
    });
  }

  function pending(feature) {
    modal({
      title: "细节待确认",
      body: "<p>「" + esc(feature) + "」的实现细节尚未定稿，已记录在《问题.txt》。原型中暂以示意方式呈现。</p>",
      actions: [{ label: "知道了", kind: "primary" }]
    });
  }

  function addStyle(id, css) {
    if (document.getElementById("style-" + id)) return;
    var el = document.createElement("style");
    el.id = "style-" + id;
    el.textContent = css;
    document.head.appendChild(el);
  }

  function role() {
    return state.role;
  }
  function roleName() {
    return ROLE_NAMES[state.role] || state.role;
  }

  function fmtDate(d) {
    var t = new Date();
    function p(n) { return (n < 10 ? "0" : "") + n; }
    return d + " " + p(t.getHours()) + ":" + p(t.getMinutes());
  }

  function syncFromHash() {
    var h = (location.hash || "").replace("#", "");
    if (views.hasOwnProperty(h) && h !== state.view) goto(h, {}, true);
  }

  window.addEventListener("popstate", syncFromHash);
  window.addEventListener("hashchange", syncFromHash);

  function boot() {
    renderTopbar();
    var h = (location.hash || "").replace("#", "");
    goto(views[h] ? h : "tasks", {}, true);
  }

  window.addEventListener("load", boot);

  return {
    state: state,
    views: views,
    registerView: registerView,
    goto: goto,
    esc: esc,
    role: role,
    roleName: roleName,
    fmtDate: fmtDate,
    data: window.MOCK,
    ui: {
      toast: toast,
      modal: modal,
      closeModal: closeModal,
      confirm: confirmDialog,
      pending: pending,
      addStyle: addStyle,
      statusTag: statusTag,
      progress: progress
    }
  };
})();
