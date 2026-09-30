(function () {
  var data = {
    pieces: [],
    segments: [],
    relations: [],
    diagrams: [],
    history: []
  };
  var subs = [];

  function notify(path, val, old) {
    subs.forEach(function (fn) {
      try { fn(path, val, old); } catch (e) {}
    });
  }

  function get(key) {
    if (arguments.length === 0) return data;
    return data[key];
  }

  function set(key, val) {
    var old = data[key];
    data[key] = val;
    notify(key, val, old);
  }

  function patch(obj) {
    Object.keys(obj).forEach(function (k) {
      var old = data[k];
      data[k] = obj[k];
      notify(k, data[k], old);
    });
  }

  function subscribe(fn) {
    subs.push(fn);
    return function () {
      var i = subs.indexOf(fn);
      if (i >= 0) subs.splice(i, 1);
    };
  }

  function touch(key) {
    notify(key, data[key], data[key]);
  }

  window.APP = window.APP || {};
  window.APP.store = {
    get: get,
    set: set,
    patch: patch,
    subscribe: subscribe,
    touch: touch
  };
})();
