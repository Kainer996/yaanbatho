/* Platform Nav v10
 * Adds subtle visual platform indicators for the mascot.
 * The top platform is already the header's red bottom border.
 * The bottom platform is a faint line above the MUSIC button.
 */
(function () {
  'use strict';

  if (window.innerWidth <= 768) return;

  function init() {
    // Bottom platform line
    var line = document.createElement('div');
    line.className = 'mascot-platform mascot-platform-bottom';
    document.body.appendChild(line);

    // Position it dynamically based on the MUSIC button
    function positionPlatform() {
      var btn = document.querySelector('.btn-music-float');
      if (!btn) return;
      var rect = btn.getBoundingClientRect();
      // Line sits at the top of the button
      line.style.bottom = (window.innerHeight - rect.top) + 'px';
      line.style.right = '24px';
      line.style.width = Math.max(200, rect.left - 40) + 'px';
    }

    positionPlatform();
    window.addEventListener('resize', positionPlatform);

    // Fade in after a short delay
    setTimeout(function () {
      line.classList.add('visible');
    }, 1200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(init, 300);
    });
  } else {
    setTimeout(init, 300);
  }
})();
