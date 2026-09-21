// =========================================================================
// 📌 通用進銷存與 BOM 耗材自動扣料外掛模組（進銷存與 BOM 耗材自動扣料外掛模組） (js/admin-inventory.js)
// =========================================================================

let allProductList = [];
let allBOMMaterials = [];

// 模組初始化進入點
async function initInventoryModule() {
  console.log("📦 進銷存模組 (Inventory Plugin) 初始化成功");
  await fetchInventoryData();
}

// 載入產品庫存與 BOM 預設耗材設定
async function fetchInventoryData() {
  try {
    const [products, boms] = await Promise.all([
      directSupabaseFetch(`products?store_id=eq.${CURRENT_STORE_ID}&order=created_at.desc`),
      directSupabaseFetch(`service_default_materials?store_id=eq.${CURRENT_STORE_ID}`)
    ]);
    allProductList = products || [];
    allBOMMaterials = boms || [];
  } catch (err) {
    console.warn("載入庫存資料異常:", err);
  }
}

// 渲染進銷存專屬管理分頁
async function renderInventoryPage() {
  await fetchInventoryData();
  renderInventoryTable();
}

// 1. 渲染庫存列表表格 (含安全水位警示標籤)
function renderInventoryTable() {
  const tbody = document.getElementById('inventory-table-body');
  if (!tbody) return;

  if (allProductList.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-6 text-brand-400 text-xs">尚無產品庫存資料，請點擊上方按鈕進貨建檔</td></tr>';
    return;
  }

  tbody.innerHTML = allProductList.map(p => {
    const isLowStock = Number(p.stock_qty || 0) <= Number(p.safety_stock || 10);
    const unitStr = p.unit || '件';
    return `
      <tr class="border-b border-brand-100 hover:bg-brand-50/50">
        <td class="py-2.5 px-2">
          <div class="font-bold text-brand-900">${p.name}</div>
          <div class="text-[10px] text-brand-400 font-mono">${p.barcode || '無條碼'}</div>
        </td>
        <td class="py-2.5 px-2">
          <span class="px-2 py-0.5 bg-brand-100 text-brand-800 rounded text-[10px] font-bold">${p.category || '一般耗材'}</span>
        </td>
        <td class="py-2.5 px-2">
          <span class="font-mono font-bold text-sm ${isLowStock ? 'text-rose-600' : 'text-emerald-700'}">
            ${p.stock_qty} ${unitStr}
          </span>
          ${isLowStock ? '<span class="ml-1 text-[9px] bg-rose-100 text-rose-800 px-1 py-0.2 rounded font-bold">缺料警示</span>' : ''}
        </td>
        <td class="py-2.5 px-2 font-mono text-brand-500">
          ${p.safety_stock} ${unitStr}
        </td>
        <td class="py-2.5 px-2 text-right">
          <button onclick="promptSingleRestock('${p.id}', '${p.name}', '${unitStr}')" class="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-bold text-[11px] mr-1">進貨</button>
          <button onclick="viewProductTransactions('${p.id}', '${p.name}')" class="px-2.5 py-1 bg-brand-100 hover:bg-brand-200 text-brand-800 rounded-lg font-bold text-[11px]">流水帳</button>
        </td>
      </tr>
    `;
  }).join('');
}

