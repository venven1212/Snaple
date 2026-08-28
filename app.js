const token = localStorage.getItem('snaple_token');
const currentUser = JSON.parse(localStorage.getItem('snaple_user') || 'null');

if (!token || !currentUser) {
  window.location.href = 'signin.html';
}

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  if (res.status === 401) {
    localStorage.removeItem('snaple_token');
    localStorage.removeItem('snaple_user');
    window.location.href = 'signin.html';
    return;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

let chats = [];
let friends = [];
let activeChatId = null;
let activeChatType = null;

const chatList = document.getElementById('chatList');
const friendList = document.getElementById('friendList');
const incomingList = document.getElementById('incomingList');
const outgoingList = document.getElementById('outgoingList');
const emptyState = document.getElementById('emptyState');
const threadView = document.getElementById('threadView');
const threadName = document.getElementById('threadName');
const threadStreak = document.getElementById('threadStreak');
const threadStreakCount = document.getElementById('threadStreakCount');
const threadMessages = document.getElementById('threadMessages');

async function refreshChats() {
  chats = await api('/chats') || [];
  renderChatList();
}

async function refreshFriends() {
  friends = await api('/friends') || [];
  renderFriendList();
}

async function refreshRequests() {
  const result = await api('/friends/requests');
  if (result) renderRequests(result.incoming, result.outgoing);
}

function renderChatList() {
  chatList.innerHTML = '';
  chats.forEach((chat) => {
    const li = document.createElement('li');
    li.className = 'list-item' + (chat.id === activeChatId ? ' active' : '');
    const streakBadge = chat.type === 'dm' && chat.streak !== null ? `<span class="streak-badge">🔥 ${chat.streak}</span>` : '';
    li.innerHTML = `
      <div class="list-item-avatar">${chat.type === 'group' ? '👥' : chat.name.charAt(0)}</div>
      <div class="list-item-text">
        <span class="list-item-name">${chat.name}</span>
        <span class="list-item-preview">${chat.lastMessage}</span>
      </div>
      ${streakBadge}
    `;
    li.addEventListener('click', () => openChat(chat.id, chat.type, chat.name, chat.streak));
    chatList.appendChild(li);
  });
}

function renderFriendList() {
  friendList.innerHTML = friends.length ? '' : '<p class="empty-hint">No friends yet — find someone in Requests.</p>';
  friends.forEach((friend) => {
    const li = document.createElement('li');
    li.className = 'list-item';
    li.innerHTML = `
      <div class="list-item-avatar">${friend.display_name.charAt(0)}</div>
      <div class="list-item-text">
        <span class="list-item-name">${friend.display_name}</span>
        <span class="list-item-preview">@${friend.username}</span>
      </div>
      <span class="streak-badge">🔥 ${friend.streak}</span>
    `;
    li.addEventListener('click', () => {
      const chat = chats.find((c) => c.type === 'dm' && c.otherUserId === friend.id);
      if (chat) {
        switchTab('chats');
        openChat(chat.id, chat.type, chat.name, chat.streak);
      }
    });
    friendList.appendChild(li);
  });
}

function renderRequests(incoming, outgoing) {
  incomingList.innerHTML = incoming.length
    ? incoming.map((r) => `
      <li class="request-item">
        <span>${r.users.display_name} <span class="muted">@${r.users.username}</span></span>
        <div class="request-actions">
          <button class="btn btn-primary btn-tiny" data-accept="${r.id}">Accept</button>
          <button class="btn btn-ghost btn-tiny" data-decline="${r.id}">Decline</button>
        </div>
      </li>
    `).join('')
    : '<p class="empty-hint">No incoming requests.</p>';

  outgoingList.innerHTML = outgoing.length
    ? outgoing.map((r) => `
      <li class="request-item">
        <span>${r.users.display_name} <span class="muted">@${r.users.username}</span></span>
        <span class="muted">Pending</span>
      </li>
    `).join('')
    : '<p class="empty-hint">No pending requests.</p>';

  incomingList.querySelectorAll('[data-accept]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await api(`/friends/requests/${btn.dataset.accept}/accept`, { method: 'POST' });
      await Promise.all([refreshRequests(), refreshFriends(), refreshChats()]);
    });
  });

  incomingList.querySelectorAll('[data-decline]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await api(`/friends/requests/${btn.dataset.decline}/decline`, { method: 'POST' });
      refreshRequests();
    });
  });
}

