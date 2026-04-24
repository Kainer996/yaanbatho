(function () {
    const slideshow = document.getElementById('projectsSlideshow');
    if (!slideshow) return;

    const track = document.getElementById('slideshowTrack');
    const slides = track.querySelectorAll('.slideshow-slide');
    const prevBtn = document.getElementById('slidePrev');
    const nextBtn = document.getElementById('slideNext');
    const dotsContainer = document.getElementById('slideshowDots');
    const total = slides.length;
    if (total === 0) return;

    let current = 0;
    let autoTimer = null;
    const INTERVAL = 4500;

    slides.forEach((_, i) => {
        const dot = document.createElement('button');
        dot.className = 'slideshow-dot' + (i === 0 ? ' active' : '');
        dot.setAttribute('aria-label', 'Go to slide ' + (i + 1));
        dot.addEventListener('click', () => goTo(i));
        dotsContainer.appendChild(dot);
    });

    const dots = dotsContainer.querySelectorAll('.slideshow-dot');

    function goTo(i) {
        current = (i + total) % total;
        track.style.transform = 'translateX(' + (-current * 100) + '%)';
        dots.forEach((d, idx) => d.classList.toggle('active', idx === current));
        restartAuto();
    }

    function next() { goTo(current + 1); }
    function prev() { goTo(current - 1); }

    prevBtn.addEventListener('click', prev);
    nextBtn.addEventListener('click', next);

    function startAuto() {
        autoTimer = setInterval(next, INTERVAL);
    }
    function stopAuto() {
        if (autoTimer) clearInterval(autoTimer);
    }
    function restartAuto() {
        stopAuto();
        startAuto();
    }

    slideshow.addEventListener('mouseenter', stopAuto);
    slideshow.addEventListener('mouseleave', startAuto);

    let touchStartX = 0;
    let touchEndX = 0;
    slideshow.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        stopAuto();
    }, { passive: true });
    slideshow.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        const diff = touchStartX - touchEndX;
        if (Math.abs(diff) > 40) {
            if (diff > 0) next(); else prev();
        }
        startAuto();
    }, { passive: true });

    startAuto();
})();
