// =========================================================================
// 📌 行銷、方案規則庫、評價審核與空檔釋出模組 (js/admin-marketing.js)
// =========================================================================

let allWalletList = [];
let filteredWalletList = [];
let walletCurrentPage = 1;

let allPkgList = [];
let filteredPkgList = [];
let pkgCurrentPage = 1;

let pendingSlotsList = [];

// 1. 行銷中心資料載入
async function loadMarketingCenter() {
  try {
    allWalletList = await directSupabaseFetch(`customers?store_id=eq.${CURRENT_STORE_ID}&order=wallet_balance.desc`);
    filteredWalletList = [...(allWalletList || [])];
    renderWalletTable();

    allPkgList = await directSupabaseFetch(`customer_packages?store_id=eq.${CURRENT_STORE_ID}&order=remaining_times.desc`);
    filteredPkgList = [...(allPkgList || [])];
    renderPkgTable();

    renderPlanRules();
    loadCoupons();
  } catch(e) {
    console.warn("載入行銷中心資料略過:", e);
  }
}

// 2. 前台說明文字保存
async function savePromoRulesText() {
  const text = document.getElementById('cfg-promo-rules-input').value.trim();
  await directSupabasePatch('store_settings', `store_id=eq.${CURRENT_STORE_ID}`, { promo_rules_text: text });
  if (backendData.settings) backendData.settings.promoRulesText = text;
  Swal.fire('說明內容已保存！', '前台加購說明區塊已同步生效', 'success');
}

// 3. 門市方案規則庫 (前台加購選單連動)
function renderPlanRules() {
  const wContainer = document.getElementById('wallet-rules-container');
  const pContainer = document.getElementById('package-rules-container');
  const s = backendData.settings || {};

  if (wContainer) {
    const wList = s.wallet_rules || s.walletRules || [];
    wContainer.innerHTML = wList.length === 0 
      ? '<div class="col-span-full text-center py-3 text-brand-400 text-xs">尚未建立儲值方案</div>'
      : wList.map((w, idx) => `
        <div class="p-3 bg-brand-50 rounded-2xl border border-brand-200 flex justify-between items-center text-xs">
          <div>
            <div class="font-bold text-brand-900">${w.name}</div>
            <div class="text-[11px] text-brand-500">本金 $${w.price} | 贈 $${w.bonus || 0} | 享 ${Math.round((w.discount || 1) * 100) / 10} 折</div>
          </div>
          <button onclick="deleteWalletRule(${idx})" class="text-rose-500 hover:text-rose-700 font-bold p-1"><i class="fa-solid fa-trash-can"></i></button>
        </div>
      `).join('');
  }

  if (pContainer) {
    const pList = s.package_rules || s.packageRules || [];
    pContainer.innerHTML = pList.length === 0
      ? '<div class="col-span-full text-center py-3 text-brand-400 text-xs">尚未建立包卡方案</div>'
      : pList.map((p, idx) => `
        <div class="p-3 bg-brand-50 rounded-2xl border border-brand-200 flex justify-between items-center text-xs">
          <div>
            <div class="font-bold text-brand-900">${p.name}</div>
            <div class="text-[11px] text-brand-500">項目：${p.service_name} | 共 ${p.times} 堂 | $${p.price}</div>
          </div>
          <button onclick="deletePackageRule(${idx})" class="text-rose-500 hover:text-rose-700 font-bold p-1"><i class="fa-solid fa-trash-can"></i></button>
        </div>
      `).join('');
  }
}