async function openChat(id, type, name, streak) {
  activeChatId = id;
  activeChatType = type;
  emptyState.classList.add('hidden');
  threadView.classList.remove('hidden');
  threadName.textContent = name;

  if (type === 'dm') {
    threadStreak.classList.remove('hidden');
    threadStreakCount.textContent = streak ?? 0;
  } else {
    threadStreak.classList.add('hidden');
  }

  await loadMessages();
  renderChatList();
}

async function loadMessages() {
  if (!activeChatId) return;
  const messages = await api(`/chats/${activeChatId}/messages`);
  if (!messages) return;

  threadMessages.innerHTML = messages.map((m) => {
    const mine = m.sender_id === currentUser.id;
    const who = !mine && activeChatType === 'group' && m.users ? `<span class="bubble-who">${m.users.display_name}</span>` : '';
    const text = m.is_snap ? '📸 Sent a snap' : m.content;
    return `<div class="bubble ${mine ? 'bubble-out' : 'bubble-in'}${m.is_snap ? ' bubble-snap' : ''}">${who}${text}</div>`;
  }).join('');
  threadMessages.scrollTop = threadMessages.scrollHeight;
}

document.getElementById('messageForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('messageInput');
  const content = input.value.trim();
  if (!content || !activeChatId) return;
  input.value = '';
  await api(`/chats/${activeChatId}/messages`, { method: 'POST', body: JSON.stringify({ content }) });
  await loadMessages();
  refreshChats();
});

document.getElementById('snapBtn').addEventListener('click', async () => {
  if (!activeChatId) return;
  await api(`/chats/${activeChatId}/messages`, { method: 'POST', body: JSON.stringify({ isSnap: true }) });
  await loadMessages();
  const chat = chats.find((c) => c.id === activeChatId);
  if (chat && chat.type === 'dm') {
    threadStreakCount.textContent = (parseInt(threadStreakCount.textContent, 10) || 0) + 1;
  }
  refreshChats();
});

document.getElementById('searchForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('searchInput');
  const q = input.value.trim();
  if (!q) return;

  const results = await api(`/friends/search?q=${encodeURIComponent(q)}`);
  const container = document.getElementById('searchResults');
  container.innerHTML = results.length
    ? results.map((u) => `
      <li class="request-item">
        <span>${u.display_name} <span class="muted">@${u.username}</span></span>
        <button class="btn btn-primary btn-tiny" data-send="${u.username}">Add</button>
      </li>
    `).join('')
    : '<p class="empty-hint">No one found.</p>';

  container.querySelectorAll('[data-send]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        await api('/friends/requests', { method: 'POST', body: JSON.stringify({ toUsername: btn.dataset.send }) });
        btn.textContent = 'Sent';
        refreshRequests();
      } catch (err) {
        btn.disabled = false;
        alert(err.message);
      }
    });
  });
});

const groupModal = document.getElementById('groupModal');
document.getElementById('newGroupBtn').addEventListener('click', () => {
  const checks = document.getElementById('groupFriendChecks');
  checks.innerHTML = friends.length
    ? friends.map((f) => `
      <label class="group-friend-check">
        <input type="checkbox" value="${f.id}"> ${f.display_name}
      </label>
    `).join('')
    : '<p class="empty-hint">Add some friends first.</p>';
  document.getElementById('groupName').value = '';
  groupModal.classList.remove('hidden');
});

document.getElementById('cancelGroupBtn').addEventListener('click', () => {
  groupModal.classList.add('hidden');
});

document.getElementById('createGroupBtn').addEventListener('click', async () => {
  const name = document.getElementById('groupName').value.trim();
  const memberIds = [...document.querySelectorAll('#groupFriendChecks input:checked')].map((c) => c.value);
  if (!name || memberIds.length === 0) return;

  await api('/chats/group', { method: 'POST', body: JSON.stringify({ name, memberIds }) });
  groupModal.classList.add('hidden');
  refreshChats();
});

function switchTab(tab) {
  document.querySelectorAll('.app-tab').forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === tab));
  document.getElementById('chatsPanel').classList.toggle('hidden', tab !== 'chats');
  document.getElementById('friendsPanel').classList.toggle('hidden', tab !== 'friends');
  document.getElementById('requestsPanel').classList.toggle('hidden', tab !== 'requests');
}

document.querySelectorAll('.app-tab').forEach((btn) => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('snaple_token');
  localStorage.removeItem('snaple_user');
  window.location.href = 'index.html';
});

refreshChats();
refreshFriends();
refreshRequests();

setInterval(refreshChats, 5000);
setInterval(refreshRequests, 8000);
setInterval(() => { if (activeChatId) loadMessages(); }, 3000);