// 2. 快速建立新商品或進貨彈窗
function openQuickRestockModal() {
  Swal.fire({
    title: '📦 產品進貨與入庫登記',
    html: `
      <div class="text-left text-xs space-y-2.5 font-sans">
        <div><label class="font-bold">產品或耗材名稱 *：</label><input id="prod-name" class="swal2-input text-xs" placeholder="例如：深層草本洗毛精 / 8度色染膏"></div>
        <div class="grid grid-cols-2 gap-2">
          <div><label class="font-bold">產品類別：</label>
            <select id="prod-cat" class="swal2-input text-xs">
              <option value="耗材洗劑">耗材洗劑 / 藥水</option>
              <option value="沙龍零售">沙龍 / 門市零售品</option>
              <option value="寵物鮮食罐頭">寵物鮮食 / 零食</option>
              <option value="工具設備">工具 / 拋棄式耗材</option>
            </select>
          </div>
          <div><label class="font-bold">計量單位：</label><input id="prod-unit" class="swal2-input text-xs" placeholder="ml / 瓶 / 包 / 罐" value="瓶"></div>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div><label class="font-bold">進貨入庫數量 *：</label><input id="prod-qty" type="number" step="0.5" class="swal2-input text-xs" value="10"></div>
          <div><label class="font-bold">安全庫存警示水位：</label><input id="prod-safety" type="number" class="swal2-input text-xs" value="5"></div>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div><label class="font-bold">成本進價 (NT$)：</label><input id="prod-cost" type="number" class="swal2-input text-xs" value="250"></div>
          <div><label class="font-bold">建議零售價 (NT$)：</label><input id="prod-price" type="number" class="swal2-input text-xs" value="500"></div>
        </div>
        <div><label class="font-bold">供應商 / 備註：</label><input id="prod-supplier" class="swal2-input text-xs" placeholder="例如：大台北美妝物料行"></div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: '確定入庫存檔',
    confirmButtonColor: '#8C7355',
    cancelButtonText: '取消',
    preConfirm: () => {
      const name = document.getElementById('prod-name').value.trim();
      const qty = Number(document.getElementById('prod-qty').value || 0);
      if (!name || qty <= 0) {
        Swal.showValidationMessage('品名與進貨數量為必填且大於 0！');
        return false;
      }
      return {
        name: name,
        category: document.getElementById('prod-cat').value,
        unit: document.getElementById('prod-unit').value.trim() || '件',
        stock_qty: qty,
        safety_stock: Number(document.getElementById('prod-safety').value || 5),
        cost_price: Number(document.getElementById('prod-cost').value || 0),
        selling_price: Number(document.getElementById('prod-price').value || 0),
        supplier: document.getElementById('prod-supplier').value.trim()
      };
    }
  }).then(async r => {
    if (r.isConfirmed && r.value) {
      Swal.showLoading();
      try {
        const payload = Object.assign({ store_id: CURRENT_STORE_ID }, r.value);
        const res = await directSupabaseUpsert('products', payload, 'id');
        const newProd = res && res[0] ? res[0] : null;

        // 記錄進貨流水帳
        if (newProd) {
          await directSupabaseUpsert('inventory_transactions', {
            store_id: CURRENT_STORE_ID,
            product_id: newProd.id,
            change_qty: r.value.stock_qty,
            type: 'PURCHASE',
            note: `首次進貨建立庫存 (${r.value.supplier || '無廠商註記'})`
          }, 'id');
        }

        Swal.fire('入庫完成！', `已成功將【${r.value.name}】建立庫存`, 'success');
        renderInventoryPage();
      } catch (err) {
        Swal.fire('入庫失敗', err.message, 'error');
      }
    }
  });
}

// 3. 現有單一產品快速再進貨 (累加庫存)
function promptSingleRestock(prodId, prodName, unitStr) {
  Swal.fire({
    title: `【${prodName}】進貨補貨`,
    input: 'number',
    inputPlaceholder: `輸入欲增加的入庫數量 (${unitStr})`,
    showCancelButton: true,
    confirmButtonText: '確認入庫',
    confirmButtonColor: '#8C7355',
    cancelButtonText: '取消'
  }).then(async r => {
    if (r.isConfirmed && Number(r.value) > 0) {
      const addQty = Number(r.value);
      Swal.showLoading();
      try {
        const prod = allProductList.find(p => p.id === prodId);
        const newQty = Number(prod?.stock_qty || 0) + addQty;

        await directSupabasePatch('products', `id=eq.${prodId}`, { stock_qty: newQty });
        await directSupabaseUpsert('inventory_transactions', {
          store_id: CURRENT_STORE_ID,
          product_id: prodId,
          change_qty: addQty,
          type: 'PURCHASE',
          note: `手動快速進貨補料 (+${addQty} ${unitStr})`
        }, 'id');

        Swal.fire('進貨成功！', `最新現有庫存：${newQty} ${unitStr}`, 'success');
        renderInventoryPage();
      } catch(e) {
        Swal.fire('進貨失敗', e.message, 'error');
      }
    }
  });
}

// 4. 門市盤點調整彈窗 (盤損盤盈校正)
function openStockTakeModal() {
  if (allProductList.length === 0) return Swal.fire('目前無產品庫存可盤點', '', 'info');

  const optionsHtml = allProductList.map(p => `
    <div class="flex items-center justify-between p-2.5 bg-brand-50 rounded-xl border border-brand-200 text-xs">
      <div>
        <div class="font-bold text-brand-900">${p.name}</div>
        <div class="text-[10.5px] text-brand-400 font-mono">系統帳面：${p.stock_qty} ${p.unit}</div>
      </div>
      <div class="flex items-center gap-1.5 w-32">
        <span class="text-[11px] font-bold shrink-0">實盤:</span>
        <input type="number" step="0.5" data-id="${p.id}" data-orig="${p.stock_qty}" data-unit="${p.unit}" class="stock-take-input w-full p-1.5 text-center bg-white border border-brand-200 rounded-lg text-xs font-mono font-bold" value="${p.stock_qty}">
      </div>
    </div>
  `).join('');

  Swal.fire({
    title: '📋 門市庫存實盤調整',
    html: `
      <div class="text-left text-xs space-y-2 max-h-[60vh] overflow-y-auto pr-1">
        <p class="text-brand-500 bg-amber-50 p-2 rounded-xl border border-amber-200">
          💡 請直接輸入現場實際清點之現貨數量，系統將自動計算盤損或盤盈差額。
        </p>
        ${optionsHtml}
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: '完成盤點並校正庫存',
    confirmButtonColor: '#8C7355',
    cancelButtonText: '放棄'
  }).then(async r => {
    if (r.isConfirmed) {
      Swal.showLoading();
      try {
        const inputs = document.querySelectorAll('.stock-take-input');
        for (let el of inputs) {
          const prodId = el.getAttribute('data-id');
          const origQty = Number(el.getAttribute('data-orig') || 0);
          const realQty = Number(el.value);
          const diff = realQty - origQty;

          if (diff !== 0) {
            await directSupabasePatch('products', `id=eq.${prodId}`, { stock_qty: realQty });
            await directSupabaseUpsert('inventory_transactions', {
              store_id: CURRENT_STORE_ID,
              product_id: prodId,
              change_qty: diff,
              type: 'ADJUST',
              note: `門市盤點校正 (原庫存 ${origQty} ➔ 實盤 ${realQty})`
            }, 'id');
          }
        }
        Swal.fire('盤點校正完成！', '庫存數據已更新至最新盤點水位', 'success');
        renderInventoryPage();
      } catch (e) {
        Swal.fire('校正失敗', e.message, 'error');
      }
    }
  });
}

