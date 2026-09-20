// =========================================================================
// 📌 核心全域常數與環境狀態設定模組(核心連線與安全驗證底座) (admin-core.js)
// =========================================================================

const SUPABASE_URL = "https://kwbxskvnfejfguuwzqfr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_JnpaLZVnGkW9Jr967LeYuQ_d8bXwfnz";
const API_URL = "https://script.google.com/macros/s/AKfycbxJlhG1eDEwuyjiJedTtvND-iwIzGXA3sfc_iN_Pq-15LIKWwlHGDX5tFRVdlOzfanONA/exec";
const IMGBB_API_KEY = "56cc9473cd6512942296b1fbeb5149de";

const urlParams = new URLSearchParams(window.location.search);
const CURRENT_ADMIN_TOKEN = urlParams.get('token') || null;
let CURRENT_STORE_ID = urlParams.get('store_id') || '2deb066f-98f2-4283-945b-6ae0d6a89acb';
const CURRENT_STAFF_PARAM = urlParams.get('staff') || null;

// 全域後台資料緩存容器
let backendData = {
  settings: {},
  appointments: [],
  revenueAppointments: [],
  scheduleDates: [],
  services: [],
  portfolio: []
};

// 專員低飽和莫蘭迪色盤
const STAFF_MORANDI_PALETTE = [
  { dot: '#9E9E9E', bg: '#F5F5F5', text: '#616161', border: '#E0E0E0' }, // 0: 不指定 (淺灰)
  { dot: '#E57373', bg: '#FFEBEE', text: '#C62828', border: '#FFCDD2' }, // 1: 柔紅
  { dot: '#FFB74D', bg: '#FFF3E0', text: '#EF6C00', border: '#FFE0B2' }, // 2: 柔橙
  { dot: '#DCE775', bg: '#F9FBE7', text: '#827717', border: '#F0F4C3' }, // 3: 柔黃綠
  { dot: '#81C784', bg: '#E8F5E9', text: '#2E7D32', border: '#C8E6C9' }, // 4: 柔綠
  { dot: '#64B5F6', bg: '#E3F2FD', text: '#1565C0', border: '#BBDEFB' }, // 5: 柔藍
  { dot: '#BA68C8', bg: '#F3E5F5', text: '#6A1B9A', border: '#E1BEE7' }  // 6: 柔紫
];

function getStaffColor(staffId, staffName = "") {
  if (!staffId || staffId === 'all' || staffId === '不指定') {
    return STAFF_MORANDI_PALETTE[0];
  }
  const staffList = (backendData.settings && backendData.settings.staffList) || [];
  const validStaffs = staffList.filter(s => s.id !== 'all');
  const index = validStaffs.findIndex(s => s.id === staffId || s.name === staffName);

  if (index !== -1) {
    return STAFF_MORANDI_PALETTE[(index + 1) % STAFF_MORANDI_PALETTE.length];
  }
  let hash = 0;
  const str = String(staffId || staffName);
  for (let i = 0; i < str.length; i++) hash += str.charCodeAt(i);
  return STAFF_MORANDI_PALETTE[hash % STAFF_MORANDI_PALETTE.length];
}

// =========================================================================
// 📌 Supabase RESTful 直連封裝 (高速通道，不繞路 GAS)
// =========================================================================

