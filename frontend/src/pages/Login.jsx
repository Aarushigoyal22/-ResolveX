import { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';

export default function Login() {
  const { login } = useAuth();
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setErr('');
    try { login(await api(`/auth/${mode}`, { method: 'POST', body: f })); }
    catch (e) { setErr(e.message); }
  }

  return (
    <div className="login">
      <div className="login-art">
        <h1>Every request,<br />answered on time.</h1>
        <p>Track incidents from first report to resolution, with deadlines that watch themselves.</p>
      </div>
      <form className="login-form" onSubmit={submit}>
        <h2>{mode === 'login' ? 'Sign in' : 'Create your account'}</h2>
        {mode === 'register' && <label>Name<input value={f.name} onChange={set('name')} required /></label>}
        <label>Email<input type="email" value={f.email} onChange={set('email')} required /></label>
        <label>Password<input type="password" value={f.password} onChange={set('password')} minLength={8} required /></label>
        {err && <p className="err">{err}</p>}
        <button className="btn">{mode === 'login' ? 'Sign in' : 'Create account'}</button>
        <button type="button" className="link" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? 'New here? Create an account' : 'Have an account? Sign in'}
        </button>
        <small className="hint">Demo: admin@resolvex.dev · asha@resolvex.dev · user@resolvex.dev / password123</small>
      </form>
    </div>
  );
}