// 5. 查看特定產品的進銷存異動流水帳
async function viewProductTransactions(prodId, prodName) {
  Swal.showLoading();
  try {
    const txs = await directSupabaseFetch(`inventory_transactions?store_id=eq.${CURRENT_STORE_ID}&product_id=eq.${prodId}&order=created_at.desc&limit=20`);
    
    let rowsHtml = (!txs || txs.length === 0) 
      ? '<div class="text-center py-4 text-brand-400">尚無異動紀錄</div>'
      : txs.map(t => {
        const isDeduct = Number(t.change_qty) < 0;
        const timeStr = t.created_at ? t.created_at.split('T')[0] : '';
        return `
          <div class="py-2 border-b border-brand-100 flex justify-between items-center text-xs">
            <div>
              <div class="font-bold text-brand-900">${t.note || t.type}</div>
              <div class="text-[10px] text-brand-400 font-mono">${timeStr}</div>
            </div>
            <div class="font-mono font-bold ${isDeduct ? 'text-rose-600' : 'text-emerald-700'}">
              ${isDeduct ? '' : '+'}${t.change_qty}
            </div>
          </div>
        `;
      }).join('');

    Swal.fire({
      title: `【${prodName}】異動流水明細`,
      html: `<div class="text-left text-xs max-h-60 overflow-y-auto p-1">${rowsHtml}</div>`,
      confirmButtonText: '關閉',
      confirmButtonColor: '#8C7355'
    });
  } catch(e) {
    Swal.fire('調閱失敗', e.message, 'error');
  }
}

