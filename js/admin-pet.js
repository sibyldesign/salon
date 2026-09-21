// =========================================================================
// 📌 通用寵物美容與住宿管理外掛模組（通用寵物美容與獨立住宿外掛模組） (js/admin-pet.js)
// =========================================================================

let allPetList = [];
let allBoardingList = [];

// 模組初始化進入點
async function initPetModule() {
  console.log("🐾 寵物模組 (Pet Plugin) 初始化成功");
  await fetchPetData();
}

// 載入寵物資料
async function fetchPetData() {
  try {
    const [pets, boardings] = await Promise.all([
      directSupabaseFetch(`pets?store_id=eq.${CURRENT_STORE_ID}&order=created_at.desc`),
      directSupabaseFetch(`boarding_records?store_id=eq.${CURRENT_STORE_ID}&order=check_in_date.asc`)
    ]);
    allPetList = pets || [];
    allBoardingList = boardings || [];
  } catch (err) {
    console.warn("載入寵物資料異常:", err);
  }
}

// 渲染寵物專屬管理分頁
async function renderPetPage() {
  await fetchPetData();
  renderPetProfiles();
  renderBoardingSchedule();
}

// 1. 渲染毛孩檔案卡片
function renderPetProfiles() {
  const container = document.getElementById('pet-profiles-container');
  if (!container) return;

  if (allPetList.length === 0) {
    container.innerHTML = '<div class="col-span-full text-center py-6 text-brand-400 text-xs bg-brand-50/50 rounded-2xl border border-dashed border-brand-200">尚無毛孩檔案，請點擊上方按鈕建立</div>';
    return;
  }

  container.innerHTML = allPetList.map(p => `
    <div class="p-3.5 bg-brand-50/80 rounded-2xl border border-brand-200 shadow-xs space-y-2 text-xs">
      <div class="flex justify-between items-start">
        <div class="flex items-center gap-2">
          <div class="w-10 h-10 rounded-full bg-cover bg-center border border-brand-300 shrink-0 flex items-center justify-center text-brand-400 bg-white" style="${p.photo_url ? `background-image:url('${p.photo_url}')` : ''}">
            ${!p.photo_url ? '🐶' : ''}
          </div>
          <div>
            <div class="font-bold text-brand-900 text-sm flex items-center gap-1.5">
              <span>${p.name}</span>
              <span class="text-[10px] px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded font-normal">${p.species || '犬'} / ${p.breed || '米克斯'}</span>
            </div>
            <div class="text-[11px] text-brand-500">家長：${p.customer_phone}</div>
          </div>
        </div>
        <div class="text-right">
          <span class="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded-lg text-[10.5px]">包卡: ${p.package_balance || 0} 點</span>
        </div>
      </div>

      <div class="p-2 bg-white rounded-xl border border-brand-100 text-[11px] space-y-0.5 text-brand-700">
        <div>體型：<b>${p.weight_kg ? p.weight_kg + ' kg' : '未記錄'}</b> (${p.coat_type || '一般毛質'})</div>
        <div>年齡/生日：<b>${p.age_str || (p.birth_date ? p.birth_date.split('T')[0] : '未填寫')}</b></div>
        ${p.temperament_tags ? `<div class="text-amber-800 font-medium">⚠️ 標籤：${p.temperament_tags}</div>` : ''}
      </div>

      <div class="flex gap-1.5 pt-1">
        <button onclick="promptEditPetPoints('${p.id}', '${p.name}', ${p.package_balance || 0})" class="flex-1 py-1.5 bg-white border border-brand-200 rounded-lg text-[11px] font-bold text-brand-800 hover:bg-brand-50">點數增減</button>
        <button onclick="deletePetProfile('${p.id}', '${p.name}')" class="px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-bold">刪除</button>
      </div>
    </div>
  `).join('');
}

