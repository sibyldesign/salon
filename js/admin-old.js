// =========================================================================
// 📌 核心資料處理、安全防護與運算底座 (js/admin-data.js)
// =========================================================================

const SUPABASE_URL = "https://kwbxskvnfejfguuwzqfr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_JnpaLZVnGkW9Jr967LeYuQ_d8bXwfnz";
const API_URL = "https://script.google.com/macros/s/AKfycbxJlhG1eDEwuyjiJedTtvND-iwIzGXA3sfc_iN_Pq-15LIKWwlHGDX5tFRVdlOzfanONA/exec";
const IMGBB_API_KEY = "56cc9473cd6512942296b1fbeb5149de";

const urlParams = new URLSearchParams(window.location.search);
const CURRENT_ADMIN_TOKEN = urlParams.get('token') || null;
let CURRENT_STORE_ID = urlParams.get('store_id') || '2deb066f-98f2-4283-945b-6ae0d6a89acb';
const CURRENT_STAFF_PARAM = urlParams.get('staff') || null;

// 全域後台資料容器
let backendData = {
  settings: {},
  appointments: [],
  scheduleDates: [],
  services: [],
  portfolio: []
};
let promoImgsArray = new Array(7).fill("");
let customOffDatesArray = [];
let shiftSlotStates = {};
let allInventoryItems = [];
let isLowStockFilterActive = false;
let allWalletList = [];
let filteredWalletList = [];
let allPkgList = [];
let filteredPkgList = [];
let pendingSlotsList = [];
let currentCheckoutBookingObj = null;
let customInventoryCategories = ["洗護消耗品", "技術耗材", "零售外帶品", "毛孩零食玩具", "工具雜項"];

// 6 款品牌美學風格色票
const THEME_PALETTES = {
  latte:  { name: '大地燕麥暖棕', colors: ['#FDFBF7', '#EBE5DF', '#8C7355', '#3D3126'] },
  matcha: { name: '日系抹茶茶木', colors: ['#F7F8F5', '#E3E8DE', '#5C725E', '#2B382D'] },
  noir:   { name: '經典極簡黑白', colors: ['#FAFAFA', '#E5E5E5', '#262626', '#0A0A0A'] },
  navy:   { name: '奢華午夜黛藍', colors: ['#F4F6F9', '#D9E2EC', '#2B4C6F', '#102A43'] },
  rose:   { name: '法式暮粉煙燻', colors: ['#FCF8F8', '#EEDCDD', '#A26D74', '#4E2C32'] },
  mist:   { name: '晨曦朝露霧綠', colors: ['#F4F7F6', '#DAE4E1', '#4A7C6D', '#1F3B33'] }
};

const DEFAULT_MOHW_BEAUTY_CONTRACT = `衛生福利部112年6月8日衛授疾字第1120300459號函發布
【美容定型化契約書】

立契約書人：消費者 (甲方)、美容業者 (乙方)。
甲乙雙方同意就服務事項依約定辦理。服務總費用與施作項目以線上明細為憑，施作前已充分溝通。本契約經線上親筆數位簽署後即時存證。`;

const STAFF_MORANDI_PALETTE = [
  { dot: '#9E9E9E', bg: '#F5F5F5', text: '#616161', border: '#E0E0E0' },
  { dot: '#E57373', bg: '#FFEBEE', text: '#C62828', border: '#FFCDD2' },
  { dot: '#FFB74D', bg: '#FFF3E0', text: '#EF6C00', border: '#FFE0B2' },
  { dot: '#DCE775', bg: '#F9FBE7', text: '#827717', border: '#F0F4C3' },
  { dot: '#81C784', bg: '#E8F5E9', text: '#2E7D32', border: '#C8E6C9' },
  { dot: '#64B5F6', bg: '#E3F2FD', text: '#1565C0', border: '#BBDEFB' }
];

function getStaffColor(staffId, staffName = "") {
  if (!staffId || staffId === 'all' || staffId === '不指定') return STAFF_MORANDI_PALETTE[0];
  const list = (backendData.settings?.staffList || []).filter(s => s.id !== 'all');
  const idx = list.findIndex(s => s.id === staffId || s.name === staffName);
  if (idx !== -1) return STAFF_MORANDI_PALETTE[(idx + 1) % STAFF_MORANDI_PALETTE.length];
  return STAFF_MORANDI_PALETTE[1];
}

