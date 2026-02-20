const express = require('express');
const router = express.Router();
const { checkAiLimit } = require('../middleware/rateLimit');

const GROQ_KEY = process.env.GROQ_API_KEY || '';

router.get('/', async (req, res) => {
  try {
    const r = await fetch('https://min-api.cryptocompare.com/data/v2/news/?lang=EN');
    const data = await r.json();
    res.json(data.Data || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/summary', async (req, res) => {
  if (!checkAiLimit(req, res)) return;
  try {
    const { title, body, lang } = req.body;
    const replyLang = lang === 'en' ? 'English' : 'Russian (русский язык)';
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({
        model: 'moonshotai/kimi-k2-instruct',
        messages: [
          { role: 'system', content: `You are a crypto news analyst. Summarize the news article in 2-3 sentences. Include key takeaways and potential market impact. ALWAYS reply in ${replyLang}.` },
          { role: 'user', content: `Title: ${title}\n\n${body || ''}` }
        ],
        temperature: 0.5, max_tokens: 500
      })
    });
    const data = await r.json();
    res.json({ summary: data?.choices?.[0]?.message?.content || 'Error' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
