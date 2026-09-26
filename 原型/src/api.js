(function () {
  function ok(data) {
    return Promise.resolve(JSON.parse(JSON.stringify(data)));
  }

  window.APP = window.APP || {};
  window.APP.api = {
    loadAnnotation: function (taskId) {
      var m = window.MOCK || {};
      return ok({
        pieces: m.pieces || [],
        segments: m.segments || [],
        relations: m.relations || [],
        diagrams: m.diagrams || []
      });
    },
    submitCut: function (pieces) {
      return ok({ diff: 0 });
    },
    submitAnnotation: function (data) {
      return ok({ saved: true });
    }
  };
})();
