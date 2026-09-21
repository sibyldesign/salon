// =========================================================================
// 📌 畫面渲染、彈窗互動與視覺呈現引擎 (js/admin-ui.js)
// =========================================================================

let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth();
let selectedCalendarDate = '';
let currentShiftDate = 'ALL';
let activeShiftStaffId = 'all';

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

// 2. 日曆月曆
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

// 3. 名單分頁渲染 (防呆、嚴禁 Emoji、全向量圖示)
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

// 單一卡片 HTML（無 Emoji、結構化財務條列）
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
  if (cleanNotes.includes('加購')) {
    financialRows.push(`<div class="flex justify-between text-amber-900 font-bold"><span><i class="fa-solid fa-cart-plus mr-1 text-amber-600"></i>現場加購：</span><span>已計入實收</span></div>`);
  }
  if (cleanNotes.includes('使用包卡') || cleanNotes.includes('包卡扣抵')) {
    financialRows.push(`<div class="flex justify-between text-blue-700 font-bold"><span><i class="fa-solid fa-ticket mr-1 text-blue-500"></i>包卡點數抵扣：</span><span>當次扣減 1 點</span></div>`);
  }
  if (cleanNotes.includes('使用儲值') || cleanNotes.includes('儲值抵扣')) {
    financialRows.push(`<div class="flex justify-between text-purple-700 font-bold"><span><i class="fa-solid fa-wallet mr-1 text-purple-500"></i>儲值餘額支付：</span><span>享專屬會員折數</span></div>`);
  }
  if (cleanNotes.includes('折扣碼')) {
    financialRows.push(`<div class="flex justify-between text-rose-600 font-bold"><span><i class="fa-solid fa-tag mr-1 text-rose-500"></i>活動促銷優惠：</span><span>已套用折扣碼</span></div>`);
  }
  if (a.deposit_deducted > 0) {
    financialRows.push(`<div class="flex justify-between text-amber-700 font-bold"><span><i class="fa-solid fa-money-bill mr-1 text-amber-600"></i>線下定額訂金：</span><span>-$${a.deposit_deducted}</span></div>`);
  }

  const rawPhone = String(a.phone || '').trim().replace(/[^0-9]/g, '');
  const intlPhone = rawPhone.startsWith('0') ? '886' + rawPhone.slice(1) : rawPhone;

  // 細節 3：支援現場手寫簽名
  const signBtnHtml = a.signature_url ? `
    <button type="button" onclick="viewDigitalContract('${a.name}', '${a.signature_url}', '${a.signed_at || a.date}')" class="px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg font-bold text-xs transition">
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

// 細節 3：現場手寫電子簽名板
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

// 4. 業績分頁渲染（結構化財務明細）
function renderRevenueSelect() {
  const sel = document.getElementById('rev-service-select');
  if (!sel) return;
  sel.innerHTML = '<option value="ALL">全部服務項目總覽</option>' + 
    (backendData.services || []).map(s => `<option value="${s.name}">${s.name}</option>`).join('');
}

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
    filtered = filtered.filter(a => (a.notes || '').includes('包卡'));
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

    if (a.status === '已結單') {
      paidTotal += finalAmt;
      totalOriginal += origPrice;
      totalDiscount += discountAmt;
      completedCount++;
      if (a.customer_type === 'old') returningRevenue += finalAmt;

      let financeTags = [];
      if (notes.includes('加購')) financeTags.push('<span class="text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">含加購</span>');
      if (notes.includes('包卡')) financeTags.push('<span class="text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">包卡扣抵</span>');
      if (notes.includes('儲值')) financeTags.push('<span class="text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">儲值扣抵</span>');
      if (notes.includes('折扣碼')) financeTags.push('<span class="text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">優惠券</span>');

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
            ${financeTags.length > 0 ? `<div class="flex flex-wrap gap-1 text-[10px] pt-0.5">${financeTags.join(' ')}</div>` : ''}
          </div>
          <div class="text-right shrink-0">
            <div class="font-black text-emerald-800 text-sm font-mono">實收 NT$ ${finalAmt.toLocaleString()}</div>
            <div class="text-[10px] text-gray-400 font-mono space-x-1">
              <span>原價 $${origPrice}</span>
              ${discountAmt > 0 ? `<span class="text-rose-500 font-bold">(-$${discountAmt})</span>` : ''}
            </div>
          </div>
        </div>`;
    } else if (a.status === '已確認') {
      unpaidListHtml += `
        <div class="p-3 bg-amber-50 rounded-2xl border border-amber-200 flex justify-between items-center text-xs shadow-2xs">
          <div>
            <div class="font-bold text-amber-950">${a.date} - ${a.name} (${a.staffName || '不指定'})</div>
            <div class="text-[11px] text-amber-800">預計施作：${a.service} (原價預估: $${origPrice})</div>
          </div>
          <button class="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs shadow-xs" onclick="openCheckoutModal('${a.id}', '${a.name}', '${a.phone}', '${a.service}', ${origPrice})">結單對帳</button>
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
        <span>總原價：$${totalOriginal.toLocaleString()} | 總折扣：-$${totalDiscount.toLocaleString()} | 實收：$${paidTotal.toLocaleString()}</span>
      </div>
      ${paidListHtml}
    ` : '<div class="text-center text-xs text-brand-400 py-6">查無符合條件之結單紀錄</div>';
  }
  if (unpaidListArea) {
    unpaidListArea.innerHTML = unpaidListHtml || '<div class="text-center text-xs text-brand-400 py-2">目前無待結單預約</div>';
  }
}