// =========================================================================
// 6. ⚡ 核心自動化：結單自動扣料引擎 (triggerMaterialDeduction)
// 由 admin-checkout.js 在確認完工結單時無感觸發
// =========================================================================
async function triggerMaterialDeduction(bookingId) {
  try {
    const appt = (backendData.appointments || []).find(a => String(a.id) === String(bookingId));
    if (!appt || !appt.service) return;

    // 依施作項目比對是否有設定 BOM 耗材配方
    const currentSvcs = backendData.services || [];
    const matchedServiceObjs = currentSvcs.filter(s => (appt.service || '').includes(s.service_name || s.name));

    for (let svc of matchedServiceObjs) {
      const boms = allBOMMaterials.filter(b => b.service_id === svc.id);
      for (let b of boms) {
        // 寫入實際耗材消耗明細 (資料庫自動透過 Trigger 扣減 products 庫存並記錄流水帳)
        await directSupabaseUpsert('order_material_consumptions', {
          store_id: CURRENT_STORE_ID,
          booking_id: bookingId,
          product_id: b.product_id,
          consumed_qty: Number(b.default_qty || 1)
        }, 'id');
      }
    }
  } catch (err) {
    console.warn("結單自動扣料背景處理略過:", err);
  }
}

// =========================================================================
// 📌 通用產品庫存管理、低庫存警示與快速進貨 (js/admin-inventory.js)
// =========================================================================

let allInventoryItems = [];
let isLowStockFilterActive = false;

// 1. 載入並渲染產品庫存主檔
async function renderInventoryList() {
  const container = document.getElementById('inventory-items-container');
  if (!container) return;

  const categoryFilter = document.getElementById('inv-filter-category')?.value || 'ALL';

  // 嘗試自 Supabase 讀取 store_inventory 資料表，若無則使用預設骨幹
  try {
    allInventoryItems = await directSupabaseFetch(`store_inventory?store_id=eq.${CURRENT_STORE_ID}&order=category.asc,name.asc`);
  } catch(e) {}

  if (!allInventoryItems || allInventoryItems.length === 0) {
    allInventoryItems = [
      { id: 'inv-1', category: '洗護消耗品', name: '草本舒緩洗毛精 (4000ml)', current_stock: 3, safe_stock: 5, unit: '桶', cost_price: 1200 },
      { id: 'inv-2', category: '技術耗材', name: '日系染膏 - 霧感冷棕 8-CB', current_stock: 12, safe_stock: 8, unit: '條', cost_price: 220 },
      { id: 'inv-3', category: '零售外帶品', name: '全能亮毛深層魚油滴劑 (100ml)', current_stock: 4, safe_stock: 6, unit: '瓶', cost_price: 580 },
      { id: 'inv-4', category: '工具雜項', name: '加厚吸水免洗毛巾 (100入)', current_stock: 8, safe_stock: 10, unit: '包', cost_price: 350 }
    ];
  }

  let filtered = allInventoryItems;
  if (categoryFilter !== 'ALL') {
    filtered = filtered.filter(it => it.category === categoryFilter);
  }
  if (isLowStockFilterActive) {
    filtered = filtered.filter(it => Number(it.current_stock) <= Number(it.safe_stock));
  }

  if (filtered.length === 0) {
    container.innerHTML = '<div class="text-center py-6 text-brand-400 text-xs">目前無符合分類之庫存品項</div>';
    return;
  }

  container.innerHTML = filtered.map(it => {
    const isAlert = Number(it.current_stock) <= Number(it.safe_stock);

    return `
      <div class="p-3 bg-white rounded-2xl border ${isAlert ? 'border-amber-300 bg-amber-50/40' : 'border-brand-200'} shadow-2xs flex justify-between items-center text-xs">
        <div>
          <div class="flex items-center gap-1.5 font-bold text-brand-900">
            <span>${it.name}</span>
            <span class="px-2 py-0.2 rounded-md text-[9px] bg-brand-100 text-brand-700">${it.category}</span>
          </div>
          <div class="text-[11px] text-brand-500 mt-0.5">
            安全水位：${it.safe_stock} ${it.unit} | 進貨成本：$${it.cost_price || 0}
          </div>
        </div>
        <div class="flex items-center gap-3">
          <div class="text-right">
            <div class="font-black text-sm font-mono ${isAlert ? 'text-rose-600 font-extrabold' : 'text-emerald-700'}">
              ${it.current_stock} ${it.unit}
            </div>
            ${isAlert ? '<span class="text-[9px] text-rose-500 font-bold">庫存吃緊</span>' : '<span class="text-[9px] text-emerald-600">正常</span>'}
          </div>
          <button onclick="promptQuickRestock('${it.id}', '${it.name}', ${it.current_stock}, '${it.unit}')" class="px-2.5 py-1 bg-brand-100 hover:bg-brand-200 text-brand-800 rounded-xl font-bold text-xs transition">
            進貨/補正
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// 2. 庫存不足警示切換
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

// 3. 快速進貨彈窗與寫入日誌
function promptQuickRestock(id, name, curStock, unit) {
  Swal.fire({
    title: `【${name}】進貨入庫`,
    html: `
      <div class="text-left text-xs space-y-2">
        <div>目前庫存：<b>${curStock} ${unit}</b></div>
        <div>
          <label class="font-bold">本次進貨增加數量：</label>
          <input type="number" id="swal-restock-qty" class="swal2-input text-xs font-bold font-mono" value="10">
        </div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: '確定進貨',
    confirmButtonColor: '#8C7355',
    preConfirm: () => Number(document.getElementById('swal-restock-qty').value || 0)
  }).then(async r => {
    if (r.isConfirmed && r.value > 0) {
      const newTotal = curStock + r.value;
      const target = allInventoryItems.find(it => it.id === id);
      if (target) target.current_stock = newTotal;

      try {
        await directSupabasePatch('store_inventory', `id=eq.${id}`, { current_stock: newTotal });
      } catch(e) {}

      Swal.fire('入庫完成！', `最新庫存：${newTotal} ${unit}`, 'success');
      renderInventoryList();
    }
  });
}

