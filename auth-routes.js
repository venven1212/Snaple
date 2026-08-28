const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('./db');

const router = express.Router();

function sign(user) {
  return jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '30d' });
}

router.post('/signup', async (req, res) => {
  const { username, password, displayName } = req.body;
  if (!username || !password || !displayName) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  const clean = username.trim().toLowerCase();
  const { data: existing } = await supabase.from('users').select('id').eq('username', clean).maybeSingle();
  if (existing) return res.status(409).json({ error: 'Username is taken' });

  const passwordHash = await bcrypt.hash(password, 10);
  const { data: user, error } = await supabase
    .from('users')
    .insert({ username: clean, password_hash: passwordHash, display_name: displayName.trim() })
    .select('id, username, display_name')
    .single();

  if (error) return res.status(500).json({ error: 'Could not create account' });

  res.json({ token: sign(user), user });
});

router.post('/signin', async (req, res) => {
  const { username, password } = req.body;
  const clean = (username || '').trim().toLowerCase();

  const { data: user } = await supabase.from('users').select('*').eq('username', clean).maybeSingle();
  if (!user) return res.status(401).json({ error: 'Wrong username or password' });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Wrong username or password' });

  res.json({
    token: sign(user),
    user: { id: user.id, username: user.username, display_name: user.display_name },
  });
});

module.exports = router;
