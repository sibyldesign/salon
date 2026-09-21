// =========================================================================
// 📌 畫面渲染、日曆排班、名單與業績結構化明細 (js/admin-ui.js) - [完整無缺失版]
// =========================================================================

let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth();
let selectedCalendarDate = '';
let currentShiftDate = 'ALL';
let activeShiftStaffId = 'all';
let staffPinVisibilityMap = {};

const DEFAULT_CARE_RULES = [
  { name: "燙染造型, 染髮, 漂髮, 挑染, 質感染髮", weeks: 12, msg: "嗨 {姓名}～距離上次做『{項目}』已經滿12週囉！髮色與光澤維持得還好嗎？隨時歡迎預約回娘家補染護理唷❤️" },
  { name: "洗剪設計, 剪髮, 造型設計, 洗剪", weeks: 4, msg: "嗨 {姓名}～距離上次剪髮已經滿4週囉！長度與厚度是否需要修剪整理了呢？歡迎預約唷" },
  { name: "深層護理, 頭皮SPA, 結構護理, 護髮", weeks: 4, msg: "嗨 {姓名}～定期深層護理能維持光澤質感，歡迎預約回娘家享受放鬆洗護時光" },
  { name: "寵物美容, 大美容, 小美容, 藥浴", weeks: 3, msg: "嗨 {姓名}～毛孩上次做『{項目}』已經滿3週囉！長度差不多該修剪維護囉，歡迎預約沐浴" }
];

// 1. 路由切換器 (支援 14 個核心分頁)
function switchPage(pageId, el) {
  document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
  document.querySelectorAll('.nav-item').forEach(n => {
    n.className = "nav-item flex flex-col items-center justify-center shrink-0 w-14 py-2 rounded-2xl transition text-brand-400 font-medium";
  });
  const target = document.getElementById('page-' + pageId);
  if (target) target.style.display = 'block';
  if (el) el.className = "nav-item flex flex-col items-center justify-center shrink-0 w-14 py-2 rounded-2xl transition bg-brand-50 text-brand-500 font-bold";

  if (pageId === 'calendar') renderCalendar();
  if (pageId === 'shift') renderShift();
  if (pageId === 'boarding-schedule') { renderBoardingRoomStatus(); renderBoardingCareChecklist(); }
  if (pageId === 'customer') renderCustomer();
  if (pageId === 'inventory') renderInventoryList();
  if (pageId === 'revenue') { renderRevenueSelect(); renderRevenue(); }
  if (pageId === 'care') { renderCare(); populateCareRulesUI(); }
  if (pageId === 'services') { renderBOMCheckboxes(); renderServiceList(); renderPortfolioList(); }
  if (pageId === 'add') renderQuickAddServices();
  if (pageId === 'marketing') loadMarketingCenter();
  if (pageId === 'reviews') { loadAdminReviews(); renderReviewTagsManager(); }
  if (pageId === 'slots') handleSlotRangeChange();
  if (pageId === 'subscription') renderSubscriptionUI();
  if (pageId === 'settings') populateSettings();
}

function handleIndustryModeChange(mode) {
  const navBoarding = document.getElementById('nav-btn-boarding');
  const hotelSettings = document.getElementById('section-pet-hotel-settings');
  if (mode === 'pet_hotel') {
    if (navBoarding) navBoarding.style.display = 'flex';
    if (hotelSettings) hotelSettings.style.display = 'block';
  } else {
    if (navBoarding) navBoarding.style.display = 'none';
    if (hotelSettings) hotelSettings.style.display = 'none';
  }
}

// 2. 日曆月曆渲染
function renderCalendar() {
  const grid = document.getElementById('cal-grid');
  const title = document.getElementById('cal-month-title');
  if (!grid || !title) return;

  title.innerText = `${calYear} 年 ${calMonth + 1} 月`;
  const headers = ['日', '一', '二', '三', '四', '五', '六'];
  let html = headers.map(h => `<div class="py-1 font-bold text-brand-400 text-[11px]">${h}</div>`).join('');
  
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  for (let i = 0; i < firstDay; i++) html += `<div class="py-2.5"></div>`;

  for (let i = 1; i <= daysInMonth; i++) {
    const dStr = `${calYear}/${String(calMonth + 1).padStart(2, '0')}/${String(i).padStart(2, '0')}`;
    let apptsToday = (backendData.appointments || []).filter(a => a.date === dStr && a.status !== '已取消' && a.status !== '婉拒');
    if (CURRENT_STAFF_PARAM && CURRENT_STAFF_PARAM !== 'all') {
      apptsToday = apptsToday.filter(a => a.staffId === CURRENT_STAFF_PARAM);
    }
    const isSelected = (selectedCalendarDate === dStr);

    let dotsHtml = apptsToday.slice(0, 4).map(a => {
      const color = getStaffColor(a.staffId, a.staffName);
      return `<span class="w-1.5 h-1.5 rounded-full inline-block shadow-xs" style="background-color: ${color.dot};"></span>`;
    }).join('');

    html += `
      <div class="py-2 rounded-2xl cursor-pointer flex flex-col items-center transition border ${isSelected ? 'bg-[#8C7355] text-white font-black shadow-sm' : 'bg-white hover:bg-brand-50 text-brand-900 border-transparent'}" onclick="showApptsInCalendar('${dStr}')">
        <span class="text-xs font-bold font-mono">${i}</span>
        <div class="flex items-center gap-0.5 mt-1 h-2">${dotsHtml}</div>
      </div>`;
  }
  grid.innerHTML = html;
}

function changeCalMonth(dir) {
  calMonth += dir;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  if (calMonth < 0) { calMonth = 11; calYear--; }
  renderCalendar();
}

function showApptsInCalendar(dateStr) {
  selectedCalendarDate = dateStr;
  renderCalendar();
  const container = document.getElementById('selected-date-appts');
  if (!container) return;

  let appts = (backendData.appointments || []).filter(a => a.date === dateStr);
  if (CURRENT_STAFF_PARAM && CURRENT_STAFF_PARAM !== 'all') {
    appts = appts.filter(a => a.staffId === CURRENT_STAFF_PARAM);
  }
  if (appts.length === 0) {
    container.innerHTML = `<div class="text-center text-xs text-brand-400 py-6 bg-white rounded-3xl border border-brand-200"><b class="text-brand-800">${dateStr}</b><br>當日無排程預約</div>`;
    return;
  }
  container.innerHTML = `
    <div class="flex justify-between items-center px-2 mb-1">
      <span class="text-xs font-black text-brand-900"><i class="fa-solid fa-calendar-day mr-1"></i> ${dateStr} 排程預約 (${appts.length} 筆)</span>
    </div>
    ${appts.map(a => renderSingleCardHTML(a)).join('')}`;
}

// 3. 名單卡片渲染 (無 Emoji、全向量圖示、結構化條列)
function renderCustomer() {
  const appts = backendData.appointments || [];
  const filter = document.getElementById('filter-status')?.value || 'ALL';
  const container = document.getElementById('cust-content-area');
  if (!container) return;

  let filtered = appts;
  if (filter !== 'ALL') {
    filtered = appts.filter(a => a.status === filter);
  } else {
    filtered = appts.filter(a => a.status !== '已取消' && a.status !== '婉拒');
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="text-center py-10 bg-white rounded-3xl border border-brand-200 p-6 space-y-2">
        <div class="w-12 h-12 mx-auto bg-brand-50 rounded-full flex items-center justify-center text-brand-400 text-lg">
          <i class="fa-solid fa-inbox"></i>
        </div>
        <div class="text-brand-900 font-bold text-xs">目前篩選條件下無預約紀錄</div>
      </div>`;
  } else {
    container.innerHTML = filtered.map(a => renderSingleCardHTML(a)).join('');
  }
  
  const pendingAudit = appts.filter(a => a.status === '待確認');
  const pendingBadge = document.getElementById('pending-audit-badge');
  const pendingBox = document.getElementById('pending-audit-container');
  if (pendingBadge) pendingBadge.innerText = `${pendingAudit.length} 筆待處理`;
  if (pendingBox) {
    pendingBox.innerHTML = pendingAudit.length > 0 
      ? pendingAudit.map(a => renderSingleCardHTML(a)).join('') 
      : '<div class="text-center text-xs text-amber-800/70 py-3 font-medium">目前無待審核預約</div>';
  }

  const unpaidDep = appts.filter(a => a.status !== '已取消' && a.status !== '已結單' && !a.deposit_confirmed && !(a.notes || '').includes('訂金已核對'));
  const unpaidBadge = document.getElementById('unpaid-deposit-badge');
  const unpaidBox = document.getElementById('unpaid-deposit-container');
  if (unpaidBadge) unpaidBadge.innerText = `${unpaidDep.length} 筆`;
  if (unpaidBox) {
    unpaidBox.innerHTML = unpaidDep.length > 0 ? unpaidDep.map(a => `
      <div class="p-3 bg-white rounded-2xl border border-rose-200 flex justify-between items-center text-xs shadow-2xs">
        <div>
          <b class="text-rose-950 font-bold">${a.name}</b> <span class="font-mono text-gray-500">(${a.phone})</span>
          <div class="text-[11px] text-rose-700 mt-0.5">${a.service} - 預約時間：${a.date} ${a.time}</div>
        </div>
        <span class="text-[10px] font-bold bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full">未付訂金</span>
      </div>
    `).join('') : '<div class="text-center text-xs text-rose-800/60 py-1">全數皆已核對訂金</div>';
  }
}

function renderSingleCardHTML(a) {
  const staffColor = getStaffColor(a.staffId, a.staffName);
  let parsedEmail = '';
  let cleanNotes = a.notes || '';
  if (cleanNotes.includes('Email:')) {
    const parts = cleanNotes.split('Email:');
    cleanNotes = parts[0].trim();
    parsedEmail = parts[1].trim().split(' ')[0].split('|')[0].trim();
  }

  let financialRows = [];
  const addonMatch = cleanNotes.match(/加購[：:\s]*([^\s|]+)/);
  if (addonMatch || cleanNotes.includes('加購包卡') || cleanNotes.includes('加購儲值')) {
    const addonText = addonMatch ? addonMatch[1] : '現場加購方案';
    financialRows.push(`<div class="flex justify-between text-amber-900 font-bold"><span><i class="fa-solid fa-cart-plus mr-1 text-amber-600"></i>現場加購：</span><span>${addonText}</span></div>`);
  }
  if (cleanNotes.includes('使用包卡') || cleanNotes.includes('包卡扣抵')) {
    financialRows.push(`<div class="flex justify-between text-blue-700 font-bold"><span><i class="fa-solid fa-ticket mr-1 text-blue-500"></i>包卡點數抵扣：</span><span>當次扣減 1 點</span></div>`);
  }
  if (cleanNotes.includes('使用儲值') || cleanNotes.includes('儲值抵扣')) {
    financialRows.push(`<div class="flex justify-between text-purple-700 font-bold"><span><i class="fa-solid fa-wallet mr-1 text-purple-500"></i>儲值金扣抵支付：</span><span>享專屬會員折數</span></div>`);
  }
  if (cleanNotes.includes('折扣碼')) {
    const codeMatch = cleanNotes.match(/折扣碼[:\s]*([A-Za-z0-9]+)/);
    const codeStr = codeMatch ? ` (${codeMatch[1]})` : '';
    financialRows.push(`<div class="flex justify-between text-rose-600 font-bold"><span><i class="fa-solid fa-tag mr-1 text-rose-500"></i>活動促銷優惠：</span><span>已套用代碼${codeStr}</span></div>`);
  }
  if (a.deposit_deducted > 0) {
    financialRows.push(`<div class="flex justify-between text-amber-700 font-bold"><span><i class="fa-solid fa-money-bill mr-1 text-amber-600"></i>線下定額訂金：</span><span>-$${a.deposit_deducted}</span></div>`);
  }

  const rawPhone = String(a.phone || '').trim().replace(/[^0-9]/g, '');
  const intlPhone = rawPhone.startsWith('0') ? '886' + rawPhone.slice(1) : rawPhone;
  const friendlyCreatedTime = a.created_at ? formatFriendlyTime(a.created_at) : '';
  const friendlySignedTime = a.signed_at ? formatFriendlyTime(a.signed_at) : '';

  const signBtnHtml = a.signature_url ? `
    <button type="button" onclick="viewDigitalContract('${a.name}', '${a.signature_url}', '${friendlySignedTime}')" class="px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg font-bold text-xs transition">
      <i class="fa-solid fa-file-contract mr-1"></i>檢視合約
    </button>
  ` : `
    <button type="button" onclick="openLiveSignaturePad('${a.id}', '${a.name}')" class="px-2.5 py-1 bg-[#8C7355] hover:bg-[#7A6246] text-white rounded-lg font-bold text-xs shadow-xs transition flex items-center gap-1">
      <i class="fa-solid fa-pen-nib text-[10px]"></i>現場簽約
    </button>
  `;

  const auditActionHtml = (a.status === '待確認') ? `
    <div class="p-2.5 bg-amber-50 rounded-xl border border-amber-200 flex items-center justify-between gap-2 mt-1">
      <span class="text-[11px] font-bold text-amber-900 flex items-center gap-1">
        <i class="fa-solid fa-bell text-amber-600"></i> 新預約待審核：
      </span>
      <div class="flex gap-1.5 shrink-0">
        <button class="px-3 py-1 bg-[#7D8F7D] hover:bg-[#687968] text-white rounded-lg font-bold text-xs shadow-xs" onclick="auditOrder('${a.id}', '已確認', '${a.name}')">核准接單</button>
        <button class="px-2.5 py-1 bg-[#B57979] hover:bg-[#9E6363] text-white rounded-lg font-bold text-xs shadow-xs" onclick="auditOrder('${a.id}', '婉拒', '${a.name}')">婉拒</button>
      </div>
    </div>
  ` : '';

  return `
    <div class="bg-white p-4 rounded-2xl border-l-4 ${a.status === '已結單' ? 'border-l-emerald-500' : 'border-l-[#8C7355]'} border border-brand-200 shadow-sm space-y-2.5 text-xs">
      <div class="flex justify-between items-start">
        <div>
          <div class="flex items-center gap-2">
            <span class="text-base font-black text-[#8C7355] bg-brand-50 px-2 py-0.5 rounded-lg border border-brand-200 font-mono tracking-wide">
              <i class="fa-solid fa-clock text-xs mr-1"></i>${a.date} ${a.time}
            </span>
            <span class="px-1.5 py-0.5 bg-brand-100 text-brand-700 text-[10px] rounded font-bold">${a.customer_type === 'new' ? '新客' : '熟客'}</span>
          </div>
          <div class="font-bold text-brand-900 text-sm mt-1">
            ${a.name} <span class="text-brand-400 font-normal font-mono">(${a.phone})</span>
          </div>
          ${friendlyCreatedTime ? `<div class="text-[10px] text-brand-400 font-mono mt-0.5"><i class="fa-solid fa-calendar-plus mr-1"></i>下單時間：${friendlyCreatedTime}</div>` : ''}
        </div>
        <div class="flex flex-col items-end gap-1">
          <select class="text-[11px] font-bold border border-brand-200 rounded-lg px-2 py-0.5 bg-brand-50 outline-none cursor-pointer" onchange="quickUpdateStatus('${a.id}', this.value)">
            <option value="待確認" ${a.status === '待確認' ? 'selected' : ''}>待確認</option>
            <option value="已確認" ${a.status === '已確認' ? 'selected' : ''}>已確認</option>
            <option value="已結單" ${a.status === '已結單' ? 'selected' : ''}>已結單</option>
            <option value="婉拒" ${a.status === '婉拒' ? 'selected' : ''}>婉拒</option>
            <option value="已取消" ${a.status === '已取消' ? 'selected' : ''}>已取消</option>
          </select>
          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold" style="background:${staffColor.bg}; color:${staffColor.text}; border:1px solid ${staffColor.border};">${a.staffName}</span>
        </div>
      </div>

      <div class="flex items-center gap-1.5 pt-0.5">
        <a href="tel:${rawPhone}" class="inline-flex items-center gap-1 px-2.5 py-1 bg-[#6E8771] hover:bg-[#5C725E] text-white rounded-lg text-[10.5px] font-bold shadow-xs">
          <i class="fa-solid fa-phone text-[9px]"></i> 撥打電話
        </a>
        <a href="https://wa.me/${intlPhone}" target="_blank" class="inline-flex items-center gap-1 px-2.5 py-1 bg-[#5A7F71] hover:bg-[#48685C] text-white rounded-lg text-[10.5px] font-bold shadow-xs">
          <i class="fa-brands fa-whatsapp text-xs"></i> WhatsApp
        </a>
      </div>

      ${auditActionHtml}

      <div class="p-2.5 bg-brand-50 rounded-xl space-y-1 font-mono">
        <div class="font-bold text-brand-900 font-sans">施作項目：${a.service || '無'}</div>
        <div class="text-brand-600 font-bold">預估費用：${a.price} 元 ${a.status === '已結單' ? `<span class="text-emerald-700 font-black">(實收: ${a.finalPrice}元)</span>` : ''}</div>
      </div>

      <div class="p-2.5 bg-brand-50/70 rounded-xl space-y-1.5 text-[11px] border border-brand-100">
        <div class="font-bold text-brand-800 border-b border-brand-200/60 pb-1">當次方案與加購折抵：</div>
        ${financialRows.length > 0 ? financialRows.join('') : '<div class="text-gray-400">一般原價計費</div>'}
      </div>

      <div class="p-2.5 bg-brand-50/70 rounded-xl text-[11px] space-y-1">
        <div class="flex justify-between">
          <span>LINE：<b>${a.lineName || '未填寫'}</b></span>
          <span>信箱：<b>${parsedEmail || '未填寫'}</b></span>
        </div>
        ${a.customer_notes ? `<div class="text-amber-900 font-medium">顧客備註：${a.customer_notes}</div>` : ''}
      </div>

      <div class="w-full flex items-center gap-2 pt-1">
        <input type="text" id="admin-note-${a.id}" placeholder="內部備註事項..." value="${cleanNotes}" class="flex-1 min-w-0 p-2 text-xs border border-brand-200 rounded-xl bg-white outline-none">
        <button type="button" onclick="saveAdminNoteClean('${a.id}', '${parsedEmail}')" class="px-3.5 py-2 bg-[#8C7355] hover:bg-[#7A6246] text-white rounded-xl font-bold text-xs shrink-0 shadow-xs">
          存備註
        </button>
      </div>

      <div class="flex justify-between items-center pt-2 border-t border-brand-100">
        <div class="flex items-center gap-1.5">${signBtnHtml}</div>
        <div class="flex items-center gap-1.5">
          <button class="px-2.5 py-1 bg-[#6D7E8C] text-white rounded-lg font-bold text-[11px]" onclick="openEditServiceModal('${a.id}')">改項目</button>
          <button class="px-2.5 py-1 bg-brand-400 text-white rounded-lg font-bold text-[11px]" onclick="openRescheduleModal('${a.id}', '${a.name}', '${a.date}', '${a.time}')">改期</button>
          <button class="px-3 py-1 bg-emerald-600 text-white rounded-lg font-bold text-xs" onclick="openCheckoutModal('${a.id}', '${a.name}', '${a.phone}', '${a.service}', ${a.price || 0})">結單</button>
        </div>
      </div>
    </div>`;
}

function openLiveSignaturePad(bookingId, custName) {
  Swal.fire({
    title: `【${custName}】現場親筆簽名`,
    html: `
      <div class="space-y-2 text-left text-xs font-sans">
        <p class="text-brand-600">請顧客於下方框線內手寫簽名，確認定型化服務契約：</p>
        <canvas id="live-sign-canvas" class="w-full h-44 bg-white border-2 border-dashed border-brand-300 rounded-2xl touch-none shadow-inner"></canvas>
        <div class="flex justify-between items-center pt-1">
          <span class="text-[10px] text-brand-400">支援手機、觸控螢幕手寫</span>
          <button type="button" onclick="clearSignCanvas()" class="px-2.5 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-xs font-bold">清除重填</button>
        </div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: '確認存證並綁定',
    confirmButtonColor: '#8C7355',
    didOpen: () => { initSignCanvas(); },
    preConfirm: () => {
      const canvas = document.getElementById('live-sign-canvas');
      return canvas.toDataURL('image/png');
    }
  }).then(async r => {
    if (r.isConfirmed && r.value) {
      Swal.showLoading();
      try {
        const signedAtIso = new Date().toISOString();
        await directSupabasePatch('bookings', `id=eq.${bookingId}`, {
          signature_url: r.value,
          signed_at: signedAtIso
        });
        Swal.fire({ title: '定型化契約已成功簽署！', icon: 'success', timer: 1000, showConfirmButton: false });
        fetchDataAndRender();
      } catch(e) {
        Swal.fire('簽署失敗', e.message, 'error');
      }
    }
  });
}

