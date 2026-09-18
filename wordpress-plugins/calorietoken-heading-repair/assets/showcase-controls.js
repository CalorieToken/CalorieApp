/* Keep the existing radio carousel and consent handling; add keyboard controls. */
(function () {
  'use strict';
  function start() {
    if (!document.body.matches('.page-id-7945.ctstyle-enabled') || document.querySelector('.brz-ed,#brz-ed-iframe')) return;
    var carousel = document.querySelector('#calorie-showcases .ct-video-carousel');
    if (!carousel || carousel.dataset.ctControlsReady) return;
    carousel.dataset.ctControlsReady = 'true';
    var radios = Array.from(carousel.querySelectorAll('input[name="ct-video-slide"]'));
    var slides = Array.from(carousel.querySelectorAll('.ct-video-slide'));
    carousel.querySelectorAll('.ct-video-controls').forEach(function (group) { group.removeAttribute('aria-hidden'); });
    carousel.querySelectorAll('label[for]').forEach(function (label) {
      label.setAttribute('role', 'button');
      label.setAttribute('tabindex', '0');
      if (label.classList.contains('ct-video-arrow')) label.setAttribute('aria-label', label.classList.contains('ct-video-prev') ? 'Previous video' : 'Next video');
      label.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        label.click();
        if (label.classList.contains('ct-video-arrow')) {
          var direction = label.classList.contains('ct-video-prev') ? '.ct-video-prev' : '.ct-video-next';
          var group = carousel.querySelector(radios[1] && radios[1].checked ? '.ct-controls-2' : '.ct-controls-1');
          if (group) group.querySelector(direction).focus({preventScroll:true});
        }
      });
    });
    radios.forEach(function (radio) { radio.tabIndex = -1; radio.addEventListener('change', sync); });
    function sync() {
      slides.forEach(function (slide, index) {
        var active = !!(radios[index] && radios[index].checked);
        slide.inert = !active;
        slide.setAttribute('aria-hidden', String(!active));
      });
      carousel.querySelectorAll('.ct-video-dot').forEach(function (dot) {
        var radio = document.getElementById(dot.htmlFor);
        dot.setAttribute('aria-pressed', String(!!(radio && radio.checked)));
      });
    }
    sync();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
}());
