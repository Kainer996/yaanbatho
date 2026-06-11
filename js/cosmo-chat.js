/* Cosmo Chat Widget — Click the spaceman to chat!
 * Connects to Ollama via /api/chat proxy
 */
(function() {
  'use strict';

  var chatOpen = false;
  var chatEl = null;
  var history = [];
  var isTyping = false;

  function buildChat() {
    chatEl = document.createElement('div');
    chatEl.id = 'cosmo-chat';
    chatEl.innerHTML = 
      '<div class="cosmo-chat-header">' +
        '<span class="cosmo-chat-title">🚀 Chat with Cosmo</span>' +
        '<button class="cosmo-chat-close" onclick="window.cosmoChatToggle()">&times;</button>' +
      '</div>' +
      '<div class="cosmo-chat-messages" id="cosmo-messages">' +
        '<div class="cosmo-msg cosmo-msg-bot">Hey! I\'m Cosmo, the spaceman who lives on this site. Click me anytime to chat! 🌟</div>' +
      '</div>' +
      '<div class="cosmo-chat-input">' +
        '<input type="text" id="cosmo-input" placeholder="Say something to Cosmo..." autocomplete="off">' +
        '<button id="cosmo-send">➤</button>' +
      '</div>';
    document.body.appendChild(chatEl);

    // Style
    var style = document.createElement('style');
    style.textContent = 
      '#cosmo-chat{position:fixed;bottom:20px;right:20px;width:340px;max-height:440px;' +
      'background:#0a1628;border:1px solid rgba(0,220,255,0.4);border-radius:12px;' +
      'box-shadow:0 8px 32px rgba(0,0,0,0.5),0 0 20px rgba(0,220,255,0.1);' +
      'font-family:"Rajdhani",system-ui,sans-serif;color:#d0e8f0;z-index:10000;' +
      'display:none;flex-direction:column;overflow:hidden;backdrop-filter:blur(12px)}' +
      '#cosmo-chat.open{display:flex}' +
      '.cosmo-chat-header{display:flex;justify-content:space-between;align-items:center;' +
      'padding:10px 14px;background:linear-gradient(135deg,#0d1f3c,#0a1628);' +
      'border-bottom:1px solid rgba(0,220,255,0.25)}' +
      '.cosmo-chat-title{font-family:"Orbitron",monospace;font-size:12px;color:#00dcff;letter-spacing:1.5px}' +
      '.cosmo-chat-close{background:none;border:none;color:#5a7a8a;font-size:22px;cursor:pointer;padding:0 4px;line-height:1}' +
      '.cosmo-chat-close:hover{color:#00dcff}' +
      '.cosmo-chat-messages{flex:1;overflow-y:auto;padding:12px;max-height:300px;' +
      'scrollbar-width:thin;scrollbar-color:rgba(0,220,255,0.3) transparent}' +
      '.cosmo-msg{margin:6px 0;padding:8px 12px;border-radius:8px;font-size:13px;line-height:1.4;max-width:85%;word-wrap:break-word}' +
      '.cosmo-msg-bot{background:rgba(0,220,255,0.08);border:1px solid rgba(0,220,255,0.2);' +
      'border-radius:8px 8px 8px 2px;color:#d0e8f0}' +
      '.cosmo-msg-user{background:rgba(0,150,200,0.2);border:1px solid rgba(0,180,220,0.3);' +
      'border-radius:8px 8px 2px 8px;margin-left:auto;text-align:right;color:#e8f4f8}' +
      '.cosmo-typing{color:#5a8a9a;font-style:italic;font-size:12px}' +
      '.cosmo-chat-input{display:flex;padding:8px;border-top:1px solid rgba(0,220,255,0.15);gap:6px}' +
      '#cosmo-input{flex:1;background:rgba(0,30,60,0.6);border:1px solid rgba(0,220,255,0.25);' +
      'border-radius:6px;padding:8px 12px;color:#d0e8f0;font-family:inherit;font-size:13px;outline:none}' +
      '#cosmo-input:focus{border-color:rgba(0,220,255,0.6);box-shadow:0 0 8px rgba(0,220,255,0.15)}' +
      '#cosmo-input::placeholder{color:#3a5a6a}' +
      '#cosmo-send{background:linear-gradient(135deg,#006a8a,#004a6a);border:1px solid rgba(0,220,255,0.4);' +
      'color:#00dcff;border-radius:6px;padding:8px 14px;cursor:pointer;font-size:14px;transition:all 0.2s}' +
      '#cosmo-send:hover{background:linear-gradient(135deg,#008aaa,#006a8a);box-shadow:0 0 10px rgba(0,220,255,0.3)}' +
      '#cosmo-send:disabled{opacity:0.4;cursor:not-allowed}' +
      '@media(max-width:768px){#cosmo-chat{display:none!important}}';
    document.head.appendChild(style);

    // Events
    document.getElementById('cosmo-send').addEventListener('click', sendMessage);
    document.getElementById('cosmo-input').addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
  }

  function addMessage(text, type) {
    var messagesEl = document.getElementById('cosmo-messages');
    var msg = document.createElement('div');
    msg.className = 'cosmo-msg cosmo-msg-' + type;
    msg.textContent = text;
    messagesEl.appendChild(msg);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return msg;
  }

  function sendMessage() {
    if (isTyping) return;
    var input = document.getElementById('cosmo-input');
    var text = input.value.trim();
    if (!text) return;

    input.value = '';
    addMessage(text, 'user');
    history.push({ role: 'user', content: text });

    isTyping = true;
    document.getElementById('cosmo-send').disabled = true;
    var typingEl = addMessage('Cosmo is thinking...', 'bot');
    typingEl.classList.add('cosmo-typing');

    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, history: history.slice(-6) })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      typingEl.remove();
      var reply = data.reply || 'Lost in space for a moment there...';
      addMessage(reply, 'bot');
      history.push({ role: 'assistant', content: reply });
    })
    .catch(function() {
      typingEl.remove();
      addMessage('*static* Lost signal! Try again in a sec.', 'bot');
    })
    .finally(function() {
      isTyping = false;
      document.getElementById('cosmo-send').disabled = false;
      document.getElementById('cosmo-input').focus();
    });
  }

  window.cosmoChatToggle = function() {
    if (!chatEl) buildChat();
    chatOpen = !chatOpen;
    chatEl.classList.toggle('open', chatOpen);
    if (chatOpen) {
      setTimeout(function() { document.getElementById('cosmo-input').focus(); }, 100);
    }
  };

  // Hook into the spaceman mascot — make it clickable
  function hookMascot() {
    var mascot = document.getElementById('spaceman-mascot');
    if (mascot) {
      mascot.style.cursor = 'pointer';
      mascot.addEventListener('click', function(e) {
        e.stopPropagation();
        window.cosmoChatToggle();
      });
      // Add a little speech bubble hint
      var hint = document.createElement('div');
      hint.id = 'cosmo-hint';
      hint.textContent = '💬 Click me!';
      hint.style.cssText = 'position:absolute;top:-28px;left:50%;transform:translateX(-50%);' +
        'background:#0a1628;border:1px solid rgba(0,220,255,0.4);color:#00dcff;' +
        'font-family:Rajdhani,sans-serif;font-size:11px;padding:3px 8px;border-radius:8px;' +
        'white-space:nowrap;opacity:0;transition:opacity 0.3s;pointer-events:none';
      mascot.style.position = mascot.style.position || 'fixed';
      mascot.appendChild(hint);
      mascot.addEventListener('mouseenter', function() { hint.style.opacity = '1'; });
      mascot.addEventListener('mouseleave', function() { hint.style.opacity = '0'; });
    } else {
      // Mascot not loaded yet, retry
      setTimeout(hookMascot, 1000);
    }
  }

  // Init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(hookMascot, 1000); });
  } else {
    setTimeout(hookMascot, 1000);
  }
})();