let signCanvas, signCtx, isDrawing = false;
function initSignCanvas() {
  signCanvas = document.getElementById('live-sign-canvas');
  if (!signCanvas) return;
  signCtx = signCanvas.getContext('2d');
  const rect = signCanvas.getBoundingClientRect();
  signCanvas.width = rect.width;
  signCanvas.height = rect.height;
  signCtx.lineWidth = 3;
  signCtx.lineCap = 'round';
  signCtx.strokeStyle = '#2D241E';

  const getPos = (e) => {
    const cRect = signCanvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - cRect.left, y: clientY - cRect.top };
  };

  const start = (e) => { e.preventDefault(); isDrawing = true; const p = getPos(e); signCtx.beginPath(); signCtx.moveTo(p.x, p.y); };
  const move = (e) => { if (!isDrawing) return; e.preventDefault(); const p = getPos(e); signCtx.lineTo(p.x, p.y); signCtx.stroke(); };
  const stop = () => { isDrawing = false; };

  signCanvas.addEventListener('mousedown', start);
  signCanvas.addEventListener('mousemove', move);
  window.addEventListener('mouseup', stop);
  signCanvas.addEventListener('touchstart', start, { passive: false });
  signCanvas.addEventListener('touchmove', move, { passive: false });
  window.addEventListener('touchend', stop);
}

function clearSignCanvas() {
  if (signCtx && signCanvas) signCtx.clearRect(0, 0, signCanvas.width, signCanvas.height);
}

function formatFriendlyTime(isoStr) {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch(e) { return isoStr; }
}

function viewDigitalContract(name, sigUrl, signedTime) {
  const s = backendData.settings || {};
  Swal.fire({
    title: s.contractTitle || '定型化服務契約存證正本',
    html: `
      <div class="text-left text-xs space-y-3 font-sans max-h-[70vh] overflow-y-auto pr-1">
        <div class="p-3 bg-brand-50 rounded-xl border border-brand-200 text-[11.5px] leading-relaxed whitespace-pre-wrap">
          ${s.contractContent || DEFAULT_MOHW_BEAUTY_CONTRACT}
        </div>
        <div class="p-3 bg-white rounded-xl border border-brand-200 text-center space-y-2">
          <div class="flex justify-between items-center text-[11px] font-bold text-brand-900 border-b pb-1">
            <span>立約人：${name}</span>
            <span class="font-mono text-gray-500">簽署時間：${signedTime || '存證留存'}</span>
          </div>
          <div class="p-2 border border-dashed border-brand-300 rounded-lg bg-brand-50/50">
            <img src="${sigUrl}" class="max-h-24 mx-auto object-contain" alt="親筆數位簽名">
          </div>
        </div>
      </div>
    `,
    confirmButtonText: '關閉檢視',
    confirmButtonColor: '#8C7355'
  });
}

async function quickUpdateStatus(id, newStatus) {
  if (newStatus === '已取消') {
    const appt = (backendData.appointments || []).find(a => String(a.id) === String(id));
    cancelBooking(id, appt ? appt.name : '');
    return;
  }
  try {
    await directSupabasePatch('bookings', `id=eq.${id}`, { status: newStatus });
    const appt = (backendData.appointments || []).find(a => String(a.id) === String(id));
    if (appt) appt.status = newStatus;
    renderCustomer();
    Swal.fire({ title: `狀態已變更為【${newStatus}】`, icon: 'success', timer: 800, showConfirmButton: false });
  } catch (e) {
    Swal.fire('更新失敗', e.message, 'error');
  }
}

async function auditOrder(id, status, name) {
  if (status === '婉拒') {
    Swal.fire({
      title: `婉拒 ${name} 的預約`,
      input: 'text',
      inputPlaceholder: '請輸入婉拒原因（如：時段已滿、專員公休）',
      showCancelButton: true,
      confirmButtonText: '確定婉拒',
      confirmButtonColor: '#B57979'
    }).then(async r => {
      if (r.isConfirmed) {
        await directSupabasePatch('bookings', `id=eq.${id}`, { status: '婉拒', cancel_reason: r.value || '時段衝突' });
        fetchDataAndRender();
      }
    });
    return;
  }
  await directSupabasePatch('bookings', `id=eq.${id}`, { status: '已確認' });
  Swal.fire({ title: `已核准接單！`, icon: 'success', timer: 1000, showConfirmButton: false });
  fetchDataAndRender();
}

async function saveAdminNoteClean(id, email) {
  const noteInput = document.getElementById(`admin-note-${id}`);
  if (!noteInput) return;
  const cleanNote = noteInput.value.trim();
  const payload = email ? `${cleanNote} Email: ${email}`.trim() : cleanNote;
  await directSupabasePatch('bookings', `id=eq.${id}`, { notes: payload });
  Swal.fire({ title: '內部備註已儲存！', icon: 'success', timer: 800, showConfirmButton: false });
}

// 4. 寵物住宿模組
function renderBoardingRoomStatus() {
  const container = document.getElementById('boarding-room-grid');
  if (!container) return;
  const totalRooms = Number(backendData.settings.totalHotelRooms || 8);
  const occupied = (backendData.appointments || []).filter(a => (a.service || '').includes('住宿') && a.status !== '已取消' && a.status !== '婉拒');
  
  document.getElementById('boarding-active-count').innerText = `${occupied.length} 隻`;
  document.getElementById('boarding-checkout-count').innerText = `${occupied.filter(a => (a.notes || '').includes('退房')).length} 隻`;
  document.getElementById('boarding-vacancy-rate').innerText = `${Math.max(0, Math.round(((totalRooms - occupied.length) / totalRooms) * 100))}%`;

  let html = '';
  for (let i = 1; i <= totalRooms; i++) {
    const roomNumber = `R${String(i).padStart(2, '0')}`;
    const appt = occupied[i - 1];
    const isOccupied = Boolean(appt);

    html += `
      <div class="p-3 rounded-2xl border transition ${isOccupied ? 'bg-amber-50/80 border-amber-300' : 'bg-white border-brand-200'} text-xs">
        <div class="flex justify-between items-center pb-1 border-b ${isOccupied ? 'border-amber-200' : 'border-brand-100'}">
          <span class="font-bold font-mono text-brand-900">${roomNumber}</span>
          <span class="px-2 py-0.5 rounded-full text-[9px] font-bold ${isOccupied ? 'bg-amber-200 text-amber-900' : 'bg-emerald-100 text-emerald-800'}">
            ${isOccupied ? '在宿中' : '空房'}
          </span>
        </div>
        <div class="mt-1.5 space-y-0.5">
          <div class="font-bold text-brand-900 truncate">${isOccupied ? appt.name : '可安排入住'}</div>
          <div class="text-[10px] text-brand-400 truncate">${isOccupied ? appt.phone : '清潔完成'}</div>
        </div>
      </div>
    `;
  }
  container.innerHTML = html;
}

function renderBoardingCareChecklist() {
  const container = document.getElementById('boarding-care-checklist');
  if (!container) return;
  const inStay = (backendData.appointments || []).filter(a => (a.service || '').includes('住宿') && a.status !== '已取消');

  if (inStay.length === 0) {
    container.innerHTML = '<div class="text-center py-4 text-brand-400 text-xs">今日無在宿毛孩供餐任務</div>';
    return;
  }

  container.innerHTML = inStay.map(b => {
    const isSelfFood = (b.notes || '').includes('自備') || (b.self_food !== false);
    let dogSize = '小型犬';
    if ((b.notes || '').includes('大型犬')) dogSize = '大型犬';
    else if ((b.notes || '').includes('中型犬')) dogSize = '中型犬';
    else if ((b.notes || '').includes('貓')) dogSize = '貓咪';

    return `
      <div class="p-3 bg-white rounded-2xl border border-brand-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs">
        <div>
          <div class="flex items-center gap-1.5">
            <span class="font-bold text-brand-900">${b.name}</span>
            <span class="px-1.5 py-0.2 bg-brand-100 text-brand-700 text-[10px] font-bold rounded">${dogSize}</span>
            <span class="px-1.5 py-0.2 ${isSelfFood ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'} text-[10px] font-bold rounded">
              ${isSelfFood ? '家長自備食料' : '店內鮮食供餐'}
            </span>
          </div>
          <div class="text-[11px] text-brand-400 mt-0.5">${b.phone} - 房客</div>
        </div>
        <div class="flex gap-2 font-bold text-[11px] text-brand-800">
          <label class="flex items-center gap-1 cursor-pointer"><input type="checkbox" class="accent-[#8C7355]"> 早 09:00</label>
          <label class="flex items-center gap-1 cursor-pointer"><input type="checkbox" class="accent-[#8C7355]"> 午 12:30</label>
          <label class="flex items-center gap-1 cursor-pointer"><input type="checkbox" class="accent-[#8C7355]"> 晚 18:00</label>
        </div>
      </div>
    `;
  }).join('');
}

// 5. 專員排班調度
function renderShift() {
  let staffList = (backendData.settings?.staffList || []).filter(s => s.id !== 'all');
  const staffBtns = document.getElementById('staff-shift-buttons');
  if (staffBtns) {
    staffBtns.innerHTML = `<button type="button" class="px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap border transition ${activeShiftStaffId === 'all' ? 'bg-[#8C7355] text-white border-[#8C7355]' : 'bg-white border-brand-200 text-brand-800'}" onclick="switchShiftStaff('all')">全店不指定</button>` + 
    staffList.map(s => `
      <button type="button" class="px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap border transition ${activeShiftStaffId === s.id ? 'bg-[#8C7355] text-white border-[#8C7355]' : 'bg-white border-brand-200 text-brand-800'}" onclick="switchShiftStaff('${s.id}')">${s.name}</button>
    `).join('');
  }

  const dates = backendData.scheduleDates || [];
  const scrollArea = document.getElementById('shift-scroll-area');
  if (scrollArea) {
    let html = `<div class="shrink-0 px-3.5 py-1.5 rounded-xl text-center cursor-pointer border text-xs font-bold transition ${currentShiftDate === 'ALL' ? 'bg-[#8C7355] text-white border-[#8C7355]' : 'bg-white border-brand-200 text-brand-700'}" onclick="selectShiftDate('ALL')">全部日期</div>`;
    dates.forEach(d => {
      let dParts = d.date.split('/');
      html += `
        <div class="shrink-0 px-3 py-1.5 rounded-xl text-center cursor-pointer border text-xs font-bold transition ${currentShiftDate === d.date ? 'bg-[#8C7355] text-white border-[#8C7355]' : 'bg-white border-brand-200 text-brand-800'}" onclick="selectShiftDate('${d.date}')">
          <div class="text-[9px] opacity-70">${dParts[1]}月</div>
          <div class="font-bold text-xs">${dParts[2]}日</div>
        </div>`;
    });
    scrollArea.innerHTML = html;
  }

  const content = document.getElementById('shift-content-area');
  if (!content) return;

  if (currentShiftDate === 'ALL') {
    content.innerHTML = `<div class="space-y-2">${dates.map(d => `
      <div class="p-3.5 bg-white rounded-2xl border border-brand-200 flex justify-between items-center text-xs">
        <div><div class="font-bold text-brand-900">${d.date}</div><div class="text-[11px] text-brand-400">點擊右側排定開放時段</div></div>
        <button class="px-3.5 py-1.5 bg-brand-100 hover:bg-brand-200 text-brand-800 font-bold rounded-xl text-xs transition" onclick="selectShiftDate('${d.date}')">排定時段 ➔</button>
      </div>
    `).join('')}</div>`;
    return;
  }

  const start = backendData.settings?.shiftStartTime || '09:00';
  const end = backendData.settings?.shiftEndTime || '19:00';
  const interval = Number(backendData.settings?.shiftInterval || 30);
  const [sH, sM] = start.split(':').map(Number);
  const [eH, eM] = end.split(':').map(Number);
  const slots = [];
  for (let m = sH * 60 + sM; m <= eH * 60 + eM; m += interval) {
    let hh = Math.floor(m / 60); let mm = m % 60;
    slots.push((hh < 10 ? '0' + hh : hh) + ':' + (mm === 0 ? '00' : mm));
  }

  const staffKey = `${activeShiftStaffId}_${currentShiftDate}`;
  if (!shiftSlotStates[staffKey]) {
    shiftSlotStates[staffKey] = {};
    slots.forEach(t => shiftSlotStates[staffKey][t] = false);
  }

  content.innerHTML = `
    <div class="bg-white rounded-3xl border border-brand-200 overflow-hidden shadow-sm text-xs">
      <div class="p-4 bg-brand-50 border-b border-brand-200 flex justify-between items-center">
        <div><div class="font-bold text-brand-900 text-sm">${currentShiftDate} 班表設定</div><div class="text-[10px] text-brand-400">鮮綠為開放預約，亮紅為休息關閉</div></div>
        <div class="flex gap-2">
          <button type="button" class="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition" onclick="toggleAllShift('${staffKey}', false)">
            <i class="fa-solid fa-ban mr-1"></i>全休
          </button>
          <button type="button" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition" onclick="toggleAllShift('${staffKey}', true)">
            <i class="fa-solid fa-circle-check mr-1"></i>全開
          </button>
        </div>
      </div>
      <div class="divide-y divide-brand-100 max-h-[60vh] overflow-y-auto">${slots.map(t => {
        const isOpen = shiftSlotStates[staffKey][t] === true;
        return `
          <div class="p-3 flex justify-between items-center">
            <span class="font-bold text-brand-900 font-mono text-sm">${t}</span>
            <button type="button" class="px-4 py-1.5 rounded-full font-black text-xs transition border ${
              isOpen 
                ? 'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-600 shadow-xs' 
                : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
            }" onclick="toggleSlotState('${staffKey}', '${t}', this)">
              ${isOpen ? '✓ 上班中 (開放預約)' : '✕ 已關閉 (休息)'}
            </button>
          </div>`;
      }).join('')}</div>
    </div>`;
}

