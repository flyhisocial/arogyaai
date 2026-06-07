// ═══════════════════════════════════════════════════
//  ArogyaAI — API Client
//  Connects frontend to real Express + Supabase backend
// ═══════════════════════════════════════════════════

const AROGYAAI = (() => {

  // ── CONFIG ──────────────────────────────────────
  // Change this to your Railway URL after deploying backend
  const API_BASE = 'https://arogyaai-backend.up.railway.app';
  const TOKEN_KEY = 'arogyaai_token';
  const USER_KEY  = 'arogyaai_user';

  // ── HELPERS ─────────────────────────────────────
  function getToken() { return localStorage.getItem(TOKEN_KEY); }
  function getUser()  {
    try { return JSON.parse(localStorage.getItem(USER_KEY)); }
    catch { return null; }
  }
  function saveSession(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
  function isLoggedIn() { return !!getToken(); }

  async function request(method, path, body, requireAuth = false) {
    const headers = { 'Content-Type': 'application/json' };
    if (requireAuth || getToken()) {
      headers['Authorization'] = `Bearer ${getToken()}`;
    }
    try {
      const res = await fetch(API_BASE + path, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  // ── AUTH ─────────────────────────────────────────
  async function registerPatient(form) {
    const r = await request('POST', '/auth/register/patient', form);
    if (r.ok && r.data.token) saveSession(r.data.token, r.data.user);
    return r;
  }

  async function registerDoctor(form) {
    return await request('POST', '/auth/register/doctor', form);
  }

  async function login(email, password, role = 'patient') {
    const r = await request('POST', '/auth/login', { email, password, role });
    if (r.ok && r.data.token) saveSession(r.data.token, r.data.user);
    return r;
  }

  async function googleAuth(email, name, google_id, role, city) {
    const r = await request('POST', '/auth/google', { email, name, google_id, role, city });
    if (r.ok && r.data.token) saveSession(r.data.token, r.data.user);
    return r;
  }

  async function sendOTP(phone) {
    return await request('POST', '/auth/otp/send', { phone });
  }

  async function verifyOTP(phone, otp, role = 'patient') {
    const r = await request('POST', '/auth/otp/verify', { phone, otp, role });
    if (r.ok && r.data.token) saveSession(r.data.token, r.data.user);
    return r;
  }

  async function getMe() {
    return await request('GET', '/auth/me', null, true);
  }

  function logout() {
    clearSession();
    window.location.href = 'login.html';
  }

  // ── DOCTORS ──────────────────────────────────────
  async function getDoctors(params = {}) {
    const q = new URLSearchParams(params).toString();
    return await request('GET', `/doctors${q ? '?' + q : ''}`);
  }

  async function getDoctor(id) {
    return await request('GET', `/doctors/${id}`);
  }

  // ── APPOINTMENTS ─────────────────────────────────
  async function bookAppointment(data) {
    return await request('POST', '/appointments', data, true);
  }

  async function getMyAppointments() {
    return await request('GET', '/appointments/my', null, true);
  }

  async function updateAppointment(id, status) {
    return await request('PATCH', `/appointments/${id}`, { status }, true);
  }

  // ── PRESCRIPTIONS ────────────────────────────────
  async function issuePrescription(data) {
    return await request('POST', '/prescriptions', data, true);
  }

  async function getMyPrescriptions() {
    return await request('GET', '/prescriptions/my', null, true);
  }

  // ── REPORTS ──────────────────────────────────────
  async function uploadReport(data) {
    return await request('POST', '/reports/upload', data, true);
  }

  async function getMyReports() {
    return await request('GET', '/reports/my', null, true);
  }

  async function reviewReport(id, notes) {
    return await request('PATCH', `/reports/${id}/review`, { notes }, true);
  }

  // ── AI CHAT ──────────────────────────────────────
  async function aiChat(message, language = 'English', history = []) {
    return await request('POST', '/ai/chat', { message, language, history }, true);
  }

  // ── ADMIN ────────────────────────────────────────
  async function getAdminStats() {
    return await request('GET', '/admin/stats', null, true);
  }

  async function getPendingDoctors() {
    return await request('GET', '/admin/doctors/pending', null, true);
  }

  async function verifyDoctor(id, action) {
    return await request('PATCH', `/admin/doctors/${id}/verify`, { action }, true);
  }

  // ── FILE TO BASE64 ───────────────────────────────
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ── REDIRECT IF NOT LOGGED IN ────────────────────
  function requireLogin() {
    if (!isLoggedIn()) {
      window.location.href = 'login.html';
      return false;
    }
    return true;
  }


  // ── AI RESPONSE CACHE (saves repeated API calls) ──
  const _aiCache = new Map();
  function _cacheKey(msg, lang) { return (lang||'en') + '::' + msg.toLowerCase().trim().slice(0,120); }

  async function aiChatCached(message, language = 'English', history = []) {
    const key = _cacheKey(message, language);
    if (_aiCache.has(key)) {
      return { ok: true, data: { reply: _aiCache.get(key), cached: true } };
    }
    const r = await aiChat(message, language, history);
    if (r.ok && r.data && r.data.reply) {
      _aiCache.set(key, r.data.reply);
      if (_aiCache.size > 50) _aiCache.delete(_aiCache.keys().next().value);
    }
    return r;
  }

  return {
    // Config
    API_BASE,
    // Auth
    registerPatient, registerDoctor, login, googleAuth,
    sendOTP, verifyOTP, getMe, logout,
    getToken, getUser, isLoggedIn, requireLogin, saveSession,
    // Doctors
    getDoctors, getDoctor,
    // Appointments
    bookAppointment, getMyAppointments, updateAppointment,
    // Prescriptions
    issuePrescription, getMyPrescriptions,
    // Reports
    uploadReport, getMyReports, reviewReport,
    // AI
    aiChat, aiChatCached,
    // Admin
    getAdminStats, getPendingDoctors, verifyDoctor,
    // Utils
    fileToBase64
  };
})();
