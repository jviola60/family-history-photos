/* Clickjacking fallback. GitHub Pages serves CSP as a meta tag, and browsers ignore frame-ancestors there. */
(function () {
  var style = document.getElementById('anti-clickjack');
  if (window.top === window.self) {
    if (style) style.remove();
    return;
  }
  try {
    window.top.location = window.self.location;
  } catch {
    /* The parent page blocked the navigation. Leave the document hidden. */
  }
})();