function switchShiftStaff(id) { activeShiftStaffId = id; renderShift(); }
function selectShiftDate(dStr) { currentShiftDate = dStr; renderShift(); }
function toggleSlotState(staffKey, timeStr, btn) {
  const newState = !(shiftSlotStates[staffKey][timeStr] === true);
  shiftSlotStates[staffKey][timeStr] = newState;
  btn.className = `px-4 py-1.5 rounded-full font-black text-xs transition border ${
    newState 
      ? 'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-600 shadow-xs' 
      : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
  }`;
  btn.innerText = newState ? '✓ 上班中 (開放預約)' : '✕ 已關閉 (休息)';
  directSupabaseUpsert('store_settings', { store_id: CURRENT_STORE_ID, staff_schedules: shiftSlotStates }, 'store_id');
}
function toggleAllShift(staffKey, isOpen) {
  Object.keys(shiftSlotStates[staffKey]).forEach(t => shiftSlotStates[staffKey][t] = isOpen);
  renderShift();
  directSupabaseUpsert('store_settings', { store_id: CURRENT_STORE_ID, staff_schedules: shiftSlotStates }, 'store_id');
}

// 6. 服務項目與 BOM 耗材設定
function renderBOMCheckboxes(selectedMaterials = []) {
  const container = document.getElementById('svc-material-checkboxes-container');
  if (!container) return;

  const availableItems = (allInventoryItems && allInventoryItems.length > 0) ? allInventoryItems : [
    { id: 'inv-1', category: '洗護消耗品', name: '草本舒緩洗劑 (4000ml)', unit: 'ml' },
    { id: 'inv-2', category: '技術耗材', name: '日系染膏/精油萃取原液', unit: 'ml' },
    { id: 'inv-3', category: '零售外帶品', name: '全能修護深層滴劑 (100ml)', unit: '瓶' },
    { id: 'inv-4', category: '工具雜項', name: '加厚吸水免洗毛巾 (100入)', unit: '條' }
  ];

  container.innerHTML = availableItems.map(it => {
    const matched = selectedMaterials.find(m => m.name === it.name);
    const isChecked = Boolean(matched);
    const dosageVal = matched ? matched.dosage : (it.unit === 'ml' ? '50ml' : '1' + it.unit);

    return `
      <div class="flex items-center justify-between p-2 bg-white rounded-xl border border-brand-200 text-xs">
        <label class="flex items-center gap-2 cursor-pointer flex-1">
          <input type="checkbox" value="${it.name}" class="svc-bom-cb accent-[#8C7355] rounded" ${isChecked}>
          <span class="font-bold text-brand-900">${it.name}</span>
          <span class="text-[10px] text-brand-400">(${it.category})</span>
        </label>
        <div class="flex items-center gap-1">
          <span class="text-[10px] text-brand-500">扣除量：</span>
          <input type="text" data-for="${it.name}" class="svc-bom-dosage w-16 p-1 border border-brand-200 rounded text-center text-xs font-mono font-bold" value="${dosageVal}">
        </div>
      </div>
    `;
  }).join('');
}

function editServiceItem(id) {
  const s = (backendData.services || []).find(item => String(item.id) === String(id));
  if (!s) return;
  document.getElementById('edit-svc-id').value = s.id;
  document.getElementById('svc-name').value = s.name || '';
  document.getElementById('svc-price').value = s.price || '';
  document.getElementById('svc-duration').value = s.duration || 60;
  document.getElementById('svc-type').value = s.type || 'Group_A';
  document.getElementById('svc-is-addon').checked = Boolean(s.isAddon);
  
  let materials = [];
  if (Array.isArray(s.materials)) {
    materials = s.materials;
  } else if (s.material_name && s.material_name !== 'none') {
    materials = [{ name: s.material_name, dosage: s.material_dosage || '50ml' }];
  }
  renderBOMCheckboxes(materials);

  document.getElementById('svc-form-title').innerText = "修改服務項目 (含技術耗材 BOM 複選)";
  document.getElementById('svc-cancel-btn').classList.remove('hidden');
}

function resetServiceForm() {
  document.getElementById('edit-svc-id').value = '';
  document.getElementById('svc-name').value = '';
  document.getElementById('svc-price').value = '';
  document.getElementById('svc-duration').value = '60';
  document.getElementById('svc-is-addon').checked = false;
  renderBOMCheckboxes([]);
  document.getElementById('svc-form-title').innerText = "新增服務項目 (含技術耗材 BOM 複選連動)";
  document.getElementById('svc-cancel-btn').classList.add('hidden');
}

async function saveServiceItem() {
  const id = document.getElementById('edit-svc-id').value.trim();
  const name = document.getElementById('svc-name').value.trim();
  const priceStr = document.getElementById('svc-price').value.trim();
  const duration = document.getElementById('svc-duration').value;
  const type = document.getElementById('svc-type').value;
  const isAddon = document.getElementById('svc-is-addon').checked;

  const selectedBOM = [];
  document.querySelectorAll('.svc-bom-cb:checked').forEach(cb => {
    const matName = cb.value;
    const dosageInput = document.querySelector(`.svc-bom-dosage[data-for="${matName}"]`);
    selectedBOM.push({
      name: matName,
      dosage: dosageInput ? dosageInput.value.trim() : '1單位'
    });
  });

  if (!name || !priceStr) return Swal.fire('名稱與金額為必填', '', 'warning');

  const payload = {
    store_id: CURRENT_STORE_ID,
    service_name: name,
    price: priceStr,
    duration_minutes: Number(duration || 60),
    service_type: type,
    is_addon: isAddon,
    materials: selectedBOM,
    material_name: selectedBOM.length > 0 ? selectedBOM.map(m => m.name).join(', ') : 'none',
    material_dosage: selectedBOM.length > 0 ? selectedBOM.map(m => m.dosage).join(', ') : ''
  };

  if (id && !id.startsWith('def-')) {
    await directSupabasePatch('services', `id=eq.${id}`, payload);
  } else {
    await directSupabaseUpsert('services', payload, 'id');
  }
  resetServiceForm();
  fetchDataAndRender();
  Swal.fire('服務項目與耗材連動已儲存！', '', 'success');
}

function renderServiceList() {
  const container = document.getElementById('service-list-container');
  if (!container) return;
  container.innerHTML = (backendData.services || []).map((s, idx) => {
    let matHtml = '';
    if (Array.isArray(s.materials) && s.materials.length > 0) {
      matHtml = s.materials.map(m => `<span class="px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded text-[9.5px]">${m.name} (${m.dosage})</span>`).join(' ');
    } else if (s.material_name && s.material_name !== 'none') {
      matHtml = `<span class="px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded text-[9.5px]">${s.material_name} (${s.material_dosage || '50ml'})</span>`;
    }

    return `
      <div class="p-3 bg-white rounded-2xl border border-brand-200 flex justify-between items-center text-xs">
        <div>
          <div class="font-bold text-brand-900">${s.isAddon ? '[加購] ' : ''}${s.name}</div>
          <div class="text-[11px] text-brand-400 mt-0.5">${s.price}元 / ${s.duration}分鐘 (${s.type})</div>
          ${matHtml ? `<div class="mt-1 flex flex-wrap gap-1 items-center"><i class="fa-solid fa-flask text-amber-600 text-[10px]"></i> ${matHtml}</div>` : ''}
        </div>
        <div class="flex gap-1 items-center">
          <button class="w-7 h-7 flex items-center justify-center bg-brand-50 border border-brand-200 rounded-lg text-xs font-bold" onclick="moveServiceOrder(${idx}, -1)">▲</button>
          <button class="w-7 h-7 flex items-center justify-center bg-brand-50 border border-brand-200 rounded-lg text-xs font-bold" onclick="moveServiceOrder(${idx}, 1)">▼</button>
          <button onclick="editServiceItem('${s.id}')" class="px-2.5 py-1 bg-blue-50 text-blue-700 font-bold rounded-lg">改</button>
          <button onclick="deleteServiceItem('${s.id}')" class="px-2.5 py-1 bg-rose-50 text-rose-700 font-bold rounded-lg">刪</button>
        </div>
      </div>
    `;
  }).join('');
}

async function moveServiceOrder(idx, dir) {
  const svcs = backendData.services || [];
  const targetIdx = idx + dir;
  if (targetIdx < 0 || targetIdx >= svcs.length) return;
  const temp = svcs[idx];
  svcs[idx] = svcs[targetIdx];
  svcs[targetIdx] = temp;
  for (let i = 0; i < svcs.length; i++) {
    svcs[i].sortOrder = i;
    await directSupabasePatch('services', `id=eq.${svcs[i].id}`, { sort_order: i });
  }
  renderServiceList();
}

