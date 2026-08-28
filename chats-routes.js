const express = require('express');
const supabase = require('./db');
const authenticate = require('./auth-middleware');

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  const { data: memberships } = await supabase
    .from('chat_members')
    .select('chat_id')
    .eq('user_id', req.userId);

  const chatIds = (memberships || []).map((m) => m.chat_id);
  if (chatIds.length === 0) return res.json([]);

  const { data: chats } = await supabase.from('chats').select('*').in('id', chatIds);

  const result = [];
  for (const chat of chats || []) {
    const { data: members } = await supabase
      .from('chat_members')
      .select('user_id, users:user_id (id, username, display_name)')
      .eq('chat_id', chat.id);

    const others = (members || []).filter((m) => m.user_id !== req.userId).map((m) => m.users);

    const { data: lastMsg } = await supabase
      .from('messages')
      .select('content, is_snap, created_at')
      .eq('chat_id', chat.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let streak = null;
    if (chat.type === 'dm' && others[0]) {
      const [a, b] = [req.userId, others[0].id].sort();
      const { data: friendship } = await supabase
        .from('friendships')
        .select('streak')
        .eq('user_a', a)
        .eq('user_b', b)
        .maybeSingle();
      streak = friendship ? friendship.streak : 0;
    }

    result.push({
      id: chat.id,
      type: chat.type,
      name: chat.type === 'dm' ? others[0]?.display_name || 'Unknown' : chat.name,
      otherUserId: chat.type === 'dm' ? others[0]?.id : null,
      lastMessage: lastMsg ? (lastMsg.is_snap ? '📸 Sent a snap' : lastMsg.content) : 'Say hi',
      streak,
    });
  }

  res.json(result);
});

router.post('/group', async (req, res) => {
  const { name, memberIds } = req.body;
  if (!name || !Array.isArray(memberIds) || memberIds.length === 0) {
    return res.status(400).json({ error: 'Missing group name or members' });
  }

  const { data: chat, error } = await supabase
    .from('chats')
    .insert({ type: 'group', name: name.trim() })
    .select('id')
    .single();

  if (error) return res.status(500).json({ error: 'Could not create group' });

  const members = [req.userId, ...memberIds].map((id) => ({ chat_id: chat.id, user_id: id }));
  await supabase.from('chat_members').insert(members);

  res.json({ id: chat.id });
});

router.get('/:id/messages', async (req, res) => {
  const { data: membership } = await supabase
    .from('chat_members')
    .select('chat_id')
    .eq('chat_id', req.params.id)
    .eq('user_id', req.userId)
    .maybeSingle();

  if (!membership) return res.status(403).json({ error: 'Not a member of this chat' });

  const { data: messages } = await supabase
    .from('messages')
    .select('id, sender_id, content, is_snap, created_at, users:sender_id (display_name)')
    .eq('chat_id', req.params.id)
    .order('created_at', { ascending: true })
    .limit(200);

  res.json(messages || []);
});

router.post('/:id/messages', async (req, res) => {
  const { content, isSnap } = req.body;

  const { data: membership } = await supabase
    .from('chat_members')
    .select('chat_id')
    .eq('chat_id', req.params.id)
    .eq('user_id', req.userId)
    .maybeSingle();

  if (!membership) return res.status(403).json({ error: 'Not a member of this chat' });

  const { data: message, error } = await supabase
    .from('messages')
    .insert({
      chat_id: req.params.id,
      sender_id: req.userId,
      content: isSnap ? null : content,
      is_snap: !!isSnap,
    })
    .select('id, sender_id, content, is_snap, created_at')
    .single();

  if (error) return res.status(500).json({ error: 'Could not send message' });

  if (isSnap) {
    const { data: chat } = await supabase.from('chats').select('type').eq('id', req.params.id).maybeSingle();
    if (chat?.type === 'dm') {
      const { data: members } = await supabase
        .from('chat_members')
        .select('user_id')
        .eq('chat_id', req.params.id);
      const other = (members || []).find((m) => m.user_id !== req.userId);
      if (other) {
        const [a, b] = [req.userId, other.user_id].sort();
        const today = new Date().toISOString().slice(0, 10);
        const { data: friendship } = await supabase
          .from('friendships')
          .select('*')
          .eq('user_a', a)
          .eq('user_b', b)
          .maybeSingle();

        if (friendship && friendship.last_snap_date !== today) {
          await supabase
            .from('friendships')
            .update({ streak: friendship.streak + 1, last_snap_date: today })
            .eq('id', friendship.id);
        }
      }
    }
  }

  res.json(message);
});

module.exports = router;
