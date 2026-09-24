(function () {
  var STEP_NAMES = ["上传文书", "确定标注范围", "案例信息", "导入指南", "分配人员"];
  var DOC_TYPES = ["原始判决书", "指导性案例", "参考案例"];
  var UPLOAD_POOL = ["民间借贷纠纷判决书", "物业服务合同纠纷判决书", "劳动争议民事判决书"];
  var ANNOTATORS = ["刘标注", "陈标注", "张三"];
  var ADJUDICATORS = ["王仲裁", "孙专家"];
  var TEACHING_ADJUDICATORS = ["赵老师", "王仲裁", "孙专家"];
  var TASK_TYPES = ["科研标注", "教学练习"];
  var CASE_KINDS = ["民事", "刑事", "行政", "执行", "国家赔偿"];
  var GUIDE_GROUPS = [
    { key: "nonProps", title: "非命题要素" },
    { key: "props", title: "命题要素" },
    { key: "relations", title: "关系类型" }
  ];
  var CASE_FIELDS = {
    "原始判决书": [
      { key: "caseNo", label: "案号", ph: "如：(2023)苏0106民初18909号" },
      { key: "court", label: "裁判法院", ph: "如：江苏省南京市鼓楼区人民法院" },
      { key: "level", label: "法院层级", type: "select", options: ["基层法院", "中级法院", "高级法院", "最高人民法院"] },
      { key: "trial", label: "审级", type: "select", options: ["一审", "二审", "再审"] },
      { key: "date", label: "裁判日期", ph: "如：2023年12月28日" },
      { key: "nature", label: "案件性质", type: "select", options: ["民事", "刑事", "行政", "执行"] },
      { key: "cause", label: "案由", ph: "如：劳务合同纠纷" },
      { key: "resultType", label: "裁判结果类型", type: "select", options: ["全部支持", "部分支持", "驳回", "其他"] }
    ],
    "指导性案例": [
      { key: "caseType", label: "案例类型", type: "select", options: ["指导性案例"] },
      { key: "name", label: "案件名称", ph: "如：某某公司与某某公司合同纠纷案" },
      { key: "publishDate", label: "发布时间", ph: "如：2024-05-08" },
      { key: "caseKind", label: "案件类型", type: "select", options: CASE_KINDS },
      { key: "laws", label: "相关法条", type: "textarea", ph: "如：《中华人民共和国民法典》第五百零九条" },
      { key: "point", label: "裁判要点", type: "textarea", ph: "输入裁判要点…" }
    ],
    "参考案例": [
      { key: "caseType", label: "案例类型", type: "select", options: ["参考案例"] },
      { key: "name", label: "案例名称", ph: "如：某某诉某某买卖合同纠纷案" },
      { key: "no", label: "入库编号", ph: "如：2024-08-2-084-001" },
      { key: "caseKind", label: "案件类型", type: "select", options: CASE_KINDS },
      { key: "laws", label: "相关法条", type: "textarea", ph: "如：《中华人民共和国民法典》第五百七十九条" },
      { key: "gist", label: "裁判要旨", type: "textarea", ph: "输入裁判要旨…" }
    ]
  };

  var CSS = `
.create-upload{padding:38px 20px;font-size:15px}
.create-upload strong{color:var(--primary)}
.create-doc-title{color:var(--muted);font-size:12px;margin-top:2px}
.create-bracket{color:var(--primary);font-weight:700}
.create-legend{display:flex;gap:16px;flex-wrap:wrap;font-size:12px;color:var(--muted);margin-top:10px}
.guide-groups{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
@media (max-width:980px){.guide-groups{grid-template-columns:1fr}}
.guide-list{display:flex;flex-direction:column;gap:6px;margin-bottom:8px}
.guide-item{display:flex;align-items:center;justify-content:space-between;gap:8px;border:1px solid var(--line);border-radius:8px;padding:5px 8px;font-size:13px;background:#fff}
.guide-item .del{border:0;background:none;color:var(--muted);cursor:pointer;font-size:15px;line-height:1;padding:2px 6px;border-radius:6px}
.guide-item .del:hover{background:var(--red-weak);color:var(--red)}
.guide-add{display:flex;gap:6px}
.guide-add input{flex:1;min-width:0}
.create-foot{position:sticky;bottom:0;z-index:10;display:flex;align-items:center;gap:10px;margin-top:16px;padding:12px 16px;background:#fff;border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow)}
.create-step-hint{font-size:12px;color:var(--muted)}
.assign-list{display:flex;flex-direction:column;gap:6px;margin-bottom:8px}
.assign-row{display:flex;align-items:center;gap:6px}
.assign-row select{flex:1;min-width:0}
.version-pick{display:flex;flex-direction:column;gap:6px;margin-bottom:8px}
.version-item{display:flex;align-items:flex-start;gap:8px;border:1px solid var(--line);border-radius:8px;padding:8px 10px;font-size:13px;background:#fff;cursor:pointer}
.version-item:hover{border-color:#c9d4e8}
.version-item input{width:auto;margin-top:3px}
.version-item.on{border-color:var(--primary);background:var(--primary-weak)}
.modal-issues{margin:0 0 6px;padding-left:18px;font-size:13px}
.modal-issues li{margin-bottom:4px}
`;

  function today() {
    var d = new Date();
    function p(n) { return (n < 10 ? "0" : "") + n; }
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }

  function optionList(list) {
    return list.map(function (v) {
      return '<option value="' + APP.esc(v) + '">' + APP.esc(v) + "</option>";
    }).join("");
  }

  function personSelect(row, kind, value, list) {
    return '<select data-assign="' + kind + '" data-row="' + row + '">' +
      list.map(function (n) {
        return "<option" + (n === value ? " selected" : "") + ">" + APP.esc(n) + "</option>";
      }).join("") + "</select>";
  }

  function annotatorSelect(row, slot, value) {
    return '<select data-assign="annotator" data-row="' + row + '" data-slot="' + slot + '">' +
      ANNOTATORS.map(function (n) {
        return "<option" + (n === value ? " selected" : "") + ">" + APP.esc(n) + "</option>";
      }).join("") + "</select>";
  }

  function assignCellHtml(row, list) {
    var items = list.map(function (name, slot) {
      return '<div class="assign-row">' + annotatorSelect(row, slot, name) +
        '<button type="button" class="btn small" data-remove-annotator="' + row + '" data-slot="' + slot + '"' +
        (list.length <= 2 ? " disabled" : "") + ' title="移除该标注员">－</button></div>';
    }).join("");
    return '<div class="assign-list">' + items + "</div>" +
      '<button type="button" class="btn small" data-add-annotator="' + row + '">＋ 添加标注员</button>';
  }

  function caseFieldHtml(type, f, value) {
    var v = value == null ? "" : String(value);
    var attrs = 'data-case-field="' + APP.esc(type) + '" data-key="' + APP.esc(f.key) + '"';
    var input;
    if (f.type === "select") {
      input = "<select " + attrs + ">" + f.options.map(function (o) {
        return "<option" + (o === v ? " selected" : "") + ">" + APP.esc(o) + "</option>";
      }).join("") + "</select>";
    } else if (f.type === "textarea") {
      input = '<textarea rows="3" ' + attrs + ' placeholder="' + APP.esc(f.ph || "") + '">' + APP.esc(v) + "</textarea>";
    } else {
      input = '<input type="text" ' + attrs + ' value="' + APP.esc(v) + '" placeholder="' + APP.esc(f.ph || "") + '">';
    }
    return '<div class="form-row"><label>' + APP.esc(f.label) + "</label>" + input + "</div>";
  }

  function rangeHtml(text) {
    var t = APP.esc(text);
    var head = "本院认为，";
    var i = t.indexOf(head);
    if (i < 0) return t;
    var before = t.slice(0, i);
    var rest = t.slice(i + head.length);
    var j = rest.indexOf("综上所述，");
    if (j < 0) j = rest.indexOf("判决如下：");
    var body = rest;
    var tail = "";
    if (j >= 0) { body = rest.slice(0, j); tail = rest.slice(j); }
    tail = tail.split("判决如下：").join('<span class="marked">判决如下：</span>');
    return before +
      '<span class="marked">' + head + '</span><span class="create-bracket">[</span>' +
      body +
      '<span class="create-bracket">]</span>' + tail;
  }

  function guideItemsHtml(group, items) {
    if (!items.length) return '<div class="small muted">暂无条目</div>';
    return items.map(function (txt, i) {
      return '<div class="guide-item"><span>' + APP.esc(txt) + '</span>' +
        '<button type="button" class="del" data-del-guide="' + group + '" data-idx="' + i + '" title="删除">×</button></div>';
    }).join("");
  }

  function guideGroupHtml(group, title, items) {
    return '<div class="panel" data-group-panel="' + group + '">' +
      "<h4>" + title + "（" + items.length + "）</h4>" +
      '<div class="guide-list" data-list="' + group + '">' + guideItemsHtml(group, items) + "</div>" +
      '<div class="guide-add"><input type="text" data-add-input="' + group + '" placeholder="添加一项…">' +
      '<button type="button" class="btn small" data-add-item="' + group + '">添加</button></div>' +
      "</div>";
  }

  function historyHtml(list) {
    return '<table class="table"><thead><tr><th>版本</th><th>日期</th><th>操作人</th><th>适用范围</th><th>说明</th></tr></thead><tbody>' +
      list.map(function (h) {
        return '<tr><td><span class="code-chip">' + APP.esc(h.version) + "</span></td><td>" + APP.esc(h.date) +
          "</td><td>" + APP.esc(h.operator) + "</td><td>" + APP.esc(h.scope || "—") + "</td><td>" + APP.esc(h.note) + "</td></tr>";
      }).join("") + "</tbody></table>" +
      '<div class="small muted mt8">历史版本只读保留；任务绑定某一版本后，不受后续版本更新影响。</div>';
  }

  APP.registerView("create", {
    title: "任务创建",
    render: function (root, params) {
      params = params || {};
      APP.ui.addStyle("view-create", CSS);

      var doc = APP.data.doc;
      var guide = APP.data.guide;
      var role = APP.role();
      var taskType = role === "teacher" ? "教学练习" : "科研标注";
      var selectedVersion = null;
      var step = 1;
      var poolIdx = 0;
      var manualCount = 0;
      var guideImported = false;
      var caseType = doc.type || "原始判决书";
      var files = [
        { name: "文书一", title: doc.title, type: "原始判决书" },
        { name: "买卖合同纠纷判决书", title: "买卖合同纠纷民事一审民事判决书", type: "原始判决书" },
        { name: "租赁合同纠纷判决书", title: "租赁合同纠纷民事一审民事判决书", type: "原始判决书" }
      ];
      var assign = newAssign();
      var parsed = JSON.parse(JSON.stringify(guide.parsed));
      var history = guide.history.map(function (h) {
        return { version: h.version, date: h.date, operator: h.operator, note: h.note, scope: h.scope };
      });
      var caseValues = {
        "原始判决书": {
          caseNo: doc.caseNo, court: doc.court, level: doc.level, trial: doc.trial,
          date: doc.date, nature: doc.nature, cause: doc.cause, resultType: doc.resultType
        },
        "指导性案例": { caseType: "指导性案例", caseKind: "民事" },
        "参考案例": { caseType: "参考案例", caseKind: "民事" }
      };

      function teaching() {
        return taskType === "教学练习";
      }

      function adjudicatorPool() {
        return teaching() ? TEACHING_ADJUDICATORS : ADJUDICATORS;
      }

      function defaultAnnotators() {
        return teaching() ? ["张三", ANNOTATORS[1]] : [ANNOTATORS[0], ANNOTATORS[1]];
      }

      function defaultAssign() {
        return { annotators: defaultAnnotators(), adj: teaching() ? TEACHING_ADJUDICATORS[0] : ADJUDICATORS[0] };
      }

      function latestVersion() {
        return history.length ? history[history.length - 1].version : guide.version;
      }

      function activeVersion() {
        return selectedVersion || latestVersion();
      }

      function pageSubtitle() {
        if (role === "teacher") return "教师创建教学练习任务：标注者默认包含学生，仲裁员默认为教师。";
        if (role === "admin") return "管理员创建科研标注任务：每份文书双人独立标注，并指定仲裁员。";
        return "向导共 5 步：上传文书 → 确定标注范围 → 案例信息 → 导入指南 → 分配人员。当前角色：" + APP.roleName();
      }

      root.innerHTML =
        '<div class="page">' +
        '<div class="page-head"><div><h2>任务创建</h2><div class="sub">' + APP.esc(pageSubtitle()) + "</div></div></div>" +
        '<div class="stepbar" data-stepbar></div>' +
        "<div data-step-content></div>" +
        '<div class="create-foot" data-foot></div>' +
        "</div>";

      var barEl = root.querySelector("[data-stepbar]");
      var contentEl = root.querySelector("[data-step-content]");
      var footEl = root.querySelector("[data-foot]");

      function newAssign() {
        return files.map(function () { return defaultAssign(); });
      }

      function render() {
        barEl.innerHTML = stepbarHtml();
        contentEl.innerHTML = contentHtml();
        footEl.innerHTML = footHtml();
      }

      function setStep(n) {
        if (n < 1 || n > STEP_NAMES.length) return;
        step = n;
        render();
      }

      function stepbarHtml() {
        return STEP_NAMES.map(function (name, i) {
          var n = i + 1;
          var cls = n === step ? " active" : (n < step ? " done" : "");
          return '<div class="step' + cls + '"><span class="num">' + (n < step ? "✓" : n) + "</span>" + name + "</div>";
        }).join("");
      }

      function footHtml() {
        var prev = '<button type="button" class="btn" data-nav="prev"' + (step === 1 ? " disabled" : "") + ">上一步</button>";
        var next = step === STEP_NAMES.length
          ? '<button type="button" class="btn primary" data-nav="create">创建任务</button>'
          : '<button type="button" class="btn primary" data-nav="next">下一步</button>';
        return prev +
          '<span class="create-step-hint">第 ' + step + " 步 / 共 " + STEP_NAMES.length + " 步 · " + STEP_NAMES[step - 1] + "</span>" +
          '<span class="spacer"></span>' + next;
      }

      function contentHtml() {
        if (step === 1) return step1Html();
        if (step === 2) return step2Html();
        if (step === 3) return step3Html();
        if (step === 4) return step4Html();
        return step5Html();
      }

      function step1Html() {
        return '<div class="grid cols-2">' +
          '<div class="card">' +
          "<h3>上传文书</h3>" +
          '<div class="form-row" style="max-width:320px"><label>任务类型</label><select data-task-type>' +
          TASK_TYPES.map(function (t) {
            return "<option" + (t === taskType ? " selected" : "") + ">" + t + "</option>";
          }).join("") + "</select></div>" +
          '<p class="muted small">支持 PDF / DOCX / TXT；原始判决书将按《指南》规则自动提取“本院认为”部分。</p>' +
          '<div class="upload create-upload" data-upload><div><strong>点击选择文件</strong></div><div class="small">或将文书拖拽到此区域（原型示意，不读取真实文件）</div></div>' +
          '<div class="row mt12"><button type="button" class="btn" data-batch>批量上传</button><button type="button" class="btn" data-paste>手动录入 / 复制粘贴</button><span class="spacer"></span><span class="small muted">已选 ' + files.length + " 份</span></div>" +
          "</div>" +
          '<div class="card">' + fileTableHtml() + "</div>" +
          "</div>";
      }

      function fileTableHtml() {
        if (!files.length) return "<h3>已选文书</h3><div class=\"empty\">尚未选择文书，请先上传或手动录入</div>";
        var rows = files.map(function (f, i) {
          return "<tr><td><strong>" + APP.esc(f.name) + '</strong><div class="create-doc-title">' + APP.esc(f.title) + "</div></td>" +
            "<td>" + APP.esc(f.type) + "</td>" +
            '<td><button type="button" class="btn-link" data-remove-file="' + i + '">移除</button></td></tr>';
        }).join("");
        return "<h3>已选文书（" + files.length + " 份）</h3>" +
          '<table class="table"><thead><tr><th>文书</th><th>文书类型</th><th>操作</th></tr></thead><tbody>' + rows + "</tbody></table>";
      }

      function step2Html() {
        return '<div class="card">' +
          '<div class="row mb8"><h3 style="margin:0">确定标注范围</h3><span class="spacer"></span><span class="small muted">文书一 · 原始判决书</span></div>' +
          '<div class="notice info">原始判决书范围＝“本院认为”之后、“判决如下”所在句子之前；下列 [ ] 内即系统按《指南》规则提取的待标注范围（示意）。</div>' +
          '<div class="paper mt12">' + rangeHtml(doc.reasonText) + "</div>" +
          '<div class="create-legend"><span><span class="marked">高亮</span>＝关键起止标记</span><span><span class="create-bracket">[ ]</span>＝提取范围</span><span>共 ' + doc.reasonText.length + " 字（示意）</span></div>" +
          '<div class="row mt12"><button type="button" class="btn" data-reextract>重新提取</button><button type="button" class="btn" data-adjust>手动调整范围</button></div>' +
          "</div>";
      }

      function step3Html() {
        var fields = CASE_FIELDS[caseType] || [];
        var values = caseValues[caseType] || {};
        return '<div class="card">' +
          '<div class="row mb12"><h3 style="margin:0">案例信息</h3><span class="spacer"></span><span class="small muted">先选择文书类型，再填写对应字段（仅示意，可编辑）</span></div>' +
          '<div class="form-row" style="max-width:320px"><label>文书类型</label><select data-case-type>' +
          DOC_TYPES.map(function (t) {
            return "<option" + (t === caseType ? " selected" : "") + ">" + t + "</option>";
          }).join("") +
          "</select></div>" +
          '<div class="form-grid">' + fields.map(function (f) { return caseFieldHtml(caseType, f, values[f.key]); }).join("") + "</div>" +
          '<div class="notice info mt12">原始判决书填写案号、裁判法院、审级等；指导性案例与参考案例填写案例名称、相关法条及裁判要点/要旨。</div>' +
          "</div>";
      }

      function step4Html() {
        var html = '<div class="card mb12">' +
          '<div class="row"><div><h3 style="margin:0">指南文件</h3><div class="small muted mt8">系统当前版本：<span class="code-chip">' + APP.esc(guide.version) + "</span>（" + APP.esc(guide.importedAt) + "）</div></div>" +
          '<span class="spacer"></span><button type="button" class="btn primary" data-pick-guide>选择指南文件</button></div>';
        if (guideImported) {
          html += '<div class="small mt12">已选文件：<span class="code-chip">' + APP.esc(guide.file) + "</span></div>";
        } else {
          html += '<div class="notice info mt12">选择《指南》文件后，系统将解析出非命题要素、命题要素与关系类型，供标注时使用。</div>';
        }
        html += "</div>";
        if (guideImported) {
          html += '<div class="card mb12"><div class="row mb12"><h3 style="margin:0">解析结果</h3><span class="spacer"></span><span class="small muted">可删除条目或追加新条目（演示）</span></div>' +
            '<div class="guide-groups">' +
            GUIDE_GROUPS.map(function (g) { return guideGroupHtml(g.key, g.title, parsed[g.key]); }).join("") +
            "</div></div>";
        }
        html += '<div class="grid cols-2">' +
          '<div class="card"><h3>登记版本</h3>' +
          '<div class="form-row"><label>版本号</label><input type="text" data-ver="version" value="' + APP.esc(guide.version) + '"></div>' +
          '<div class="form-row"><label>适用范围</label><input type="text" data-ver="scope" value="' + APP.esc(guide.scope) + '"></div>' +
          '<div class="form-row"><label>操作人</label><input type="text" data-ver="operator" value="' + APP.esc(guide.operator) + '"></div>' +
          '<div class="form-row"><label>说明</label><textarea rows="2" data-ver="note" placeholder="本次指南的主要变化…"></textarea></div>' +
          '<button type="button" class="btn primary" data-register>登记版本</button></div>' +
          '<div class="card"><h3>版本历史</h3><div data-guide-history>' + historyHtml(history) + "</div></div>" +
          "</div>";
        html += '<div class="card mt12" data-version-card>' + versionPickHtml() + "</div>";
        return html;
      }

      function versionPickHtml() {
        var active = activeVersion();
        var items = history.map(function (h) {
          return '<label class="version-item' + (h.version === active ? " on" : "") + '">' +
            '<input type="radio" name="task-guide-version" data-pick-version value="' + APP.esc(h.version) + '"' + (h.version === active ? " checked" : "") + ">" +
            '<span><span class="code-chip">' + APP.esc(h.version) + "</span> " + APP.esc(h.date) + " · " + APP.esc(h.operator) +
            " · 适用范围：" + APP.esc(h.scope || "—") + "</span></label>";
        }).join("");
        if (!items) items = '<div class="small muted">暂无版本记录</div>';
        return "<h3>任务使用的指南版本（单选）</h3>" +
          '<div class="small muted mb8">默认选择最新版本（' + APP.esc(latestVersion()) + "），可在列表中选择其它版本。</div>" +
          '<div class="version-pick">' + items + "</div>" +
          '<div class="notice info">任务绑定后，任务期间标签体系冻结；新版本指南仅影响之后绑定它的任务（《指南》8.3.3）。</div>';
      }

      function refreshVersionPick() {
        var host = contentEl.querySelector("[data-version-card]");
        if (host) host.innerHTML = versionPickHtml();
      }

      function step5Html() {
        var rows = files.length ? files.map(function (f, i) {
          var a = assign[i] || defaultAssign();
          var list = a.annotators && a.annotators.length ? a.annotators : defaultAnnotators();
          return "<tr><td><strong>" + APP.esc(f.name) + '</strong><div class="create-doc-title">' + APP.esc(f.type) + "</div></td>" +
            "<td>" + assignCellHtml(i, list) + "</td>" +
            "<td>" + personSelect(i, "adj", a.adj, adjudicatorPool()) + "</td></tr>";
        }).join("") : '<tr><td colspan="3" class="muted">暂无文书，请返回第 1 步添加</td></tr>';
        return '<div class="card mb12">' +
          '<div class="row"><h3 style="margin:0">分配人员</h3><span class="spacer"></span><button type="button" class="btn" data-batch-assign>按案例类型批量分配</button></div>' +
          '<p class="muted small mt8">每份文书默认由 2 名标注员独立标注，分歧交由 1 名仲裁员裁定。</p>' +
          '<div class="small muted mb8">使用指南版本：<span class="code-chip">' + APP.esc(activeVersion()) + "</span></div>" +
          '<table class="table"><thead><tr><th>文书</th><th>标注员</th><th>仲裁员</th></tr></thead><tbody>' + rows + "</tbody></table>" +
          '<div class="small muted mt8">每份文书至少 2 名标注员（双人独立标注），可继续添加多人；一份案例与标注者之间为多对多关系。' +
          (teaching() ? "教学练习数据与正式任务数据隔离（细节待确认）。" : "") + "</div>" +
          "</div>" +
          '<div class="notice">任务开始后标签体系冻结，新版本指南仅影响之后绑定它的任务。创建前请确认人员与指南版本。</div>';
      }

      function addFile(opts) {
        opts = opts || {};
        var name = opts.name;
        if (!name) {
          name = UPLOAD_POOL[poolIdx % UPLOAD_POOL.length];
          poolIdx++;
        }
        var exists = files.some(function (f) { return f.name === name; });
        if (exists) {
          APP.ui.toast("该文书已在列表中", "warn");
          return;
        }
        files.push({ name: name, title: opts.title || name + "民事一审民事判决书", type: opts.type || "原始判决书" });
        assign.push(defaultAssign());
        APP.ui.toast("已选择文件：" + name);
        render();
      }

      function batchAdd() {
        var added = 0;
        UPLOAD_POOL.forEach(function (name) {
          var exists = files.some(function (f) { return f.name === name; });
          if (exists) return;
          files.push({ name: name, title: name + "民事一审民事判决书", type: "原始判决书" });
          assign.push(defaultAssign());
          added++;
        });
        APP.ui.toast(added ? "已批量选择（新增 " + added + " 份）" : "已批量选择（示例文书均已在列表中）");
        render();
      }

      function pasteModal() {
        APP.ui.modal({
          title: "手动录入 / 复制粘贴",
          body: '<p class="muted small">将裁判文书全文粘贴到下方文本框，系统按《指南》规则提取待标注范围（原型仅示意，不解析真实文本）。</p>' +
            '<textarea rows="8" data-paste-text placeholder="在此粘贴文书全文…"></textarea>',
          actions: [
            { label: "取消" },
            {
              label: "确定", kind: "primary", onClick: function () {
                var ta = document.querySelector("[data-paste-text]");
                var val = ta ? ta.value.trim() : "";
                if (!val) {
                  APP.ui.toast("请先粘贴文书内容", "warn");
                  return false;
                }
                manualCount++;
                addFile({ name: "手动录入文书 " + manualCount, title: "复制粘贴录入（演示）" });
              }
            }
          ]
        });
      }

      function assignModal() {
        APP.ui.modal({
          title: "按案例类型批量分配",
          body: '<p class="muted small">同一文书类型可套用相同的人员配置，批量分配后仍可在列表中逐份调整（演示）。</p>' +
            '<div class="form-row"><label>文书类型</label><select data-batch-type>' + optionList(DOC_TYPES) + "</select></div>" +
            '<div class="form-row"><label>标注员 A</label><select data-batch-a1>' + optionList(ANNOTATORS) + "</select></div>" +
            '<div class="form-row"><label>标注员 B</label><select data-batch-a2>' + optionList(ANNOTATORS) + "</select></div>" +
            '<div class="form-row"><label>仲裁员</label><select data-batch-adj>' + optionList(adjudicatorPool()) + "</select></div>",
          actions: [
            { label: "取消" },
            {
              label: "应用", kind: "primary", onClick: function () {
                var type = document.querySelector("[data-batch-type]").value;
                var a1 = document.querySelector("[data-batch-a1]").value;
                var a2 = document.querySelector("[data-batch-a2]").value;
                var adj = document.querySelector("[data-batch-adj]").value;
                var count = 0;
                files.forEach(function (f, i) {
                  if (f.type === type) { assign[i] = { annotators: [a1, a2], adj: adj }; count++; }
                });
                APP.ui.toast(count ? "已按「" + type + "」批量分配（" + count + " 份）" : "没有「" + type + "」类型的文书", count ? "" : "warn");
                render();
              }
            }
          ]
        });
      }

      function refreshGroup(group) {
        var panel = contentEl.querySelector('[data-group-panel="' + group + '"]');
        if (!panel) return;
        var title = "";
        GUIDE_GROUPS.forEach(function (g) { if (g.key === group) title = g.title; });
        var h4 = panel.querySelector("h4");
        if (h4) h4.textContent = title + "（" + parsed[group].length + "）";
        var list = panel.querySelector('[data-list="' + group + '"]');
        if (list) list.innerHTML = guideItemsHtml(group, parsed[group]);
      }

      function readVer(key) {
        var el = contentEl.querySelector('[data-ver="' + key + '"]');
        return el ? el.value.trim() : "";
      }

      function storeCase(type, key, value) {
        if (!caseValues[type]) caseValues[type] = {};
        caseValues[type][key] = value;
      }

      function createProblems() {
        var problems = [];
        if (!files.length) problems.push("请先上传至少一份文书");
        files.forEach(function (f, i) {
          var a = assign[i] || {};
          var list = a.annotators || [];
          if (list.length < 2) problems.push("「" + f.name + "」标注员不足 2 名（当前 " + list.length + " 名）");
          var seen = {};
          var dups = [];
          list.forEach(function (n) {
            if (seen[n] && dups.indexOf(n) === -1) dups.push(n);
            seen[n] = true;
          });
          if (dups.length) problems.push("「" + f.name + "」标注员重复：" + dups.join("、"));
          if (!a.adj) problems.push("「" + f.name + "」未选择仲裁员");
        });
        return problems;
      }

      root.addEventListener("click", function (e) {
        var t = e.target;
        if (!t || !t.closest) return;

        var nav = t.closest("[data-nav]");
        if (nav) {
          var dir = nav.getAttribute("data-nav");
          if (dir === "prev") setStep(step - 1);
          else if (dir === "next") {
            if (step === 1 && !files.length) {
              APP.ui.toast("请先上传至少一份文书", "warn");
              return;
            }
            setStep(step + 1);
          } else if (dir === "create") {
            var problems = createProblems();
            if (problems.length) {
              APP.ui.modal({
                title: "无法创建任务",
                body: '<p class="muted small">请修正以下问题后再提交：</p><ul class="modal-issues">' +
                  problems.map(function (p) { return "<li>" + APP.esc(p) + "</li>"; }).join("") + "</ul>",
                actions: [{ label: "知道了", kind: "primary" }]
              });
              return;
            }
            APP.ui.toast("任务已创建（演示）", "ok");
            APP.goto("tasks");
          }
          return;
        }

        if (t.closest("[data-upload]")) { addFile(); return; }
        if (t.closest("[data-batch]")) { batchAdd(); return; }
        if (t.closest("[data-paste]")) { pasteModal(); return; }

        var rem = t.closest("[data-remove-file]");
        if (rem) {
          var idx = Number(rem.getAttribute("data-remove-file"));
          var removed = files.splice(idx, 1)[0];
          assign.splice(idx, 1);
          if (removed) APP.ui.toast("已移除：" + removed.name);
          render();
          return;
        }

        var annAdd = t.closest("[data-add-annotator]");
        if (annAdd) {
          var annRow = Number(annAdd.getAttribute("data-add-annotator"));
          var rowAssign = assign[annRow];
          if (rowAssign && rowAssign.annotators) {
            var next = ANNOTATORS.filter(function (n) { return rowAssign.annotators.indexOf(n) === -1; })[0] || ANNOTATORS[0];
            rowAssign.annotators.push(next);
            render();
          }
          return;
        }

        var annRm = t.closest("[data-remove-annotator]");
        if (annRm) {
          var rmRow = Number(annRm.getAttribute("data-remove-annotator"));
          var rmSlot = Number(annRm.getAttribute("data-slot"));
          var rmList = assign[rmRow] && assign[rmRow].annotators;
          if (rmList && rmList.length > 2) {
            rmList.splice(rmSlot, 1);
            render();
          }
          return;
        }

        if (t.closest("[data-reextract]")) { APP.ui.toast("已按指南规则重新提取"); return; }
        if (t.closest("[data-adjust]")) { APP.ui.pending("手动拖动调整提取范围"); return; }

        if (t.closest("[data-pick-guide]")) {
          guideImported = true;
          APP.ui.toast("已选择指南文件：" + guide.file);
          render();
          return;
        }

        var del = t.closest("[data-del-guide]");
        if (del) {
          var g1 = del.getAttribute("data-del-guide");
          var i1 = Number(del.getAttribute("data-idx"));
          if (parsed[g1] && parsed[g1][i1] != null) {
            var gone = parsed[g1].splice(i1, 1)[0];
            refreshGroup(g1);
            APP.ui.toast("已删除：" + gone);
          }
          return;
        }

        var add = t.closest("[data-add-item]");
        if (add) {
          var g2 = add.getAttribute("data-add-item");
          var input = contentEl.querySelector('[data-add-input="' + g2 + '"]');
          var val = input ? input.value.trim() : "";
          if (!val) {
            APP.ui.toast("请先输入内容", "warn");
            return;
          }
          parsed[g2].push(val);
          if (input) input.value = "";
          refreshGroup(g2);
          APP.ui.toast("已添加：" + val);
          return;
        }

        if (t.closest("[data-register]")) {
          var version = readVer("version") || guide.version;
          var operator = readVer("operator") || APP.roleName();
          var scope = readVer("scope") || "全部任务";
          var note = readVer("note");
          var dup = history.some(function (h) { return h.version === version; });
          if (dup) note = "（版本号重复，按新版本登记）" + (note || "");
          if (!note) note = "—";
          history.push({ version: version, date: today(), operator: operator, note: note, scope: scope });
          selectedVersion = version;
          APP.ui.toast("指南版本已登记（历史版本只读保留，重复版本号按新版本登记）", "ok");
          var host = contentEl.querySelector("[data-guide-history]");
          if (host) host.innerHTML = historyHtml(history);
          refreshVersionPick();
          return;
        }

        if (t.closest("[data-batch-assign]")) { assignModal(); return; }
      });

      root.addEventListener("change", function (e) {
        var t = e.target;
        if (!t || !t.closest) return;
        if (t.hasAttribute && t.hasAttribute("data-pick-version")) {
          selectedVersion = t.value;
          Array.prototype.forEach.call(contentEl.querySelectorAll(".version-item"), function (item) {
            var inp = item.querySelector("input[data-pick-version]");
            item.classList.toggle("on", !!inp && inp.value === selectedVersion);
          });
          return;
        }
        var sel = t.closest("select");
        if (!sel) return;
        if (sel.hasAttribute("data-task-type")) {
          taskType = sel.value;
          assign = newAssign();
          render();
          return;
        }
        if (sel.hasAttribute("data-case-type")) {
          caseType = sel.value;
          render();
          return;
        }
        var field = sel.getAttribute("data-case-field");
        if (field) {
          storeCase(field, sel.getAttribute("data-key"), sel.value);
          return;
        }
        var kind = sel.getAttribute("data-assign");
        if (kind) {
          var row = Number(sel.getAttribute("data-row"));
          if (!assign[row]) return;
          if (kind === "adj") {
            assign[row].adj = sel.value;
          } else if (kind === "annotator") {
            var slot = Number(sel.getAttribute("data-slot"));
            if (assign[row].annotators) assign[row].annotators[slot] = sel.value;
          }
        }
      });

      root.addEventListener("input", function (e) {
        var t = e.target;
        if (!t || !t.closest) return;
        var field = t.closest("[data-case-field]");
        if (field) storeCase(field.getAttribute("data-case-field"), field.getAttribute("data-key"), field.value);
      });

      render();
    }
  });
})();