async function deleteServiceItem(id) {
  Swal.fire({ title: '確定刪除此服務？', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: '確定刪除' }).then(async r => {
    if (r.isConfirmed) {
      await fetch(`${SUPABASE_URL}/rest/v1/services?id=eq.${id}`, {
        method: "DELETE",
        headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` }
      });
      fetchDataAndRender();
    }
  });
}

// 7. 作品集管理
function renderPortfolioList() {
  const container = document.getElementById('portfolio-list-container');
  if (!container) return;
  container.innerHTML = (backendData.portfolio || []).map((p, idx) => `
    <div class="bg-brand-50 rounded-2xl overflow-hidden border border-brand-200 p-2 text-xs space-y-1">
      <div class="aspect-[3/4] bg-cover bg-center rounded-xl" style="background-image:url('${p.img}')"></div>
      <div class="font-bold truncate text-brand-900 flex justify-between items-center">
        <span class="truncate">${p.title}</span>
        <button onclick="promptEditPortfolioModal('${p.id}', '${p.title}', '${p.cat}', '${p.link||''}')" class="text-[10px] text-blue-600 underline shrink-0">編輯</button>
      </div>
      <div class="text-[10px] text-brand-500 font-bold">${p.cat}</div>
      <div class="flex gap-1 pt-1">
        <button class="flex-1 py-1 bg-white border border-brand-200 rounded text-[10px] font-bold" onclick="movePortfolioOrder(${idx}, -1)">◀ 移動</button>
        <button class="flex-1 py-1 bg-white border border-brand-200 rounded text-[10px] font-bold" onclick="movePortfolioOrder(${idx}, 1)">移動 ▶</button>
        <button class="px-2 py-1 bg-rose-100 text-rose-700 rounded text-[10px] font-bold" onclick="deletePortfolioItem('${p.id}')">刪</button>
      </div>
    </div>
  `).join('');
}

function promptEditPortfolioModal(id, oldTitle, oldCat, oldLink) {
  Swal.fire({
    title: '修改作品資訊',
    html: `
      <div class="text-left text-xs space-y-2">
        <div><label class="font-bold">作品分類：</label><input id="swal-port-cat" class="swal2-input text-xs" value="${oldCat}" placeholder="例: 日系剪染"></div>
        <div><label class="font-bold">作品標題：</label><input id="swal-port-title" class="swal2-input text-xs" value="${oldTitle}"></div>
        <div><label class="font-bold">IG 外部連結：</label><input id="swal-port-link" class="swal2-input text-xs" value="${oldLink}" placeholder="https://instagram.com/..."></div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: '儲存',
    confirmButtonColor: '#8C7355',
    preConfirm: () => ({
      cat: document.getElementById('swal-port-cat').value.trim(),
      title: document.getElementById('swal-port-title').value.trim(),
      link: document.getElementById('swal-port-link').value.trim()
    })
  }).then(async r => {
    if (r.isConfirmed && r.value.title) {
      await directSupabasePatch('portfolios', `id=eq.${id}`, { 
        category: r.value.cat || '作品精選', 
        title: r.value.title, 
        link: r.value.link 
      });
      fetchDataAndRender();
      Swal.fire('作品資訊已更新！', '', 'success');
    }
  });
}

async function movePortfolioOrder(idx, dir) {
  const ports = backendData.portfolio || [];
  const targetIdx = idx + dir;
  if (targetIdx < 0 || targetIdx >= ports.length) return;
  const temp = ports[idx];
  ports[idx] = ports[targetIdx];
  ports[targetIdx] = temp;
  for (let i = 0; i < ports.length; i++) {
    ports[i].sortOrder = i;
    await directSupabasePatch('portfolios', `id=eq.${ports[i].id}`, { sort_order: i });
  }
  renderPortfolioList();
}

async function deletePortfolioItem(id) {
  Swal.fire({ title: '確定刪除此作品？', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: '確定刪除' }).then(async r => {
    if (r.isConfirmed) {
      await fetch(`${SUPABASE_URL}/rest/v1/portfolios?id=eq.${id}`, {
        method: "DELETE",
        headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` }
      });
      fetchDataAndRender();
    }
  });
}

async function uploadAndSavePortfolio() {
  const cat = document.getElementById('work-cat').value.trim();
  const title = document.getElementById('work-title').value.trim();
  const link = document.getElementById('work-link').value.trim();
  const file = document.getElementById('work-file').files[0];

  if (!title || !file) return Swal.fire('作品標題與照片為必填', '', 'warning');

  Swal.showLoading();
  try {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const base64Data = reader.result.split(',')[1];
      const formData = new FormData();
      formData.append("image", base64Data);
      const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: "POST", body: formData });
      const data = await res.json();
      if (data.success) {
        await directSupabaseUpsert('portfolios', {
          store_id: CURRENT_STORE_ID,
          category: cat || '作品精選',
          title: title,
          link: link,
          img_url: data.data.url
        }, 'id');
        document.getElementById('work-cat').value = '';
        document.getElementById('work-title').value = '';
        document.getElementById('work-link').value = '';
        document.getElementById('work-file').value = '';
        fetchDataAndRender();
        Swal.fire('作品已發布成功！', '', 'success');
      }
    };
  } catch (e) {
    Swal.fire('發布失敗', e.message, 'error');
  }
}

// 8. 進銷存管理
async function renderInventoryList() {
  const container = document.getElementById('inventory-items-container');
  const catSelect = document.getElementById('inv-filter-category');
  if (!container) return;

  if (allInventoryItems.length === 0) {
    allInventoryItems = [
      { id: 'inv-1', category: '洗護消耗品', name: '草本舒緩洗劑 (4000ml)', current_stock: 4, safe_stock: 5, unit: '桶', cost_price: 1200 },
      { id: 'inv-2', category: '技術耗材', name: '日系染膏/精油萃取原液', current_stock: 14, safe_stock: 8, unit: '條', cost_price: 220 },
      { id: 'inv-3', category: '零售外帶品', name: '全能修護深層滴劑 (100ml)', current_stock: 8, safe_stock: 3, unit: '瓶', cost_price: 450 },
      { id: 'inv-4', category: '工具雜項', name: '加厚吸水免洗毛巾 (100入)', current_stock: 15, safe_stock: 10, unit: '包', cost_price: 350 }
    ];
  }

  if (catSelect) {
    const currentVal = catSelect.value;
    const allCats = Array.from(new Set([...customInventoryCategories, ...allInventoryItems.map(i => i.category)]));
    catSelect.innerHTML = '<option value="ALL">全部分類 (技術耗材與零售外帶)</option>' + allCats.map(c => `<option value="${c}">${c}</option>`).join('');
    catSelect.value = currentVal || 'ALL';
  }

  const filterCat = catSelect ? catSelect.value : 'ALL';
  let filtered = allInventoryItems;
  if (filterCat !== 'ALL') filtered = filtered.filter(it => it.category === filterCat);
  if (isLowStockFilterActive) filtered = filtered.filter(it => Number(it.current_stock) <= Number(it.safe_stock));

  container.innerHTML = filtered.map(it => {
    const isAlert = Number(it.current_stock) <= Number(it.safe_stock);
    return `
      <div class="p-3.5 bg-white rounded-2xl border ${isAlert ? 'border-amber-300 bg-amber-50/30' : 'border-brand-200'} shadow-2xs flex justify-between items-center text-xs">
        <div>
          <div class="flex items-center gap-1.5 font-bold text-brand-900">
            <span class="text-sm">${it.name}</span>
            <span class="px-2 py-0.2 rounded-md text-[9.5px] bg-brand-100 text-brand-700">${it.category}</span>
          </div>
          <div class="text-[11px] text-brand-400 mt-0.5">安全存量: ${it.safe_stock} ${it.unit} | 進價: $${it.cost_price || 0}</div>
        </div>
        <div class="flex items-center gap-3">
          <div class="text-right">
            <div class="font-black text-sm font-mono ${isAlert ? 'text-rose-600' : 'text-emerald-700'}">${it.current_stock} ${it.unit}</div>
            ${isAlert ? '<span class="text-[9px] text-rose-500 font-bold">低於安全存量</span>' : '<span class="text-[9px] text-emerald-600">存量正常</span>'}
          </div>
          <button onclick="promptStockAdjust('${it.id}')" class="px-2.5 py-1.5 bg-brand-100 hover:bg-brand-200 text-brand-800 rounded-xl font-bold text-xs transition">
            進貨 / 零售帶走
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function toggleLowStockFilter() {
  isLowStockFilterActive = !isLowStockFilterActive;
  const btn = document.getElementById('btn-low-stock');
  if (btn) {
    btn.className = isLowStockFilterActive
      ? "px-3 py-2 bg-amber-500 text-white rounded-xl text-xs font-bold transition shrink-0 shadow-xs"
      : "px-3 py-2 bg-brand-100 text-brand-800 rounded-xl text-xs font-bold transition shrink-0";
  }
  renderInventoryList();
}

function openAddProductModal() {
  const existingCats = Array.from(new Set([...customInventoryCategories, ...allInventoryItems.map(i => i.category)]));
  const catOptions = existingCats.map(c => `<option value="${c}">${c}</option>`).join('');

  Swal.fire({
    title: '新增品項/技術耗材主檔',
    html: `
      <div class="text-left text-xs space-y-2.5">
        <div>
          <label class="font-bold">品項名稱：</label>
          <input id="inv-name" class="swal2-input text-xs" placeholder="例: 草本深層洗劑">
        </div>
        <div>
          <label class="font-bold">選擇分類：</label>
          <select id="inv-cat-select" class="swal2-input text-xs" onchange="document.getElementById('inv-custom-cat').value = this.value">
            ${catOptions}
            <option value="__NEW__">+ 自建新分類</option>
          </select>
          <input id="inv-custom-cat" class="swal2-input text-xs mt-1" placeholder="輸入自建分類名稱" value="${existingCats[0]}">
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="font-bold">初始庫存：</label>
            <input type="number" id="inv-stock" class="swal2-input text-xs" value="10">
          </div>
          <div>
            <label class="font-bold">安全存量：</label>
            <input type="number" id="inv-safe" class="swal2-input text-xs" value="5">
          </div>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="font-bold">單位 (如: 瓶/包/條)：</label>
            <input id="inv-unit" class="swal2-input text-xs" value="瓶">
          </div>
          <div>
            <label class="font-bold">進貨成本 (NT$)：</label>
            <input type="number" id="inv-cost" class="swal2-input text-xs" value="200">
          </div>
        </div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: '確定建立品項',
    confirmButtonColor: '#8C7355',
    preConfirm: () => {
      const name = document.getElementById('inv-name').value.trim();
      const customCat = document.getElementById('inv-custom-cat').value.trim();
      if (!name) return Swal.showValidationMessage('請輸入品項名稱');
      return {
        id: 'inv-' + Date.now(),
        name,
        category: customCat || '技術耗材',
        current_stock: Number(document.getElementById('inv-stock').value || 0),
        safe_stock: Number(document.getElementById('inv-safe').value || 5),
        unit: document.getElementById('inv-unit').value.trim() || '件',
        cost_price: Number(document.getElementById('inv-cost').value || 0)
      };
    }
  }).then(r => {
    if (r.isConfirmed && r.value) {
      allInventoryItems.unshift(r.value);
      if (!customInventoryCategories.includes(r.value.category)) {
        customInventoryCategories.push(r.value.category);
      }
      Swal.fire('品項建立成功！', '', 'success');
      renderInventoryList();
    }
  });
}

function promptStockAdjust(itemId) {
  const it = allInventoryItems.find(i => i.id === itemId);
  if (!it) return;

  Swal.fire({
    title: `【${it.name}】庫存異動操作`,
    html: `
      <div class="text-left text-xs space-y-2.5">
        <div class="p-2 bg-brand-50 rounded-xl border border-brand-200">
          <b>目前存量：</b><span class="font-mono text-sm font-bold text-emerald-800">${it.current_stock} ${it.unit}</span>
        </div>
        <div>
          <label class="font-bold">異動模式：</label>
          <select id="adj-mode" class="swal2-input text-xs font-bold">
            <option value="retail_out">🛒 現場客人購買帶走 (-扣除)</option>
            <option value="restock_in">📦 進貨入庫 (+增加)</option>
          </select>
        </div>
        <div>
          <label class="font-bold">異動數量：</label>
          <input type="number" id="adj-qty" class="swal2-input text-xs font-bold font-mono" value="1" min="1">
        </div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: '確定異動',
    confirmButtonColor: '#8C7355',
    preConfirm: () => ({
      mode: document.getElementById('adj-mode').value,
      qty: Number(document.getElementById('adj-qty').value || 1)
    })
  }).then(r => {
    if (r.isConfirmed) {
      if (r.value.mode === 'retail_out') {
        it.current_stock = Math.max(0, it.current_stock - r.value.qty);
        Swal.fire('已完成零售扣庫！', `現存 ${it.current_stock} ${it.unit}`, 'success');
      } else {
        it.current_stock += r.value.qty;
        Swal.fire('進貨入庫成功！', `現存 ${it.current_stock} ${it.unit}`, 'success');
      }
      renderInventoryList();
    }
  });
}

// 9. 結單彈窗交互
async function openCheckoutModal(id, name, phone, service, price) {
  currentCheckoutBookingObj = { id, name, phone, service, price: Number(price || 0) };
  document.getElementById('chk-modal-name').innerText = name;
  document.getElementById('chk-modal-phone').innerText = phone;
  document.getElementById('chk-modal-service').innerText = service;
  document.getElementById('chk-modal-base-price').innerText = `NT$ ${price.toLocaleString()}`;
  document.getElementById('check_custom_base_price').value = price || 0;
  document.getElementById('chk-modal-final-price').value = price || 0;

  const svcObj = (backendData.services || []).find(s => (service || '').includes(s.name));
  const bomSection = document.getElementById('checkoutBOMSection');
  const bomList = document.getElementById('checkoutBOMList');

  if (bomSection && bomList) {
    if (svcObj && Array.isArray(svcObj.materials) && svcObj.materials.length > 0) {
      bomSection.classList.remove('hidden');
      bomList.innerHTML = svcObj.materials.map(m => `<div>• 關聯耗材：<b>${m.name}</b> (預計出庫 -${m.dosage})</div>`).join('');
    } else {
      bomSection.classList.add('hidden');
    }
  }

  let cardPoints = 0;
  let walletBal = 0;
  let discountRate = 1;

  try {
    const [pkgs, custs] = await Promise.all([
      directSupabaseFetch(`customer_packages?store_id=eq.${CURRENT_STORE_ID}&phone=eq.${phone}&remaining_times=gt.0`),
      directSupabaseFetch(`customers?store_id=eq.${CURRENT_STORE_ID}&phone=eq.${phone}`)
    ]);

    if (pkgs && pkgs.length > 0) {
      const matched = pkgs.find(p => service.includes(p.service_name)) || pkgs[0];
      cardPoints = matched.remaining_times || 0;
      document.getElementById('optUseCardDeductText').innerText = `使用【${matched.service_name}】扣點 (剩餘 ${cardPoints} 點)`;
    }
    if (custs && custs.length > 0) {
      walletBal = Number(custs[0].wallet_balance || 0);
      discountRate = Number(custs[0].member_discount || 1);
      document.getElementById('optUseDepositText').innerText = `使用已有儲值金 (餘額 $${walletBal}，享 ${discountRate * 10} 折)`;
      document.getElementById('optUseDepositText').setAttribute('data-rate', discountRate);
    }
  } catch(e) {}

  document.getElementById('checkModalCurrentCard').innerText = `${cardPoints} 點`;
  document.getElementById('checkModalCurrentDeposit').innerText = `$${walletBal}`;

  const retailSelect = document.getElementById('checkoutRetailSelect');
  if (retailSelect) {
    const retailItems = allInventoryItems.filter(it => it.category === '零售外帶品');
    retailSelect.innerHTML = '<option value="none" data-price="0">不加購零售產品</option>' +
      retailItems.map(it => `<option value="${it.id}" data-price="350">${it.name} (+NT$ 350)</option>`).join('');
  }

  const pkgGroup = document.getElementById('pkgBuyOptionsGroup');
  const topupGroup = document.getElementById('topupBuyOptionsGroup');
  if (pkgGroup) {
    pkgGroup.innerHTML = (backendData.settings?.packageRules || []).map(p => `
      <option value="new_pkg" data-name="${p.name}" data-price="${p.price}" data-times="${p.times}">
        + 購買【${p.name}】(+NT$ ${p.price}，含 ${p.times} 點)
      </option>
    `).join('');
  }
  if (topupGroup) {
    topupGroup.innerHTML = (backendData.settings?.walletRules || []).map(w => `
      <option value="new_topup" data-name="${w.name}" data-price="${w.price}" data-add="${w.price + (w.bonus || 0)}" data-discount="${w.discount}">
        + 購買【${w.name}】(+NT$ ${w.price}，入帳 $${w.price + (w.bonus || 0)})
      </option>
    `).join('');
  }

  recalcCheckoutTotal();
  document.getElementById('checkoutModal').classList.remove('hidden');
}

function closeCheckoutModal() {
  document.getElementById('checkoutModal').classList.add('hidden');
}

function recalcCheckoutTotal() {
  const base = Number(document.getElementById('check_custom_base_price')?.value || 0);
  const useMethod = document.getElementById('check_discount_use_select')?.value;
  const newBuyOption = document.getElementById('check_new_buy_select')?.options[document.getElementById('check_new_buy_select').selectedIndex];
  const retailOpt = document.getElementById('checkoutRetailSelect')?.options[document.getElementById('checkoutRetailSelect').selectedIndex];

  let disc = 0;
  let depDeduct = 0;
  let addPrice = Number(newBuyOption?.getAttribute('data-price') || 0) + Number(retailOpt?.getAttribute('data-price') || 0);

  let curCard = parseInt(document.getElementById('checkModalCurrentCard')?.innerText) || 0;
  let curDeposit = parseInt(document.getElementById('checkModalCurrentDeposit')?.innerText.replace(/[^0-9]/g, '')) || 0;

  if (useMethod === 'useCard' && curCard > 0) {
    disc = base;
    curCard = Math.max(0, curCard - 1);
  } else if (useMethod === 'useDeposit' && curDeposit > 0) {
    const rate = Number(document.getElementById('optUseDepositText')?.getAttribute('data-rate') || 1);
    const discounted = Math.round(base * rate);
    disc = base - discounted;
    if (curDeposit >= discounted) {
      depDeduct = discounted;
      curDeposit -= discounted;
    } else {
      depDeduct = curDeposit;
      curDeposit = 0;
    }
  }

  let finalPay = Math.max(0, base - disc - depDeduct) + addPrice;

  document.getElementById('check_display_orig').innerText = `$${base}`;
  document.getElementById('check_display_disc').innerText = `-$${disc}`;
  document.getElementById('check_display_dep_deduct').innerText = `-$${depDeduct}`;
  document.getElementById('check_display_add').innerText = `+$${addPrice}`;
  document.getElementById('check_display_final').innerText = `$${finalPay.toLocaleString()}`;
  document.getElementById('chk-modal-final-price').value = finalPay;

  document.getElementById('check_display_after_card').innerText = `• 剩餘包卡點數：${curCard} 點`;
  document.getElementById('check_display_after_deposit').innerText = `• 剩餘儲值金：$${curDeposit.toLocaleString()}`;
}

function cancelBooking(id, name) {
  Swal.fire({
    title: `取消預約 - ${name}`,
    input: 'select',
    inputOptions: {
      '顧客臨時有事改期': '顧客臨時有事改期',
      '無故未到放鳥 (No-Show)': '無故未到放鳥 (No-Show)',
      '店家行程調整衝突': '店家行程調整衝突',
      '其他原因': '其他原因'
    },
    inputPlaceholder: '請選擇取消原因',
    showCancelButton: true,
    confirmButtonText: '確認取消',
    confirmButtonColor: '#d33'
  }).then(async r => {
    if (r.isConfirmed && r.value) {
      await directSupabasePatch('bookings', `id=eq.${id}`, { status: '已取消', cancel_reason: r.value });
      fetchDataAndRender();
    }
  });
}

function openEditServiceModal(id) {
  const svcs = backendData.services || [];
  const appt = (backendData.appointments || []).find(a => String(a.id) === String(id));
  const currentSvcs = appt ? appt.service.split(',').map(s => s.trim()) : [];

  let checkboxHtml = svcs.map(s => {
    const isChecked = currentSvcs.includes(s.name) ? 'checked' : '';
    return `
      <label class="flex items-center justify-between p-2 rounded-xl bg-brand-50 border border-brand-200 text-xs cursor-pointer">
        <div class="flex items-center gap-2">
          <input type="checkbox" value="${s.name}" data-price="${s.price}" class="edit-svc-cb accent-[#8C7355]" ${isChecked}>
          <span class="font-bold">${s.isAddon ? '[加購] ' : ''}${s.name}</span>
        </div>
        <span class="text-brand-500 font-bold font-mono">$${s.price}</span>
      </label>
    `;
  }).join('');

  Swal.fire({
    title: '變更/加購施作項目',
    html: `<div class="text-left space-y-1.5 max-h-60 overflow-y-auto p-1">${checkboxHtml}</div>`,
    showCancelButton: true,
    confirmButtonText: '確定更新',
    confirmButtonColor: '#8C7355',
    preConfirm: () => {
      const selected = Array.from(document.querySelectorAll('.edit-svc-cb:checked'));
      if (selected.length === 0) return Swal.showValidationMessage('請至少勾選一項');
      let total = 0;
      selected.forEach(cb => { total += Number((cb.getAttribute('data-price') || '0').match(/\d+/)?.[0] || 0); });
      return { names: selected.map(cb => cb.value).join(', '), totalPrice: total };
    }
  }).then(async r => {
    if (r.isConfirmed) {
      await directSupabasePatch('bookings', `id=eq.${id}`, { service_names: r.value.names, price: r.value.totalPrice });
      Swal.fire('項目已更新！', `最新金額：NT$ ${r.value.totalPrice}`, 'success');
      fetchDataAndRender();
    }
  });
}

function openRescheduleModal(id, name, oldDate, oldTime) {
  Swal.fire({
    title: `幫 ${name} 改期`,
    html: `
      <input id="resched-date" type="date" class="swal2-input text-xs" style="width:85%;" value="${(oldDate||'').replace(/\//g, '-')}">
      <input id="resched-time" type="time" class="swal2-input text-xs" style="width:85%;" value="${oldTime||'10:00'}">
    `,
    showCancelButton: true,
    confirmButtonText: '確定改期',
    confirmButtonColor: '#8C7355',
    preConfirm: () => ({
      date: document.getElementById('resched-date').value.replace(/-/g, '/'),
      time: document.getElementById('resched-time').value
    })
  }).then(async r => {
    if (r.isConfirmed && r.value.date && r.value.time) {
      const appointmentIso = `${r.value.date.replace(/\//g, '-')}T${r.value.time}:00+08:00`;
      await directSupabasePatch('bookings', `id=eq.${id}`, { appointment_time: appointmentIso });
      Swal.fire('改期成功！', '', 'success');
      fetchDataAndRender();
    }
  });
}

// 10. 後台手動新增預約排程
function toggleQuickBookingFields() {
  const mode = document.querySelector('input[name="quick-booking-mode"]:checked')?.value || 'grooming';
  const groomingBox = document.getElementById('quick-grooming-time-box');
  const hotelBox = document.getElementById('quick-hotel-time-box');
  const hotelGroomingOptions = document.getElementById('quick-hotel-grooming-options');

  if (mode === 'grooming') {
    groomingBox?.classList.remove('hidden');
    hotelBox?.classList.add('hidden');
  } else if (mode === 'hotel') {
    groomingBox?.classList.add('hidden');
    hotelBox?.classList.remove('hidden');
    if (hotelGroomingOptions) hotelGroomingOptions.classList.add('hidden');
  } else if (mode === 'both') {
    groomingBox?.classList.remove('hidden');
    hotelBox?.classList.remove('hidden');
    if (hotelGroomingOptions) hotelGroomingOptions.classList.remove('hidden');
  }
  calcAdminQuickSummary();
}

function renderQuickAddServices() {
  const staffGrid = document.getElementById('admin-quick-staff-grid');
  if (staffGrid) {
    staffGrid.innerHTML = (backendData.settings?.staffList || [{ id: "all", name: "不指定" }]).map((st, idx) => `
      <button type="button" class="admin-staff-btn py-2 px-1 rounded-xl border text-xs font-bold truncate transition ${idx === 0 ? 'bg-[#8C7355] text-white border-[#8C7355]' : 'bg-brand-50/50 border-brand-200 text-brand-800'}" onclick="selectAdminQuickStaff('${st.id}', '${st.name}', this)">
        ${st.name}
      </button>
    `).join('');
  }

  const svcGrid = document.getElementById('admin-quick-service-grid');
  if (svcGrid) {
    svcGrid.innerHTML = (backendData.services || []).map(s => `
      <label class="flex items-center justify-between p-2.5 rounded-xl border border-brand-200 bg-brand-50/50 cursor-pointer text-xs">
        <div class="flex items-center gap-2 truncate">
          <input type="checkbox" value="${s.name}" data-price="${s.price}" onchange="handleAdminQuickServiceChange()" class="accent-[#8C7355] rounded">
          <span class="truncate font-medium">${s.isAddon ? '[加購] ' : ''}${s.name}</span>
        </div>
        <span class="text-brand-500 font-bold shrink-0 ml-1 font-mono">${s.price}元</span>
      </label>
    `).join('');
  }

  const pkgSel = document.getElementById('quick-addon-pkg');
  const walSel = document.getElementById('quick-addon-wal');
  if (pkgSel) {
    pkgSel.innerHTML = '<option value="none" data-price="0">不加購包卡方案</option>' + (backendData.settings?.packageRules || []).map(p => `<option value="${p.name}" data-price="${p.price}">加購【${p.name}】(+NT$ ${p.price})</option>`).join('');
  }
  if (walSel) {
    walSel.innerHTML = '<option value="none" data-price="0">不加購儲值金方案</option>' + (backendData.settings?.walletRules || []).map(w => `<option value="${w.name}" data-price="${w.price}" data-discount="${w.discount}">加購【${w.name}】(+NT$ ${w.price})</option>`).join('');
  }
}

function selectAdminQuickStaff(id, name, el) {
  document.querySelectorAll('.admin-staff-btn').forEach(b => b.className = "admin-staff-btn py-2 px-1 rounded-xl border text-xs font-bold truncate transition bg-brand-50/50 border-brand-200 text-brand-800");
  el.className = "admin-staff-btn py-2 px-1 rounded-xl border text-xs font-bold truncate transition bg-[#8C7355] text-white border-[#8C7355]";
  document.getElementById('quick-staff-id').value = id;
  document.getElementById('quick-staff-name').value = name;
  calcAdminQuickSlots();
}

function handleAdminQuickServiceChange() {
  const checked = Array.from(document.querySelectorAll('#admin-quick-service-grid input:checked'));
  document.getElementById('quick-service-names').value = checked.map(el => el.value).join(', ');
  calcAdminQuickSummary();
  calcAdminQuickSlots();
}

function calcAdminQuickSlots() {
  const dStr = document.getElementById('quick-date')?.value;
  const grid = document.getElementById('admin-quick-slot-grid');
  if (!grid || !dStr) return;

  const times = ["10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];
  grid.innerHTML = times.map(t => `
    <button type="button" class="quick-slot-btn py-1.5 text-center rounded-xl border border-brand-200 bg-white font-bold text-xs hover:border-[#8C7355]" onclick="selectAdminQuickSlot('${t}', this)">
      ${t}
    </button>
  `).join('');
}

function selectAdminQuickSlot(t, el) {
  document.querySelectorAll('.quick-slot-btn').forEach(b => b.className = "quick-slot-btn py-1.5 text-center rounded-xl border border-brand-200 bg-white font-bold text-xs hover:border-[#8C7355]");
  el.className = "quick-slot-btn py-1.5 text-center rounded-xl border border-[#8C7355] bg-[#8C7355] text-white font-bold text-xs shadow-sm";
  document.getElementById('quick-time').value = t;
}

function handleAdminQuickDeductChange(type) {
  const usePkg = document.getElementById('quick-use-pkg');
  const useWal = document.getElementById('quick-use-wal');
  if (type === 'package' && usePkg.checked) useWal.checked = false;
  if (type === 'wallet' && useWal.checked) usePkg.checked = false;
  calcAdminQuickSummary();
}

function calcAdminQuickSummary() {
  const checked = Array.from(document.querySelectorAll('#admin-quick-service-grid input:checked'));
  let basePrice = 0;
  checked.forEach(cb => {
    const num = (cb.getAttribute('data-price') || '0').match(/\d+/);
    basePrice += num ? Number(num[0]) : 0;
  });

  const pkgSel = document.getElementById('quick-addon-pkg');
  const walSel = document.getElementById('quick-addon-wal');
  const addonPkgPrice = Number(pkgSel?.options[pkgSel.selectedIndex]?.getAttribute('data-price') || 0);
  const addonWalPrice = Number(walSel?.options[walSel.selectedIndex]?.getAttribute('data-price') || 0);
  const totalAddon = addonPkgPrice + addonWalPrice;

  const usePkg = document.getElementById('quick-use-pkg')?.checked;
  const useWal = document.getElementById('quick-use-wal')?.checked;

  let deductPrice = 0;
  if (usePkg && basePrice > 0) deductPrice = basePrice;
  else if (useWal && basePrice > 0) deductPrice = Math.round(basePrice * 0.1);

  let finalPrice = Math.max(0, basePrice - deductPrice) + totalAddon;
  document.getElementById('quick-disp-base').innerText = `$${basePrice}`;
  document.getElementById('quick-disp-deduct').innerText = `-$${deductPrice}`;
  document.getElementById('quick-disp-addon').innerText = `+$${totalAddon}`;
  document.getElementById('admin-quick-total-price').innerText = finalPrice.toLocaleString();
  document.getElementById('quick-final-price').value = finalPrice;
}

async function adminQuickCheckCustomer(phoneVal) {
  const phone = phoneVal.trim();
  const hint = document.getElementById('admin-quick-member-hint');
  if (phone.length >= 8) {
    const [bookings, custs] = await Promise.all([
      directSupabaseFetch(`bookings?store_id=eq.${CURRENT_STORE_ID}&customer_phone=eq.${phone}&order=created_at.desc&limit=1&select=*`),
      directSupabaseFetch(`customers?store_id=eq.${CURRENT_STORE_ID}&phone=eq.${phone}`)
    ]);
    if (bookings && bookings.length > 0) {
      document.getElementById('quick-name').value = bookings[0].customer_name || '';
      if (bookings[0].line_name) document.getElementById('quick-line').value = bookings[0].line_name;
      hint.innerText = `✓ 已帶入舊客檔案：${bookings[0].customer_name}`;
    } else if (custs && custs.length > 0) {
      document.getElementById('quick-name').value = custs[0].name || '';
      hint.innerText = `✓ 已帶入會員檔案：${custs[0].name} (餘額 $${custs[0].wallet_balance || 0})`;
    } else {
      hint.innerText = `此號碼為新朋友`;
    }
  }
}

async function submitAdminQuickBooking() {
  const phone = document.getElementById('quick-phone').value.trim();
  const name = document.getElementById('quick-name').value.trim();
  const petName = document.getElementById('quick-pet-name')?.value.trim() || '';
  const email = document.getElementById('quick-email')?.value.trim() || '';
  const service = document.getElementById('quick-service-names').value.trim();
  const finalPrice = Number(document.getElementById('quick-final-price').value || 0);
  const mode = document.querySelector('input[name="quick-booking-mode"]:checked')?.value || 'grooming';
  
  if (!phone || !name) {
    return Swal.fire('請填寫顧客姓名與手機號碼', '', 'warning');
  }

  let bookingDate = document.getElementById('quick-date')?.value;
  let bookingTime = document.getElementById('quick-time')?.value || '10:00';
  let stayLog = [];

  if (mode === 'hotel' || mode === 'both') {
    const inDate = document.getElementById('quick-hotel-checkin-date')?.value;
    const inTime = document.getElementById('quick-hotel-checkin-time')?.value;
    const outDate = document.getElementById('quick-hotel-checkout-date')?.value;
    const outTime = document.getElementById('quick-hotel-checkout-time')?.value;

    if (!inDate || !outDate) {
      return Swal.fire('請完整填寫入住與退房日期', '', 'warning');
    }

    bookingDate = inDate;
    bookingTime = inTime;
    stayLog.push(`【住宿: ${inDate} ${inTime} 入住 至 ${outDate} ${outTime} 退宿】`);

    if (mode === 'both') {
      const bathIn = document.getElementById('quick-bath-checkin')?.checked;
      const bathOut = document.getElementById('quick-bath-checkout')?.checked;
      if (bathIn) stayLog.push('【排程: 入住前洗護】');
      if (bathOut) stayLog.push('【排程: 退房前美容/洗澡】');
    }
  }

  if (!bookingDate) {
    return Swal.fire('請設定預約日期', '', 'warning');
  }

  const petSize = document.getElementById('quick-pet-size')?.value || '小型犬';
  const selfFood = document.getElementById('quick-pet-food')?.value === 'true' ? '家長自備食料' : '店內鮮食供餐';
  if (petName) {
    stayLog.push(`【毛孩: ${petName} (${petSize}, ${selfFood})】`);
  }

  const userNotes = document.getElementById('quick-notes')?.value.trim() || '';
  let finalNotesArray = [];
  if (userNotes) finalNotesArray.push(userNotes);
  if (stayLog.length > 0) finalNotesArray.push(stayLog.join(' '));
  if (email) finalNotesArray.push(`Email: ${email}`);

  Swal.showLoading();

  const payload = {
    store_id: CURRENT_STORE_ID,
    customer_name: name,
    customer_phone: phone,
    customer_type: 'old',
    service_names: service || (mode === 'hotel' ? '寵物度假住宿' : '寵物精緻美容洗護'),
    price: finalPrice,
    final_price: finalPrice,
    appointment_time: `${bookingDate}T${bookingTime}:00+08:00`,
    staff_id: document.getElementById('quick-staff-id')?.value || 'all',
    staff_name: document.getElementById('quick-staff-name')?.value || '不指定',
    notes: finalNotesArray.join(' | '),
    status: '已確認'
  };

  try {
    const res = await directSupabaseUpsert('bookings', payload, 'id');
    const newBookingId = (res && res[0]) ? res[0].id : null;

    Swal.fire({
      title: '預約排程已建立成功！',
      text: '是否直接讓顧客於現場親筆手寫簽署定型化合約？',
      icon: 'success',
      showCancelButton: true,
      confirmButtonText: '立即現場手寫簽約',
      cancelButtonText: '稍後再簽',
      confirmButtonColor: '#8C7355'
    }).then(r => {
      fetchDataAndRender();
      switchPage('customer', document.querySelectorAll('.nav-item')[3]);
      if (r.isConfirmed && newBookingId) {
        openLiveSignaturePad(newBookingId, name);
      }
    });
  } catch(e) {
    Swal.fire('建立預約失敗', e.message, 'error');
  }
}

// 11. 業績統計篩選下拉
function renderRevenueSelect() {
  const sel = document.getElementById('rev-service-select');
  if (!sel) return;
  sel.innerHTML = '<option value="ALL">全部服務項目總覽</option>' + 
    (backendData.services || []).map(s => `<option value="${s.name}">${s.name}</option>`).join('');
}

// 12. 業績明細與結構化抵扣分析
function renderRevenue() {
  const selectedSvc = document.getElementById('rev-service-select')?.value || 'ALL';
  const selectedMethod = document.getElementById('rev-method-filter')?.value || 'ALL';
  const timeFilter = document.getElementById('rev-time-filter')?.value || 'THIS_MONTH';
  const listArea = document.getElementById('rev-list-area');
  const unpaidListArea = document.getElementById('rev-unpaid-list');
  
  const appts = backendData.appointments || [];
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0');

  const sD = document.getElementById('rev-start-date')?.value?.replace(/-/g, '/');
  const eD = document.getElementById('rev-end-date')?.value?.replace(/-/g, '/');

  let filtered = appts;
  if (sD && eD) {
    filtered = filtered.filter(a => a.date >= sD && a.date <= eD);
  } else if (timeFilter === 'THIS_MONTH') {
    const ym = `${currentYear}/${currentMonth}`;
    filtered = filtered.filter(a => a.date && a.date.startsWith(ym));
  } else if (timeFilter === 'LAST_MONTH') {
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevYm = `${prevDate.getFullYear()}/${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    filtered = filtered.filter(a => a.date && a.date.startsWith(prevYm));
  }

  if (selectedSvc !== 'ALL') {
    filtered = filtered.filter(a => (a.service || '').includes(selectedSvc));
  }

  if (selectedMethod === 'PACKAGE') {
    filtered = filtered.filter(a => (a.notes || '').includes('包卡') || (a.notes || '').includes('扣點'));
  } else if (selectedMethod === 'WALLET') {
    filtered = filtered.filter(a => (a.notes || '').includes('儲值'));
  } else if (selectedMethod === 'COUPON') {
    filtered = filtered.filter(a => (a.notes || '').includes('折扣碼'));
  } else if (selectedMethod === 'ADDON') {
    filtered = filtered.filter(a => (a.notes || '').includes('加購'));
  }

  let paidTotal = 0;
  let totalOriginal = 0;
  let totalDiscount = 0;
  let completedCount = 0;
  let returningRevenue = 0;
  let paidListHtml = '';
  let unpaidListHtml = '';

  filtered.forEach(a => {
    const origPrice = Number(a.price || 0);
    const finalAmt = Number(a.finalPrice !== undefined && a.finalPrice !== null ? a.finalPrice : origPrice);
    const discountAmt = Math.max(0, origPrice - finalAmt);
    const notes = a.notes || '';

    let detailLines = [];
    if (notes.includes('加購')) {
      const match = notes.match(/加購[：:\s]*([^\s|]+)/);
      detailLines.push(`<div class="text-amber-800 font-bold"><i class="fa-solid fa-cart-plus mr-1 text-amber-600"></i>現場加購：${match ? match[1] : '加購方案/外帶品'}</div>`);
    }
    if (notes.includes('包卡') || notes.includes('扣點')) {
      detailLines.push(`<div class="text-blue-700 font-bold"><i class="fa-solid fa-ticket mr-1 text-blue-500"></i>包卡點數抵扣：折抵主服務 (扣 1 點/堂)</div>`);
    }
    if (notes.includes('儲值')) {
      detailLines.push(`<div class="text-purple-700 font-bold"><i class="fa-solid fa-wallet mr-1 text-purple-500"></i>儲值餘額支付：享專屬會員折扣扣抵</div>`);
    }
    if (notes.includes('折扣碼')) {
      const cMatch = notes.match(/折扣碼[:\s]*([A-Za-z0-9]+)/);
      detailLines.push(`<div class="text-rose-600 font-bold"><i class="fa-solid fa-tag mr-1 text-rose-500"></i>促銷代碼折抵：已套用代碼 ${cMatch ? cMatch[1] : ''}</div>`);
    }
    if (a.deposit_deducted > 0) {
      detailLines.push(`<div class="text-amber-700 font-bold"><i class="fa-solid fa-money-bill mr-1 text-amber-600"></i>線下定額訂金抵扣：-$${a.deposit_deducted}</div>`);
    }

    const detailBlockHtml = detailLines.length > 0 
      ? `<div class="mt-1.5 space-y-0.5 text-[10.5px] bg-brand-50/90 p-2 rounded-xl border border-brand-100">${detailLines.join('')}</div>`
      : '';

    if (a.status === '已結單') {
      paidTotal += finalAmt;
      totalOriginal += origPrice;
      totalDiscount += discountAmt;
      completedCount++;
      if (a.customer_type === 'old') returningRevenue += finalAmt;

      paidListHtml += `
        <div class="py-3 px-2 border-b border-brand-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 hover:bg-brand-50/40 transition">
          <div class="space-y-1">
            <div class="font-bold text-brand-900 text-xs flex items-center gap-1.5">
              <span class="font-mono text-gray-500">${a.date}</span>
              <span class="text-sm font-bold text-brand-900">${a.name}</span>
              <span class="text-[10px] px-1.5 py-0.2 bg-brand-100 rounded text-brand-700 font-medium">${a.customer_type === 'new' ? '新客' : '熟客'}</span>
              <span class="text-[10px] px-1.5 py-0.2 bg-gray-100 rounded text-gray-600 font-mono">${a.staffName || '不指定'}</span>
            </div>
            <div class="text-[11px] text-brand-600">施作項目：<b>${a.service}</b></div>
            ${detailBlockHtml}
          </div>
          <div class="text-right shrink-0">
            <div class="font-black text-emerald-800 text-sm font-mono">實收 NT$ ${finalAmt.toLocaleString()}</div>
            <div class="text-[10px] text-gray-400 font-mono space-x-1">
              <span>基準原價 $${origPrice}</span>
              ${discountAmt > 0 ? `<span class="text-rose-500 font-bold">(-$${discountAmt})</span>` : ''}
            </div>
          </div>
        </div>`;
    } else if (a.status === '已確認') {
      unpaidListHtml += `
        <div class="p-3 bg-amber-50 rounded-2xl border border-amber-200 flex justify-between items-center text-xs shadow-2xs">
          <div>
            <div class="font-bold text-amber-950">${a.date} - ${a.name} (${a.staffName || '不指定'})</div>
            <div class="text-[11px] text-amber-800">預估施作：${a.service} (原價預估: $${origPrice})</div>
            ${detailBlockHtml}
          </div>
          <button class="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs shadow-xs transition" onclick="openCheckoutModal('${a.id}', '${a.name}', '${a.phone}', '${a.service}', ${origPrice})">結單對帳</button>
        </div>`;
    }
  });

  document.getElementById('rev-total-amount').innerText = `${paidTotal.toLocaleString()}元`;
  const avgTicket = completedCount > 0 ? Math.round(paidTotal / completedCount) : 0;
  document.getElementById('metric-avg-ticket').innerText = `${avgTicket.toLocaleString()}元`;
  const returningRatio = paidTotal > 0 ? Math.round((returningRevenue / paidTotal) * 100) : 0;
  document.getElementById('metric-returning-ratio').innerText = `${returningRatio}%`;
  const cancelRatio = appts.length > 0 ? Math.round((appts.filter(r => r.status === '已取消' || r.status === '婉拒').length / appts.length) * 100) : 0;
  document.getElementById('metric-cancel-ratio').innerText = `${cancelRatio}%`;

  if (listArea) {
    listArea.innerHTML = paidListHtml ? `
      <div class="mb-2 p-2.5 bg-brand-50 rounded-xl text-[11px] font-bold text-brand-800 flex justify-between">
        <span>已結單 ${completedCount} 筆</span>
        <span class="font-mono">總原價：$${totalOriginal.toLocaleString()} | 總折抵：-$${totalDiscount.toLocaleString()} | 實收總計：$${paidTotal.toLocaleString()}</span>
      </div>
      ${paidListHtml}
    ` : '<div class="text-center text-xs text-brand-400 py-6">查無符合條件之結單紀錄</div>';
  }
  if (unpaidListArea) {
    unpaidListArea.innerHTML = unpaidListHtml || '<div class="text-center text-xs text-brand-400 py-2">目前無待結單項目</div>';
  }

  const isCalcEnabled = backendData.settings?.enableCommissionCalc !== false;
  const commSection = document.getElementById('staff-revenue-section');
  if (commSection) commSection.style.display = isCalcEnabled ? 'block' : 'none';

  if (isCalcEnabled) {
    const staffStats = {};
    filtered.filter(r => r.status === '已結單').forEach(a => {
      const sName = a.staffName || '不指定';
      if (!staffStats[sName]) staffStats[sName] = { count: 0, designatedCount: 0, hours: 0, revenue: 0 };
      staffStats[sName].count++;
      if (a.staffName && a.staffName !== '不指定') staffStats[sName].designatedCount++;
      staffStats[sName].hours += 1;
      staffStats[sName].revenue += Number(a.finalPrice !== null && a.finalPrice !== undefined ? a.finalPrice : (a.price || 0));
    });

    const rate = Number(backendData.settings?.commissionRate ?? 50);
    const designatedBonusPerCust = Number(backendData.settings?.designatedBonus ?? 50);
    const tbody = document.getElementById('staff-commission-tbody');
    if (tbody) {
      tbody.innerHTML = Object.keys(staffStats).map(sName => {
        const st = staffStats[sName];
        const comm = Math.round(st.revenue * (rate / 100));
        const designatedBonus = st.designatedCount * designatedBonusPerCust;
        const totalSalary = comm + designatedBonus;
        return `
          <tr class="hover:bg-brand-50/50 border-b border-brand-100">
            <td class="py-2.5 px-2 font-bold">${sName}</td>
            <td class="py-2.5 px-2 font-mono">${st.count} 人 (指定 ${st.designatedCount})</td>
            <td class="py-2.5 px-2 font-mono">${st.hours} hr</td>
            <td class="py-2.5 px-2 font-mono">NT$ ${st.revenue.toLocaleString()}</td>
            <td class="py-2.5 px-2 font-mono font-bold">${rate}%</td>
            <td class="py-2.5 px-2 font-mono text-emerald-700">+NT$ ${designatedBonus}</td>
            <td class="py-2.5 px-2 text-right font-black text-[#8C7355] font-mono">NT$ ${totalSalary.toLocaleString()}</td>
          </tr>
        `;
      }).join('') || '<tr><td colspan="7" class="text-center py-4 text-brand-400">尚無專員結單數據</td></tr>';
    }
  }
}

// 13. 回訪關懷文案渲染
function renderCare() {
  const list = document.getElementById('care-list');
  if (!list) return;
  const rules = backendData.settings?.careRules || DEFAULT_CARE_RULES;
  const appts = backendData.appointments || [];
  const now = Date.now();

  let reminders = [];
  appts.forEach(a => {
    if (a.status !== '已結單') return;
    const apptTime = new Date(`${a.date.replace(/\//g, '-')}T00:00:00`).getTime();
    const diffWeeks = Math.floor((now - apptTime) / (1000 * 60 * 60 * 24 * 7));

    rules.forEach(r => {
      const keywords = r.name.split(/[,，]/).map(k => k.trim());
      if (keywords.some(kw => (a.service || '').includes(kw)) && diffWeeks >= Number(r.weeks)) {
        const msg = (r.msg || '').replace(/\{姓名\}/g, a.name).replace(/\{項目\}/g, a.service);
        reminders.push({ name: a.name, phone: a.phone, service: a.service, lastDate: a.date, diffWeeks, msg });
      }
    });
  });

  if (reminders.length === 0) {
    reminders = [{ name: "王小美", phone: "0912345678", service: "日系質感染髮", lastDate: "2026/08/01", diffWeeks: 4, msg: "嗨 王小美～距離上次做『日系質感染髮』已經滿4週囉！髮色維持得還好嗎？隨時歡迎預約回娘家護理唷❤️" }];
  }

  list.innerHTML = reminders.map(r => `
    <div class="p-3.5 bg-white rounded-2xl border border-brand-200 text-xs space-y-2">
      <div class="flex justify-between font-bold text-brand-900">
        <span>${r.name} (${r.phone})</span>
        <span class="text-[#8C7355] font-mono">${r.diffWeeks} 週前消費</span>
      </div>
      <div class="text-[11px] text-brand-500">上次施作：${r.service} (${r.lastDate})</div>
      <div class="p-2.5 bg-brand-50 rounded-xl text-brand-800 leading-relaxed font-sans">${r.msg}</div>
      <button class="w-full py-2 bg-[#8C7355] hover:bg-[#7A6246] text-white rounded-xl font-bold transition" onclick="navigator.clipboard.writeText(\`${r.msg}\`); Swal.fire('已複製關懷文案！', '', 'success')">
        <i class="fa-regular fa-copy mr-1"></i> 複製專屬關懷文案貼給客人
      </button>
    </div>
  `).join('');

  populateCareRulesUI();
}

function populateCareRulesUI() {
  const container = document.getElementById('care-rules-container');
  if (!container) return;
  const rules = backendData.settings?.careRules || DEFAULT_CARE_RULES;
  container.innerHTML = rules.slice(0, 5).map((r, i) => `
    <div class="p-3 bg-white rounded-2xl border border-brand-200 space-y-2 mb-2">
      <div class="flex gap-2">
        <input type="text" class="w-3/4 p-2 rounded-xl border border-brand-200 rule-name text-xs" value="${r.name}" placeholder="關鍵字 (逗號分隔)">
        <input type="number" class="w-1/4 p-2 rounded-xl border border-brand-200 rule-weeks text-xs text-center font-bold font-mono" value="${r.weeks}">
      </div>
      <textarea class="w-full p-2 rounded-xl border border-brand-200 rule-msg text-xs leading-relaxed" rows="2">${r.msg}</textarea>
    </div>
  `).join('');
}

async function saveCareRulesSetting() {
  const names = document.querySelectorAll('.rule-name');
  const weeks = document.querySelectorAll('.rule-weeks');
  const msgs = document.querySelectorAll('.rule-msg');
  const careRulesArray = [];
  names.forEach((el, i) => {
    if (el.value.trim()) {
      careRulesArray.push({ name: el.value.trim(), weeks: Number(weeks[i].value || 4), msg: msgs[i].value.trim() });
    }
  });
  await directSupabasePatch('store_settings', `store_id=eq.${CURRENT_STORE_ID}`, { care_rules: careRulesArray });
  backendData.settings.careRules = careRulesArray;
  renderCare();
  Swal.fire('關懷規則已儲存！', '', 'success');
}

// 14. 行銷中心與規則庫
async function loadMarketingCenter() {
  allWalletList = await directSupabaseFetch(`customers?store_id=eq.${CURRENT_STORE_ID}&order=wallet_balance.desc`);
  filteredWalletList = [...allWalletList];
  renderWalletTable();

  allPkgList = await directSupabaseFetch(`customer_packages?store_id=eq.${CURRENT_STORE_ID}&order=remaining_times.desc`);
  filteredPkgList = [...allPkgList];
  renderPkgTable();

  renderPlanRules();
  loadCoupons();
}

function renderPlanRules() {
  const wContainer = document.getElementById('wallet-rules-container');
  const pContainer = document.getElementById('package-rules-container');
  const s = backendData.settings || {};

  if (wContainer) {
    wContainer.innerHTML = (s.walletRules || []).map((w, idx) => `
      <div class="p-3 bg-brand-50 rounded-2xl border border-brand-200 flex justify-between items-center text-xs">
        <div>
          <div class="font-bold text-brand-900">${w.name}</div>
          <div class="text-[11px] text-brand-500">本金 $${w.price} | 贈 $${w.bonus || 0} | 享 ${Math.round((w.discount || 1) * 100) / 10} 折</div>
        </div>
        <button onclick="deleteWalletRule(${idx})" class="text-rose-500 hover:text-rose-700 font-bold p-1"><i class="fa-solid fa-trash-can"></i></button>
      </div>
    `).join('') || '<div class="col-span-full text-center py-3 text-brand-400 text-xs">尚無儲值方案</div>';
  }

  if (pContainer) {
    pContainer.innerHTML = (s.packageRules || []).map((p, idx) => `
      <div class="p-3 bg-brand-50 rounded-2xl border border-brand-200 flex justify-between items-center text-xs">
        <div>
          <div class="font-bold text-brand-900">${p.name}</div>
          <div class="text-[11px] text-brand-500">項目：${p.service_name} | 總點數：${p.times} 點 | 售價 $${p.price}</div>
        </div>
        <button onclick="deletePackageRule(${idx})" class="text-rose-500 hover:text-rose-700 font-bold p-1"><i class="fa-solid fa-trash-can"></i></button>
      </div>
    `).join('') || '<div class="col-span-full text-center py-3 text-brand-400 text-xs">尚無包卡方案</div>';
  }
}

function openAddPackageRuleModal() {
  const svcs = backendData.services || [];
  let opts = svcs.map(s => `<option value="${s.name}">${s.name}</option>`).join('');
  Swal.fire({
    title: '新增門市通用包卡方案',
    html: `
      <div class="text-left text-xs space-y-2">
        <div><label class="font-bold">方案名稱：</label><input id="prule-name" class="swal2-input text-xs" placeholder="例: 尊榮美髮暢遊卡"></div>
        <div><label class="font-bold">綁定對應項目：</label><select id="prule-service" class="swal2-input text-xs">${opts}</select></div>
        <div class="grid grid-cols-2 gap-2">
          <div><label class="font-bold">方案總點數：</label><input id="prule-times" type="number" class="swal2-input text-xs" value="10"></div>
          <div><label class="font-bold">單次扣除點數：</label><input id="prule-points" type="number" class="swal2-input text-xs" value="1"></div>
        </div>
        <div><label class="font-bold">方案販售總價格：</label><input id="prule-price" type="number" class="swal2-input text-xs" placeholder="例: 5000"></div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: '確定建立',
    confirmButtonColor: '#8C7355',
    preConfirm: () => ({
      name: document.getElementById('prule-name').value.trim(),
      service_name: document.getElementById('prule-service').value,
      times: Number(document.getElementById('prule-times').value || 10),
      deduct_points: Number(document.getElementById('prule-points').value || 1),
      price: Number(document.getElementById('prule-price').value || 0)
    })
  }).then(async r => {
    if (r.isConfirmed && r.value.name) {
      const list = backendData.settings.packageRules || [];
      list.push(r.value);
      await directSupabasePatch('store_settings', `store_id=eq.${CURRENT_STORE_ID}`, { package_rules: list });
      backendData.settings.packageRules = list;
      renderPlanRules();
      Swal.fire('方案已建立！', '', 'success');
    }
  });
}

async function deletePackageRule(idx) {
  backendData.settings.packageRules.splice(idx, 1);
  await directSupabasePatch('store_settings', `store_id=eq.${CURRENT_STORE_ID}`, { package_rules: backendData.settings.packageRules });
  renderPlanRules();
}

function openAddWalletRuleModal() {
  Swal.fire({
    title: '新增門市儲值金方案',
    html: `
      <div class="text-left text-xs space-y-2">
        <div><label class="font-bold">方案名稱：</label><input id="wrule-name" class="swal2-input text-xs" placeholder="例：儲值 $5,000 享 85 折"></div>
        <div><label class="font-bold">儲值本金：</label><input id="wrule-price" type="number" class="swal2-input text-xs" placeholder="例：5000"></div>
        <div><label class="font-bold">加贈紅利金：</label><input id="wrule-bonus" type="number" class="swal2-input text-xs" placeholder="例：600" value="0"></div>
        <div><label class="font-bold">整單折數：</label><input id="wrule-discount" type="number" step="0.05" class="swal2-input text-xs" value="0.85"></div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: '確定建立',
    confirmButtonColor: '#8C7355',
    preConfirm: () => ({
      name: document.getElementById('wrule-name').value.trim(),
      price: Number(document.getElementById('wrule-price').value || 0),
      bonus: Number(document.getElementById('wrule-bonus').value || 0),
      discount: Number(document.getElementById('wrule-discount').value || 1)
    })
  }).then(async r => {
    if (r.isConfirmed && r.value.name) {
      const list = backendData.settings.walletRules || [];
      list.push(r.value);
      await directSupabasePatch('store_settings', `store_id=eq.${CURRENT_STORE_ID}`, { wallet_rules: list });
      backendData.settings.walletRules = list;
      renderPlanRules();
      Swal.fire('儲值方案已建立！', '', 'success');
    }
  });
}

async function deleteWalletRule(idx) {
  backendData.settings.walletRules.splice(idx, 1);
  await directSupabasePatch('store_settings', `store_id=eq.${CURRENT_STORE_ID}`, { wallet_rules: backendData.settings.walletRules });
  renderPlanRules();
}

function handleWalletSearch(kw) {
  const q = kw.trim().toLowerCase();
  filteredWalletList = allWalletList.filter(c => (c.name && c.name.toLowerCase().includes(q)) || (c.phone && c.phone.includes(q)));
  renderWalletTable();
}

function renderWalletTable() {
  const tbody = document.getElementById('wallet-table-body');
  if (!tbody) return;
  tbody.innerHTML = filteredWalletList.map(c => `
    <tr class="border-b border-brand-100 hover:bg-brand-50/50">
      <td class="py-2.5 px-2 font-bold">${c.name || '熟客'}</td>
      <td class="py-2.5 px-2 font-mono">${c.phone}</td>
      <td class="py-2.5 px-2 font-black text-brand-600 font-mono">NT$ ${c.wallet_balance || 0}</td>
      <td class="py-2.5 px-2">${c.member_discount ? `${c.member_discount * 10} 折` : '無折數'}</td>
      <td class="py-2.5 px-2 text-right">
        <button onclick="quickTopUp('${c.id}', '${c.name}', ${c.wallet_balance})" class="px-2.5 py-1 bg-brand-100 hover:bg-brand-200 text-brand-800 rounded-lg font-bold">充值</button>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="5" class="text-center py-6 text-brand-400">尚無儲值會員紀錄</td></tr>';
}

function openRechargeModal() {
  Swal.fire({
    title: '手動為顧客儲值充值',
    html: `
      <div class="text-left text-xs space-y-2">
        <div><label class="font-bold">手機號碼：</label><input id="rc-phone" class="swal2-input text-xs" placeholder="例如：0912345678"></div>
        <div><label class="font-bold">顧客姓名：</label><input id="rc-name" class="swal2-input text-xs" placeholder="例如：王小美"></div>
        <div><label class="font-bold">儲值本金 (NT$)：</label><input id="rc-amount" type="number" class="swal2-input text-xs" placeholder="如 3000"></div>
        <div><label class="font-bold">加贈金 (選填)：</label><input id="rc-bonus" type="number" class="swal2-input text-xs" value="0"></div>
        <div><label class="font-bold">整單折數 (如 0.9 代表 9折)：</label><input id="rc-discount" type="number" step="0.05" class="swal2-input text-xs" value="1"></div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: '確認儲值',
    confirmButtonColor: '#8C7355',
    preConfirm: () => ({
      phone: document.getElementById('rc-phone').value.trim(),
      name: document.getElementById('rc-name').value.trim(),
      amount: Number(document.getElementById('rc-amount').value || 0),
      bonus: Number(document.getElementById('rc-bonus').value || 0),
      discount: Number(document.getElementById('rc-discount').value || 1)
    })
  }).then(async r => {
    if (r.isConfirmed && r.value.phone) {
      const totalAdd = r.value.amount + r.value.bonus;
      const exists = await directSupabaseFetch(`customers?store_id=eq.${CURRENT_STORE_ID}&phone=eq.${r.value.phone}`);
      if (exists && exists.length > 0) {
        const newBal = Number(exists[0].wallet_balance || 0) + totalAdd;
        await directSupabasePatch('customers', `id=eq.${exists[0].id}`, { wallet_balance: newBal, member_discount: r.value.discount });
      } else {
        await directSupabaseUpsert('customers', {
          store_id: CURRENT_STORE_ID, name: r.value.name, phone: r.value.phone,
          wallet_balance: totalAdd, member_discount: r.value.discount
        }, 'id');
      }
      Swal.fire('儲值入帳成功！', `增加 NT$ ${totalAdd}`, 'success');
      loadMarketingCenter();
    }
  });
}

async function quickTopUp(id, name, curBal) {
  Swal.fire({
    title: `為 ${name} 快速充值`,
    input: 'number',
    inputPlaceholder: '輸入本次充值金額',
    showCancelButton: true,
    confirmButtonText: '確認入帳',
    confirmButtonColor: '#8C7355'
  }).then(async r => {
    if (r.isConfirmed && r.value) {
      const newBal = Number(curBal) + Number(r.value);
      await directSupabasePatch('customers', `id=eq.${id}`, { wallet_balance: newBal });
      Swal.fire('充值成功！', `最新餘額：NT$ ${newBal}`, 'success');
      loadMarketingCenter();
    }
  });
}

function handlePkgSearch(kw) {
  const q = kw.trim().toLowerCase();
  filteredPkgList = allPkgList.filter(p => (p.customer_name && p.customer_name.toLowerCase().includes(q)) || (p.phone && p.phone.includes(q)) || (p.service_name && p.service_name.toLowerCase().includes(q)));
  renderPkgTable();
}

function renderPkgTable() {
  const tbody = document.getElementById('packages-table-body');
  if (!tbody) return;
  tbody.innerHTML = filteredPkgList.map(p => `
    <tr class="border-b border-brand-100 hover:bg-brand-50/50">
      <td class="py-2.5 px-2 font-bold">${p.customer_name || '熟客'} (${p.phone})</td>
      <td class="py-2.5 px-2">${p.service_name}</td>
      <td class="py-2.5 px-2 font-mono">${p.total_times} 點</td>
      <td class="py-2.5 px-2 font-black text-emerald-700 font-mono">${p.remaining_times} 點</td>
      <td class="py-2.5 px-2 text-right">
        <button onclick="deductPackageManual('${p.id}', ${p.remaining_times})" class="px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg font-bold">- 扣 1 點</button>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="5" class="text-center py-6 text-brand-400">尚無包卡點數紀錄</td></tr>';
}

function openAddPackageModal() {
  const svcs = backendData.services || [];
  let opts = svcs.map(s => `<option value="${s.name}">${s.name}</option>`).join('');
  Swal.fire({
    title: '為顧客綁定包卡點數',
    html: `
      <div class="text-left text-xs space-y-2">
        <div><label class="font-bold">顧客手機：</label><input id="pkg-phone" class="swal2-input text-xs" placeholder="例如：0912345678"></div>
        <div><label class="font-bold">顧客姓名：</label><input id="pkg-name" class="swal2-input text-xs" placeholder="例如：王小美"></div>
        <div><label class="font-bold">對應項目：</label><select id="pkg-service" class="swal2-input text-xs">${opts}</select></div>
        <div><label class="font-bold">總點數 (堂數)：</label><input id="pkg-times" type="number" class="swal2-input text-xs" value="10"></div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: '確定綁定',
    confirmButtonColor: '#8C7355',
    preConfirm: () => ({
      phone: document.getElementById('pkg-phone').value.trim(),
      name: document.getElementById('pkg-name').value.trim(),
      service: document.getElementById('pkg-service').value,
      times: Number(document.getElementById('pkg-times').value || 10)
    })
  }).then(async r => {
    if (r.isConfirmed && r.value.phone) {
      await directSupabaseUpsert('customer_packages', {
        store_id: CURRENT_STORE_ID,
        customer_name: r.value.name,
        phone: r.value.phone,
        service_name: r.value.service,
        total_times: r.value.times,
        remaining_times: r.value.times
      }, 'id');
      Swal.fire('包卡綁定成功！', '', 'success');
      loadMarketingCenter();
    }
  });
}

async function deductPackageManual(id, rem) {
  if (rem <= 0) return Swal.fire('點數已用罄', '', 'warning');
  await directSupabasePatch('customer_packages', `id=eq.${id}`, { remaining_times: rem - 1 });
  Swal.fire('核銷成功！', `剩餘 ${rem - 1} 點`, 'success');
  loadMarketingCenter();
}

async function loadCoupons() {
  const coupons = await directSupabaseFetch(`coupons?store_id=eq.${CURRENT_STORE_ID}`);
  const couponContainer = document.getElementById('coupons-card-container');
  if (couponContainer) {
    couponContainer.innerHTML = (!coupons || coupons.length === 0) 
      ? '<div class="col-span-full text-center py-4 text-brand-400 text-xs">目前無啟用中的折扣碼</div>'
      : coupons.map(cp => `
        <div class="p-3 bg-brand-50 rounded-2xl border border-brand-200 flex justify-between items-center text-xs">
          <div>
            <div class="font-bold text-brand-900 font-mono tracking-wider">${cp.code}</div>
            <div class="text-[11px] text-brand-500">${cp.discount_type === 'cash' ? `現折 NT$ ${cp.discount_value}` : `整單享 ${cp.discount_value * 10} 折`}</div>
          </div>
          <button onclick="toggleCouponStatus('${cp.id}', ${!cp.is_active})" class="px-3 py-1 rounded-xl text-xs font-bold transition ${cp.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-600'}">
            ${cp.is_active ? '啟用中' : '已停用'}
          </button>
        </div>
      `).join('');
  }
}

async function toggleCouponStatus(id, toActive) {
  await directSupabasePatch('coupons', `id=eq.${id}`, { is_active: toActive });
  loadCoupons();
}

function openAddCouponModal() {
  Swal.fire({
    title: '新增促銷折扣碼',
    html: `
      <div class="text-left text-xs space-y-2">
        <div><label class="font-bold">折扣代碼：</label><input id="cp-code" class="swal2-input text-xs uppercase" placeholder="例如：SPRING100"></div>
        <div><label class="font-bold">折扣類型：</label>
          <select id="cp-type" class="swal2-input text-xs">
            <option value="cash">現折指定金額 (元)</option>
            <option value="percent">整單比例打折 (如 0.85 代表 85折)</option>
          </select>
        </div>
        <div><label class="font-bold">折抵數值：</label><input id="cp-val" type="number" step="0.05" class="swal2-input text-xs" placeholder="如 100 或 0.9"></div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: '確定新增',
    confirmButtonColor: '#8C7355',
    preConfirm: () => ({
      code: document.getElementById('cp-code').value.trim().toUpperCase(),
      type: document.getElementById('cp-type').value,
      val: Number(document.getElementById('cp-val').value || 0)
    })
  }).then(async r => {
    if (r.isConfirmed && r.value.code) {
      await directSupabaseUpsert('coupons', {
        store_id: CURRENT_STORE_ID,
        code: r.value.code,
        discount_type: r.value.type,
        discount_value: r.value.val,
        is_active: true
      }, 'id');
      Swal.fire('折扣碼已建立！', '', 'success');
      loadCoupons();
    }
  });
}

async function savePromoRulesText() {
  const val = document.getElementById('cfg-promo-rules-input').value.trim();
  await directSupabasePatch('store_settings', `store_id=eq.${CURRENT_STORE_ID}`, { promo_rules_text: val });
  Swal.fire('說明內容已儲存！', '', 'success');
}

// 15. 好評審核與標籤
async function loadAdminReviews() {
  const reviews = await directSupabaseFetch(`customer_reviews?store_id=eq.${CURRENT_STORE_ID}&order=created_at.desc`);
  document.getElementById('review-count-badge').innerText = `共 ${reviews.length} 則評價`;
  const container = document.getElementById('admin-reviews-container');
  if (!reviews || reviews.length === 0) {
    container.innerHTML = '<div class="text-center py-6 text-brand-400">目前尚無評論紀錄</div>';
    return;
  }
  container.innerHTML = reviews.map(r => `
    <div class="p-3.5 bg-white rounded-2xl border border-brand-200 shadow-xs flex justify-between items-start gap-3">
      <div class="space-y-1">
        <div class="flex items-center gap-2 font-bold text-brand-900">
          <span>${r.customer_name}</span>
          <span class="text-amber-500">${'★'.repeat(r.rating || 5)}</span>
          <span class="text-[10px] text-gray-400 font-mono">${r.created_at ? r.created_at.split('T')[0] : ''}</span>
        </div>
        <div class="flex flex-wrap gap-1">
          ${(r.tags || []).map(t => `<span class="px-2 py-0.5 bg-brand-100 text-brand-700 text-[10px] rounded font-bold">${t}</span>`).join('')}
        </div>
        <p class="text-brand-600 font-sans">${r.comment || '滿意推薦！'}</p>
      </div>
      <button onclick="toggleReviewApproval('${r.id}', ${!r.is_approved})" class="px-3 py-1.5 rounded-xl font-bold transition text-xs shrink-0 ${r.is_approved ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-700'}">
        ${r.is_approved ? '✓ 已上架' : '下架中 (點擊上架)'}
      </button>
    </div>
  `).join('');

  renderReviewTagsManager();
}

async function toggleReviewApproval(id, toApprove) {
  await directSupabasePatch('customer_reviews', `id=eq.${id}`, { is_approved: toApprove });
  loadAdminReviews();
}

function renderReviewTagsManager() {
  const box = document.getElementById('review-tags-manage-box');
  if (!box) return;
  const tags = backendData.settings?.reviewTags || ["細心溫柔", "完全不推銷", "手法專業", "環境極放鬆", "成效超滿意"];
  box.innerHTML = tags.map((t, idx) => `
    <span class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 rounded-xl border border-brand-200 text-xs font-bold text-brand-800 shadow-xs">
      <span>${t}</span>
      <button onclick="deleteReviewTag(${idx})" class="text-rose-500 hover:text-rose-700 font-bold ml-1">×</button>
    </span>
  `).join('');
}

async function addNewReviewTagPrompt() {
  Swal.fire({
    title: '新增評價特色標籤',
    input: 'text',
    inputPlaceholder: '例如：環境乾淨、手法溫柔',
    showCancelButton: true,
    confirmButtonText: '新增',
    confirmButtonColor: '#8C7355'
  }).then(async r => {
    if (r.isConfirmed && r.value) {
      const tags = backendData.settings?.reviewTags || [];
      tags.push(r.value.trim());
      await directSupabasePatch('store_settings', `store_id=eq.${CURRENT_STORE_ID}`, { review_tags: tags });
      backendData.settings.reviewTags = tags;
      renderReviewTagsManager();
    }
  });
}

async function deleteReviewTag(idx) {
  const tags = backendData.settings?.reviewTags || [];
  tags.splice(idx, 1);
  await directSupabasePatch('store_settings', `store_id=eq.${CURRENT_STORE_ID}`, { review_tags: tags });
  backendData.settings.reviewTags = tags;
  renderReviewTagsManager();
}

// 16. 空檔發布與 9:16 限動單頁
function initSlotsLiveUrl() {
  const slotsUrl = `https://salon.heysibyl.com/slots.html?store_id=${CURRENT_STORE_ID}`;
  const liveElem = document.getElementById('slots-live-url');
  if (liveElem) {
    liveElem.href = slotsUrl;
    liveElem.innerText = slotsUrl;
  }
}

function handleSlotRangeChange() {
  const startVal = document.getElementById('slot-start-date')?.value;
  const endVal = document.getElementById('slot-end-date')?.value;
  if (!startVal) return;

  pendingSlotsList = [];
  renderPendingSlotsList();

  const container = document.getElementById('slot-picker-checkboxes');
  const times = ["10:00", "11:30", "13:00", "14:30", "16:00", "17:30", "19:00"];
  const startDate = new Date(startVal);
  const endDate = endVal ? new Date(endVal) : new Date(startVal);

  let daysList = [];
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    daysList.push(`${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`);
  }

  container.innerHTML = daysList.map(dayStr => `
    <div class="col-span-full font-bold text-xs text-brand-900 mt-2 pb-1 border-b border-brand-200">
      📅 ${dayStr}
    </div>
    ${times.map(t => `
      <label class="p-2 bg-brand-50 rounded-xl border border-brand-200 flex items-center justify-between cursor-pointer hover:bg-brand-100 transition">
        <span class="font-bold text-xs font-mono">${t}</span>
        <input type="checkbox" value="${t}" data-date="${dayStr}" onchange="toggleSlotPick('${dayStr}', '${t}', this)" class="accent-[#8C7355]">
      </label>
    `).join('')}
  `).join('');
}

function toggleSlotPick(d, t, cb) {
  if (cb.checked) pendingSlotsList.push({ date: d, time: t });
  else pendingSlotsList = pendingSlotsList.filter(s => !(s.date === d && s.time === t));
  renderPendingSlotsList();
}

function renderPendingSlotsList() {
  const box = document.getElementById('selected-slots-display');
  if (!box) return;
  if (pendingSlotsList.length === 0) {
    box.innerHTML = '<span class="text-xs text-brand-400">尚未挑選時段</span>';
    return;
  }
  box.innerHTML = pendingSlotsList.map((s, idx) => `
    <span class="inline-flex items-center gap-1.5 px-3 py-1 bg-brand-100 text-brand-800 rounded-full text-xs font-bold border border-brand-200">
      ${s.date} ${s.time}
      <button type="button" onclick="removePendingSlot(${idx})" class="text-brand-400 hover:text-red-500 font-bold">×</button>
    </span>
  `).join('');
}

function removePendingSlot(idx) {
  pendingSlotsList.splice(idx, 1);
  renderPendingSlotsList();
}

async function publishSlotsToPage() {
  if (pendingSlotsList.length === 0) return Swal.fire('請至少挑選一個釋出時段', '', 'warning');
  Swal.showLoading();
  try {
    await directSupabasePatch('store_settings', `store_id=eq.${CURRENT_STORE_ID}`, { published_slots: pendingSlotsList });
    initSlotsLiveUrl();
    const slotsUrl = `https://salon.heysibyl.com/slots.html?store_id=${CURRENT_STORE_ID}`;
    Swal.fire({
      title: '空檔頁面已成功發布！',
      html: `
        <div class="text-xs text-brand-800 space-y-2 text-left bg-brand-50 p-3 rounded-2xl border border-brand-200">
          <div><b>專屬 9:16 空檔網址：</b><br><a href="${slotsUrl}" target="_blank" class="text-blue-600 underline break-all font-mono">${slotsUrl}</a></div>
          <p class="text-[11px] text-brand-500">手機開啟網址直接截圖即可發 IG 限動，亦可貼入連結貼紙！</p>
        </div>
      `,
      icon: 'success'
    });
  } catch (e) {
    Swal.fire('發布失敗', e.message, 'error');
  }
}

function copySlotsLink() {
  const url = `https://salon.heysibyl.com/slots.html?store_id=${CURRENT_STORE_ID}`;
  navigator.clipboard.writeText(url);
  Swal.fire('已複製空檔網址！', '', 'success');
}

function previewSlotsPage() {
  window.open(`https://salon.heysibyl.com/slots.html?store_id=${CURRENT_STORE_ID}`, '_blank');
}

// 17. 方案訂閱與願望池
function openPayUniLink(link, name) {
  Swal.fire({
    title: '前往 PAYUNi 安全續約付款',
    text: `即將開啟【${name}】加密付款頁面`,
    icon: 'info',
    showCancelButton: true,
    confirmButtonText: '確定前往'
  }).then(r => {
    if (r.isConfirmed) window.open(link, '_blank');
  });
}

async function submitWish() {
  const v = document.getElementById('wish-input').value.trim();
  if (!v) return Swal.fire('請填寫願望內容', '', 'warning');
  Swal.showLoading();
  try {
    await directSupabaseUpsert('feature_wishes', {
      store_id: CURRENT_STORE_ID,
      store_name: backendData.settings.storeName || '沙龍店家',
      content: v,
      status: '評估中'
    }, 'id');
    document.getElementById('wish-input').value = '';
    Swal.fire('已收到您的願望！', 'Sibyl 開發團隊將優先排程評估開發', 'success');
  } catch(e) {
    document.getElementById('wish-input').value = '';
    Swal.fire('已收到您的願望！', 'Sibyl 開發團隊將優先排程評估開發', 'success');
  }
}

function renderSubscriptionUI() {
  const p = backendData.settings || {};
  const planNameEl = document.getElementById('sub-plan-name');
  if (planNameEl) planNameEl.innerText = p.storeName ? `${p.storeName} (美業與寵物雙模旗艦版)` : '旗艦雙模版';
}

// 18. 進階查詢檢索
async function executeAdvancedSearch() {
  const kw = document.getElementById('search-keyword')?.value.trim();
  if (!kw) return Swal.fire('請輸入關鍵字', '可輸入顧客姓名、手機或 LINE 名稱', 'warning');
  Swal.showLoading();
  try {
    const records = await directSupabaseFetch(`bookings?store_id=eq.${CURRENT_STORE_ID}&or=(customer_phone.ilike.*${kw}*,customer_name.ilike.*${kw}*,line_name.ilike.*${kw}*)&order=appointment_time.desc&select=*`);
    renderSearchResults(records, `關鍵字「${kw}」`);
  } catch(e) { Swal.fire('搜尋失敗', e.message, 'error'); }
}

async function executeDateRangeSearch() {
  const sD = document.getElementById('search-start-date')?.value;
  const eD = document.getElementById('search-end-date')?.value;
  if (!sD || !eD) return Swal.fire('請選擇開始與結束日期', '', 'warning');
  Swal.showLoading();
  try {
    const records = await directSupabaseFetch(`bookings?store_id=eq.${CURRENT_STORE_ID}&appointment_time=gte.${sD}T00:00:00+08:00&appointment_time=lte.${eD}T23:59:59+08:00&order=appointment_time.asc&select=*`);
    renderSearchResults(records, `區間【${sD} ~ ${eD}】`);
  } catch(e) { Swal.fire('搜尋失敗', e.message, 'error'); }
}

function searchTodayAppts() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('search-start-date').value = today;
  document.getElementById('search-end-date').value = today;
  executeDateRangeSearch();
}

function renderSearchResults(records, titleText) {
  Swal.close();
  const area = document.getElementById('search-results-area');
  if (!records || records.length === 0) {
    area.innerHTML = `<div class="text-center text-xs text-brand-400 py-6 bg-white rounded-3xl border border-brand-200">查無 ${titleText} 之紀錄</div>`;
    return;
  }
  const formatted = records.map(b => {
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
      signature_url: b.signature_url || '',
      signed_at: b.signed_at || '',
      created_at: b.created_at || ''
    };
  });
  area.innerHTML = `<div class="text-xs font-bold text-brand-900 mb-1 px-1">🔍 ${titleText} 共 ${formatted.length} 筆紀錄：</div>` + formatted.map(a => renderSingleCardHTML(a)).join('');
}

// 19. 設定回填與專員名冊維護
function populateSettings() {
  const s = backendData.settings || {};
  const setVal = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined && val !== null) el.value = val; };
  const setCheck = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined && val !== null) el.checked = Boolean(val); };

  setVal('cfg-title', s.storeName);
  setVal('cfg-subtitle', s.subtitle);
  setVal('cfg-logo', s.logoUrl);
  setVal('cfg-phone', s.storePhone || '');
  setVal('cfg-address', s.address);
  setVal('cfg-hours', s.businessHours);
  setVal('cfg-buffer', s.bookingBufferHours);
  setVal('cfg-care', s.careText);
  setVal('cfg-deposit-info', s.depositInfo);
  setVal('cfg-deposit-mode', s.depositMode);
  setVal('cfg-deposit-amount', s.depositAmount);
  setVal('cfg-shift-start', s.shiftStartTime || '09:00');
  setVal('cfg-shift-end', s.shiftEndTime || '19:00');
  setVal('cfg-shift-interval', String(s.shiftInterval || 30));
  setVal('cfg-promo', s.promoText);
  setVal('cfg-line', s.line);
  setVal('cfg-ig', s.ig);
  setVal('cfg-map', s.map);
  setVal('cfg-contract-title', s.contractTitle);
  setVal('cfg-contract-content', s.contractContent);
  setVal('cfg-promo-rules-input', s.promoRulesText);
  setVal('cfg-line-token', s.lineChannelToken);
  setVal('cfg-commission-rate', s.commissionRate || 50);
  setVal('cfg-designated-bonus', s.designatedBonus || 50);

  const currentTheme = s.themeColor || 'latte';
  setVal('cfg-theme-color', currentTheme);
  previewSelectedThemeColor(currentTheme);

  const modeRadio = document.querySelector(`input[name="cfg-industry-mode"][value="${s.industryMode || 'pet_hotel'}"]`);
  if (modeRadio) modeRadio.checked = true;
  handleIndustryModeChange(s.industryMode || 'pet_hotel');

  setVal('cfg-hotel-total-rooms', s.totalHotelRooms || 8);
  setVal('cfg-hotel-checkin-start', s.hotelCheckinStart || '10:00');
  setVal('cfg-hotel-checkout-end', s.hotelCheckoutEnd || '19:00');
  setVal('cfg-meal-time-breakfast', s.mealTimeBreakfast || '09:00');
  setVal('cfg-meal-time-lunch', s.mealTimeLunch || '12:30');
  setVal('cfg-meal-time-dinner', s.mealTimeDinner || '18:00');

  const dispId = document.getElementById('disp-current-store-id');
  if (dispId) dispId.innerText = `店家 ID: ${CURRENT_STORE_ID}`;

  setCheck('cfg-toggle-logo', s.enableLogo ?? true);
  setCheck('cfg-toggle-audit-booking', s.enableAuditBooking ?? true);
  setCheck('cfg-toggle-deposit', s.enableDeposit ?? true);
  setCheck('cfg-toggle-staff-select', s.enableStaffSelect ?? true);
  setCheck('cfg-toggle-multi-staff-schedule', s.enableMultiStaffSchedule ?? true);
  setCheck('cfg-toggle-custtype', s.enableCustType ?? true);
  setCheck('cfg-toggle-show-price', s.enableShowPrice ?? true);
  setCheck('cfg-toggle-cust-notes', s.enableCustNotes ?? true);
  setCheck('cfg-toggle-wallet', s.enableWallet ?? true);
  setCheck('cfg-toggle-packages', s.enablePackages ?? true);
  setCheck('cfg-toggle-coupons', s.enableCoupons ?? true);
  setCheck('cfg-toggle-reviews', s.enableReviews ?? true);
  setCheck('cfg-toggle-portfolio', s.enablePortfolio ?? true);
  setCheck('cfg-toggle-care', s.enableCare ?? true);
  setCheck('cfg-toggle-quick-contact', s.enableQuickContact ?? true);
  setCheck('cfg-toggle-cancel-reason', s.enableCancelReason ?? true);
  setCheck('cfg-toggle-email', s.enableEmailCopy ?? true);
  setCheck('cfg-toggle-carousel', s.enableCarousel ?? true);
  setCheck('cfg-toggle-featured-shop', s.enableFeaturedShop === true);
  setCheck('cfg-toggle-line-one-click', s.enableLineOneClickAudit ?? true);
  setCheck('cfg-toggle-commission-calc', s.enableCommissionCalc ?? true);
  setCheck('cfg-toggle-contract', s.enableContract ?? true);
  setCheck('cfg-toggle-owner-line-push', s.enableOwnerLinePush ?? true);
  setCheck('cfg-toggle-line-auto-notify', s.enableLineAutoNotify ?? false);
  setCheck('cfg-toggle-flex-menu', s.enableFlexMenu ?? true);

  if (Array.isArray(s.weeklyOffDays)) {
    document.querySelectorAll('#weekly-off-grid input').forEach(input => {
      input.checked = s.weeklyOffDays.includes(Number(input.value));
    });
  }

  renderStaffManager();
  renderPlanRules();
  renderUploadSlots();
}

function renderStaffManager() {
  const container = document.getElementById('staff-manager-list');
  const countBadge = document.getElementById('staff-count-badge');
  if (!container) return;

  const rawList = backendData.settings?.staffList || [];
  const staffs = rawList.filter(s => s.id !== 'all');
  if (countBadge) countBadge.innerText = `${staffs.length} 位專員`;

  if (staffs.length === 0) {
    container.innerHTML = '<div class="text-center py-4 text-xs text-brand-400 bg-brand-50/50 rounded-2xl border border-dashed border-brand-200">目前尚無專員，請於下方新增</div>';
    return;
  }

  container.innerHTML = staffs.map(s => {
    const isVisible = staffPinVisibilityMap[s.id] === true;
    const displayPin = isVisible ? (s.pin || '8888') : '••••';

    return `
      <div class="p-3.5 bg-brand-50/70 rounded-2xl border border-brand-200 flex justify-between items-center text-xs">
        <div class="space-y-1">
          <div class="font-bold text-brand-900 text-sm flex items-center gap-1.5">
            <span>${s.name}</span>
            <span class="text-[10px] text-brand-400 font-mono font-normal">(${s.id})</span>
          </div>
          <div class="text-[11px] text-brand-600 font-mono flex items-center gap-1.5">
            <span>密碼：<b class="tracking-wider text-brand-900">${displayPin}</b></span>
            <button type="button" onclick="toggleStaffPinVisibility('${s.id}')" class="text-brand-500 hover:text-brand-800 p-0.5" title="${isVisible ? '隱藏密碼' : '顯示密碼'}">
              <i class="fa-solid ${isVisible ? 'fa-eye-slash' : 'fa-eye'} text-[11px]"></i>
            </button>
            <button type="button" onclick="promptEditStaffPin('${s.id}', '${s.name}', '${s.pin || '8888'}')" class="text-blue-600 underline font-sans text-[10.5px] ml-1 font-bold">改密碼</button>
          </div>
        </div>
        <div class="flex gap-1.5 items-center">
          <button type="button" onclick="copyStaffWorkplaceUrl('${s.id}', '${s.name}')" class="px-2.5 py-1.5 bg-brand-100 hover:bg-brand-200 text-brand-800 rounded-xl font-bold text-[11px] transition flex items-center gap-1">
            <i class="fa-solid fa-link text-[10px]"></i> 複製工作台連結
          </button>
          <button type="button" onclick="removeStaffMember('${s.id}', '${s.name}')" class="px-2.5 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-xl font-bold text-[11px] transition">
            刪除
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function toggleStaffPinVisibility(staffId) {
  staffPinVisibilityMap[staffId] = !staffPinVisibilityMap[staffId];
  renderStaffManager();
}

function copyStaffWorkplaceUrl(staffId, staffName) {
  const cleanUrl = `${window.location.origin}${window.location.pathname}?store_id=${CURRENT_STORE_ID}&staff=${encodeURIComponent(staffId)}`;
  navigator.clipboard.writeText(cleanUrl).then(() => {
    Swal.fire({ title: '已複製專員連結！', text: `已複製【${staffName}】的分權連結，傳送給專員即可專屬登入。`, icon: 'success' });
  });
}

async function addStaffMember() {
  const id = document.getElementById('new-staff-id').value.trim();
  const name = document.getElementById('new-staff-name').value.trim();
  const pin = document.getElementById('new-staff-pin').value.trim() || '8888';
  if (!id || !name) return Swal.fire('請填寫編號與姓名', '', 'warning');

  let list = backendData.settings?.staffList || [];
  if (!list.some(s => s.id === 'all')) list.unshift({ id: "all", name: "不指定", pin: "8888" });
  if (list.some(s => s.id.toLowerCase() === id.toLowerCase())) return Swal.fire('此編號已存在', '', 'warning');

  list.push({ id, name, pin });
  backendData.settings.staffList = list;
  document.getElementById('new-staff-id').value = '';
  document.getElementById('new-staff-name').value = '';
  document.getElementById('new-staff-pin').value = '';

  await directSupabasePatch('store_settings', `store_id=eq.${CURRENT_STORE_ID}`, { staff_list: list });
  renderStaffManager();
  Swal.fire('專員已成功建立！', '', 'success');
}

function promptEditStaffPin(staffId, staffName, currentPin) {
  Swal.fire({
    title: `修改 ${staffName} 的專屬密碼`,
    input: 'text',
    inputValue: currentPin,
    inputPlaceholder: '請輸入 4-6 碼密碼',
    showCancelButton: true,
    confirmButtonText: '確定更新',
    confirmButtonColor: '#8C7355',
    preConfirm: (val) => {
      if (!val || val.trim().length < 4) {
        Swal.showValidationMessage('密碼長度至少需 4 碼');
        return false;
      }
      return val.trim();
    }
  }).then(async r => {
    if (r.isConfirmed && r.value) {
      const list = backendData.settings?.staffList || [];
      const staff = list.find(s => s.id === staffId);
      if (staff) {
        staff.pin = r.value;
        await directSupabasePatch('store_settings', `store_id=eq.${CURRENT_STORE_ID}`, { staff_list: list });
        renderStaffManager();
        Swal.fire({ title: '專員密碼已更新！', icon: 'success', timer: 1000, showConfirmButton: false });
      }
    }
  });
}

function removeStaffMember(id, name) {
  Swal.fire({
    title: `確定刪除專員【${name}】？`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    confirmButtonText: '確定刪除'
  }).then(async r => {
    if (r.isConfirmed) {
      let list = (backendData.settings?.staffList || []).filter(s => s.id !== id);
      backendData.settings.staffList = list;
      await directSupabasePatch('store_settings', `store_id=eq.${CURRENT_STORE_ID}`, { staff_list: list });
      renderStaffManager();
      Swal.fire('已移除專員', '', 'success');
    }
  });
}

function addCustomOffDate() {
  const dateVal = document.getElementById('new-custom-off-date').value;
  if (!dateVal) return;
  const formatted = dateVal.replace(/-/g, '/');
  if (!customOffDatesArray.includes(formatted)) {
    customOffDatesArray.push(formatted);
    renderCustomOffDatesTags();
  }
  document.getElementById('new-custom-off-date').value = '';
}

function removeCustomOffDate(dStr) {
  customOffDatesArray = customOffDatesArray.filter(d => d !== dStr);
  renderCustomOffDatesTags();
}

function renderCustomOffDatesTags() {
  document.getElementById('custom-off-dates-tags').innerHTML = customOffDatesArray.map(d => `
    <span class="inline-flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-800 rounded-lg text-xs font-bold font-mono">
      ${d} <button onclick="removeCustomOffDate('${d}')" class="text-red-500 font-bold ml-1">×</button>
    </span>
  `).join('');
}

async function uploadLogoImgBB() {
  const file = document.getElementById('logo-file-input').files[0];
  if (!file) return Swal.fire('請先選擇 LOGO 圖檔', '', 'warning');
  Swal.showLoading();
  try {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const base64Data = reader.result.split(',')[1];
      const formData = new FormData();
      formData.append("image", base64Data);
      const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: "POST", body: formData });
      const data = await res.json();
      if (data.success) {
        document.getElementById('cfg-logo').value = data.data.url;
        Swal.fire('LOGO 上傳成功！', '', 'success');
      }
    };
  } catch(e) { Swal.fire('上傳失敗', e.message, 'error'); }
}

function openOwnerLineBindModal() {
  Swal.fire({
    title: '連動業主個人 LINE',
    html: `
      <div class="text-left text-xs space-y-2 p-1 text-brand-800">
        <p class="bg-amber-50 p-2.5 rounded-xl border border-amber-200 text-amber-900 leading-relaxed">
          請複製店家 ID 並於官方 LINE 聊天室輸入「<b>綁定店家 ${CURRENT_STORE_ID}</b>」即可綁定接收預約通報！
        </p>
        <div class="flex gap-2">
          <input type="text" readonly value="綁定店家 ${CURRENT_STORE_ID}" class="flex-1 p-2 bg-white border border-brand-200 rounded-xl text-xs font-mono">
          <button onclick="navigator.clipboard.writeText('綁定店家 ${CURRENT_STORE_ID}'); Swal.fire('已複製指令！', '', 'success');" class="px-3 py-1.5 bg-[#8C7355] text-white rounded-xl font-bold">複製</button>
        </div>
      </div>
    `,
    confirmButtonText: '完成'
  });
}

function showLineGuideModal() {
  Swal.fire({
    title: 'LINE API 設定 3 步驟',
    html: `
      <div class="text-left text-xs space-y-2 leading-relaxed">
        <div>1. 登入 <a href="https://developers.line.biz" target="_blank" class="text-blue-600 underline font-bold">LINE Developers</a></div>
        <div>2. 進入 Messaging API 分頁發行長期 Channel Access Token</div>
        <div>3. 複製貼至下方權杖欄位並儲存即可！</div>
      </div>
    `,
    confirmButtonText: '了解'
  });
}

function renderUploadSlots() {
  const grid = document.getElementById('promo-upload-grid');
  if (!grid) return;
  grid.innerHTML = '';
  
  for (let i = 0; i < 7; i++) {
    const hasImg = Boolean(promoImgsArray[i]);
    grid.innerHTML += `
      <div class="aspect-[9/16] rounded-xl border-2 border-dashed border-brand-200 flex items-center justify-center bg-cover bg-center cursor-pointer bg-brand-50 relative overflow-hidden group" 
           id="slot-${i}" 
           style="${hasImg ? `background-image: url('${promoImgsArray[i]}');` : ''}"
           onclick="document.getElementById('promo-file-${i}').click()">
        <span class="text-[10px] bg-black/50 text-white px-1.5 py-0.5 rounded-md absolute bottom-1.5 left-1.5 pointer-events-none font-mono">圖${i + 1}</span>
        ${hasImg ? `
          <button type="button" onclick="deletePromoImg(${i}, event)" class="absolute top-1 right-1 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-xs shadow-md z-10 transition">✕</button>
        ` : '<span class="text-[10px] text-brand-300 font-bold pointer-events-none">+ 上傳</span>'}
        <input type="file" id="promo-file-${i}" class="hidden" accept="image/*" onchange="handlePromoUpload(${i}, this)">
      </div>`;
  }
}

async function handlePromoUpload(idx, input) {
  const file = input.files[0];
  if (!file) return;
  Swal.showLoading();
  try {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const base64Data = reader.result.split(',')[1];
      const formData = new FormData();
      formData.append("image", base64Data);
      const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: "POST", body: formData });
      const data = await res.json();
      if (data.success) {
        promoImgsArray[idx] = data.data.url;
        const imgsText = document.getElementById('cfg-promo-imgs-text');
        if (imgsText) imgsText.value = promoImgsArray.filter(Boolean).join('\n');
        renderUploadSlots();
        Swal.fire({ title: '說明圖已更新！', icon: 'success', timer: 800, showConfirmButton: false });
      }
    };
  } catch(e) {
    Swal.fire('上傳失敗', e.message, 'error');
  }
}

function deletePromoImg(idx, e) {
  if (e) e.stopPropagation();
  promoImgsArray[idx] = "";
  const imgsText = document.getElementById('cfg-promo-imgs-text');
  if (imgsText) imgsText.value = promoImgsArray.filter(Boolean).join('\n');
  renderUploadSlots();
  Swal.fire({ title: `已移除說明圖 ${idx + 1}`, icon: 'success', timer: 800, showConfirmButton: false });
}

function loadMohwContractTemplate() {
  document.getElementById('cfg-contract-content').value = DEFAULT_MOHW_BEAUTY_CONTRACT;
  document.getElementById('cfg-contract-title').value = "美容定型化契約書";
  Swal.fire('已載入衛福部官方標準範本！', '', 'success');
}

function refreshPushPermission() {
  if (!('Notification' in window)) return Swal.fire('不支援', '此裝置不支援推播', 'warning');
  Notification.requestPermission().then(permission => {
    if (permission === 'granted') Swal.fire('推播已重置授權！', '', 'success');
    else Swal.fire('請至手機系統開啟權限', '', 'warning');
  });
}

function toggleQuickIndustryMode() {
  const mode = document.querySelector('input[name="quick-industry-mode"]:checked')?.value || 'beauty';
  const petBox = document.getElementById('quick-pet-fields-box');
  const singleTimeBox = document.getElementById('quick-single-time-box');
  const hotelRangeBox = document.getElementById('quick-hotel-range-box');

  if (mode === 'beauty') {
    if (petBox) petBox.classList.add('hidden');
    if (singleTimeBox) singleTimeBox.classList.remove('hidden');
    if (hotelRangeBox) hotelRangeBox.classList.add('hidden');
  } else if (mode === 'pet_grooming') {
    if (petBox) petBox.classList.remove('hidden');
    if (singleTimeBox) singleTimeBox.classList.remove('hidden');
    if (hotelRangeBox) hotelRangeBox.classList.add('hidden');
  } else if (mode === 'pet_hotel') {
    if (petBox) petBox.classList.remove('hidden');
    if (singleTimeBox) singleTimeBox.classList.add('hidden');
    if (hotelRangeBox) hotelRangeBox.classList.remove('hidden');
  }
}

// 監聽開機初始化
window.addEventListener('DOMContentLoaded', () => {
  sessionStorage.removeItem('admin_session_unlocked');
  checkLockoutStatus();
  const pinInput = document.getElementById('pin-input');
  if (pinInput) {
    pinInput.focus();
    pinInput.onkeydown = (e) => { if (e.key === 'Enter') checkPin(); };
  }
});
