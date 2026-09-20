// =========================================================================
// 📌 日曆總覽與預約排程名單渲染模組（日曆檢視、名單過濾與快速查詢）
JavaScript (admin-calendar.js)
// =========================================================================

let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth();
let selectedCalendarDate = '';

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
    const apptsToday = (backendData.appointments || []).filter(a => 
      a.date === dStr && a.status !== '已取消' && a.status !== '婉拒'
    );
    const isSelected = (selectedCalendarDate === dStr);

    let dotsHtml = apptsToday.slice(0, 4).map(a => {
      const color = getStaffColor(a.staffId, a.staffName);
      return `<span class="w-1.5 h-1.5 rounded-full inline-block shadow-xs" style="background-color: ${color.dot};" title="${a.staffName || '專員'}"></span>`;
    }).join('');
    if (apptsToday.length > 4) dotsHtml += `<span class="text-[9px] text-brand-500 font-bold leading-none">+</span>`;

    html += `
      <div class="cal-cell py-2 rounded-2xl cursor-pointer flex flex-col items-center transition border ${isSelected ? 'bg-brand-500 text-white border-brand-500 font-black shadow-sm' : 'bg-white hover:bg-brand-50 text-brand-900 border-transparent'}" onclick="showApptsInCalendar('${dStr}')">
        <span class="text-xs font-bold">${i}</span>
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

  const appts = (backendData.appointments || []).filter(a => a.date === dateStr);
  if (appts.length === 0) {
    container.innerHTML = `<div class="text-center text-xs text-brand-400 py-6 bg-white rounded-3xl border border-brand-200"><b class="text-brand-800">${dateStr}</b><br>當日無排程預約</div>`;
    return;
  }
  container.innerHTML = `
    <div class="flex justify-between items-center px-2 mb-1">
      <span class="text-xs font-black text-brand-900">📅 ${dateStr} 排程預約 (${appts.length} 筆)</span>
    </div>
    ${appts.map(a => renderSingleCardHTML(a)).join('')}`;
}

// 渲染名單分頁 (審核專區、未付訂金、即將到來排程)
function renderCustomer() {
  const appts = backendData.appointments || [];
  const now = new Date();
  const isDepositEnabled = backendData.settings?.enable_deposit !== false;

  const isPastAppt = (a) => {
    if (!a.date) return false;
    const timeStr = a.time || "23:59";
    const apptDate = new Date(`${a.date.replace(/\//g, '-')}T${timeStr}:00`);
    return apptDate < now;
  };

  const pendingAudit = appts.filter(a => 
    !isPastAppt(a) && (a.status === '待確認' || (isDepositEnabled && a.depositLast5 && !a.deposit_confirmed))
  );

  const pendingContainer = document.getElementById('pending-audit-container');
  const pendingBadge = document.getElementById('pending-audit-badge');
  if (pendingBadge) pendingBadge.innerText = `${pendingAudit.length} 筆待處理`;
  if (pendingContainer) {
    pendingContainer.innerHTML = pendingAudit.length === 0 
      ? '<div class="text-center text-xs text-amber-800/70 py-3">目前無待核准的預約</div>'
      : pendingAudit.map(a => renderSingleCardHTML(a)).join('');
  }

  const filterStatus = document.getElementById('filter-status')?.value || 'ALL';
  let normalAppts = appts;
  if (filterStatus === 'ALL') {
    normalAppts = appts.filter(a => a.status !== '已取消' && a.status !== '婉拒' && a.status !== '已結單' && !isPastAppt(a));
  } else {
    normalAppts = appts.filter(a => a.status === filterStatus);
  }

  const custContainer = document.getElementById('cust-content-area');
  if (custContainer) {
    custContainer.innerHTML = normalAppts.length === 0 
      ? '<div class="text-center text-xs text-brand-400 py-6 bg-white rounded-3xl border border-brand-200">目前無排程名單</div>'
      : normalAppts.map(a => renderSingleCardHTML(a)).join('');
  }
}

