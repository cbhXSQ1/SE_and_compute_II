(function () {
  var ROLE_TAG = {
    "管理员": "violet",
    "教师": "blue",
    "标注员": "green",
    "学生": "amber"
  };

  function rolesOf(user) {
    if (user.roles && user.roles.length) return user.roles.slice();
    return user.role ? [user.role] : [];
  }

  function privsOf(user) {
    return user.privileges ? user.privileges.slice() : [];
  }

  function roleTagsHtml(roles) {
    if (!roles.length) return '<span class="muted">—</span>';
    return roles.map(function (r) {
      return '<span class="tag ' + (ROLE_TAG[r] || "gray") + '">' + APP.esc(r) + "</span>";
    }).join(" ");
  }

  function privTagsHtml(privs) {
    if (!privs.length) return '<span class="muted">—</span>';
    return privs.map(function (p) {
      return '<span class="tag gray">' + APP.esc(p) + "</span>";
    }).join(" ");
  }

  function checklistHtml(catalog, checked) {
    return catalog.map(function (v) {
      var on = checked.indexOf(v) !== -1;
      return '<label class="checkbox"><input type="checkbox" data-pick value="' + APP.esc(v) + '"' + (on ? " checked" : "") + ">" +
        "<span>" + APP.esc(v) + "</span></label>";
    }).join("");
  }

  function pickedValues() {
    var out = [];
    Array.prototype.forEach.call(document.querySelectorAll("#modal-root [data-pick]:checked"), function (el) {
      out.push(el.value);
    });
    return out;
  }

  function orderRoles(picked, current) {
    var catalog = (APP.data && APP.data.roleCatalog) || [];
    return picked.slice().sort(function (a, b) {
      var ia = current.indexOf(a);
      var ib = current.indexOf(b);
      if (ia === -1) ia = 1000 + catalog.indexOf(a);
      if (ib === -1) ib = 1000 + catalog.indexOf(b);
      return ia - ib;
    });
  }

  function userRowHtml(user, manage) {
    var id = APP.esc(user.id);
    var ops = manage
      ? '<div class="row">' +
        '<button type="button" class="btn small" data-act="roles" data-id="' + id + '">编辑角色</button>' +
        '<button type="button" class="btn small" data-act="privs" data-id="' + id + '">授予特权</button>' +
        '<button type="button" class="btn small danger" data-act="remove" data-id="' + id + '">移除</button>' +
        "</div>"
      : '<span class="muted">—</span>';
    return "<tr>" +
      "<td><strong>" + APP.esc(user.name) + "</strong></td>" +
      "<td>" + roleTagsHtml(rolesOf(user)) + "</td>" +
      "<td>" + privTagsHtml(privsOf(user)) + "</td>" +
      "<td>" + ops + "</td></tr>";
  }

  function tableHtml(users, manage) {
    var rows = users.length
      ? users.map(function (u) { return userRowHtml(u, manage); }).join("")
      : '<tr><td colspan="4" class="muted">暂无用户</td></tr>';
    return '<div class="card">' +
      '<table class="table"><thead><tr><th>姓名</th><th>角色</th><th>特权</th><th>操作</th></tr></thead>' +
      "<tbody>" + rows + "</tbody></table>" +
      "</div>";
  }

  function pageHtml(users, manage) {
    return '<div class="page">' +
      '<div class="page-head"><div><h2>人员管理</h2><div class="sub">维护用户与角色、授予特权（一人可多角色；创建者可赋予他人特权）</div></div>' +
      '<span class="spacer"></span>' +
      (manage ? '<button type="button" class="btn primary" data-act="add">新增用户</button>' : '<span class="tag gray">只读模式</span>') +
      "</div>" +
      tableHtml(users, manage) +
      '<div class="notice ' + (manage ? "info" : "") + ' mt16">' +
      (manage
        ? "一人可拥有多个角色；学生泛化自标注员（练习中复用标注功能）。特权用于授予非管理员上传数据、创建任务等能力（对应用例 A1 维护用户与角色 / A2 授予特权）。"
        : "人员管理仅管理员可操作；当前角色为只读查看。") +
      "</div>" +
      "</div>";
  }

  APP.registerView("people", {
    title: "人员管理",
    render: function (root, params) {
      var users = ((APP.data && APP.data.users) || []).slice();
      var roleCatalog = (APP.data && APP.data.roleCatalog) || [];
      var privCatalog = (APP.data && APP.data.privilegeCatalog) || [];
      var canManage = APP.role() === "admin";

      function writeBack() {
        if (APP.data) APP.data.users = users;
      }

      function paint() {
        root.innerHTML = pageHtml(users, canManage);
      }

      function findUser(id) {
        for (var i = 0; i < users.length; i++) {
          if (users[i].id === id) return i;
        }
        return -1;
      }

      function nextId() {
        var max = 0;
        users.forEach(function (u) {
          var m = /^u(\d+)$/.exec(u.id || "");
          if (m) max = Math.max(max, Number(m[1]));
        });
        return "u" + (max + 1);
      }

      function editRoles(user) {
        var current = rolesOf(user);
        APP.ui.modal({
          title: "编辑角色 · " + user.name,
          body: '<p class="muted small">一人可拥有多个角色；保存后同步角色字段（roles[0]）。</p>' +
            '<div class="form-row"><label>角色（可多选）</label>' + checklistHtml(roleCatalog, current) + "</div>",
          actions: [
            { label: "取消" },
            {
              label: "保存", kind: "primary", onClick: function () {
                var list = orderRoles(pickedValues(), current);
                if (!list.length) {
                  APP.ui.toast("请至少选择一个角色", "warn");
                  return false;
                }
                user.roles = list;
                user.role = list[0];
                writeBack();
                paint();
                APP.ui.toast("已更新角色：" + user.name + "（" + list.join("、") + "）", "ok");
              }
            }
          ]
        });
      }

      function grantPrivs(user) {
        var current = privsOf(user);
        APP.ui.modal({
          title: "授予特权 · " + user.name,
          body: '<p class="muted small">取消勾选即回收对应特权。</p>' +
            '<div class="form-row"><label>特权</label>' + checklistHtml(privCatalog, current) + "</div>",
          actions: [
            { label: "取消" },
            {
              label: "保存", kind: "primary", onClick: function () {
                var list = pickedValues();
                user.privileges = list;
                writeBack();
                paint();
                APP.ui.toast("已更新特权：" + user.name + "（" + (list.join("、") || "无") + "）", "ok");
              }
            }
          ]
        });
      }

      function removeUser(user) {
        APP.ui.confirm("确定移除用户「" + user.name + "」吗？原型演示：仅从人员列表移除。", function () {
          var idx = findUser(user.id);
          if (idx !== -1) users.splice(idx, 1);
          writeBack();
          paint();
          APP.ui.toast("已移除用户：" + user.name, "ok");
        });
      }

      function addUser() {
        APP.ui.modal({
          title: "新增用户",
          body: '<div class="form-row"><label>姓名</label><input type="text" data-name placeholder="请输入姓名"></div>' +
            '<div class="form-row"><label>角色（可多选）</label>' + checklistHtml(roleCatalog, ["标注员"]) + "</div>",
          actions: [
            { label: "取消" },
            {
              label: "确定", kind: "primary", onClick: function () {
                var input = document.querySelector("#modal-root [data-name]");
                var name = input ? input.value.trim() : "";
                if (!name) {
                  APP.ui.toast("请输入姓名", "warn");
                  return false;
                }
                var list = orderRoles(pickedValues(), []);
                if (!list.length) {
                  APP.ui.toast("请至少选择一个角色", "warn");
                  return false;
                }
                users.push({ id: nextId(), name: name, role: list[0], roles: list, privileges: [] });
                writeBack();
                paint();
                APP.ui.toast("已新增用户：" + name + "（" + list.join("、") + "）", "ok");
              }
            }
          ]
        });
      }

      root.addEventListener("click", function (e) {
        var btn = e.target.closest("button[data-act]");
        if (!btn) return;
        if (!canManage) {
          APP.ui.toast("只读模式：人员管理仅管理员可操作", "warn");
          return;
        }
        var act = btn.getAttribute("data-act");
        if (act === "add") {
          addUser();
          return;
        }
        var idx = findUser(btn.getAttribute("data-id"));
        if (idx === -1) return;
        var user = users[idx];
        if (act === "roles") editRoles(user);
        if (act === "privs") grantPrivs(user);
        if (act === "remove") removeUser(user);
      });

      paint();
    }
  });
})();
