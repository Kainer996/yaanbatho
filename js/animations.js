// Yaan Batho - Advanced Animations JavaScript
// Inspired by ui.aceternity.com, brittanychiang.com

// ============================================
// SCROLL PROGRESS BAR
// ============================================
function initScrollProgress() {
    const progressBar = document.createElement('div');
    progressBar.className = 'scroll-progress';
    document.body.appendChild(progressBar);
    
    window.addEventListener('scroll', () => {
        const windowHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const scrolled = (window.scrollY / windowHeight) * 100;
        progressBar.style.width = scrolled + '%';
    });
}

// ============================================
// GLASS MORPHISM NAVBAR (on scroll)
// ============================================
function initScrollNavbar() {
    const header = document.querySelector('header');
    if (!header) return;
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });
}

// ============================================
// INTERSECTION OBSERVER (Scroll Reveal)
// ============================================
function initScrollReveal() {
    const revealElements = document.querySelectorAll('.reveal-on-scroll, .fade-in-up, .stat-item');
    
    const observerOptions = {
        threshold: 0.15,
        rootMargin: '0px 0px -100px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                // Stop observing once revealed
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);
    
    revealElements.forEach(el => observer.observe(el));
}

// ============================================
// PARALLAX EFFECT (Hero Banner)
// ============================================
function initParallax() {
    const parallaxElements = document.querySelectorAll('.parallax-layer');
    
    if (parallaxElements.length === 0) return;
    
    window.addEventListener('scroll', () => {
        const scrolled = window.scrollY;
        
        parallaxElements.forEach((el, index) => {
            const speed = (index + 1) * 0.3; // Different speeds for different layers
            const yPos = -(scrolled * speed);
            el.style.transform = `translateY(${yPos}px)`;
        });
    });
}

// ============================================
// FLOATING PARTICLES (Hero Section)
// ============================================
function initParticles() {
    const heroSection = document.querySelector('.hero');
    if (!heroSection) return;
    
    // Create particles container if it doesn't exist
    let particlesContainer = heroSection.querySelector('.particles');
    if (!particlesContainer) {
        particlesContainer = document.createElement('div');
        particlesContainer.className = 'particles';
        heroSection.appendChild(particlesContainer);
        
        // Create 10 particles
        for (let i = 0; i < 10; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particlesContainer.appendChild(particle);
        }
    }
}

// ============================================
// STATS COUNTER ANIMATION
// ============================================
function animateCounter(element, target, duration = 2000) {
    let start = 0;
    const increment = target / (duration / 16); // 60fps
    
    const updateCounter = () => {
        start += increment;
        if (start < target) {
            element.textContent = Math.floor(start);
            requestAnimationFrame(updateCounter);
        } else {
            element.textContent = target;
        }
    };
    
    updateCounter();
}

function initStatsCounter() {
    const statNumbers = document.querySelectorAll('.stat-number');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !entry.target.classList.contains('counted')) {
                entry.target.classList.add('counted');
                const targetText = entry.target.textContent;
                const targetNumber = parseInt(targetText.replace(/\D/g, ''));
                const suffix = targetText.replace(/[0-9]/g, '');
                
                animateCounter(entry.target, targetNumber);
                
                // Add suffix back after animation
                setTimeout(() => {
                    entry.target.textContent = targetNumber + suffix;
                }, 2000);
            }
        });
    }, { threshold: 0.5 });
    
    statNumbers.forEach(stat => observer.observe(stat));
}

// ============================================
// CUSTOM CURSOR (Desktop Only)
// ============================================
function initCustomCursor() {
    // Only on desktop
    if (window.innerWidth < 768) return;
    
    const cursor = document.createElement('div');
    cursor.className = 'custom-cursor';
    document.body.appendChild(cursor);
    
    const follower = document.createElement('div');
    follower.className = 'custom-cursor-follower';
    document.body.appendChild(follower);
    
    let mouseX = 0, mouseY = 0;
    let followerX = 0, followerY = 0;
    
    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
        
        cursor.style.left = mouseX + 'px';
        cursor.style.top = mouseY + 'px';
        cursor.classList.add('active');
        follower.classList.add('active');
    });
    
    // Smooth follower animation
    function animateFollower() {
        followerX += (mouseX - followerX) * 0.1;
        followerY += (mouseY - followerY) * 0.1;
        
        follower.style.left = followerX + 'px';
        follower.style.top = followerY + 'px';
        
        requestAnimationFrame(animateFollower);
    }
    animateFollower();
    
    // Hover effects on interactive elements
    const hoverElements = document.querySelectorAll('a, button, .card, .tag');
    hoverElements.forEach(el => {
        el.addEventListener('mouseenter', () => cursor.classList.add('hover'));
        el.addEventListener('mouseleave', () => cursor.classList.remove('hover'));
    });
}

