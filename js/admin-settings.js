// =========================================================================
// 📌 全域設定管理與 Feature Flags 模組（全域設定與 Feature Flags 引擎） (admin-settings.js)
// =========================================================================

const DEFAULT_MOHW_BEAUTY_CONTRACT = `衛生福利部112年6月8日衛授疾字第1120300459號函發布
【美容/美髮定型化契約書 (公版範本)】

立契約書人：消費者 (以下簡稱甲方) 與 美業/寵物服務業者 (以下簡稱乙方)
簽訂契約前，乙方已將本契約交付甲方審閱，並確認甲方已詳閱各條款。甲乙雙方同意就預約服務事項依下列約定辦理：

第 一 條 (服務範圍明確性)
本契約服務總費用(含技術費、材料費與專員指定費)依預約明細確認，未明列之項目乙方不得強制加收。

第 二 條 (健康與體質告知義務)
甲方於實施服務前應誠實告知過敏史、特殊膚質、病史或毛孩是否有攻擊性。任一方發現異常現象應即時中止。

第 三 條 (改期與解約約定)
因個人因素需改期請提前 24 小時提出。若於服務前解約，已繳費用扣除法定行政手續費後退還。

本契約經甲方於線上確認並完成親筆數位簽章後生效，系統自動寄發副本存證。`;

// 回填設定表單 (安全賦值，絕不用空值覆蓋既有畫面)
// 1. 設定表單資料回填
function populateSettings() {
  const s = backendData.settings || {};
  const setVal = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined && val !== null) el.value = val; };
  const setCheck = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined && val !== null) el.checked = Boolean(val); };

  // 基礎品牌資料
  setVal('cfg-title', s.storeName);
  setVal('cfg-subtitle', s.subtitle);
  setVal('cfg-logo', s.logoUrl);
  setVal('cfg-phone', s.storePhone || '');
  setVal('cfg-address', s.address);
  setVal('cfg-hours', s.businessHours);
  setVal('cfg-buffer', s.bookingBufferHours || 1);
  setVal('cfg-line', s.line);
  setVal('cfg-ig', s.ig);
  setVal('cfg-map', s.map);
  setVal('cfg-line-token', s.lineChannelToken);
  setVal('cfg-promo', s.promoText);
  setVal('cfg-promo-rules-input', s.promoRulesText);
  setVal('cfg-commission-rate', s.commissionRate || 50);

  // 營運模式單選 (beauty / pet)
  const industryRadios = document.querySelectorAll('input[name="cfg-industry-type"]');
  industryRadios.forEach(r => { r.checked = (r.value === (s.industryType || 'pet')); });

  // 寵物住宿進階營運規則
  const bs = s.boardingSettings || {};
  setVal('cfg-meal-time-breakfast', bs.breakfastTime || '09:00');
  setVal('cfg-meal-time-lunch', bs.lunchTime || '12:30');
  setVal('cfg-meal-time-dinner', bs.dinnerTime || '18:00');
  setCheck('cfg-mandatory-checkin-bath', bs.mandatoryCheckinBath ?? false);
  setCheck('cfg-allow-checkout-bath', bs.allowCheckoutBath ?? true);
  setCheck('cfg-toggle-stay-notice', bs.toggleNotice ?? true);
  setVal('cfg-stay-notice-content', bs.noticeContent || "1. 入住前請確保毛孩已施打核心疫苗並出示證明。\n2. 請自備毛孩習慣食用之飼料及睡墊。\n3. 若毛孩有護食或重大病史，敬請於預約時誠實告知。");

  // 供餐加收單價
  const mr = s.boardingMealRates || { one: 80, two: 150, three: 220 };
  setVal('cfg-meal-price-1', mr.one);
  setVal('cfg-meal-price-2', mr.two);
  setVal('cfg-meal-price-3', mr.three);

  // 毛孩履歷收集開關
  const cf = s.petCustomFields || {};
  setCheck('field-chip-id', cf.chipId ?? false);
  setCheck('field-vaccine', cf.vaccine ?? true);
  setCheck('field-deworm', cf.deworm ?? true);
  setCheck('field-allergy', cf.allergy ?? true);
  setCheck('field-intro', cf.intro ?? true);
  setCheck('field-shuttle', cf.shuttle ?? true);

  // 審核與訂金
  setCheck('cfg-toggle-audit-booking', s.enableAuditBooking ?? true);
  setCheck('cfg-toggle-deposit', s.enableDeposit ?? true);
  setVal('cfg-deposit-mode', s.depositMode || 'all');
  setVal('cfg-deposit-amount', s.depositAmount || 0);
  setVal('cfg-deposit-info', s.depositInfo || '');

  // 定型化契約
  setCheck('cfg-toggle-contract', s.enableContract ?? true);
  setVal('cfg-contract-title', s.contractTitle || '美容定型化契約書');
  setVal('cfg-contract-content', s.contractContent || DEFAULT_MOHW_BEAUTY_CONTRACT);

  // LINE 推播二合一開關
  setCheck('cfg-toggle-owner-line-push', s.enableOwnerLinePush ?? true);
  setCheck('cfg-toggle-line-auto-notify', s.enableLineAutoNotify ?? false);
  setCheck('cfg-toggle-flex-menu', s.enableFlexMenu ?? true);

  // 渲染自訂收集欄位
  if (typeof renderCustomFieldsAdminList === 'function') renderCustomFieldsAdminList();
}

