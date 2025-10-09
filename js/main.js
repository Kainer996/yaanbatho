// Yaan Batho - Main JavaScript

// Mobile Menu Toggle
document.addEventListener('DOMContentLoaded', function() {
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const nav = document.querySelector('nav');
    
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', function() {
            nav.classList.toggle('active');
            this.textContent = nav.classList.contains('active') ? '✕' : '☰';
        });
    }

    // Set active nav link based on current page
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const navLinks = document.querySelectorAll('nav a');
    navLinks.forEach(link => {
        const linkPage = link.getAttribute('href');
        if (linkPage === currentPage || (currentPage === '' && linkPage === 'index.html')) {
            link.classList.add('active');
        }
    });
});

// Audio Player Class
class AudioPlayer {
    constructor(element) {
        this.player = element;
        this.audio = this.player.querySelector('audio');
        this.playBtn = this.player.querySelector('.play-btn');
        this.progress = this.player.querySelector('.progress');
        this.currentTimeEl = this.player.querySelector('.current-time');
        this.durationEl = this.player.querySelector('.duration');
        
        this.init();
    }

    init() {
        // Play/Pause
        this.playBtn.addEventListener('click', () => this.togglePlay());
        
        // Update progress
        this.audio.addEventListener('timeupdate', () => this.updateProgress());
        
        // Update duration
        this.audio.addEventListener('loadedmetadata', () => this.updateDuration());
        
        // Seek
        this.progress.addEventListener('input', (e) => this.seek(e));
        
        // Reset on end
        this.audio.addEventListener('ended', () => this.reset());
    }

    togglePlay() {
        if (this.audio.paused) {
            this.audio.play();
            this.playBtn.textContent = '❚❚';
        } else {
            this.audio.pause();
            this.playBtn.textContent = '▶';
        }
    }

    updateProgress() {
        if (this.audio.duration) {
            this.progress.value = (this.audio.currentTime / this.audio.duration) * 100;
            this.currentTimeEl.textContent = this.formatTime(this.audio.currentTime);
        }
    }

    updateDuration() {
        this.durationEl.textContent = this.formatTime(this.audio.duration);
    }

    seek(e) {
        const seekTime = (e.target.value / 100) * this.audio.duration;
        this.audio.currentTime = seekTime;
    }

    reset() {
        this.playBtn.textContent = '▶';
        this.progress.value = 0;
    }

    formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
}

// Initialize audio players
document.addEventListener('DOMContentLoaded', function() {
    const audioPlayers = document.querySelectorAll('.audio-player');
    audioPlayers.forEach(player => new AudioPlayer(player));
});

// Project Filtering
function initProjectFiltering() {
    const tags = document.querySelectorAll('.filter-bar .tag');
    const cards = document.querySelectorAll('.project-card');
    
    tags.forEach(tag => {
        tag.addEventListener('click', function() {
            // Remove active from all tags
            tags.forEach(t => t.classList.remove('active'));
            // Add active to clicked tag
            this.classList.add('active');
            
            const filterTag = this.dataset.tag;
            
            cards.forEach(card => {
                if (filterTag === 'all') {
                    card.style.display = 'block';
                } else {
                    const cardTags = card.dataset.tags ? card.dataset.tags.split(',') : [];
                    if (cardTags.includes(filterTag)) {
                        card.style.display = 'block';
                    } else {
                        card.style.display = 'none';
                    }
                }
            });
        });
    });
}

// Music Filtering
function initMusicFiltering() {
    const tags = document.querySelectorAll('.filter-bar .tag');
    const cards = document.querySelectorAll('.music-card');
    
    tags.forEach(tag => {
        tag.addEventListener('click', function() {
            tags.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            const filterAlias = this.dataset.alias;
            
            cards.forEach(card => {
                if (filterAlias === 'all') {
                    card.style.display = 'block';
                } else {
                    const cardAlias = card.dataset.alias;
                    if (cardAlias === filterAlias) {
                        card.style.display = 'block';
                    } else {
                        card.style.display = 'none';
                    }
                }
            });
        });
    });
}

// Contact Form
function initContactForm() {
    const form = document.querySelector('.contact-form');
    if (!form) return;
    
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const name = this.querySelector('[name="name"]').value;
        const email = this.querySelector('[name="email"]').value;
        const subject = this.querySelector('[name="subject"]').value;
        const message = this.querySelector('[name="message"]').value;
        
        const mailtoLink = `mailto:hello@yaanbatho.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`From: ${name} (${email})\n\n${message}`)}`;
        
        window.location.href = mailtoLink;
    });
}

// Initialize based on page
document.addEventListener('DOMContentLoaded', function() {
    // Project filtering
    if (document.querySelector('.project-card')) {
        initProjectFiltering();
    }
    
    // Music filtering
    if (document.querySelector('.music-card')) {
        initMusicFiltering();
    }
    
    // Contact form
    initContactForm();
    
    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });
});

