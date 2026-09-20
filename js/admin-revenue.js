// =========================================================================
// 📌 營收報表與各專員業績抽成模組（營業額統計與專員拆帳抽成） (admin-revenue.js)
// =========================================================================

function renderRevenueSelect() {
  const sel = document.getElementById('rev-service-select');
  if (!sel) return;
  const svcs = backendData.services || [];
  sel.innerHTML = '<option value="ALL">全部服務項目總覽</option>' + 
    svcs.map(s => `<option value="${s.service_name || s.name}">${s.service_name || s.name}</option>`).join('');
}

function renderRevenue() {
  try {
    const selectedSvc = document.getElementById('rev-service-select')?.value || 'ALL';
    const timeFilter = document.getElementById('rev-time-filter')?.value || 'THIS_MONTH';
    const listArea = document.getElementById('rev-list-area');
    const unpaidListArea = document.getElementById('rev-unpaid-list');

    let allAppts = backendData.revenueAppointments || [];
    const now = new Date();
    const currentYm = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;

    const sD = document.getElementById('rev-start-date')?.value?.replace(/-/g, '/');
    const eD = document.getElementById('rev-end-date')?.value?.replace(/-/g, '/');

    if (sD && eD) {
      allAppts = allAppts.filter(a => a.date >= sD && a.date <= eD);
    } else if (timeFilter === 'THIS_MONTH') {
      allAppts = allAppts.filter(a => a.date && a.date.startsWith(currentYm));
    }

    if (selectedSvc !== 'ALL') {
      allAppts = allAppts.filter(a => (a.service || '').includes(selectedSvc));
    }

    let paidTotal = 0;
    let completedCount = 0;
    let returningRevenue = 0;
    let paidListHtml = '';
    let unpaidListHtml = '';

    allAppts.forEach(a => {
      if (a.status === '已結單') {
        const amt = Number(a.finalPrice || a.price || 0);
        paidTotal += amt;
        completedCount++;
        if (a.customer_type === 'old') returningRevenue += amt;

        paidListHtml += `
          <div class="py-2.5 px-1 border-b border-brand-100 flex justify-between items-center text-xs">
            <div>
              <div class="font-bold text-brand-900">${a.date} - ${a.name} (${a.staffName || '不指定'})</div>
              <div class="text-[11px] text-brand-500">${a.service}</div>
            </div>
            <div class="font-bold text-emerald-800 font-mono text-sm">NT$ ${amt.toLocaleString()}</div>
          </div>`;
      } else if (a.status === '已確認') {
        unpaidListHtml += `
          <div class="p-2.5 bg-amber-50 rounded-xl border border-amber-200 flex justify-between items-center text-xs">
            <div>
              <div class="font-bold text-amber-950">${a.date} - ${a.name}</div>
              <div class="text-[11px] text-amber-800">預估：${a.service} ($${a.price})</div>
            </div>
            <button class="px-3 py-1 bg-amber-600 text-white rounded-lg font-bold" onclick="openUniversalCheckoutModal('${a.id}', '${a.name}', '${a.phone}', '${a.service}', ${a.price})">結單</button>
          </div>`;
      }
    });

    if (document.getElementById('rev-total-amount')) document.getElementById('rev-total-amount').innerText = `${paidTotal.toLocaleString()}元`;
    const avgTicket = completedCount > 0 ? Math.round(paidTotal / completedCount) : 0;
    if (document.getElementById('metric-avg-ticket')) document.getElementById('metric-avg-ticket').innerText = `${avgTicket.toLocaleString()}元`;
    const retRatio = paidTotal > 0 ? Math.round((returningRevenue / paidTotal) * 100) : 0;
    if (document.getElementById('metric-returning-ratio')) document.getElementById('metric-returning-ratio').innerText = `${retRatio}%`;

    if (listArea) listArea.innerHTML = paidListHtml || '<div class="text-center py-4 text-brand-400">目前無已結單資料</div>';
    if (unpaidListArea) unpaidListArea.innerHTML = unpaidListHtml || '<div class="text-center py-2 text-brand-400">目前無待結單項目</div>';

    // 專員業績抽成
    const tbody = document.getElementById('staff-commission-tbody');
    if (tbody) {
      const staffStats = {};
      allAppts.filter(a => a.status === '已結單').forEach(a => {
        const sName = a.staffName || '不指定';
        if (!staffStats[sName]) staffStats[sName] = { count: 0, designated: 0, hours: 0, revenue: 0 };
        staffStats[sName].count++;
        if (sName !== '不指定') staffStats[sName].designated++;
        staffStats[sName].hours += 1; // 預設 1 小時工時
        staffStats[sName].revenue += Number(a.finalPrice || a.price || 0);
      });

      const rate = Number(backendData.settings?.commission_rate || 50);
      tbody.innerHTML = Object.keys(staffStats).map(name => {
        const st = staffStats[name];
        const comm = Math.round(st.revenue * (rate / 100));
        const bonus = st.designated * 50;
        const total = comm + bonus;
        return `
          <tr class="hover:bg-brand-50/50 border-b border-brand-100">
            <td class="py-2.5 px-2 font-bold">${name}</td>
            <td class="py-2.5 px-2">${st.count} 人</td>
            <td class="py-2.5 px-2 font-mono">${st.hours} hr</td>
            <td class="py-2.5 px-2 font-mono">NT$ ${st.revenue.toLocaleString()}</td>
            <td class="py-2.5 px-2 font-bold">${rate}%</td>
            <td class="py-2.5 px-2 text-emerald-700">+NT$ ${bonus}</td>
            <td class="py-2.5 px-2 text-right font-black text-[#8C7355]">NT$ ${total.toLocaleString()}</td>
          </tr>`;
      }).join('') || '<tr><td colspan="7" class="text-center py-4 text-brand-400">無專員業績</td></tr>';
    }
  } catch(e){}
}
