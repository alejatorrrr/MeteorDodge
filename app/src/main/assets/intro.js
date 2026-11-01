(() => {
  'use strict';
  const intro = document.getElementById('studio-intro');
  const logo = intro.querySelector('img');
  const stage = document.getElementById('stage');
  stage.inert = true;
  // Also protect keyboard controls on older Android WebViews without inert.
  const blockKeys = event => { event.preventDefault(); event.stopImmediatePropagation(); };
  window.addEventListener('keydown', blockKeys, true);
  const finish = () => {
    intro.remove();
    stage.inert = false;
    window.removeEventListener('keydown', blockKeys, true);
  };
  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    setTimeout(() => {
      intro.classList.add('is-leaving');
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      setTimeout(finish, reduced ? 0 : 700);
    }, 2500);
  };
  if (logo.complete) start();
  else {
    logo.addEventListener('load', start, { once: true });
    logo.addEventListener('error', start, { once: true });
    setTimeout(start, 3000); // Never leave the menu blocked by a failed image load.
  }
})();