// ============================================
// MAGNETIC EFFECT (for buttons and cards)
// ============================================
function initMagneticEffect() {
    const magneticElements = document.querySelectorAll('.magnetic, .btn, .card');
    
    magneticElements.forEach(el => {
        el.addEventListener('mousemove', (e) => {
            const rect = el.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            
            const moveX = x * 0.15;
            const moveY = y * 0.15;
            
            el.style.transform = `translate(${moveX}px, ${moveY}px)`;
        });
        
        el.addEventListener('mouseleave', () => {
            el.style.transform = 'translate(0, 0)';
        });
    });
}

// ============================================
// TILT EFFECT (3D card tilt on hover)
// ============================================
function initTiltEffect() {
    const tiltCards = document.querySelectorAll('.tilt-card, .card');
    
    tiltCards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            
            const rotateX = (y - centerY) / 10;
            const rotateY = (centerX - x) / 10;
            
            card.style.setProperty('--rotate-x', `${rotateX}deg`);
            card.style.setProperty('--rotate-y', `${rotateY}deg`);
        });
        
        card.addEventListener('mouseleave', () => {
            card.style.setProperty('--rotate-x', '0deg');
            card.style.setProperty('--rotate-y', '0deg');
        });
    });
}

// ============================================
// TYPEWRITER EFFECT (for hero tagline)
// ============================================
function initTypewriter() {
    const typewriterElement = document.querySelector('.typewriter-text');
    if (!typewriterElement) return;
    
    const text = typewriterElement.textContent;
    typewriterElement.textContent = '';
    typewriterElement.style.display = 'inline-block';
    
    let index = 0;
    
    function typeCharacter() {
        if (index < text.length) {
            typewriterElement.textContent += text.charAt(index);
            index++;
            setTimeout(typeCharacter, 80);
        } else {
            // Remove cursor after typing is done
            setTimeout(() => {
                typewriterElement.style.borderRight = 'none';
            }, 500);
        }
    }
    
    // Start typing after a short delay
    setTimeout(typeCharacter, 500);
}

// ============================================
// PAGE TRANSITION
// ============================================
function initPageTransition() {
    // Create transition overlay
    const transition = document.createElement('div');
    transition.className = 'page-transition';
    transition.innerHTML = `
        <div class="page-transition-content">
            <div class="loader"></div>
            <div class="loader-text">LOADING</div>
        </div>
    `;
    document.body.appendChild(transition);
    
    // Show on page load
    window.addEventListener('load', () => {
        transition.classList.add('active');
        setTimeout(() => {
            transition.classList.remove('active');
        }, 800);
    });
    
    // Show on navigation
    document.querySelectorAll('a:not([target="_blank"])').forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');
            // Only for internal links
            if (href && !href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('http')) {
                e.preventDefault();
                transition.classList.add('active');
                setTimeout(() => {
                    window.location.href = href;
                }, 500);
            }
        });
    });
}

// ============================================
// SMOOTH SCROLL FOR ANCHOR LINKS
// ============================================
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ 
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

// ============================================
// STAGGERED CARD ANIMATIONS
// ============================================
function initStaggeredCards() {
    const cards = document.querySelectorAll('.card');
    
    cards.forEach((card, index) => {
        card.style.animationDelay = `${index * 0.1}s`;
        card.classList.add('fade-in-up');
    });
}

// ============================================
// INITIALIZE ALL ANIMATIONS
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎨 Initializing Yaan Batho portfolio animations...');
    
    // Core animations
    initScrollProgress();
    initScrollNavbar();
    initScrollReveal();
    initParallax();
    initParticles();
    initSmoothScroll();
    initStaggeredCards();
    
    // Interactive effects
    initCustomCursor();
    initMagneticEffect();
    initTiltEffect();
    
    // Stats counter (if present)
    if (document.querySelector('.stat-number')) {
        initStatsCounter();
    }
    
    // Typewriter (if present)
    if (document.querySelector('.typewriter-text')) {
        initTypewriter();
    }
    
    // Page transitions
    initPageTransition();
    
    console.log('✨ All animations initialized!');
});

// ============================================
// PERFORMANCE OPTIMIZATION
// ============================================

// Debounce function for resize events
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Re-initialize certain effects on resize
window.addEventListener('resize', debounce(() => {
    console.log('🔄 Re-initializing on resize...');
    // Re-init cursor if needed
    if (window.innerWidth >= 768) {
        const existingCursor = document.querySelector('.custom-cursor');
        if (!existingCursor) {
            initCustomCursor();
        }
    }
}, 250));