// 細節 4：耗材 (BOM) 下拉連動設定
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

// 初始化開機監聽
window.addEventListener('DOMContentLoaded', () => {
  sessionStorage.removeItem('admin_session_unlocked');
  checkLockoutStatus();
  const pinInput = document.getElementById('pin-input');
  if (pinInput) {
    pinInput.focus();
    pinInput.onkeydown = (e) => { if (e.key === 'Enter') checkPin(); };
  }
});

// =========================================================================
// 📌 畫面渲染、日曆排班、名單與住宿甘特圖 (js/admin-ui.js) - [第一段整理]
// =========================================================================

let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth();
let selectedCalendarDate = '';
let currentShiftDate = 'ALL';
let activeShiftStaffId = 'all';

// 1. 前台 6 大品牌美學主題色票定義
const THEME_PALETTES = {
  latte:  { name: '大地燕麥暖棕', colors: ['#FDFBF7', '#EBE5DF', '#8C7355', '#3D3126'] },
  matcha: { name: '日系抹茶茶木', colors: ['#F7F8F5', '#E3E8DE', '#5C725E', '#2B382D'] },
  noir:   { name: '經典極簡黑白', colors: ['#FAFAFA', '#E5E5E5', '#262626', '#0A0A0A'] },
  navy:   { name: '奢華午夜黛藍', colors: ['#F4F6F9', '#D9E2EC', '#2B4C6F', '#102A43'] },
  rose:   { name: '法式暮粉煙燻', colors: ['#FCF8F8', '#EEDCDD', '#A26D74', '#4E2C32'] },
  mist:   { name: '晨曦朝露霧綠', colors: ['#F4F7F6', '#DAE4E1', '#4A7C6D', '#1F3B33'] }
};

function previewSelectedThemeColor(themeKey) {
  const t = THEME_PALETTES[themeKey] || THEME_PALETTES['latte'];
  const nameEl = document.getElementById('theme-preview-name');
  const chipsEl = document.getElementById('theme-color-chips');
  if (nameEl) nameEl.innerText = `${t.name}：`;
  if (chipsEl) {
    chipsEl.innerHTML = t.colors.map(c => `
      <span class="w-5 h-5 rounded-full border border-black/10 shadow-xs inline-block" style="background-color: ${c};" title="${c}"></span>
    `).join('');
  }
}

const DEFAULT_CARE_RULES = [
  { name: "燙染造型, 染髮, 漂髮, 挑染, 質感染髮", weeks: 12, msg: "嗨 {姓名}～距離上次做『{項目}』已經滿12週囉！髮色與光澤維持得還好嗎？隨時歡迎預約回娘家補染護理唷" },
  { name: "洗剪設計, 剪髮, 造型設計, 洗剪", weeks: 4, msg: "嗨 {姓名}～距離上次剪髮已經滿4週囉！長度與厚度是否需要修剪整理了呢？歡迎預約唷" },
  { name: "深層護理, 頭皮SPA, 結構護理, 護髮", weeks: 4, msg: "嗨 {姓名}～定期深層護理能維持光澤質感，歡迎預約回娘家享受放鬆洗護時光" },
  { name: "寵物美容, 大美容, 小美容, 藥浴", weeks: 3, msg: "嗨 {姓名}～毛孩上次做『{項目}』已經滿3週囉！長度差不多該修剪維護囉，歡迎預約沐浴" }
];