async function directSupabaseFetch(endpoint) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
    headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` }
  });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

async function directSupabaseUpsert(table, payload, conflictKey = 'id') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=${conflictKey}`, {
    method: "POST",
    headers: {
      "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates,return=representation"
    },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

async function directSupabasePatch(table, queryFilter, payload) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${queryFilter}`, {
    method: "PATCH",
    headers: {
      "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json", "Prefer": "return=representation"
    },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

// =========================================================================
// 📌 安全防護與防暴力破解 (15 分鐘冷卻機制)
// =========================================================================

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const ATTEMPTS_KEY = `sibyl_attempts_${CURRENT_STORE_ID}`;
const LOCKOUT_KEY = `sibyl_lockout_${CURRENT_STORE_ID}`;

function checkLockoutStatus() {
  const lockoutUntil = localStorage.getItem(LOCKOUT_KEY);
  if (lockoutUntil) {
    const remainingMs = Number(lockoutUntil) - Date.now();
    if (remainingMs > 0) {
      triggerLockoutUI(Math.ceil(remainingMs / 1000));
      return true;
    } else {
      localStorage.removeItem(LOCKOUT_KEY);
      localStorage.removeItem(ATTEMPTS_KEY);
    }
  }
  return false;
}

function triggerLockoutUI(secondsRemaining) {
  const input = document.getElementById('pin-input');
  const btn = document.getElementById('unlock-btn');
  const box = document.getElementById('lockout-countdown');
  const timerSec = document.getElementById('timer-sec');
  if (!input || !btn || !box) return;
  input.disabled = true;
  btn.disabled = true;
  btn.classList.add('opacity-50', 'pointer-events-none');
  box.classList.remove('hidden');
  timerSec.innerText = secondsRemaining;
  const interval = setInterval(() => {
    secondsRemaining--;
    if (secondsRemaining <= 0) {
      clearInterval(interval);
      input.disabled = false;
      btn.disabled = false;
      btn.classList.remove('opacity-50', 'pointer-events-none');
      box.classList.add('hidden');
      localStorage.removeItem(LOCKOUT_KEY);
      localStorage.removeItem(ATTEMPTS_KEY);
    } else {
      timerSec.innerText = secondsRemaining;
    }
  }, 1000);
}

async function checkPin() {
  if (checkLockoutStatus()) return;
  const input = document.getElementById('pin-input').value.trim();
  if (!input) return;

  try {
    if (CURRENT_ADMIN_TOKEN) {
      const tokenRes = await directSupabaseFetch(`stores?admin_token=eq.${CURRENT_ADMIN_TOKEN}&select=id,admin_pin,plan_status,store_name`);
      if (tokenRes && tokenRes.length > 0) {
        CURRENT_STORE_ID = tokenRes[0].id;
      } else {
        document.getElementById('lock-error').innerText = '無效或未授權的後台管理金鑰 (Token)';
        return;
      }
    }
  } catch(e){}

  try {
    const storeStatus = await directSupabaseFetch(`stores?id=eq.${CURRENT_STORE_ID}&select=plan_status,store_name`);
    if (storeStatus && storeStatus.length > 0) {
      const pStatus = storeStatus[0].plan_status;
      if (pStatus === 'locked' || pStatus === 'expired') {
        document.getElementById('admin-lock-title').innerText = pStatus === 'locked' ? '後台授權已暫時鎖定' : '系統授權已過期';
        document.getElementById('admin-maintenance-desc').innerText = `【${storeStatus[0].store_name}】目前已被總管系統鎖定停權，暫停所有管理操作。`;
        document.getElementById('admin-maintenance-screen').classList.remove('hidden');
        document.getElementById('lock-screen').style.display = 'none';
        return;
      }
    }
  } catch(e){}

  try {
    let correctPin = '8888';
    const [stores, settings] = await Promise.all([
      directSupabaseFetch(`stores?id=eq.${CURRENT_STORE_ID}&select=admin_pin`),
      directSupabaseFetch(`store_settings?store_id=eq.${CURRENT_STORE_ID}&select=staff_list`)
    ]);

    if (stores && stores.length > 0 && stores[0].admin_pin) {
      correctPin = stores[0].admin_pin;
    }
    if (CURRENT_STAFF_PARAM && CURRENT_STAFF_PARAM !== 'all') {
      const staffList = (settings && settings.length > 0) ? (settings[0].staff_list || []) : [];
      const staff = staffList.find(s => s.id === CURRENT_STAFF_PARAM);
      if (staff && staff.pin) correctPin = staff.pin;
    }

    if (input === String(correctPin).trim()) {
      localStorage.removeItem(ATTEMPTS_KEY);
      localStorage.removeItem(LOCKOUT_KEY);
      sessionStorage.setItem('admin_session_unlocked', 'true');
      enterDashboard();
    } else {
      let attempts = Number(localStorage.getItem(ATTEMPTS_KEY) || 0) + 1;
      localStorage.setItem(ATTEMPTS_KEY, attempts);
      if (attempts >= MAX_ATTEMPTS) {
        const lockoutUntil = Date.now() + LOCKOUT_MINUTES * 60 * 1000;
        localStorage.setItem(LOCKOUT_KEY, lockoutUntil);
        document.getElementById('lock-error').innerText = '';
        triggerLockoutUI(LOCKOUT_MINUTES * 60);
      } else {
        const left = MAX_ATTEMPTS - attempts;
        document.getElementById('lock-error').innerText = `密碼錯誤！剩餘 ${left} 次嘗試機會`;
        document.getElementById('pin-input').value = '';
      }
    }
  } catch (e) {
    if (input === '8888') {
      sessionStorage.setItem('admin_session_unlocked', 'true');
      enterDashboard();
    } else {
      document.getElementById('lock-error').innerText = '連線異常，請稍後重試';
    }
  }
}

function enterDashboard() {
  document.getElementById('lock-screen').style.display = 'none';
  document.getElementById('main-content').style.display = 'block';
  document.getElementById('bottom-nav').style.display = 'flex';

  fetchDataAndRender();
  fetchSystemAnnouncement();
  setInterval(fetchSystemAnnouncement, 15000);
}

// ==========================================
// 📌 核心全域載入與透明架構看板渲染
// ==========================================

async function fetchDataAndRender() {
  try {
    const [stores, settings, services, bookings] = await Promise.all([
      directSupabaseFetch(`stores?id=eq.${CURRENT_STORE_ID}&select=*`),
      directSupabaseFetch(`store_settings?store_id=eq.${CURRENT_STORE_ID}&select=*`),
      directSupabaseFetch(`services?store_id=eq.${CURRENT_STORE_ID}&order=sort_order.asc,created_at.asc&select=*`),
      directSupabaseFetch(`bookings?store_id=eq.${CURRENT_STORE_ID}&order=appointment_time.asc&select=*`)
    ]);

    const sInfo = (stores && stores.length > 0) ? stores[0] : { store_name: "沙龍管理系統" };
    const sCfg = (settings && settings.length > 0) ? settings[0] : {};

    backendData.settings = Object.assign({}, sCfg, {
      storeName: sCfg.display_title || sInfo.store_name,
      industryType: sInfo.industry_type || 'beauty'
    });

    backendData.appointments = (bookings || []).map(b => {
      const d = new Date(b.appointment_time);
      const timeStr = (d.getHours()<10?'0'+d.getHours():d.getHours()) + ':' + (d.getMinutes()<10?'0'+d.getMinutes():d.getMinutes());
      return {
        id: b.id,
        date: `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`,
        time: timeStr,
        name: b.customer_name,
        phone: b.customer_phone,
        customer_type: b.customer_type || 'old',
        customer_notes: b.customer_notes || '',
        cancel_reason: b.cancel_reason || '',
        lineName: b.line_name || '',
        service: b.service_names || '',
        price: Number(b.price || 0),
        finalPrice: Number(b.final_price !== null && b.final_price !== undefined ? b.final_price : b.price),
        notes: b.notes || '',
        staffId: b.staff_id || 'all',
        staffName: b.staff_name || '不指定',
        status: b.status || '待確認',
        signature_url: b.signature_url || '',
        created_at: b.created_at || ''
      };
    });

    backendData.revenueAppointments = backendData.appointments;
    backendData.services = services || [];

    document.getElementById('top-bar-title').innerText = `${backendData.settings.storeName} 管理後台`;

    // 核心看板與外掛功能顯隱同步
    updateArchitectureStatus();

    // 呼叫各模組渲染函式 (若對應腳本已載入)
    if (typeof renderCalendar === 'function') renderCalendar();
    if (typeof renderCustomer === 'function') renderCustomer();
    if (typeof renderShift === 'function') renderShift();
    if (typeof renderRevenueSelect === 'function') renderRevenueSelect();
    if (typeof renderRevenue === 'function') renderRevenue();
    if (typeof renderCare === 'function') renderCare();
    if (typeof renderServiceList === 'function') renderServiceList();
    if (typeof renderQuickAddServices === 'function') renderQuickAddServices();
    if (typeof populateSettings === 'function') populateSettings();

    // 外掛模組載入觸發
    if (backendData.settings.module_pet_profile && typeof initPetModule === 'function') {
      initPetModule();
    }
    if (backendData.settings.module_inventory && typeof initInventoryModule === 'function') {
      initInventoryModule();
    }
  } catch (err) {
    console.error("fetchDataAndRender 錯誤:", err);
  }
}

// ✨ 更新頂部透明化系統架構與外掛狀態看板
function updateArchitectureStatus() {
  const s = backendData.settings || {};
  const isPetEnabled = Boolean(s.module_pet_profile || s.module_pet_boarding);
  const isInvEnabled = Boolean(s.module_inventory || s.module_service_materials);

  const modeBadge = document.getElementById('arch-mode-badge');
  if (modeBadge) {
    modeBadge.innerText = isPetEnabled ? "通用寵物模式" : "通用美業模式";
    modeBadge.className = isPetEnabled 
      ? "px-2 py-0.5 bg-amber-100 text-amber-900 rounded-lg font-mono font-bold"
      : "px-2 py-0.5 bg-brand-100 text-brand-800 rounded-lg font-mono font-bold";
  }

  const modPet = document.getElementById('mod-pet');
  const navPet = document.getElementById('nav-btn-pet');
  if (modPet) {
    modPet.className = isPetEnabled ? "text-amber-600 font-bold" : "text-gray-300";
    modPet.innerText = isPetEnabled ? "🐾 Pet (On)" : "⚪ Pet (Off)";
  }
  if (navPet) {
    navPet.classList.toggle('hidden', !isPetEnabled);
  }

  const modInv = document.getElementById('mod-inv');
  const navInv = document.getElementById('nav-btn-inv');
  if (modInv) {
    modInv.className = isInvEnabled ? "text-blue-600 font-bold" : "text-gray-300";
    modInv.innerText = isInvEnabled ? "📦 Inv (On)" : "⚪ Inv (Off)";
  }
  if (navInv) {
    navInv.classList.toggle('hidden', !isInvEnabled);
  }
}

function switchPage(pageId, el) {
  document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.remove('bg-brand-50', 'text-brand-500', 'font-bold');
    n.classList.add('text-brand-400', 'font-medium');
  });

  const target = document.getElementById('page-' + pageId);
  if (target) target.style.display = 'block';
  if (el) {
    el.classList.remove('text-brand-400', 'font-medium');
    el.classList.add('bg-brand-50', 'text-brand-500', 'font-bold');
  }

  if (pageId === 'calendar' && typeof renderCalendar === 'function') renderCalendar();
  if (pageId === 'customer' && typeof renderCustomer === 'function') renderCustomer();
  if (pageId === 'shift' && typeof renderShift === 'function') renderShift();
  if (pageId === 'marketing' && typeof loadMarketingCenter === 'function') loadMarketingCenter();
  if (pageId === 'revenue' && typeof renderRevenue === 'function') renderRevenue();
  if (pageId === 'settings' && typeof populateSettings === 'function') populateSettings();
  if (pageId === 'pet' && typeof renderPetPage === 'function') renderPetPage();
  if (pageId === 'inventory' && typeof renderInventoryPage === 'function') renderInventoryPage();
}

async function fetchSystemAnnouncement() {
  try {
    const data = await directSupabaseFetch(`system_announcements?is_active=eq.true&order=created_at.desc&limit=1`);
    const banner = document.getElementById('system-announcement-banner');
    const content = document.getElementById('announcement-content');
    if (data && data.length > 0 && data[0].content) {
      content.innerText = data[0].content;
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }
  } catch(e){}
}

function handleAdminLogout() {
  Swal.fire({
    title: '確定登出後台？',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: '確定登出',
    confirmButtonColor: '#8C7355'
  }).then(r => {
    if (r.isConfirmed) {
      sessionStorage.clear();
      location.reload();
    }
  });
}

function handleAdminManualRefresh(btn) {
  const icon = btn.querySelector('i');
  if (icon) icon.classList.add('animate-spin');
  fetchDataAndRender().then(() => {
    setTimeout(() => { if (icon) icon.classList.remove('animate-spin'); }, 600);
  });
}

window.addEventListener('DOMContentLoaded', () => {
  sessionStorage.removeItem('admin_session_unlocked');
  checkLockoutStatus();
  const pinInput = document.getElementById('pin-input');
  if (pinInput) {
    pinInput.focus();
    pinInput.onkeydown = (e) => { if (e.key === 'Enter') checkPin(); };
  }
});
