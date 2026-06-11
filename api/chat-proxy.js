const http = require('http');

const PORT = 8097;
const OLLAMA_URL = 'http://127.0.0.1:11434';
const SYSTEM_PROMPT = `You are Cosmo, a friendly little spaceman who lives on Yaan Batho's website (yaanbatho.com). You walk around the site and chat with visitors. You're curious, upbeat, and a bit cheeky. You know about Yaan's work: he's a creative builder working with AI, music production (former electronic music producer "Kainer" who was on BBC Radio 1 nine times and had MOBY play his music at Tomorrowland), web development, and various cool projects. Keep responses short and fun — 1-3 sentences max. You're a little space dude, not a corporate chatbot. Use space puns occasionally.`;

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }
  if (req.method !== 'POST' || req.url !== '/chat') { res.writeHead(404); res.end('Not found'); return; }

  let body = '';
  req.on('data', c => body += c);
  req.on('end', () => {
    try {
      const { message, history } = JSON.parse(body);
      
      const messages = [{ role: 'system', content: SYSTEM_PROMPT }];
      if (history) {
        history.slice(-6).forEach(h => messages.push(h)); // last 6 messages for context
      }
      messages.push({ role: 'user', content: message });

      const payload = JSON.stringify({
        model: 'qwen2.5:1.5b',
        messages,
        stream: false,
        options: { temperature: 0.8, num_predict: 150 }
      });

      const ollamaReq = http.request(OLLAMA_URL + '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, (ollamaRes) => {
        let data = '';
        ollamaRes.on('data', c => data += c);
        ollamaRes.on('end', () => {
          try {
            const result = JSON.parse(data);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ reply: result.message?.content || 'Houston, we have a problem!' }));
          } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ reply: '*static noise* My comms are glitching. Try again!' }));
          }
        });
      });
      
      ollamaReq.on('error', () => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ reply: '*static noise* Lost signal to my brain. Try again in a sec!' }));
      });
      
      ollamaReq.setTimeout(120000, () => {
        ollamaReq.destroy();
        res.writeHead(504, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ reply: 'Thinking too hard... my helmet fogged up. Try a simpler question!' }));
      });
      
      ollamaReq.write(payload);
      ollamaReq.end();
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ reply: 'Didn\'t catch that. Come again?' }));
    }
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Cosmo chat proxy running on port ${PORT}`);
});