// 4. 路由切換器 (全域 14 個核心分頁)
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
  if (pageId === 'inventory') { if (typeof renderInventoryList === 'function') renderInventoryList(); }
  if (pageId === 'revenue') { if (typeof renderRevenue === 'function') renderRevenue(); }
  if (pageId === 'care') { if (typeof renderCare === 'function') renderCare(); }
  if (pageId === 'services') { if (typeof renderServiceList === 'function') renderServiceList(); }
  if (pageId === 'add') { if (typeof renderQuickAddServices === 'function') renderQuickAddServices(); }
  if (pageId === 'marketing') { if (typeof loadMarketingCenter === 'function') loadMarketingCenter(); }
  if (pageId === 'reviews') { if (typeof loadAdminReviews === 'function') loadAdminReviews(); }
  if (pageId === 'slots') { if (typeof handleSlotRangeChange === 'function') handleSlotRangeChange(); }
  if (pageId === 'subscription') { if (typeof renderSubscriptionUI === 'function') renderSubscriptionUI(); }
  if (pageId === 'settings') { if (typeof populateSettings === 'function') populateSettings(); }
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

// 5. 日曆檢視
function renderCalendar() {
  const grid = document.getElementById('cal-grid');
  if (!grid) return;
  document.getElementById('cal-month-title').innerText = `${calYear} 年 ${calMonth + 1} 月`;
  const headers = ['日', '一', '二', '三', '四', '五', '六'];
  let html = headers.map(h => `<div class="py-1 font-bold text-brand-400 text-[11px]">${h}</div>`).join('');
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  for (let i = 0; i < firstDay; i++) html += `<div class="py-2.5"></div>`;
  
  for (let i = 1; i <= daysInMonth; i++) {
    let dStr = `${calYear}/${String(calMonth+1).padStart(2,'0')}/${String(i).padStart(2,'0')}`;
    let apptsToday = (backendData.appointments || []).filter(a => a.date === dStr && a.status !== '已取消' && a.status !== '婉拒');
    if (CURRENT_STAFF_PARAM && CURRENT_STAFF_PARAM !== 'all') {
      apptsToday = apptsToday.filter(a => a.staffId === CURRENT_STAFF_PARAM);
    }
    let isSelected = (selectedCalendarDate === dStr);
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

// 6. 預約卡片渲染引擎 (獨立條列財務與折抵明細)
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
  if (cleanNotes.includes('使用包卡') || cleanNotes.includes('包卡扣抵') || cleanNotes.includes('扣點')) {
    financialRows.push(`<div class="flex justify-between text-blue-700 font-bold"><span><i class="fa-solid fa-ticket mr-1 text-blue-500"></i>包卡點數抵扣：</span><span>當次扣減 1 點 (堂)</span></div>`);
  }
  if (cleanNotes.includes('使用儲值') || cleanNotes.includes('儲值抵扣') || cleanNotes.includes('儲值金')) {
    financialRows.push(`<div class="flex justify-between text-purple-700 font-bold"><span><i class="fa-solid fa-wallet mr-1 text-purple-500"></i>儲值金扣抵支付：</span><span>享專屬會員折數</span></div>`);
  }
  if (cleanNotes.includes('折扣碼')) {
    const codeMatch = cleanNotes.match(/折扣碼[:\s]*([A-Za-z0-9]+)/);
    const codeStr = codeMatch ? ` (${codeMatch[1]})` : '';
    financialRows.push(`<div class="flex justify-between text-rose-600 font-bold"><span><i class="fa-solid fa-tag mr-1 text-rose-500"></i>活動促銷優惠：</span><span>已套用代碼${codeStr}</span></div>`);
  }
  if (a.deposit_deducted > 0) {
    financialRows.push(`<div class="flex justify-between text-amber-700 font-bold"><span><i class="fa-solid fa-money-bill mr-1 text-amber-600"></i>線下定額訂金抵扣：</span><span>-$${a.deposit_deducted}</span></div>`);
  }

  const friendlyCreatedTime = a.created_at ? formatFriendlyTime(a.created_at) : '';
  const friendlySignedTime = a.signed_at ? formatFriendlyTime(a.signed_at) : '';
  const rawPhone = String(a.phone || '').trim().replace(/[^0-9]/g, '');
  const intlPhone = rawPhone.startsWith('0') ? '886' + rawPhone.slice(1) : rawPhone;

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
        <button class="px-3 py-1 bg-[#7D8F7D] hover:bg-[#687968] text-white rounded-lg font-bold text-xs shadow-xs transition" onclick="auditOrder('${a.id}', '已確認', '${a.name}')">核准接單</button>
        <button class="px-2.5 py-1 bg-[#B57979] hover:bg-[#9E6363] text-white rounded-lg font-bold text-xs shadow-xs transition" onclick="auditOrder('${a.id}', '婉拒', '${a.name}')">婉拒</button>
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
        <div class="font-bold text-brand-800 border-b border-brand-200/60 pb-1">當次方案與加購折抵明細：</div>
        ${financialRows.length > 0 ? financialRows.join('') : '<div class="text-gray-400">無特殊加購或方案折抵紀錄</div>'}
      </div>

      <div class="p-2.5 bg-brand-50/70 rounded-xl text-[11px] space-y-1">
        <div class="flex justify-between">
          <span>LINE：<b>${a.lineName || '未填寫'}</b></span>
          <span>信箱：<b>${parsedEmail || '未填寫'}</b></span>
        </div>
        ${a.customer_notes ? `<div class="text-amber-900 font-medium">顧客備註：${a.customer_notes}</div>` : ''}
        ${a.signature_url ? `
          <div class="flex justify-between items-center text-emerald-700 pt-1.5 border-t border-brand-200/60 font-bold">
            <span>✓ 已簽署定型化契約 ${friendlySignedTime ? `(${friendlySignedTime})` : ''}</span>
            <button onclick="viewDigitalContract('${a.name}', '${a.signature_url}', '${friendlySignedTime}')" class="text-blue-600 underline text-[10.5px]">檢視正本</button>
          </div>
        ` : ''}
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
          <div class="flex items-center gap-1.5 pt-1">
            <a href="${sigUrl}" target="_blank" class="px-3 py-1 bg-brand-100 hover:bg-brand-200 text-brand-800 rounded-lg font-bold text-xs">開啟原圖</a>
            <input type="text" readonly value="${sigUrl}" class="flex-1 p-1 text-[10px] border border-brand-200 rounded font-mono text-gray-400 truncate" onclick="this.select()">
            <button onclick="navigator.clipboard.writeText('${sigUrl}'); Swal.fire('已複製簽名網址！', '', 'success')" class="px-3 py-1 bg-[#8C7355] text-white rounded-lg font-bold text-xs">複製網址</button>
          </div>
        </div>
      </div>
    `,
    confirmButtonText: '關閉檢視',
    confirmButtonColor: '#8C7355'
  });
}

function openLiveSignaturePad(bookingId, custName) {
  Swal.fire({
    title: `【${custName}】現場親筆簽名`,
    html: `
      <div class="space-y-2 text-left text-xs font-sans">
        <p class="text-brand-600">請顧客於下方框線內手寫簽名，確認定型化照護契約：</p>
        <canvas id="live-sign-canvas" class="w-full h-44 bg-white border-2 border-dashed border-brand-300 rounded-2xl touch-none shadow-inner"></canvas>
        <div class="flex justify-between items-center pt-1">
          <span class="text-[10px] text-brand-400">支援手機、平板或觸控螢幕手寫</span>
          <button type="button" onclick="clearSignCanvas()" class="px-2.5 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-xs font-bold">清除重填</button>
        </div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: '確認存證並綁定',
    confirmButtonColor: '#8C7355',
    cancelButtonText: '取消',
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
        
        const target = (backendData.appointments || []).find(a => String(a.id) === String(bookingId));
        if (target) {
          target.signature_url = r.value;
          target.signed_at = signedAtIso;
        }
        
        Swal.fire({ title: '定型化契約已成功簽署！', icon: 'success', timer: 1000, showConfirmButton: false });
        renderCustomer();
      } catch(e) {
        Swal.fire('簽章存證失敗', e.message, 'error');
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
  signCtx.lineJoin = 'round';
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
        <div class="text-[11px] text-brand-400">可切換右上角狀態下拉選單查閱其他排程</div>
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

// 7. 寵物住宿模組 (動態總房數配置 ＆ 智能照護供餐清單)
function renderBoardingRoomStatus() {
  const container = document.getElementById('boarding-room-grid');
  if (!container) return;
  const totalRooms = Number(backendData.settings.totalHotelRooms || 8);
  const viewDate = document.getElementById('boarding-view-date')?.value?.replace(/-/g, '/') || new Date().toISOString().split('T')[0].replace(/-/g, '/');

  const occupied = (backendData.appointments || []).filter(a => (a.service || '').includes('住宿') && a.status !== '已取消' && a.status !== '婉拒');
  const activeCount = occupied.length;
  const checkoutCount = occupied.filter(a => (a.notes || '').includes('退房') || (a.notes || '').includes('退宿')).length;

  document.getElementById('boarding-active-count').innerText = `${activeCount} 隻`;
  document.getElementById('boarding-checkout-count').innerText = `${checkoutCount} 隻`;
  document.getElementById('boarding-vacancy-rate').innerText = `${Math.max(0, Math.round(((totalRooms - activeCount) / totalRooms) * 100))}%`;

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

// 8. 專員排班調度
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
