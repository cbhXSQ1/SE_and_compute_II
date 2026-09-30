(function () {
  var PREFIX = "annotation-draft-";
  var timer = null;

  function key(taskId) { return PREFIX + (taskId || "T1"); }

  function load(taskId) {
    try {
      var raw = localStorage.getItem(key(taskId));
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function save(taskId) {
    var data = {
      pieces: APP.store.get("pieces"),
      segments: APP.store.get("segments"),
      relations: APP.store.get("relations"),
      diagrams: APP.store.get("diagrams"),
      savedAt: Date.now()
    };
    try {
      localStorage.setItem(key(taskId), JSON.stringify(data));
      markSaved(data.savedAt);
    } catch (e) {}
  }

  function saveDebounced() {
    clearTimeout(timer);
    timer = setTimeout(function () { save(APP.state.currentTaskId); }, 300);
  }

  function clear(taskId) {
    try { localStorage.removeItem(key(taskId)); } catch (e) {}
  }

  function markSaved(ts) {
    var el = document.querySelector('[data-act="save"]');
    if (!el) return;
    var d = new Date(ts);
    function p(n) { return (n < 10 ? "0" : "") + n; }
    el.textContent = "已保存 " + p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
  }

  // store 任何变化后自动保存草稿（防抖）
  APP.store.subscribe(saveDebounced);

  APP.persist = { load: load, save: save, clear: clear };
})();
