const express = require('express');
const supabase = require('./db');
const authenticate = require('./auth-middleware');

const router = express.Router();
router.use(authenticate);

router.get('/search', async (req, res) => {
  const q = (req.query.q || '').trim().toLowerCase();
  if (!q) return res.json([]);

  const { data } = await supabase
    .from('users')
    .select('id, username, display_name')
    .ilike('username', `%${q}%`)
    .neq('id', req.userId)
    .limit(10);

  res.json(data || []);
});

router.post('/requests', async (req, res) => {
  const { toUsername } = req.body;
  const clean = (toUsername || '').trim().toLowerCase();

  const { data: target } = await supabase.from('users').select('id').eq('username', clean).maybeSingle();
  if (!target) return res.status(404).json({ error: 'No user with that username' });
  if (target.id === req.userId) return res.status(400).json({ error: "That's you" });

  const [a, b] = [req.userId, target.id].sort();
  const { data: existingFriendship } = await supabase
    .from('friendships')
    .select('id')
    .eq('user_a', a)
    .eq('user_b', b)
    .maybeSingle();
  if (existingFriendship) return res.status(409).json({ error: 'Already friends' });

  const { data: existingRequest } = await supabase
    .from('friend_requests')
    .select('id')
    .or(`and(sender_id.eq.${req.userId},receiver_id.eq.${target.id}),and(sender_id.eq.${target.id},receiver_id.eq.${req.userId})`)
    .eq('status', 'pending')
    .maybeSingle();
  if (existingRequest) return res.status(409).json({ error: 'Request already pending' });

  const { error } = await supabase
    .from('friend_requests')
    .insert({ sender_id: req.userId, receiver_id: target.id });

  if (error) return res.status(500).json({ error: 'Could not send request' });
  res.json({ ok: true });
});

router.get('/requests', async (req, res) => {
  const { data: incoming } = await supabase
    .from('friend_requests')
    .select('id, sender_id, users:sender_id (username, display_name)')
    .eq('receiver_id', req.userId)
    .eq('status', 'pending');

  const { data: outgoing } = await supabase
    .from('friend_requests')
    .select('id, receiver_id, users:receiver_id (username, display_name)')
    .eq('sender_id', req.userId)
    .eq('status', 'pending');

  res.json({ incoming: incoming || [], outgoing: outgoing || [] });
});

router.post('/requests/:id/accept', async (req, res) => {
  const { data: request } = await supabase
    .from('friend_requests')
    .select('*')
    .eq('id', req.params.id)
    .eq('receiver_id', req.userId)
    .maybeSingle();

  if (!request) return res.status(404).json({ error: 'Request not found' });

  await supabase.from('friend_requests').update({ status: 'accepted' }).eq('id', request.id);

  const [a, b] = [request.sender_id, request.receiver_id].sort();
  await supabase.from('friendships').insert({ user_a: a, user_b: b, streak: 0 });

  const { data: chat } = await supabase.from('chats').insert({ type: 'dm' }).select('id').single();
  await supabase.from('chat_members').insert([
    { chat_id: chat.id, user_id: request.sender_id },
    { chat_id: chat.id, user_id: request.receiver_id },
  ]);

  res.json({ ok: true });
});

router.post('/requests/:id/decline', async (req, res) => {
  await supabase
    .from('friend_requests')
    .update({ status: 'declined' })
    .eq('id', req.params.id)
    .eq('receiver_id', req.userId);

  res.json({ ok: true });
});

router.get('/', async (req, res) => {
  const { data } = await supabase
    .from('friendships')
    .select('*')
    .or(`user_a.eq.${req.userId},user_b.eq.${req.userId}`);

  const friendIds = (data || []).map((f) => (f.user_a === req.userId ? f.user_b : f.user_a));
  if (friendIds.length === 0) return res.json([]);

  const { data: users } = await supabase
    .from('users')
    .select('id, username, display_name')
    .in('id', friendIds);

  const result = (users || []).map((u) => {
    const friendship = data.find((f) => f.user_a === u.id || f.user_b === u.id);
    return { ...u, streak: friendship ? friendship.streak : 0 };
  });

  res.json(result);
});

module.exports = router;