// 2. 渲染寵物住宿排程 (若店家關閉住宿開關，整塊自動隱藏)
function renderBoardingSchedule() {
  const boardingWrapper = document.getElementById('boarding-schedule-container')?.closest('.bg-white');
  const isBoardingEnabled = Boolean(backendData.settings?.module_pet_boarding);

  if (boardingWrapper) {
    boardingWrapper.style.display = isBoardingEnabled ? 'block' : 'none';
  }
  if (!isBoardingEnabled) return;

  const container = document.getElementById('boarding-schedule-container');
  if (!container) return;

  if (allBoardingList.length === 0) {
    container.innerHTML = '<div class="text-center py-6 text-brand-400 text-xs">目前無進行中的住宿預約</div>';
    return;
  }

  container.innerHTML = allBoardingList.map(b => `
    <div class="p-3.5 bg-brand-50/70 rounded-2xl border border-brand-200 flex justify-between items-center text-xs">
      <div class="space-y-0.5">
        <div class="flex items-center gap-1.5 font-bold text-brand-900">
          <span class="text-sm">🐾 ${b.pet_name}</span>
          <span class="text-[10px] bg-[#8C7355] text-white px-2 py-0.2 rounded-md font-mono">房號 ${b.room_number}</span>
          <span class="text-[10px] bg-brand-100 text-brand-800 px-1.5 py-0.2 rounded">${b.total_days} 晚</span>
        </div>
        <div class="text-[11px] text-brand-500 font-mono">
          入住：${b.check_in_date} ${b.check_in_time} ➔ 退房：${b.check_out_date} ${b.check_out_time}
        </div>
        <div class="text-[10.5px] text-amber-800">
          供餐：${b.feed_morning ? '早' : ''}${b.feed_evening ? '晚' : ''} ${b.special_diet ? `(備註: ${b.special_diet})` : ''}
          ${b.addon_grooming_service ? ` | <b>退宿美容: ${b.addon_grooming_service}</b>` : ''}
        </div>
      </div>
      <div class="text-right shrink-0">
        <div class="font-black text-brand-900 font-mono text-sm">NT$ ${b.daily_rate * b.total_days}</div>
        <button onclick="checkoutBoardingOrder('${b.id}', '${b.pet_name}')" class="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs mt-1 transition">退房結算</button>
      </div>
    </div>
  `).join('');
}

// 3. 新增毛孩檔案彈窗
function openAddNewPetModal() {
  Swal.fire({
    title: '🐶 登記新毛孩檔案',
    html: `
      <div class="text-left text-xs space-y-2.5 font-sans">
        <div><label class="font-bold">飼主手機號碼 *：</label><input id="pet-owner-phone" class="swal2-input text-xs" placeholder="0912345678"></div>
        <div class="grid grid-cols-2 gap-2">
          <div><label class="font-bold">毛孩大名 *：</label><input id="pet-name-input" class="swal2-input text-xs" placeholder="例如：皮皮"></div>
          <div><label class="font-bold">品種：</label><input id="pet-breed-input" class="swal2-input text-xs" placeholder="例如：柴犬、貴賓"></div>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div><label class="font-bold">體重 (kg)：</label><input id="pet-weight-input" type="number" step="0.1" class="swal2-input text-xs" placeholder="例如：9.5"></div>
          <div><label class="font-bold">毛質：</label><input id="pet-coat-input" class="swal2-input text-xs" placeholder="短毛 / 捲毛 / 雙層毛"></div>
        </div>
        <div><label class="font-bold">年齡或生日：</label><input id="pet-age-input" class="swal2-input text-xs" placeholder="例如：2歲 或 2024/05/20"></div>
        <div><label class="font-bold">個性與健康特殊標籤：</label><input id="pet-tags-input" class="swal2-input text-xs" placeholder="例如：會兇、怕剪指甲、有心臟病"></div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: '建立毛孩檔案',
    confirmButtonColor: '#8C7355',
    cancelButtonText: '取消',
    preConfirm: () => {
      const phone = document.getElementById('pet-owner-phone').value.trim();
      const name = document.getElementById('pet-name-input').value.trim();
      if (!phone || !name) {
        Swal.showValidationMessage('飼主電話與毛孩姓名為必填！');
        return false;
      }
      return {
        customer_phone: phone,
        name: name,
        breed: document.getElementById('pet-breed-input').value.trim(),
        weight_kg: Number(document.getElementById('pet-weight-input').value || 0),
        coat_type: document.getElementById('pet-coat-input').value.trim(),
        age_str: document.getElementById('pet-age-input').value.trim(),
        temperament_tags: document.getElementById('pet-tags-input').value.trim()
      };
    }
  }).then(async r => {
    if (r.isConfirmed && r.value) {
      Swal.showLoading();
      try {
        await directSupabaseUpsert('pets', Object.assign({ store_id: CURRENT_STORE_ID }, r.value), 'id');
        Swal.fire('建立成功！', `毛孩【${r.value.name}】已成功建檔`, 'success');
        renderPetPage();
      } catch (err) {
        Swal.fire('建立失敗', err.message, 'error');
      }
    }
  });
}

// 4. 毛孩包卡點數手動增減
function promptEditPetPoints(petId, petName, curPoints) {
  Swal.fire({
    title: `調整【${petName}】專屬包卡點數`,
    text: `目前剩餘：${curPoints} 點`,
    input: 'number',
    inputPlaceholder: '輸入欲增加或扣除後的最新總點數',
    inputValue: curPoints,
    showCancelButton: true,
    confirmButtonText: '確認更新',
    confirmButtonColor: '#8C7355',
    cancelButtonText: '取消'
  }).then(async r => {
    if (r.isConfirmed && r.value !== '') {
      const newPoints = Number(r.value);
      await directSupabasePatch('pets', `id=eq.${petId}`, { package_balance: newPoints });
      Swal.fire('已更新點數！', `最新剩餘點數：${newPoints} 點`, 'success');
      renderPetPage();
    }
  });
}

// 5. 刪除毛孩檔案
function deletePetProfile(petId, petName) {
  Swal.fire({
    title: `確定刪除毛孩【${petName}】？`,
    text: '此操作將同步移除其個別點數紀錄。',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    confirmButtonText: '確定刪除',
    cancelButtonText: '取消'
  }).then(async r => {
    if (r.isConfirmed) {
      await fetch(`${SUPABASE_URL}/rest/v1/pets?id=eq.${petId}`, {
        method: "DELETE",
        headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` }
      });
      Swal.fire('已刪除！', '', 'success');
      renderPetPage();
    }
  });
}

