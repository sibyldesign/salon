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
function populateSettings() {
  const s = backendData.settings || {};

  const safeSetVal = (id, val) => {
    const el = document.getElementById(id);
    if (el && val !== undefined && val !== null) el.value = val;
  };
  const safeSetCheck = (id, val) => {
    const el = document.getElementById(id);
    if (el && val !== undefined && val !== null) el.checked = Boolean(val);
  };

  safeSetVal('cfg-title', s.storeName);
  safeSetVal('cfg-address', s.address);
  safeSetVal('cfg-hours', s.businessHours);

  // ✨ Feature Flags 模組開關回填
  safeSetCheck('cfg-module-pet', s.module_pet_profile || s.module_pet_boarding);
  safeSetCheck('cfg-module-inventory', s.module_inventory || s.module_service_materials);

  updateArchitectureStatus();
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

  const titleVal = document.getElementById('cfg-title')?.value.trim() || '專業美業沙龍';
  const addressVal = document.getElementById('cfg-address')?.value.trim() || '';
  const hoursVal = document.getElementById('cfg-hours')?.value.trim() || '';

  const payload = {
    store_id: CURRENT_STORE_ID,
    display_title: titleVal,
    address: addressVal,
    business_hours: hoursVal,
    module_pet_profile: Boolean(document.getElementById('cfg-module-pet')?.checked),
    module_pet_boarding: Boolean(document.getElementById('cfg-module-pet')?.checked),
    module_inventory: Boolean(document.getElementById('cfg-module-inventory')?.checked),
    module_service_materials: Boolean(document.getElementById('cfg-module-inventory')?.checked)
  };

  try {
    await directSupabaseUpsert('stores', { id: CURRENT_STORE_ID, store_name: titleVal }, 'id');
    await directSupabaseUpsert('store_settings', payload, 'store_id');
    backendData.settings = Object.assign({}, backendData.settings, payload);
    document.getElementById('top-bar-title').innerText = `${titleVal} 管理後台`;
    updateArchitectureStatus();
    Swal.fire('設定已成功保存！', '', 'success');
  } catch (e) {
    Swal.fire('儲存失敗', e.message, 'error');
  }
}