function openAddWalletRuleModal() {
  Swal.fire({
    title: '新增門市儲值金方案',
    html: `
      <div class="text-left text-xs space-y-2">
        <div><label class="font-bold">方案名稱：</label><input id="wrule-name" class="swal2-input text-xs" placeholder="例：尊榮儲值 $5,000"></div>
        <div><label class="font-bold">儲值本金：</label><input id="wrule-price" type="number" class="swal2-input text-xs" placeholder="例：5000"></div>
        <div><label class="font-bold">加贈紅利金：</label><input id="wrule-bonus" type="number" class="swal2-input text-xs" placeholder="例：600" value="0"></div>
        <div><label class="font-bold">全店折數 (0.85 代表 85折)：</label><input id="wrule-discount" type="number" step="0.05" class="swal2-input text-xs" value="0.9"></div>
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
      const list = backendData.settings.wallet_rules || backendData.settings.walletRules || [];
      list.push(r.value);
      await directSupabasePatch('store_settings', `store_id=eq.${CURRENT_STORE_ID}`, { wallet_rules: list });
      backendData.settings.wallet_rules = list;
      backendData.settings.walletRules = list;
      renderPlanRules();
      Swal.fire('方案已建立！', '前台方案選單已自動連動', 'success');
    }
  });
}

async function deleteWalletRule(idx) {
  const list = backendData.settings.wallet_rules || backendData.settings.walletRules || [];
  list.splice(idx, 1);
  await directSupabasePatch('store_settings', `store_id=eq.${CURRENT_STORE_ID}`, { wallet_rules: list });
  backendData.settings.wallet_rules = list;
  renderPlanRules();
}

function openAddPackageRuleModal() {
  const svcs = backendData.services || [];
  let opts = svcs.map(s => `<option value="${s.name}">${s.name}</option>`).join('');
  Swal.fire({
    title: '新增門市包卡方案',
    html: `
      <div class="text-left text-xs space-y-2">
        <div><label class="font-bold">方案名稱：</label><input id="prule-name" class="swal2-input text-xs" placeholder="例：剪髮買5送1方案"></div>
        <div><label class="font-bold">對應服務項目：</label><select id="prule-service" class="swal2-input text-xs">${opts}</select></div>
        <div><label class="font-bold">總堂數 (含贈送)：</label><input id="prule-times" type="number" class="swal2-input text-xs" value="6"></div>
        <div><label class="font-bold">販售總價格：</label><input id="prule-price" type="number" class="swal2-input text-xs" placeholder="例：4000"></div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: '確定建立',
    confirmButtonColor: '#8C7355',
    preConfirm: () => ({
      name: document.getElementById('prule-name').value.trim(),
      service_name: document.getElementById('prule-service').value,
      times: Number(document.getElementById('prule-times').value || 1),
      price: Number(document.getElementById('prule-price').value || 0)
    })
  }).then(async r => {
    if (r.isConfirmed && r.value.name) {
      const list = backendData.settings.package_rules || backendData.settings.packageRules || [];
      list.push(r.value);
      await directSupabasePatch('store_settings', `store_id=eq.${CURRENT_STORE_ID}`, { package_rules: list });
      backendData.settings.package_rules = list;
      backendData.settings.packageRules = list;
      renderPlanRules();
      Swal.fire('包卡方案已建立！', '前台方案選單已自動連動', 'success');
    }
  });
}

async function deletePackageRule(idx) {
  const list = backendData.settings.package_rules || backendData.settings.packageRules || [];
  list.splice(idx, 1);
  await directSupabasePatch('store_settings', `store_id=eq.${CURRENT_STORE_ID}`, { package_rules: list });
  backendData.settings.package_rules = list;
  renderPlanRules();
}