// 4. 新增庫存主檔彈窗
function openAddProductModal() {
  Swal.fire({
    title: '新增庫存品項 / 耗材主檔',
    html: `
      <div class="text-left text-xs space-y-2">
        <div><label class="font-bold">品項名稱：</label><input id="inv-new-name" class="swal2-input text-xs" placeholder="例：頂級全能修護洗劑"></div>
        <div><label class="font-bold">分類：</label>
          <select id="inv-new-cat" class="swal2-input text-xs">
            <option value="洗護消耗品">洗護消耗品</option>
            <option value="技術耗材">技術耗材</option>
            <option value="零售外帶品">零售外帶品</option>
            <option value="工具雜項">工具雜項</option>
          </select>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div><label class="font-bold">初始庫存：</label><input type="number" id="inv-new-stock" class="swal2-input text-xs" value="10"></div>
          <div><label class="font-bold">安全存量警示：</label><input type="number" id="inv-new-safe" class="swal2-input text-xs" value="5"></div>
        </div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: '確定建立',
    confirmButtonColor: '#8C7355',
    preConfirm: () => ({
      name: document.getElementById('inv-new-name').value.trim(),
      category: document.getElementById('inv-new-cat').value,
      current_stock: Number(document.getElementById('inv-new-stock').value || 0),
      safe_stock: Number(document.getElementById('inv-new-safe').value || 5),
      unit: '瓶',
      store_id: CURRENT_STORE_ID
    })
  }).then(async r => {
    if (r.isConfirmed && r.value.name) {
      allInventoryItems.unshift(r.value);
      try {
        await directSupabaseUpsert('store_inventory', r.value, 'id');
      } catch(e) {}
      Swal.fire('品項建立成功！', '', 'success');
      renderInventoryList();
    }
  });
}
