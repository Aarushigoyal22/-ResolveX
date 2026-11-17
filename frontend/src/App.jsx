import { createContext, useContext, useState } from 'react';
import { Routes, Route, Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Tickets from './pages/Tickets.jsx';
import NewTicket from './pages/NewTicket.jsx';
import TicketDetail from './pages/TicketDetail.jsx';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

function Shell() {
  const { user, logout } = useAuth();
  const staff = user.role !== 'user';
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">Resolve<b>X</b></div>
        <nav>
          {staff && <NavLink to="/dashboard">Dashboard</NavLink>}
          <NavLink to="/tickets" end>{staff ? 'All tickets' : 'My tickets'}</NavLink>
          <NavLink to="/tickets/new">New ticket</NavLink>
        </nav>
        <div className="me">
          <div>{user.name}</div>
          <small>{user.role}</small>
          <button className="link" onClick={logout}>Sign out</button>
        </div>
      </aside>
      <main className="main"><Outlet /></main>
    </div>
  );
}

function Protected({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const nav = useNavigate();
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('rx_user') || 'null'));

  const login = ({ token, user }) => {
    localStorage.setItem('rx_token', token);
    localStorage.setItem('rx_user', JSON.stringify(user));
    setUser(user);
    nav(user.role === 'user' ? '/tickets' : '/dashboard');
  };
  const logout = () => {
    localStorage.removeItem('rx_token');
    localStorage.removeItem('rx_user');
    setUser(null);
    nav('/login');
  };

  return (
    <AuthCtx.Provider value={{ user, login, logout }}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<Protected><Shell /></Protected>}>
          <Route path="/dashboard" element={user?.role === 'user' ? <Navigate to="/tickets" /> : <Dashboard />} />
          <Route path="/tickets" element={<Tickets />} />
          <Route path="/tickets/new" element={<NewTicket />} />
          <Route path="/tickets/:id" element={<TicketDetail />} />
          <Route path="*" element={<Navigate to="/tickets" />} />
        </Route>
      </Routes>
    </AuthCtx.Provider>
  );
}