// ✨ 模組開關切換即時連動 (無需刷新頁面，秒級切換導覽列與外掛專頁)
async function toggleModuleStatus(moduleType, isChecked) {
  Swal.fire({ title: '正在切換模組運行狀態...', allowOutsideClick: false });
  Swal.showLoading();

  let patchPayload = {};
  if (moduleType === 'pet') {
    patchPayload = {
      module_pet_profile: isChecked,
      module_pet_boarding: isChecked
    };
    backendData.settings.module_pet_profile = isChecked;
    backendData.settings.module_pet_boarding = isChecked;
  } else if (moduleType === 'inventory') {
    patchPayload = {
      module_inventory: isChecked,
      module_service_materials: isChecked
    };
    backendData.settings.module_inventory = isChecked;
    backendData.settings.module_service_materials = isChecked;
  }

  try {
    await directSupabasePatch('store_settings', `store_id=eq.${CURRENT_STORE_ID}`, patchPayload);
    updateArchitectureStatus();
    Swal.fire({
      title: isChecked ? '模組已開通啟用！' : '模組已停用關閉',
      text: '導覽列與對應介面已動態切換',
      icon: 'success',
      timer: 1200,
      showConfirmButton: false
    });
  } catch (err) {
    Swal.fire('設定失敗', err.message, 'error');
  }
}

