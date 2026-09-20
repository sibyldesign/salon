// =========================================================================
// 📌 專員排班與時段矩陣開關模組（專員排班與時段矩陣管理） (admin-shift.js)
// =========================================================================

let currentShiftDate = 'ALL';
let activeShiftStaffId = 'all';
let shiftSlotStates = {};

function renderShift() {
  let staffList = (backendData.settings?.staff_list || []).slice();
  if (!staffList.some(s => s.id === 'all')) {
    staffList.unshift({ id: "all", name: "不指定" });
  }

  const staffBtns = document.getElementById('staff-shift-buttons');
  if (staffBtns) {
    staffBtns.innerHTML = staffList.map(s => {
      const color = getStaffColor(s.id, s.name);
      const isSelected = (activeShiftStaffId === s.id);
      return `
        <button type="button" class="px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap border transition inline-flex items-center gap-1.5 ${
          isSelected ? 'bg-[#8C7355] text-white border-[#8C7355] shadow-xs' : 'bg-white border-brand-200 text-brand-800 hover:bg-brand-50'
        }" onclick="switchShiftStaff('${s.id}')">
          <span class="w-2 h-2 rounded-full shrink-0" style="background-color: ${isSelected ? '#FFFFFF' : color.dot};"></span>
          <span>${s.name}</span>
        </button>`;
    }).join('');
  }

  const scrollArea = document.getElementById('shift-scroll-area');
  const today = new Date();
  const dates = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    dates.push(`${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`);
  }

  if (scrollArea) {
    let html = `<div class="shrink-0 px-3.5 py-1.5 rounded-xl text-center cursor-pointer border text-xs font-bold transition ${currentShiftDate === 'ALL' ? 'bg-[#8C7355] text-white border-[#8C7355]' : 'bg-white border-brand-200 text-brand-700'}" onclick="selectShiftDate('ALL')">全部日期</div>`;
    dates.forEach(dStr => {
      const parts = dStr.split('/');
      html += `
        <div class="shrink-0 px-3 py-1.5 rounded-xl text-center cursor-pointer border text-xs font-bold transition ${currentShiftDate === dStr ? 'bg-[#8C7355] text-white border-[#8C7355]' : 'bg-white border-brand-200 text-brand-800'}" onclick="selectShiftDate('${dStr}')">
          <div class="text-[9px] opacity-70">${parts[1]}月</div>
          <div class="font-bold text-xs">${parts[2]}日</div>
        </div>`;
    });
    scrollArea.innerHTML = html;
  }

  const content = document.getElementById('shift-content-area');
  if (!content) return;

  if (currentShiftDate === 'ALL') {
    content.innerHTML = `
      <div class="space-y-2">
        ${dates.slice(0, 7).map(d => `
          <div class="p-3.5 bg-white rounded-2xl border border-brand-200 flex justify-between items-center shadow-xs text-xs">
            <span class="font-bold text-brand-900">${d}</span>
            <button class="px-3.5 py-1.5 bg-brand-100 hover:bg-brand-200 text-brand-800 font-bold rounded-xl text-xs transition" onclick="selectShiftDate('${d}')">排定時段 ➔</button>
          </div>
        `).join('')}
      </div>`;
    return;
  }

  const start = backendData.settings?.shift_start_time || '09:00';
  const end = backendData.settings?.shift_end_time || '19:00';
  const interval = Number(backendData.settings?.shift_interval || 30);
  const [sH, sM] = start.split(':').map(Number);
  const [eH, eM] = end.split(':').map(Number);
  const slots = [];
  for (let m = sH * 60 + sM; m <= eH * 60 + eM; m += interval) {
    const hh = Math.floor(m / 60); const mm = m % 60;
    slots.push((hh < 10 ? '0' + hh : hh) + ':' + (mm === 0 ? '00' : mm));
  }

  const staffKey = `${activeShiftStaffId}_${currentShiftDate}`;
  const cloudSchedules = backendData.settings?.staff_schedules || {};
  if (!shiftSlotStates[staffKey]) {
    shiftSlotStates[staffKey] = Object.assign({}, cloudSchedules[staffKey] || {});
    slots.forEach(t => {
      if (shiftSlotStates[staffKey][t] === undefined) shiftSlotStates[staffKey][t] = false;
    });
  }

  content.innerHTML = `
    <div class="bg-white rounded-3xl border border-brand-200 overflow-hidden shadow-sm">
      <div class="p-4 bg-brand-50 border-b border-brand-200 flex justify-between items-center">
        <span class="font-bold text-xs text-brand-900">📅 ${currentShiftDate} 班表</span>
        <div class="flex gap-1.5">
          <button type="button" class="px-2.5 py-1 border border-brand-300 rounded-lg text-xs font-bold hover:bg-brand-100" onclick="toggleAllShift('${staffKey}', false)">全休</button>
          <button type="button" class="px-2.5 py-1 bg-[#8C7355] text-white rounded-lg text-xs font-bold" onclick="toggleAllShift('${staffKey}', true)">全開</button>
        </div>
      </div>
      <div class="divide-y divide-brand-100 max-h-[60vh] overflow-y-auto">
        ${slots.map(t => {
          const isOpen = shiftSlotStates[staffKey][t] === true;
          return `
            <div class="p-3 flex justify-between items-center text-xs">
              <span class="font-bold text-brand-800 font-mono text-sm">${t}</span>
              <button type="button" class="px-4 py-1.5 rounded-full text-xs font-bold transition ${isOpen ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}" onclick="toggleSlotState('${staffKey}', '${t}', this)">
                ${isOpen ? '上班中' : '已關閉'}
              </button>
            </div>`;
        }).join('')}
      </div>
    </div>`;
}

function switchShiftStaff(id) { activeShiftStaffId = id; renderShift(); }
function selectShiftDate(d) { currentShiftDate = d; renderShift(); }

function toggleSlotState(staffKey, timeStr, btn) {
  const newState = !(shiftSlotStates[staffKey][timeStr] === true);
  shiftSlotStates[staffKey][timeStr] = newState;
  btn.className = `px-4 py-1.5 rounded-full text-xs font-bold transition ${newState ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`;
  btn.innerText = newState ? '上班中' : '已關閉';
  syncShiftStatesToCloud();
}

function toggleAllShift(staffKey, isOpen) {
  Object.keys(shiftSlotStates[staffKey]).forEach(t => { shiftSlotStates[staffKey][t] = isOpen; });
  renderShift();
  syncShiftStatesToCloud();
}

async function syncShiftStatesToCloud() {
  await directSupabaseUpsert('store_settings', {
    store_id: CURRENT_STORE_ID,
    staff_schedules: shiftSlotStates
  }, 'store_id');
}