// 4. 顧客好評審核
async function loadAdminReviews() {
  try {
    const reviews = await directSupabaseFetch(`customer_reviews?store_id=eq.${CURRENT_STORE_ID}&order=created_at.desc`);
    const countBadge = document.getElementById('review-count-badge');
    if (countBadge) countBadge.innerText = `共 ${reviews.length} 則評價`;
    const container = document.getElementById('admin-reviews-container');
    if (!container) return;
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
            <span class="text-[10px] text-gray-400">${r.created_at ? r.created_at.split('T')[0] : ''}</span>
          </div>
          <div class="flex flex-wrap gap-1">
            ${(r.tags || []).map(t => `<span class="px-2 py-0.5 bg-brand-100 text-brand-700 text-[10px] rounded-md font-bold">${t}</span>`).join('')}
          </div>
          <p class="text-brand-600">${r.comment || '滿意推薦！'}</p>
        </div>
        <button onclick="toggleReviewApproval('${r.id}', ${!r.is_approved})" class="px-3 py-1.5 rounded-xl font-bold transition text-xs shrink-0 ${r.is_approved ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}">
          ${r.is_approved ? '✓ 已上架' : '下架中 (點擊上架)'}
        </button>
      </div>
    `).join('');
  } catch(e) {}
}

async function toggleReviewApproval(id, toApprove) {
  await directSupabasePatch('customer_reviews', `id=eq.${id}`, { is_approved: toApprove });
  loadAdminReviews();
}

function renderReviewTagsManager() {
  const box = document.getElementById('review-tags-manage-box');
  if (!box) return;
  const tags = backendData.settings?.review_tags || backendData.settings?.reviewTags || ["細心溫柔", "完全不推銷", "手法專業", "環境極放鬆", "成效超滿意"];
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
    inputPlaceholder: '例如：溝通親切',
    showCancelButton: true,
    confirmButtonText: '新增',
    confirmButtonColor: '#8C7355'
  }).then(async r => {
    if (r.isConfirmed && r.value) {
      const tags = backendData.settings?.review_tags || backendData.settings?.reviewTags || [];
      tags.push(r.value.trim());
      await directSupabasePatch('store_settings', `store_id=eq.${CURRENT_STORE_ID}`, { review_tags: tags });
      if (backendData.settings) backendData.settings.review_tags = tags;
      renderReviewTagsManager();
    }
  });
}

async function deleteReviewTag(idx) {
  const tags = backendData.settings?.review_tags || backendData.settings?.reviewTags || [];
  tags.splice(idx, 1);
  await directSupabasePatch('store_settings', `store_id=eq.${CURRENT_STORE_ID}`, { review_tags: tags });
  if (backendData.settings) backendData.settings.review_tags = tags;
  renderReviewTagsManager();
}

// 5. 空檔釋出與 9:16 限動網址產生
function handleSlotRangeChange() {
  const startVal = document.getElementById('slot-start-date')?.value;
  const endVal = document.getElementById('slot-end-date')?.value;
  if (!startVal) return;

  pendingSlotsList = [];
  renderPendingSlotsList();

  const container = document.getElementById('slot-picker-checkboxes');
  if (!container) return;
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
        <span class="font-bold text-xs">${t}</span>
        <input type="checkbox" value="${t}" data-date="${dayStr}" onchange="toggleSlotPick('${dayStr}', '${t}', this)" class="accent-brand-500">
      </label>
    `).join('')}
  `).join('');
}

function toggleSlotPick(d, t, cb) {
  if (cb.checked) {
    pendingSlotsList.push({ date: d, time: t });
  } else {
    pendingSlotsList = pendingSlotsList.filter(s => !(s.date === d && s.time === t));
  }
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
      <button onclick="removePendingSlot(${idx})" class="text-brand-400 hover:text-red-500 font-bold">×</button>
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
    const slotsUrl = `https://salon.heysibyl.com/slots.html?store_id=${CURRENT_STORE_ID}`;
    const liveElem = document.getElementById('slots-live-url');
    if (liveElem) { liveElem.href = slotsUrl; liveElem.innerText = slotsUrl; }
    Swal.fire({
      title: '空檔頁面已成功發布！',
      html: `<div class="text-xs text-brand-800 text-left bg-brand-50 p-3 rounded-2xl border border-brand-200"><a href="${slotsUrl}" target="_blank" class="text-blue-600 underline break-all">${slotsUrl}</a></div>`,
      icon: 'success'
    });
  } catch(e) {
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

// 6. 折扣碼載入
async function loadCoupons() {
  try {
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
  } catch(e) {}
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
        <div><label class="font-bold">折扣代碼 (如 VIP88)：</label><input id="cp-code" class="swal2-input text-xs uppercase" placeholder="例如：SPRING100"></div>
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
