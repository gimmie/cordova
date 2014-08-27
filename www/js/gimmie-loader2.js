// Load Gimmie API
(function () {

  var widget = new Widget('#gimmie-root');
  window.GimmieWidget = widget;

  if (typeof _gimmie) {
    if (_gimmie.user) {
      widget.init(_gimmie.user);
    }
    else {
      widget.init();
    }
  }
  else {
    widget.init();
  }

})();
