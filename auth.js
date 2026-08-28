const authError = document.getElementById('authError');
const signupForm = document.getElementById('signupForm');
const signinForm = document.getElementById('signinForm');

async function submitAuth(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

if (signupForm) {
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    authError.textContent = '';
    const displayName = document.getElementById('displayName').value.trim();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    try {
      const { token, user } = await submitAuth('/auth/signup', { username, password, displayName });
      localStorage.setItem('snaple_token', token);
      localStorage.setItem('snaple_user', JSON.stringify(user));
      window.location.href = 'app.html';
    } catch (err) {
      authError.textContent = err.message;
    }
  });
}

if (signinForm) {
  signinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    authError.textContent = '';
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    try {
      const { token, user } = await submitAuth('/auth/signin', { username, password });
      localStorage.setItem('snaple_token', token);
      localStorage.setItem('snaple_user', JSON.stringify(user));
      window.location.href = 'app.html';
    } catch (err) {
      authError.textContent = err.message;
    }
  });
}