// 儲存門市基礎資料
async function saveStoreSettings() {
  Swal.fire({ title: '正在儲存設定...', allowOutsideClick: false });
  Swal.showLoading();

  const checkedWeekly = Array.from(document.querySelectorAll('#weekly-off-grid input:checked')).map(el => Number(el.value));
  const selectedIndustry = document.querySelector('input[name="cfg-industry-type"]:checked')?.value || 'pet';

  const payload = {
    store_id: CURRENT_STORE_ID,
    display_title: document.getElementById('cfg-title')?.value.trim() || backendData.settings.storeName,
    display_subtitle: document.getElementById('cfg-subtitle')?.value.trim() || '',
    logo_url: document.getElementById('cfg-logo')?.value.trim() || '',
    store_phone: document.getElementById('cfg-phone')?.value.trim() || '',
    address: document.getElementById('cfg-address')?.value.trim() || '',
    business_hours: document.getElementById('cfg-hours')?.value.trim() || '09:00 - 19:00',
    booking_buffer_hours: Number(document.getElementById('cfg-buffer')?.value || 1),
    line_url: document.getElementById('cfg-line')?.value.trim() || '',
    ig_url: document.getElementById('cfg-ig')?.value.trim() || '',
    map_url: document.getElementById('cfg-map')?.value.trim() || '',
    line_channel_token: document.getElementById('cfg-line-token')?.value.trim() || '',
    promo_text: document.getElementById('cfg-promo')?.value.trim() || '',
    promo_rules_text: document.getElementById('cfg-promo-rules-input')?.value.trim() || '',
    contract_title: document.getElementById('cfg-contract-title')?.value.trim() || '美容定型化契約書',
    contract_content: document.getElementById('cfg-contract-content')?.value.trim() || '',
    weekly_off_days: checkedWeekly,
    custom_off_dates: customOffDatesArray,
    shift_start_time: document.getElementById('cfg-shift-start')?.value || "09:00",
    shift_end_time: document.getElementById('cfg-shift-end')?.value || "19:00",
    shift_interval: Number(document.getElementById('cfg-shift-interval')?.value || 30),
    commission_rate: Number(document.getElementById('cfg-commission-rate')?.value || 50),
    industry_type: selectedIndustry,

    // 寵物住宿與放飯排程
    boarding_settings: {
      breakfastTime: document.getElementById('cfg-meal-time-breakfast')?.value || '09:00',
      lunchTime: document.getElementById('cfg-meal-time-lunch')?.value || '12:30',
      dinnerTime: document.getElementById('cfg-meal-time-dinner')?.value || '18:00',
      mandatoryCheckinBath: Boolean(document.getElementById('cfg-mandatory-checkin-bath')?.checked),
      allowCheckoutBath: Boolean(document.getElementById('cfg-allow-checkout-bath')?.checked),
      toggleNotice: Boolean(document.getElementById('cfg-toggle-stay-notice')?.checked),
      noticeContent: document.getElementById('cfg-stay-notice-content')?.value.trim() || ''
    },
    boarding_meal_rates: {
      one: Number(document.getElementById('cfg-meal-price-1')?.value || 80),
      two: Number(document.getElementById('cfg-meal-price-2')?.value || 150),
      three: Number(document.getElementById('cfg-meal-price-3')?.value || 220)
    },
    pet_custom_fields: {
      chipId: Boolean(document.getElementById('field-chip-id')?.checked),
      vaccine: Boolean(document.getElementById('field-vaccine')?.checked),
      deworm: Boolean(document.getElementById('field-deworm')?.checked),
      allergy: Boolean(document.getElementById('field-allergy')?.checked),
      intro: Boolean(document.getElementById('field-intro')?.checked),
      shuttle: Boolean(document.getElementById('field-shuttle')?.checked),
      extraFields: backendData.settings?.petCustomFields?.extraFields || []
    },

    // 模組開關
    enable_audit_booking: Boolean(document.getElementById('cfg-toggle-audit-booking')?.checked),
    enable_deposit: Boolean(document.getElementById('cfg-toggle-deposit')?.checked),
    deposit_mode: document.getElementById('cfg-deposit-mode')?.value || 'all',
    deposit_amount: Number(document.getElementById('cfg-deposit-amount')?.value || 0),
    deposit_info: document.getElementById('cfg-deposit-info')?.value.trim() || '',
    enable_contract: Boolean(document.getElementById('cfg-toggle-contract')?.checked),
    enable_owner_line_push: Boolean(document.getElementById('cfg-toggle-owner-line-push')?.checked),
    enable_line_auto_notify: Boolean(document.getElementById('cfg-toggle-line-auto-notify')?.checked),
    enable_flex_menu: Boolean(document.getElementById('cfg-toggle-flex-menu')?.checked)
  };

  try {
    await directSupabaseUpsert('stores', { id: CURRENT_STORE_ID, store_name: payload.display_title, industry_type: selectedIndustry }, 'id');
    await directSupabaseUpsert('store_settings', payload, 'store_id');
    backendData.settings = Object.assign({}, backendData.settings, payload);
    Swal.fire({ title: '設定已完整儲存！', icon: 'success', timer: 1200, showConfirmButton: false });
  } catch (e) {
    Swal.fire('儲存失敗', e.message, 'error');
  }
}
