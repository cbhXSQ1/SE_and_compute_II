(function () {
  function ok(data) {
    return Promise.resolve(JSON.parse(JSON.stringify(data)));
  }

  window.APP = window.APP || {};
  window.APP.api = {
    loadAnnotation: function (taskId, docId) {
      var draft = window.APP.persist && window.APP.persist.load(taskId, docId);
      if (draft) return ok(draft);
      var m = window.MOCK || {};
      var dd = (m.docData && docId && m.docData[docId]) || null;
      if (dd) return ok({
        pieces: dd.pieces || [],
        segments: dd.segments || [],
        relations: dd.relations || [],
        diagrams: dd.diagrams || []
      });
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
