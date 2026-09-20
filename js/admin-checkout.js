// =========================================================================
// 📌 通用智慧結單與扣抵核算模組（通用結單對帳、加購與包卡儲值智慧扣抵） (admin-checkout.js)
// 支援美業個人與寵物毛孩的包卡扣點、儲值折抵、現場加購與耗材連動
// =========================================================================

async function openUniversalCheckoutModal(bookingId, custName, phone, serviceName, basePrice) {
  Swal.showLoading();

  let cust = null;
  let pkgs = [];
  try {
    const [cList, pList] = await Promise.all([
      directSupabaseFetch(`customers?store_id=eq.${CURRENT_STORE_ID}&phone=eq.${phone}`),
      directSupabaseFetch(`customer_packages?store_id=eq.${CURRENT_STORE_ID}&phone=eq.${phone}&remaining_times=gt.0`)
    ]);
    if (cList.length > 0) cust = cList[0];
    pkgs = pList || [];
  } catch(e){}

  const walletBal = Number(cust?.wallet_balance || 0);
  const matchedPkg = pkgs.find(p => serviceName.includes(p.service_name));
  const cardTimes = matchedPkg ? matchedPkg.remaining_times : 0;

  Swal.fire({
    title: '完工結單對帳',
    html: `
      <div class="text-left text-xs space-y-3 font-sans">
        <div class="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 flex justify-between font-bold text-emerald-900">
          <span>💳 剩餘包卡：<b>${cardTimes} 堂</b></span>
          <span>💰 儲值餘額：<b>$${walletBal.toLocaleString()}</b></span>
        </div>

        <div class="p-2.5 bg-brand-50 rounded-xl space-y-1">
          <div><b>顧客：</b>${custName} (${phone})</div>
          <div><b>施作項目：</b>${serviceName}</div>
        </div>

        <div>
          <label class="block font-bold text-brand-800 mb-1">1. 本次現場基準金額 (可微調)：</label>
          <input type="number" id="chk-base-price" value="${basePrice || 0}" class="w-full p-2 rounded-xl border border-brand-200 font-bold text-emerald-700 text-sm outline-none" oninput="recalcUniversalCheckout(${cardTimes}, ${walletBal})">
        </div>

        <div>
          <label class="block font-bold text-brand-800 mb-1">2. 扣抵歷史舊方案：</label>
          <select id="chk-deduct-opt" class="w-full p-2 rounded-xl border border-brand-200 text-xs bg-white outline-none" onchange="recalcUniversalCheckout(${cardTimes}, ${walletBal})">
            <option value="none">不使用舊方案 (原價計費)</option>
            <option value="pkg" ${cardTimes > 0 ? '' : 'disabled'}>使用包卡扣抵 (主項目 $0，剩餘 ${cardTimes} 堂)</option>
            <option value="wal" ${walletBal > 0 ? '' : 'disabled'}>使用儲值金扣抵 (餘額 $${walletBal})</option>
          </select>
        </div>

        <div>
          <label class="block font-bold text-brand-800 mb-1">3. 現場加購方案：</label>
          <select id="chk-addon-opt" class="w-full p-2 rounded-xl border border-brand-200 text-xs bg-white outline-none" onchange="recalcUniversalCheckout(${cardTimes}, ${walletBal})">
            <option value="none" data-price="0">不加購方案</option>
            <option value="pkg_5plus1" data-price="4000" data-addtimes="6">加購【買5送1包卡】(+NT$ 4,000)</option>
            <option value="wal_3000" data-price="3000" data-addwal="3000">加購【儲值金 $3,000】(+NT$ 3,000)</option>
          </select>
        </div>

        <div class="p-3 bg-brand-50 rounded-xl space-y-1 text-xs border border-brand-200">
          <div class="flex justify-between"><span>項目基準：</span><span id="disp-chk-base">$${basePrice}</span></div>
          <div class="flex justify-between text-rose-600"><span>方案折抵：</span><span id="disp-chk-disc">-$0</span></div>
          <div class="flex justify-between text-amber-800"><span>現場加購：</span><span id="disp-chk-addon">+$0</span></div>
          <div class="border-t border-brand-200 pt-1 flex justify-between font-bold text-sm text-brand-900">
            <span>現場實收補付：</span>
            <span class="text-emerald-700 text-base" id="disp-chk-final">$${basePrice}</span>
          </div>
        </div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: '確認結單並核銷',
    confirmButtonColor: '#8C7355',
    cancelButtonText: '取消'
  }).then(async r => {
    if (r.isConfirmed) {
      const finalPay = Number(document.getElementById('disp-chk-final').innerText.replace(/[^0-9]/g, '') || 0);
      const deductType = document.getElementById('chk-deduct-opt').value;
      const addonOpt = document.getElementById('chk-addon-opt');
      const addonVal = addonOpt.value;

      Swal.showLoading();
      try {
        // 1. 包卡核銷
        if (deductType === 'pkg' && matchedPkg) {
          await directSupabasePatch('customer_packages', `id=eq.${matchedPkg.id}`, { remaining_times: matchedPkg.remaining_times - 1 });
        }
        // 2. 儲值金扣抵
        if (deductType === 'wal' && cust) {
          const newBal = Math.max(0, walletBal - basePrice);
          await directSupabasePatch('customers', `id=eq.${cust.id}`, { wallet_balance: newBal });
        }
        // 3. 新購包卡自動入帳
        if (addonVal === 'pkg_5plus1') {
          await directSupabaseUpsert('customer_packages', {
            store_id: CURRENT_STORE_ID,
            customer_name: custName,
            phone: phone,
            service_name: serviceName,
            total_times: 6,
            remaining_times: 6
          }, 'id');
        }
        // 4. 新購儲值金自動充值
        if (addonVal === 'wal_3000') {
          const newWalBal = (cust ? walletBal : 0) + 3000;
          await directSupabaseUpsert('customers', {
            store_id: CURRENT_STORE_ID,
            name: custName,
            phone: phone,
            wallet_balance: newWalBal
          }, 'id');
        }

        // 5. 更新預約單狀態
        await directSupabasePatch('bookings', `id=eq.${bookingId}`, {
          status: '已結單',
          final_price: finalPay
        });

        // 6. 若開通進銷存耗材扣除，連動自動扣料
        if (backendData.settings?.module_service_materials && typeof triggerMaterialDeduction === 'function') {
          await triggerMaterialDeduction(bookingId);
        }

        Swal.fire('結單完成！', `現場實收：NT$ ${finalPay.toLocaleString()}`, 'success');
        fetchDataAndRender();
      } catch (err) {
        Swal.fire('結單失敗', err.message, 'error');
      }
    }
  });

  recalcUniversalCheckout(cardTimes, walletBal);
}

function recalcUniversalCheckout(cardTimes, walletBal) {
  const base = Number(document.getElementById('chk-base-price')?.value || 0);
  const deductType = document.getElementById('chk-deduct-opt')?.value || 'none';
  const addonSel = document.getElementById('chk-addon-opt');
  const addonPrice = Number(addonSel?.options[addonSel.selectedIndex]?.getAttribute('data-price') || 0);

  let disc = 0;
  if (deductType === 'pkg' && cardTimes > 0) disc = base;
  if (deductType === 'wal' && walletBal > 0) disc = Math.min(base, walletBal);

  const finalPay = Math.max(0, base - disc) + addonPrice;

  if (document.getElementById('disp-chk-base')) document.getElementById('disp-chk-base').innerText = `$${base}`;
  if (document.getElementById('disp-chk-disc')) document.getElementById('disp-chk-disc').innerText = `-$${disc}`;
  if (document.getElementById('disp-chk-addon')) document.getElementById('disp-chk-addon').innerText = `+$${addonPrice}`;
  if (document.getElementById('disp-chk-final')) document.getElementById('disp-chk-final').innerText = `$${finalPay.toLocaleString()}`;
}