// 單一預約卡片 HTML 模板
function renderSingleCardHTML(a) {
  if (!a) return '';
  const isCompleted = (a.status === '已結單');
  const staffColor = getStaffColor(a.staffId, a.staffName);
  const cleanNotes = (a.notes || '').replace(/Email:[^|]+/g, '').trim();

  // 若開通寵物模組，檢查備註或資料中是否有毛孩資訊
  const hasPetTag = (a.notes && a.notes.includes('【毛孩:')) || false;

  return `
    <div class="bg-white p-4 rounded-2xl border-l-4 ${isCompleted ? 'border-l-emerald-500' : 'border-l-brand-400'} border border-brand-200 shadow-sm space-y-2 text-xs">
      <div class="flex justify-between items-start">
        <div>
          <div class="flex items-center gap-2">
            <span class="text-brand-500 font-bold text-sm">${a.date} ${a.time}</span>
            <span class="px-2 py-0.5 bg-brand-100 text-brand-800 rounded-full text-[10px] font-bold">${a.customer_type === 'new' ? '新朋友' : '舊朋友'}</span>
            ${hasPetTag ? '<span class="px-2 py-0.5 bg-amber-100 text-amber-900 rounded-full text-[10px] font-bold">🐾 寵物預約</span>' : ''}
          </div>
          <div class="font-bold text-brand-900 text-sm mt-0.5">${a.name} <span class="text-brand-400 font-normal">(${a.phone})</span></div>
        </div>
        <div class="flex flex-col items-end gap-1">
          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold border" style="background-color: ${staffColor.bg}; color: ${staffColor.text}; border-color: ${staffColor.border};">
            ${a.staffName || '不指定'}
          </span>
          <span class="text-[10px] font-bold ${a.status === '已確認' ? 'text-emerald-700' : (a.status === '已結單' ? 'text-blue-700' : 'text-amber-700')}">${a.status}</span>
        </div>
      </div>

      <div class="p-2.5 bg-brand-50 rounded-xl space-y-1">
        <div class="font-bold text-brand-900 flex justify-between">
          <span>施作：${a.service || '一般服務'}</span>
          <span class="text-brand-600 font-bold">$${a.price} ${isCompleted ? `<span class="text-emerald-700 font-black">(實收 $${a.finalPrice})</span>` : ''}</span>
        </div>
        ${a.notes ? `<div class="text-[11px] text-brand-600 font-medium">${a.notes}</div>` : ''}
      </div>

      <div class="flex gap-1.5 pt-1">
        <input type="text" id="admin-note-${a.id}" placeholder="內部備註..." value="${cleanNotes}" class="flex-1 p-2 text-xs border border-brand-200 rounded-xl bg-white outline-none">
        <button onclick="saveAdminQuickNote('${a.id}')" class="px-3 py-1.5 bg-[#8C7355] text-white rounded-xl font-bold text-xs shrink-0">存備註</button>
      </div>

      <div class="flex gap-1.5 pt-1 flex-wrap text-[11px] items-center">
        <a href="tel:${a.phone}" class="px-2.5 py-1 bg-[#6E8771] text-white rounded-lg font-bold">撥電話</a>
        ${a.status === '待確認' ? `
          <button class="px-2.5 py-1 bg-emerald-600 text-white rounded-lg font-bold" onclick="auditOrderStatus('${a.id}', '已確認')">核准接單</button>
          <button class="px-2.5 py-1 bg-rose-600 text-white rounded-lg font-bold" onclick="auditOrderStatus('${a.id}', '婉拒')">婉拒</button>
        ` : ''}
        ${!isCompleted ? `
          <button class="px-2.5 py-1 bg-[#7D8F7D] text-white rounded-lg font-bold" onclick="openUniversalCheckoutModal('${a.id}', '${a.name}', '${a.phone}', '${a.service}',${a.price})">結單對帳</button>
        ` : ''}
      </div>
    </div>`;
}

async function saveAdminQuickNote(id) {
  const val = document.getElementById(`admin-note-${id}`).value.trim();
  await directSupabasePatch('bookings', `id=eq.${id}`, { notes: val });
  Swal.fire({ title: '備註已儲存！', icon: 'success', timer: 800, showConfirmButton: false });
}

async function auditOrderStatus(id, newStatus) {
  Swal.showLoading();
  await directSupabasePatch('bookings', `id=eq.${id}`, { status: newStatus });
  Swal.fire({ title: `已${newStatus}！`, icon: 'success', timer: 1000, showConfirmButton: false });
  fetchDataAndRender();
}