// RESTful 通訊底座
async function directSupabaseFetch(endpoint) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
      headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` }
    });
    return res.ok ? await res.json() : [];
  } catch(e) { return []; }
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
  return res.ok ? await res.json() : [];
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
  return res.ok ? await res.json() : [];
}

// 密碼安全防護
const LOCKOUT_KEY = `admin_lockout_${CURRENT_STORE_ID}`;
const ATTEMPTS_KEY = `admin_attempts_${CURRENT_STORE_ID}`;

function checkLockoutStatus() {
  const lockedUntil = localStorage.getItem(LOCKOUT_KEY);
  if (lockedUntil && Date.now() < Number(lockedUntil)) {
    const remainSec = Math.ceil((Number(lockedUntil) - Date.now()) / 1000);
    showLockoutUI(remainSec);
    return true;
  }
  return false;
}

function showLockoutUI(sec) {
  const countdownEl = document.getElementById('lockout-countdown');
  const timerSecEl = document.getElementById('timer-sec');
  const unlockBtn = document.getElementById('unlock-btn');
  const pinInput = document.getElementById('pin-input');

  if (countdownEl && timerSecEl) {
    countdownEl.classList.remove('hidden');
    timerSecEl.innerText = sec;
    if (unlockBtn) unlockBtn.disabled = true;
    if (pinInput) pinInput.disabled = true;

    const timer = setInterval(() => {
      sec--;
      timerSecEl.innerText = sec;
      if (sec <= 0) {
        clearInterval(timer);
        countdownEl.classList.add('hidden');
        if (unlockBtn) unlockBtn.disabled = false;
        if (pinInput) pinInput.disabled = false;
        localStorage.removeItem(LOCKOUT_KEY);
        localStorage.removeItem(ATTEMPTS_KEY);
      }
    }, 1000);
  }
}

async function checkPin() {
  if (checkLockoutStatus()) return;
  const pinInput = document.getElementById('pin-input');
  const errorEl = document.getElementById('lock-error');
  const inputPin = pinInput ? pinInput.value.trim() : '';
  if (!inputPin) return;

  try {
    let correctPin = '8888';
    const [stores, settings] = await Promise.all([
      directSupabaseFetch(`stores?id=eq.${CURRENT_STORE_ID}&select=admin_pin`),
      directSupabaseFetch(`store_settings?store_id=eq.${CURRENT_STORE_ID}&select=staff_list`)
    ]);

    if (stores && stores.length > 0 && stores[0].admin_pin) {
      correctPin = String(stores[0].admin_pin).trim();
    }

    if (CURRENT_STAFF_PARAM && CURRENT_STAFF_PARAM !== 'all') {
      const staffList = (settings && settings.length > 0) ? (settings[0].staff_list || []) : [];
      const matchedStaff = staffList.find(s => s.id === CURRENT_STAFF_PARAM);
      if (matchedStaff && matchedStaff.pin) correctPin = String(matchedStaff.pin).trim();
    }

    if (inputPin === correctPin) {
      localStorage.removeItem(ATTEMPTS_KEY);
      localStorage.removeItem(LOCKOUT_KEY);
      enterDashboard();
    } else {
      let attempts = Number(localStorage.getItem(ATTEMPTS_KEY) || 0) + 1;
      localStorage.setItem(ATTEMPTS_KEY, attempts);
      if (attempts >= 5) {
        localStorage.setItem(LOCKOUT_KEY, Date.now() + 15 * 60 * 1000);
        showLockoutUI(900);
      } else {
        errorEl.innerText = `密碼錯誤！還剩 ${5 - attempts} 次嘗試機會`;
        pinInput.value = '';
      }
    }
  } catch (e) {
    if (inputPin === '8888') enterDashboard();
    else errorEl.innerText = '系統連線異常，請稍後再試';
  }
}

function enterDashboard() {
  document.getElementById('lock-screen').style.display = 'none';
  document.getElementById('main-content').style.display = 'block';
  document.getElementById('bottom-nav').style.display = 'flex';

  if (CURRENT_STAFF_PARAM && CURRENT_STAFF_PARAM !== 'all') {
    document.querySelectorAll('.full-admin-only').forEach(el => el.style.display = 'none');
    activeShiftStaffId = CURRENT_STAFF_PARAM;
    const topTitle = document.getElementById('top-bar-title');
    if (topTitle) topTitle.innerText = `專員個人工作台 (${CURRENT_STAFF_PARAM})`;
  }

  fetchDataAndRender();
}

// 全域資料拉取
async function fetchDataAndRender() {
  try {
    let [stores, settings, services, portfolios, bookings] = await Promise.all([
      directSupabaseFetch(`stores?id=eq.${CURRENT_STORE_ID}&select=*`),
      directSupabaseFetch(`store_settings?store_id=eq.${CURRENT_STORE_ID}&select=*`),
      directSupabaseFetch(`services?store_id=eq.${CURRENT_STORE_ID}&order=sort_order.asc,created_at.asc&select=*`),
      directSupabaseFetch(`portfolios?store_id=eq.${CURRENT_STORE_ID}&order=sort_order.asc,created_at.desc&select=*`),
      directSupabaseFetch(`bookings?store_id=eq.${CURRENT_STORE_ID}&order=appointment_time.asc&select=*`)
    ]);

    const sCfg = (settings && settings.length > 0) ? settings[0] : {};
    const sInfo = (stores && stores.length > 0) ? stores[0] : {};

    const weeklyOffDays = Array.isArray(sCfg.weekly_off_days) ? sCfg.weekly_off_days : [];
    customOffDatesArray = Array.isArray(sCfg.custom_off_dates) ? sCfg.custom_off_dates : [];
    
    const availableDates = [];
    const today = new Date();
    for (let i = 0; i < 60; i++) {
      const target = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
      const dStr = `${target.getFullYear()}/${String(target.getMonth()+1).padStart(2,'0')}/${String(target.getDate()).padStart(2,'0')}`;
      if (!weeklyOffDays.includes(target.getDay()) && !customOffDatesArray.includes(dStr)) {
        availableDates.push(dStr);
      }
    }

    promoImgsArray = (sCfg.promo_imgs && Array.isArray(sCfg.promo_imgs)) ? sCfg.promo_imgs : new Array(7).fill("");
    while (promoImgsArray.length < 7) promoImgsArray.push("");

    backendData = {
      appointments: (bookings && bookings.length > 0) ? bookings.map(b => {
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
          lineName: b.line_name || '',
          service: b.service_names || '',
          price: Number(b.price) || 0,
          finalPrice: (b.final_price !== null && b.final_price !== undefined) ? Number(b.final_price) : Number(b.price),
          notes: b.notes || '',
          staffId: b.staff_id || 'all',
          staffName: b.staff_name || '不指定',
          status: b.status || '待確認',
          deposit_confirmed: b.deposit_confirmed === true,
          deposit_deducted: Number(b.deposit_deducted || 0),
          depositLast5: b.deposit_last5 || '',
          signature_url: b.signature_url || '',
          signed_at: b.signed_at || '',
          created_at: b.created_at || '',
          pet_type: b.pet_type || '小型犬',
          self_food: b.self_food !== false
        };
      }) : [],
      scheduleDates: availableDates.map(dStr => ({ date: dStr })),
      services: (services && services.length > 0) ? services.map(s => ({
        id: s.id,
        name: s.service_name || s.name,
        duration: s.duration_minutes || s.duration || 60,
        type: s.service_type || s.type || "Group_A",
        price: s.price || 0,
        isAddon: s.is_addon === true || s.isAddon === true,
        sortOrder: s.sort_order || 0,
        materials: Array.isArray(s.materials) ? s.materials : (s.material_name && s.material_name !== 'none' ? [{ name: s.material_name, dosage: s.material_dosage || '50ml' }] : [])
      })) : [],
      portfolio: (portfolios && portfolios.length > 0) ? portfolios.map(p => ({
        id: p.id,
        cat: p.category || p.cat || '作品精選',
        title: p.title || '',
        link: p.link || '',
        img: p.img_url || p.img,
        sortOrder: p.sort_order || 0
      })) : [],
      settings: {
        storeName: sCfg.display_title || sInfo.store_name || "專業沙龍與寵物旗艦館",
        subtitle: sCfg.display_subtitle || "",
        logoUrl: sCfg.logo_url || "",
        enableLogo: sCfg.enable_logo ?? true,
        storePhone: sCfg.store_phone || "",
        address: sCfg.address || "",
        businessHours: sCfg.business_hours || "09:00 - 19:00",
        bookingBufferHours: Number(sCfg.booking_buffer_hours ?? 1),
        careText: sCfg.care_text || "服務完成後請保持乾爽通風與定期保養。",
        depositInfo: sCfg.deposit_info || "",
        depositMode: sCfg.deposit_mode || "all",
        depositAmount: Number(sCfg.deposit_amount || 0),
        promoText: sCfg.promo_text || "",
        promoRulesText: sCfg.promo_rules_text || '',
        contractTitle: sCfg.contract_title || '美容定型化契約書',
        contractContent: sCfg.contract_content || DEFAULT_MOHW_BEAUTY_CONTRACT,
        staffList: (sCfg.staff_list && sCfg.staff_list.length > 0) ? sCfg.staff_list : [{ id: "all", name: "不指定", pin: "8888" }],
        walletRules: sCfg.wallet_rules || [{ name: "儲值 $3,000", price: 3000, bonus: 300, discount: 0.9 }],
        packageRules: sCfg.package_rules || [{ name: "剪髮買5送1暢遊卡", service_name: "剪髮造型設計 (含洗吹)", times: 6, price: 4000, deduct_points: 1 }],
        themeColor: sCfg.theme_color || sInfo.theme_color || 'latte',
        industryMode: sCfg.industry_mode || sInfo.industry_type || "pet_hotel",
        totalHotelRooms: Number(sCfg.total_hotel_rooms || 8),
        hotelCheckinStart: sCfg.hotel_checkin_start || "10:00",
        hotelCheckoutEnd: sCfg.hotel_checkout_end || "19:00",
        mealTimeBreakfast: sCfg.meal_time_breakfast || "09:00",
        mealTimeLunch: sCfg.meal_time_lunch || "12:30",
        mealTimeDinner: sCfg.meal_time_dinner || "18:00",
        line: sCfg.line_url || "",
        ig: sCfg.ig_url || "",
        map: sCfg.map_url || "",
        lineChannelToken: sCfg.line_channel_token || "",
        shiftStartTime: sCfg.shift_start_time || "09:00",
        shiftEndTime: sCfg.shift_end_time || "19:00",
        shiftInterval: Number(sCfg.shift_interval || 30),
        commissionRate: Number(sCfg.commission_rate || 50),
        designatedBonus: Number(sCfg.designated_bonus || 50),
        publishedSlots: sCfg.published_slots || [],
        enableAuditBooking: sCfg.enable_audit_booking ?? true,
        enableDeposit: sCfg.enable_deposit ?? true,
        enableStaffSelect: sCfg.enable_staff_select ?? true,
        enableMultiStaffSchedule: sCfg.enable_multi_staff_schedule ?? true,
        enableCustType: sCfg.enable_cust_type ?? true,
        enableShowPrice: sCfg.enable_show_price ?? true,
        enableCustNotes: sCfg.enable_cust_notes ?? true,
        enableWallet: sCfg.enable_wallet ?? true,
        enablePackages: sCfg.enable_packages ?? true,
        enableCoupons: sCfg.enable_coupons ?? true,
        enableReviews: sCfg.enable_reviews ?? true,
        enablePortfolio: sCfg.enable_portfolio ?? true,
        enableCare: sCfg.enable_care ?? true,
        enableQuickContact: sCfg.enable_quick_contact ?? true,
        enableCancelReason: sCfg.enable_cancel_reason ?? true,
        enableEmailCopy: sCfg.enable_email_copy ?? true,
        enableCarousel: sCfg.enable_carousel ?? true,
        enableFeaturedShop: sCfg.enable_featured_shop === true,
        enableLineOneClickAudit: sCfg.enable_line_one_click_audit ?? true,
        enableCommissionCalc: sCfg.enable_commission_calc ?? true,
        enableContract: sCfg.enable_contract ?? true,
        enableOwnerLinePush: sCfg.enable_owner_line_push ?? true,
        enableLineAutoNotify: sCfg.enable_line_auto_notify ?? false,
        enableFlexMenu: sCfg.enable_flex_menu ?? true
      }
    };

    if (typeof handleIndustryModeChange === 'function') handleIndustryModeChange(backendData.settings.industryMode);
    if (typeof renderCalendar === 'function') renderCalendar();
    if (typeof renderCustomer === 'function') renderCustomer();
    if (typeof renderShift === 'function') renderShift();
    if (typeof renderRevenueSelect === 'function') renderRevenueSelect();
    if (typeof renderRevenue === 'function') renderRevenue();
    if (typeof renderCare === 'function') renderCare();
    if (typeof renderBOMCheckboxes === 'function') renderBOMCheckboxes();
    if (typeof renderServiceList === 'function') renderServiceList();
    if (typeof renderPortfolioList === 'function') renderPortfolioList();
    if (typeof populateSettings === 'function') populateSettings();
    if (typeof loadMarketingCenter === 'function') loadMarketingCenter();
    if (typeof loadAdminReviews === 'function') loadAdminReviews();
    if (typeof renderUploadSlots === 'function') renderUploadSlots();
    if (typeof renderInventoryList === 'function') renderInventoryList();
    if (typeof renderBoardingRoomStatus === 'function') renderBoardingRoomStatus();
    if (typeof renderBoardingCareChecklist === 'function') renderBoardingCareChecklist();
    if (typeof initSlotsLiveUrl === 'function') initSlotsLiveUrl();
  } catch (err) {
    console.error("fetchDataAndRender 錯誤:", err);
  }
}

// 儲存全域設定
async function saveStoreSettings() {
  Swal.fire({ title: '正在儲存設定...', allowOutsideClick: false });
  Swal.showLoading();

  const checkedWeekly = Array.from(document.querySelectorAll('#weekly-off-grid input:checked')).map(el => Number(el.value));
  const rawImgsText = document.getElementById('cfg-promo-imgs-text')?.value.trim() || '';
  const textImgsArray = rawImgsText.split('\n').map(u => u.trim()).filter(Boolean);
  const finalPromoImgs = textImgsArray.length > 0 ? textImgsArray : promoImgsArray.filter(Boolean);
  const selectedMode = document.querySelector('input[name="cfg-industry-mode"]:checked')?.value || 'pet_hotel';
  const selectedTheme = document.getElementById('cfg-theme-color')?.value || 'latte';

  const payload = {
    store_id: CURRENT_STORE_ID,
    display_title: document.getElementById('cfg-title')?.value.trim() || backendData.settings.storeName,
    display_subtitle: document.getElementById('cfg-subtitle')?.value.trim() || '',
    logo_url: document.getElementById('cfg-logo')?.value.trim() || '',
    enable_logo: Boolean(document.getElementById('cfg-toggle-logo')?.checked),
    store_phone: document.getElementById('cfg-phone')?.value.trim() || '',
    address: document.getElementById('cfg-address')?.value.trim() || '',
    business_hours: document.getElementById('cfg-hours')?.value.trim() || '09:00 - 19:00',
    booking_buffer_hours: Number(document.getElementById('cfg-buffer')?.value || 1),
    care_text: document.getElementById('cfg-care')?.value.trim() || '',
    deposit_mode: document.getElementById('cfg-deposit-mode')?.value || 'all',
    deposit_amount: Number(document.getElementById('cfg-deposit-amount')?.value || 0),
    deposit_info: document.getElementById('cfg-deposit-info')?.value.trim() || '',
    promo_text: document.getElementById('cfg-promo')?.value.trim() || '',
    promo_imgs: finalPromoImgs,
    line_url: document.getElementById('cfg-line')?.value.trim() || '',
    ig_url: document.getElementById('cfg-ig')?.value.trim() || '',
    map_url: document.getElementById('cfg-map')?.value.trim() || '',
    line_channel_token: document.getElementById('cfg-line-token')?.value.trim() || '',
    contract_title: document.getElementById('cfg-contract-title')?.value.trim() || '美容定型化契約書',
    contract_content: document.getElementById('cfg-contract-content')?.value.trim() || '',
    promo_rules_text: document.getElementById('cfg-promo-rules-input')?.value.trim() || '',
    
    theme_color: selectedTheme,
    industry_mode: selectedMode,
    total_hotel_rooms: Number(document.getElementById('cfg-hotel-total-rooms')?.value || 8),
    hotel_checkin_start: document.getElementById('cfg-hotel-checkin-start')?.value || '10:00',
    hotel_checkout_end: document.getElementById('cfg-hotel-checkout-end')?.value || '19:00',
    meal_time_breakfast: document.getElementById('cfg-meal-time-breakfast')?.value || '09:00',
    meal_time_lunch: document.getElementById('cfg-meal-time-lunch')?.value || '12:30',
    meal_time_dinner: document.getElementById('cfg-meal-time-dinner')?.value || '18:00',

    weekly_off_days: checkedWeekly,
    custom_off_dates: customOffDatesArray,
    shift_start_time: document.getElementById('cfg-shift-start')?.value || "09:00",
    shift_end_time: document.getElementById('cfg-shift-end')?.value || "19:00",
    shift_interval: Number(document.getElementById('cfg-shift-interval')?.value || 30),
    commission_rate: Number(document.getElementById('cfg-commission-rate')?.value || 50),
    designated_bonus: Number(document.getElementById('cfg-designated-bonus')?.value || 50),

    enable_audit_booking: Boolean(document.getElementById('cfg-toggle-audit-booking')?.checked),
    enable_deposit: Boolean(document.getElementById('cfg-toggle-deposit')?.checked),
    enable_staff_select: Boolean(document.getElementById('cfg-toggle-staff-select')?.checked),
    enable_multi_staff_schedule: Boolean(document.getElementById('cfg-toggle-multi-staff-schedule')?.checked),
    enable_cust_type: Boolean(document.getElementById('cfg-toggle-custtype')?.checked),
    enable_show_price: Boolean(document.getElementById('cfg-toggle-show-price')?.checked),
    enable_cust_notes: Boolean(document.getElementById('cfg-toggle-cust-notes')?.checked),
    enable_wallet: Boolean(document.getElementById('cfg-toggle-wallet')?.checked),
    enable_packages: Boolean(document.getElementById('cfg-toggle-packages')?.checked),
    enable_coupons: Boolean(document.getElementById('cfg-toggle-coupons')?.checked),
    enable_reviews: Boolean(document.getElementById('cfg-toggle-reviews')?.checked),
    enable_portfolio: Boolean(document.getElementById('cfg-toggle-portfolio')?.checked),
    enable_care: Boolean(document.getElementById('cfg-toggle-care')?.checked),
    enable_quick_contact: Boolean(document.getElementById('cfg-toggle-quick-contact')?.checked),
    enable_cancel_reason: Boolean(document.getElementById('cfg-toggle-cancel-reason')?.checked),
    enable_email_copy: Boolean(document.getElementById('cfg-toggle-email')?.checked),
    enable_carousel: Boolean(document.getElementById('cfg-toggle-carousel')?.checked),
    enable_featured_shop: Boolean(document.getElementById('cfg-toggle-featured-shop')?.checked),
    enable_line_one_click_audit: Boolean(document.getElementById('cfg-toggle-line-one-click')?.checked),
    enable_commission_calc: Boolean(document.getElementById('cfg-toggle-commission-calc')?.checked),
    enable_contract: Boolean(document.getElementById('cfg-toggle-contract')?.checked),
    enable_owner_line_push: Boolean(document.getElementById('cfg-toggle-owner-line-push')?.checked),
    enable_line_auto_notify: Boolean(document.getElementById('cfg-toggle-line-auto-notify')?.checked),
    enable_flex_menu: Boolean(document.getElementById('cfg-toggle-flex-menu')?.checked)
  };

  try {
    await directSupabasePatch('stores', `id=eq.${CURRENT_STORE_ID}`, {
      store_name: payload.display_title,
      industry_type: selectedMode,
      theme_color: selectedTheme
    });
    await directSupabaseUpsert('store_settings', payload, 'store_id');
    
    backendData.settings = Object.assign({}, backendData.settings, payload);
    handleIndustryModeChange(selectedMode);
    Swal.fire({ title: '全域設定與風格色系已成功同步！', icon: 'success', timer: 1200, showConfirmButton: false });
  } catch (e) {
    Swal.fire('儲存失敗', e.message, 'error');
  }
}

// 完工結單自動扣庫
async function submitFinalCheckoutAction() {
  const finalPrice = Number(document.getElementById('chk-modal-final-price').value || 0);
  await directSupabasePatch('bookings', `id=eq.${currentCheckoutBookingObj.id}`, { status: '已結單', final_price: finalPrice });

  const svcObj = (backendData.services || []).find(s => (currentCheckoutBookingObj.service || '').includes(s.name));
  if (svcObj && Array.isArray(svcObj.materials) && svcObj.materials.length > 0) {
    svcObj.materials.forEach(m => {
      const invItem = allInventoryItems.find(it => it.name === m.name);
      if (invItem) {
        invItem.current_stock = Math.max(0, invItem.current_stock - 1);
        directSupabasePatch('store_inventory', `id=eq.${invItem.id}`, { current_stock: invItem.current_stock }).catch(()=>{});
      }
    });
  }

  closeCheckoutModal();
  Swal.fire('完工結單成功！', `實收 NT$ ${finalPrice}，BOM 耗材已自動扣除`, 'success');
  fetchDataAndRender();
}

function handleAdminLogout() {
  sessionStorage.clear();
  location.reload();
}

function handleAdminManualRefresh(btn) {
  const icon = btn.querySelector('i');
  if (icon) icon.classList.add('animate-spin');
  fetchDataAndRender().then(() => {
    setTimeout(() => { if (icon) icon.classList.remove('animate-spin'); }, 600);
  });
}
