const BASE = import.meta.env.VITE_API_URL || '/api';

export async function api(path, { method = 'GET', body } = {}) {
  const token = localStorage.getItem('rx_token');
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) {           // expired session
    localStorage.removeItem('rx_token');
    localStorage.removeItem('rx_user');
    window.location.href = '/login';
  }
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}
