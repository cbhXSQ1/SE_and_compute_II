(function () {
  APP.ui.addStyle("view-teaching",
    ".vt-quiz .q-item{border:1px solid var(--line);border-radius:8px;padding:10px 12px;margin-bottom:10px;background:#fff}" +
    ".vt-quiz .q-title{font-weight:600;margin-bottom:6px}" +
    ".vt-quiz label.opt{display:flex;align-items:flex-start;gap:8px;padding:4px 6px;border-radius:6px;cursor:pointer;font-size:13px;border:1px solid transparent}" +
    ".vt-quiz label.opt:hover{background:#f7faff}" +
    ".vt-quiz label.opt input{width:auto;margin-top:3px}" +
    ".vt-quiz label.opt.correct{background:var(--green-weak);border-color:#bfe3d0}" +
    ".vt-quiz label.opt.wrong{background:var(--red-weak);border-color:#f0c6c2}" +
    ".vt-clip{display:block;max-width:560px}" +
    ".vt-diagram-item{display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:#fff;font-size:13px}" +
    ".vt-comment{border:1px solid var(--line);border-radius:8px;padding:10px 12px;background:#fff;margin-bottom:8px}" +
    ".vt-comment .head{display:flex;align-items:center;gap:8px;margin-bottom:4px}" +
    ".btn.disabled{opacity:.5;cursor:not-allowed}" +
    ".btn.disabled:hover{background:#fff;border-color:var(--line)}" +
    ".btn.primary.disabled:hover{background:var(--primary);border-color:var(--primary)}"
  );

  var TABS = [
    { id: "guide", label: "指南学习" },
    { id: "sample", label: "标准样例" },
    { id: "try", label: "试标练习" },
    { id: "compare", label: "比对练习" },
    { id: "comment", label: "批注评价" }
  ];

  var TYPE_TAG = {
    SF: "amber", SM: "blue", "SM-C": "blue",
    "GM-L": "green", "GM-I": "green", "GM-U": "green", "GM-M": "green", "GM-O": "green"
  };

  var READONLY_MSG = "管理员为只读查看；教学操作请由教师/学生账号完成。";

  function actBtn(act, label, cls, locked, lockMsg) {
    return '<button type="button" class="btn' + (cls ? " " + cls : "") + (locked ? " disabled" : "") +
      '" data-act="' + act + '"' +
      (locked ? ' aria-disabled="true" data-lock="' + APP.esc(lockMsg) + '"' : "") +
      ">" + label + "</button>";
  }

  function clip(s, n) {
    s = String(s == null ? "" : s);
    return s.length > n ? s.slice(0, n) + "…" : s;
  }

  function optionLetter(i) {
    return String.fromCharCode(65 + i);
  }

  function nowStamp() {
    var d = new Date();
    function p(n) { return (n < 10 ? "0" : "") + n; }
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
  }

  function tagFor(type) {
    if (!type) return '<span class="tag gray">未标注</span>';
    return '<span class="tag ' + (TYPE_TAG[type] || "blue") + '">' + APP.esc(type) + "</span>";
  }

  function tabsHtml(active) {
    return '<div class="tabs">' + TABS.map(function (t) {
      return '<button type="button" data-tab="' + t.id + '"' + (t.id === active ? ' class="active"' : "") + ">" + t.label + "</button>";
    }).join("") + "</div>";
  }

  function guidePanel(role) {
    var g = APP.data.guide;
    var quiz = APP.data.teaching.quiz;
    var items = quiz.map(function (item, i) {
      var opts = item.options.map(function (o, j) {
        return '<label class="opt"><input type="radio" name="q' + i + '" value="' + j + '"><span>' + optionLetter(j) + ". " + APP.esc(o) + "</span></label>";
      }).join("");
      return '<div class="q-item" data-q="' + i + '"><div class="q-title">' + (i + 1) + ". " + APP.esc(item.q) + "</div>" + opts + '<div class="q-feedback mt8"></div></div>';
    }).join("");
    var locked = role !== "student";
    var lockMsg = role === "teacher" ? "理解确认为学生/标注员环节" : READONLY_MSG;
    var hint = role === "teacher" ? '<div class="notice info mt12">理解确认为学生/标注员环节；教师可查看题目，不可代为提交。</div>' : "";
    return (
      '<div class="card mb12">' +
      "<h3>指南学习</h3>" +
      '<p class="muted small">依《指南》8.2.1：培训后进行指南学习并完成理解确认。请阅读《' + APP.esc(g.file) + "》后完成下列题目。</p>" +
      '<div class="row small muted"><span>指南版本</span><span class="code-chip">' + APP.esc(g.version) + "</span><span>导入时间 " + APP.esc(g.importedAt) + "</span></div>" +
      "</div>" +
      '<div class="card vt-quiz">' +
      '<div class="row mb12"><h3 style="margin:0">理解确认</h3><span class="spacer"></span><span class="vt-score small muted">得分 — / ' + quiz.length + "</span></div>" +
      items +
      '<div class="row">' + actBtn("quiz-submit", "提交答案", "primary", locked, lockMsg) + "</div>" +
      hint +
      '<div class="vt-quiz-notice mt12"></div>' +
      "</div>"
    );
  }

  function samplePanel(role) {
    var doc = APP.data.doc;
    var segments = APP.data.segments;
    var rows = segments.map(function (s) {
      return "<tr><td class='mono'>" + APP.esc(s.id) + "</td><td><span class='vt-clip' title='" + APP.esc(s.text) + "'>" + APP.esc(clip(s.text, 26)) + "</span></td><td>" + tagFor(s.type) + "</td></tr>";
    }).join("");
    var dgItems = APP.data.diagrams.map(function (d) {
      return '<div class="vt-diagram-item"><span class="tag violet">' + APP.esc(d.title) + '</span><span class="spacer"></span><span class="small muted">要素节点 ' + d.nodes.length + " 个 · 关系节点 " + d.relNodes.length + " 个</span></div>";
    }).join("");
    var publishBtn = role === "student" ? "" : actBtn("publish-sample", "发布/更新标准样例", "small", role !== "teacher", READONLY_MSG);
    return (
      '<div class="grid cols-2 mb12">' +
      '<div class="card">' +
      "<h3>文书一：余某、徐某劳务合同纠纷</h3>" +
      '<dl class="kv">' +
      "<dt>案号</dt><dd class='mono'>" + APP.esc(doc.caseNo) + "</dd>" +
      "<dt>法院</dt><dd>" + APP.esc(doc.court) + "</dd>" +
      "<dt>案由</dt><dd>" + APP.esc(doc.cause) + "</dd>" +
      "</dl>" +
      '<p class="small muted mt8">' + APP.esc(doc.title) + "（" + APP.esc(doc.trial) + " · " + APP.esc(doc.resultType) + "）</p>" +
      "</div>" +
      '<div class="card">' +
      "<h3>图示摘要</h3>" +
      '<div style="display:flex;flex-direction:column;gap:8px">' + dgItems + "</div>" +
      '<div class="row mt12"><button type="button" class="btn" data-act="goto-diagram">在标注工作台查看</button></div>' +
      "</div>" +
      "</div>" +
      '<div class="card">' +
      '<div class="row mb8"><h3 style="margin:0">标准标注结果（要素）</h3><span class="spacer"></span><span class="small muted">共 ' + segments.length + " 个要素</span>" + publishBtn + "</div>" +
      '<table class="table"><thead><tr><th style="width:70px">编号</th><th>原文</th><th style="width:90px">类型</th></tr></thead><tbody>' + rows + "</tbody></table>" +
      "</div>"
    );
  }

  function practicePanel(role) {
    var on = !!APP.state.practice;
    var quizCount = APP.data.teaching.quiz.length;
    var canPractice = role === "student";
    var lockMsg = role === "teacher" ? "试标由学生完成；教师可布置练习（演示）" : READONLY_MSG;
    var teacherHint = role === "teacher" ? '<div class="notice info mb12">试标由学生完成；教师可布置练习（演示）。</div>' : "";
    var practiceCard =
      '<div class="card">' +
      "<h3>试标练习</h3>" +
      '<p class="muted small">复用文本切割、命题标注、关系标注流程；练习数据与正式任务数据隔离（细节待确认）。</p>' +
      (on ? '<div class="notice info mb12">当前处于练习模式</div>' : "") +
      teacherHint +
      '<div class="row">' +
      actBtn("start-practice", "开始试标", "primary", !canPractice, lockMsg) +
      (on ? actBtn("exit-practice", "退出练习", "", !canPractice, lockMsg) : "") +
      (role === "teacher" ? actBtn("assign-practice", "布置练习（演示）", "", false) : "") +
      "</div>" +
      "</div>";
    var quizCard = role === "student"
      ? ""
      : '<div class="card"><h3>试题发布</h3><p class="muted small">当前试题 ' + quizCount + ' 道（单选，用于指南理解确认）。</p><div class="row">' +
        actBtn("publish-quiz", "发布试题", "", role !== "teacher", READONLY_MSG) + "</div></div>";
    return '<div class="grid cols-2">' + practiceCard + quizCard + "</div>";
  }

  function comparePanel() {
    var diffs = APP.data.teaching.studentDiffs;
    var rows = diffs.map(function (d) {
      return "<tr><td><div>" + APP.esc(d.kind) + '</div><div class="small muted">' + APP.esc(d.desc) + "</div></td>" +
        "<td><div class='diff-b'>" + APP.esc(d.standard) + "</div></td>" +
        "<td><div class='diff-a'>" + APP.esc(d.student) + "</div></td></tr>";
    }).join("");
    return (
      '<div class="card">' +
      '<div class="row mb12"><h3 style="margin:0">比对练习与标准结果</h3><span class="spacer"></span><span class="tag amber">差异 ' + diffs.length + " 处</span></div>" +
      '<div class="row mb12"><span class="small muted">比对方式（自动/人工）与反馈维度待确认。</span><span class="spacer"></span><button type="button" class="btn small" data-act="compare-detail">查看详情</button></div>' +
      '<table class="table"><thead><tr><th style="width:34%">差异类型</th><th style="width:33%">标准结果</th><th style="width:33%">学生结果</th></tr></thead><tbody>' + rows + "</tbody></table>" +
      "</div>"
    );
  }

  function commentListHtml() {
    var list = APP.data.teaching.comments;
    if (!list.length) return '<div class="empty">暂无批注</div>';
    return list.map(function (c) {
      return '<div class="vt-comment"><div class="head"><span class="tag violet">' + APP.esc(c.teacher) + '</span><span class="small muted">' + APP.esc(c.time) + "</span></div><div>" + APP.esc(c.text) + "</div></div>";
    }).join("");
  }

  function commentPanel(role) {
    var list = APP.data.teaching.comments;
    var form;
    if (role === "teacher") {
      form = '<div class="card mt12"><h3>提交批注</h3><textarea data-role="comment-input" placeholder="填写对学生的评价与修改建议"></textarea><div class="row mt8">' + actBtn("comment-submit", "提交批注", "primary", false) + "</div></div>";
    } else if (role === "student") {
      form = '<div class="notice info mt12">批注由教师填写，学生仅可查看。</div>';
    } else {
      form = '<div class="card mt12"><h3>提交批注</h3><textarea data-role="comment-input" placeholder="填写对学生的评价与修改建议" disabled></textarea><div class="row mt8">' + actBtn("comment-submit", "提交批注", "primary", true, READONLY_MSG) + "</div></div>";
    }
    return (
      '<div class="card">' +
      '<div class="row mb8"><h3 style="margin:0">教师批注评价</h3><span class="spacer"></span><span class="small muted vt-comment-count">共 ' + list.length + " 条</span></div>" +
      '<div class="vt-comment-list">' + commentListHtml() + "</div>" +
      "</div>" + form
    );
  }

  function submitQuiz(root) {
    var quiz = APP.data.teaching.quiz;
    var score = 0;
    quiz.forEach(function (item, i) {
      var box = root.querySelector('.q-item[data-q="' + i + '"]');
      if (!box) return;
      var labels = box.querySelectorAll("label.opt");
      Array.prototype.forEach.call(labels, function (l) { l.classList.remove("correct", "wrong"); });
      var checked = box.querySelector('input[name="q' + i + '"]:checked');
      var fb = box.querySelector(".q-feedback");
      var right = optionLetter(item.answer) + ". " + APP.esc(item.options[item.answer]);
      if (!checked) {
        labels[item.answer].classList.add("correct");
        fb.innerHTML = '<span class="err-text">未作答，正确答案：' + right + "</span>";
        return;
      }
      if (Number(checked.value) === item.answer) {
        score++;
        checked.closest("label").classList.add("correct");
        fb.innerHTML = '<span class="ok-text">回答正确</span>';
      } else {
        checked.closest("label").classList.add("wrong");
        labels[item.answer].classList.add("correct");
        fb.innerHTML = '<span class="err-text">回答错误，正确答案：' + right + "</span>";
      }
    });
    var total = quiz.length;
    var scoreEl = root.querySelector(".vt-score");
    if (scoreEl) scoreEl.innerHTML = "得分 <span class='score'>" + score + " / " + total + "</span>";
    var notice = root.querySelector(".vt-quiz-notice");
    if (notice) {
      notice.innerHTML = score === total
        ? '<div class="notice ok">全部正确，理解确认通过。</div>'
        : '<div class="notice">尚未全部正确，请对照正确答案复习《指南》后重新提交。</div>';
    }
    APP.ui.toast("理解确认完成", score === total ? "ok" : "");
  }

  function submitComment(root) {
    var box = root.querySelector('[data-role="comment-input"]');
    if (!box) return;
    var text = box.value.trim();
    if (!text) {
      APP.ui.toast("请先填写批注内容", "warn");
      return;
    }
    APP.data.teaching.comments.push({ teacher: APP.roleName(), time: nowStamp(), text: text });
    var list = root.querySelector(".vt-comment-list");
    if (list) list.innerHTML = commentListHtml();
    var count = root.querySelector(".vt-comment-count");
    if (count) count.textContent = "共 " + APP.data.teaching.comments.length + " 条";
    box.value = "";
    APP.ui.toast("批注已提交", "ok");
  }

  function bind(root, tab) {
    root.addEventListener("click", function (e) {
      var tabBtn = e.target.closest("button[data-tab]");
      if (tabBtn) {
        APP.goto("teaching", { tab: tabBtn.getAttribute("data-tab") });
        return;
      }
      var btn = e.target.closest("button[data-act]");
      if (!btn) return;
      if (btn.classList.contains("disabled")) {
        APP.ui.toast(btn.getAttribute("data-lock") || READONLY_MSG, "warn");
        return;
      }
      var act = btn.getAttribute("data-act");
      if (act === "quiz-submit") submitQuiz(root);
      else if (act === "publish-sample") APP.ui.toast("已发布（演示）");
      else if (act === "goto-diagram") APP.goto("annotate", { mode: "diagram" });
      else if (act === "start-practice") {
        APP.state.practice = true;
        APP.goto("annotate", { mode: "cut" });
        APP.ui.toast("已进入试标练习", "ok");
      } else if (act === "exit-practice") {
        APP.state.practice = false;
        APP.goto("teaching", { tab: "try" });
        APP.ui.toast("已退出练习模式");
      } else if (act === "publish-quiz") APP.ui.toast("试题已发布（演示）");
      else if (act === "assign-practice") APP.ui.toast("已布置练习（演示）", "ok");
      else if (act === "compare-detail") APP.ui.pending("比对练习的比对方式与反馈维度");
      else if (act === "comment-submit") submitComment(root);
    });
    root.addEventListener("change", function (e) {
      var input = e.target.closest(".vt-quiz input[type=radio]");
      if (!input) return;
      var box = input.closest(".q-item");
      if (!box) return;
      Array.prototype.forEach.call(box.querySelectorAll("label.opt"), function (l) { l.classList.remove("correct", "wrong"); });
      var fb = box.querySelector(".q-feedback");
      if (fb) fb.innerHTML = "";
    });
  }

  APP.registerView("teaching", {
    title: "教学展示",
    render: function (root, params) {
      var role = APP.role();
      var readonly = role !== "student" && role !== "teacher";
      var subs = {
        student: "学生：学习《指南》、完成理解确认，参与试标与比对；标注结果由教师批注评价",
        teacher: "教师：发布标准样例与试题、布置练习（演示）、批注评价；标注操作由学生/标注员完成"
      };
      var tab = params && params.tab;
      if (!tab || !TABS.some(function (t) { return t.id === tab; })) tab = TABS[0].id;

      var body = "";
      if (tab === "guide") body = guidePanel(role);
      else if (tab === "sample") body = samplePanel(role);
      else if (tab === "try") body = practicePanel(role);
      else if (tab === "compare") body = comparePanel();
      else body = commentPanel(role);

      root.innerHTML =
        '<div class="page">' +
        '<div class="page-head"><div><h2>教学展示</h2><div class="sub">' + (subs[role] || READONLY_MSG) + "</div></div>" +
        '<span class="spacer"></span>' +
        (readonly ? '<span class="tag gray">只读模式</span>' : "") +
        '<span class="tag violet">当前角色：' + APP.esc(APP.roleName()) + "</span></div>" +
        (readonly ? '<div class="notice mt12">' + READONLY_MSG + "</div>" : "") +
        tabsHtml(tab) +
        body +
        '<div class="notice info mt16">教学数据与正式数据集隔离方式待确认（见问题清单）。</div>' +
        "</div>";

      bind(root, tab);
    }
  });
})();