// 6. 建立寵物住宿預約彈窗
function openNewBoardingModal() {
  Swal.fire({
    title: '🏨 建立寵物住宿與安親',
    html: `
      <div class="text-left text-xs space-y-2.5 font-sans">
        <div><label class="font-bold">毛孩大名 *：</label><input id="b-pet-name" class="swal2-input text-xs" placeholder="例如：皮皮"></div>
        <div><label class="font-bold">飼主電話 *：</label><input id="b-cust-phone" class="swal2-input text-xs" placeholder="0912345678"></div>
        <div class="grid grid-cols-2 gap-2">
          <div><label class="font-bold">房號/籠號 *：</label><input id="b-room" class="swal2-input text-xs" placeholder="例：A01"></div>
          <div><label class="font-bold">每晚費用 (NT$)：</label><input id="b-daily-rate" type="number" class="swal2-input text-xs" value="800"></div>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div><label class="font-bold">入住日期：</label><input type="date" id="b-checkin-date" class="swal2-input text-xs"></div>
          <div><label class="font-bold">入住時間：</label><input type="time" id="b-checkin-time" class="swal2-input text-xs" value="10:00"></div>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div><label class="font-bold">預計退房：</label><input type="date" id="b-checkout-date" class="swal2-input text-xs"></div>
          <div><label class="font-bold">退房時間：</label><input type="time" id="b-checkout-time" class="swal2-input text-xs" value="18:00"></div>
        </div>
        <div class="p-2.5 bg-brand-50 rounded-xl space-y-1">
          <label class="font-bold block">供餐設定：</label>
          <label class="inline-flex items-center gap-1 mr-3"><input type="checkbox" id="b-feed-am" checked class="accent-brand-500"> 早餐</label>
          <label class="inline-flex items-center gap-1"><input type="checkbox" id="b-feed-pm" checked class="accent-brand-500"> 晚餐</label>
          <input type="text" id="b-diet-note" class="w-full mt-1 p-1.5 border border-brand-200 rounded text-xs bg-white" placeholder="自備飼料 / 需拌罐頭等備註">
        </div>
        <div>
          <label class="font-bold">退房當天加做美容洗澡 (選填)：</label>
          <input type="text" id="b-addon-grooming" class="swal2-input text-xs" placeholder="例：精緻洗澡 + 剪指甲">
        </div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: '登記住宿',
    confirmButtonColor: '#8C7355',
    cancelButtonText: '取消',
    preConfirm: () => {
      const petName = document.getElementById('b-pet-name').value.trim();
      const phone = document.getElementById('b-cust-phone').value.trim();
      const inDate = document.getElementById('b-checkin-date').value;
      const outDate = document.getElementById('b-checkout-date').value;
      if (!petName || !phone || !inDate || !outDate) {
        Swal.showValidationMessage('毛孩名、電話與入住退房日期為必填！');
        return false;
      }
      const d1 = new Date(inDate);
      const d2 = new Date(outDate);
      const totalDays = Math.max(1, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)));

      return {
        pet_name: petName,
        customer_phone: phone,
        room_number: document.getElementById('b-room').value.trim() || 'A01',
        daily_rate: Number(document.getElementById('b-daily-rate').value || 800),
        check_in_date: inDate,
        check_in_time: document.getElementById('b-checkin-time').value,
        check_out_date: outDate,
        check_out_time: document.getElementById('b-checkout-time').value,
        feed_morning: document.getElementById('b-feed-am').checked,
        feed_evening: document.getElementById('b-feed-pm').checked,
        special_diet: document.getElementById('b-diet-note').value.trim(),
        addon_grooming_service: document.getElementById('b-addon-grooming').value.trim(),
        total_days: totalDays,
        status: 'booked'
      };
    }
  }).then(async r => {
    if (r.isConfirmed && r.value) {
      Swal.showLoading();
      try {
        await directSupabaseUpsert('boarding_records', Object.assign({ store_id: CURRENT_STORE_ID }, r.value), 'id');
        Swal.fire('住宿登記完成！', `已排定【${r.value.pet_name}】住宿共 ${r.value.total_days} 晚`, 'success');
        renderPetPage();
      } catch(err) {
        Swal.fire('登記失敗', err.message, 'error');
      }
    }
  });
}

// 7. 住宿退房結算
async function checkoutBoardingOrder(boardingId, petName) {
  Swal.fire({
    title: `確定辦理【${petName}】退房結算？`,
    text: '結算後將標記為已退房離開。',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: '確定退房',
    confirmButtonColor: '#8C7355'
  }).then(async r => {
    if (r.isConfirmed) {
      await directSupabasePatch('boarding_records', `id=eq.${boardingId}`, { status: 'checked_out' });
      Swal.fire('退房完成！', '', 'success');
      renderPetPage();
    }
  });
}

// =========================================================================
// 📌 寵物住宿房況甘特圖、每日放飯供餐核對與毛孩動態欄位 (js/admin-pet.js)
// =========================================================================

// 1. 即時渲染寵物住宿房況與格網看板
function renderBoardingRoomStatus() {
  const container = document.getElementById('boarding-room-grid');
  const activeCountEl = document.getElementById('boarding-active-count');
  const checkoutCountEl = document.getElementById('boarding-checkout-count');
  const vacancyRateEl = document.getElementById('boarding-vacancy-rate');
  const viewDateInput = document.getElementById('boarding-view-date');
  
  if (!container) return;

  const todayStr = viewDateInput?.value ? viewDateInput.value.replace(/-/g, '/') : new Date().toISOString().split('T')[0].replace(/-/g, '/');
  if (viewDateInput && !viewDateInput.value) {
    viewDateInput.value = todayStr.replace(/\//g, '-');
  }

  const appts = backendData.appointments || [];
  // 篩選出住宿型態訂單
  const boardingAppts = appts.filter(a => (a.service || '').includes('住宿') && a.status !== '已取消' && a.status !== '婉拒');

  // 定義 6 間標準門市房型 (可依需求擴充)
  const defaultRooms = [
    { id: 'R101', name: '溫馨小挑高房 A', type: '小型犬貓', maxWeight: 8 },
    { id: 'R102', name: '陽光舒活房 B', type: '中小型犬', maxWeight: 15 },
    { id: 'R103', name: '景觀獨立大房 C', type: '中大型犬', maxWeight: 25 },
    { id: 'R104', name: '旗艦奢華套房 D', type: '大型犬', maxWeight: 40 },
    { id: 'R105', name: '貓咪專屬垂直跳台房 E', type: '貓咪專用', maxWeight: 10 },
    { id: 'R106', name: '友善靜音照護房 F', type: '老犬/特殊照護', maxWeight: 20 }
  ];

  let occupiedCount = 0;
  let checkoutTodayCount = 0;

  const roomCardsHtml = defaultRooms.map((room, idx) => {
    // 檢查是否有毛孩正在此房位 (依序安排或指定)
    const activeBooking = boardingAppts.find((b, bIdx) => (bIdx % defaultRooms.length) === idx && b.date <= todayStr);
    const isOccupied = Boolean(activeBooking);

    if (isOccupied) {
      occupiedCount++;
      if (activeBooking.notes && activeBooking.notes.includes('退房')) checkoutTodayCount++;
    }

    let petName = '無住宿客';
    let petDetails = '空房清潔中，可隨時登記入住';
    if (isOccupied) {
      const petMatch = (activeBooking.notes || '').match(/【毛孩:\s*([^/]+)\s*\/\s*([^/]+)\s*\/\s*([^/]+)/);
      petName = petMatch ? `${petMatch[1].trim()} (${petMatch[2].trim()})` : activeBooking.name;
      petDetails = `飼主：${activeBooking.name} (${activeBooking.phone})<br>期間：${activeBooking.date} 入住`;
    }

    return `
      <div class="p-3.5 rounded-2xl border transition shadow-2xs ${isOccupied ? 'bg-amber-50/70 border-amber-300' : 'bg-white border-brand-200'}">
        <div class="flex justify-between items-center pb-1.5 border-b ${isOccupied ? 'border-amber-200' : 'border-brand-100'}">
          <span class="font-bold text-xs ${isOccupied ? 'text-amber-950' : 'text-brand-900'} font-mono">${room.id} ${room.name}</span>
          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${isOccupied ? 'bg-amber-200 text-amber-900' : 'bg-emerald-100 text-emerald-800'}">
            ${isOccupied ? '在宿中' : '空房'}
          </span>
        </div>
        <div class="mt-2 space-y-1 text-xs">
          <div class="font-black ${isOccupied ? 'text-amber-900' : 'text-brand-400'} text-sm">${petName}</div>
          <div class="text-[11px] text-brand-500 leading-snug">${petDetails}</div>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = roomCardsHtml;
  if (activeCountEl) activeCountEl.innerText = `${occupiedCount} 隻`;
  if (checkoutCountEl) checkoutCountEl.innerText = `${checkoutTodayCount} 隻`;
  if (vacancyRateEl) {
    const rate = Math.round(((defaultRooms.length - occupiedCount) / defaultRooms.length) * 100);
    vacancyRateEl.innerText = `${rate}%`;
  }

  renderBoardingCareChecklist(boardingAppts, todayStr);
}

// 2. 每日早/中/晚放飯供餐核對表
function renderBoardingCareChecklist(boardingAppts, todayStr) {
  const container = document.getElementById('boarding-care-checklist');
  if (!container) return;

  const bSettings = backendData.settings?.boardingSettings || {};
  const bTime = bSettings.breakfastTime || '09:00';
  const lTime = bSettings.lunchTime || '12:30';
  const dTime = bSettings.dinnerTime || '18:00';

  if (!boardingAppts || boardingAppts.length === 0) {
    container.innerHTML = '<div class="text-center py-4 text-brand-400 text-xs">今日無在宿毛孩供餐任務</div>';
    return;
  }

  container.innerHTML = boardingAppts.map(b => {
    const petMatch = (b.notes || '').match(/【毛孩:\s*([^/]+)\s*\/\s*([^/]+)/);
    const petDisplayName = petMatch ? `${petMatch[1].trim()} (${petMatch[2].trim()})` : b.name;
    const isSpecialFood = (b.notes || '').includes('鮮食');

    return `
      <div class="p-3 bg-brand-50 rounded-2xl border border-brand-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <div class="font-bold text-brand-900 text-xs">
            🐾 ${petDisplayName} 
            <span class="text-[10px] text-brand-500 font-mono">(${b.phone})</span>
            ${isSpecialFood ? '<span class="ml-1.5 px-1.5 py-0.2 bg-amber-100 text-amber-900 rounded text-[9px] font-bold">精緻鮮食</span>' : '<span class="ml-1.5 px-1.5 py-0.2 bg-stone-100 text-stone-700 rounded text-[9px] font-bold">自備乾糧</span>'}
          </div>
          <div class="text-[11px] text-brand-500 mt-0.5">${b.notes || '無特殊照護指示'}</div>
        </div>
        <div class="flex items-center gap-2 text-xs font-bold">
          <label class="flex items-center gap-1 cursor-pointer bg-white px-2 py-1 rounded-lg border border-brand-200">
            <input type="checkbox" class="accent-[#8C7355]"> 早 ${bTime}
          </label>
          <label class="flex items-center gap-1 cursor-pointer bg-white px-2 py-1 rounded-lg border border-brand-200">
            <input type="checkbox" class="accent-[#8C7355]"> 午 ${lTime}
          </label>
          <label class="flex items-center gap-1 cursor-pointer bg-white px-2 py-1 rounded-lg border border-brand-200">
            <input type="checkbox" class="accent-[#8C7355]"> 晚 ${dTime}
          </label>
        </div>
      </div>
    `;
  }).join('');
}

// 3. 毛孩自訂收集欄位清單渲染與動態新增
function renderCustomFieldsAdminList() {
  const container = document.getElementById('custom-fields-list-box');
  if (!container) return;

  const extraFields = backendData.settings?.petCustomFields?.extraFields || [];
  if (extraFields.length === 0) {
    container.innerHTML = '<div class="text-center py-2 text-brand-400 text-xs">尚無自訂欄位，點選上方按鈕新增</div>';
    return;
  }

  container.innerHTML = extraFields.map((f, idx) => `
    <div class="p-2.5 bg-brand-50 rounded-xl border border-brand-200 flex justify-between items-center text-xs">
      <div>
        <span class="font-bold text-brand-900">${f.name}</span>
        <span class="text-[10px] text-brand-400 ml-1">(${f.type === 'text' ? '文字輸入' : '勾選框'})</span>
      </div>
      <button onclick="removeExtraCustomField(${idx})" class="text-rose-500 hover:text-rose-700 p-1">
        <i class="fa-solid fa-trash-can text-[11px]"></i>
      </button>
    </div>
  `).join('');
}

function promptAddCustomField() {
  Swal.fire({
    title: '新增前台自訂收集欄位',
    html: `
      <div class="text-left text-xs space-y-2">
        <div><label class="font-bold">欄位名稱：</label><input id="new-cf-name" class="swal2-input text-xs" placeholder="例如：防蚤項圈配戴紀錄"></div>
        <div><label class="font-bold">填寫型態：</label>
          <select id="new-cf-type" class="swal2-input text-xs">
            <option value="text">文字單行輸入</option>
            <option value="checkbox">是否核對勾選框</option>
          </select>
        </div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: '確定加入',
    confirmButtonColor: '#8C7355',
    preConfirm: () => ({
      name: document.getElementById('new-cf-name').value.trim(),
      type: document.getElementById('new-cf-type').value
    })
  }).then(r => {
    if (r.isConfirmed && r.value.name) {
      if (!backendData.settings.petCustomFields) backendData.settings.petCustomFields = {};
      if (!backendData.settings.petCustomFields.extraFields) backendData.settings.petCustomFields.extraFields = [];
      backendData.settings.petCustomFields.extraFields.push(r.value);
      renderCustomFieldsAdminList();
      Swal.fire({ title: '自訂欄位已加入！', icon: 'success', timer: 1000, showConfirmButton: false });
    }
  });
}

function removeExtraCustomField(idx) {
  backendData.settings.petCustomFields.extraFields.splice(idx, 1);
  renderCustomFieldsAdminList();
}
