const monthNames = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
const currentRealMonth = new Date().getMonth();

let globalFixedExpenses = JSON.parse(localStorage.getItem('globalFixedExpenses_v6')) || [];
let db = JSON.parse(localStorage.getItem('budgetDB_v6')) || {};
let closedMonths = JSON.parse(localStorage.getItem('closedMonths_v6')) || [];

const monthSelect = document.getElementById('currentMonth');
const yearSelect = document.getElementById('currentYear');

function initMonthSelect() {
    monthSelect.innerHTML = '';
    const isCurrentYear = (yearSelect.value == new Date().getFullYear());
    const startMonth = isCurrentYear ? currentRealMonth : 0;
    for (let i = startMonth; i < 12; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = monthNames[i];
        monthSelect.appendChild(opt);
    }
}

function getCurrentKey() { return `${yearSelect.value}_${monthSelect.value}`; }

document.getElementById('addBtn').addEventListener('click', function() {
    const type = document.getElementById('typeInput').value;
    const desc = document.getElementById('descInput').value.trim();
    const amount = parseFloat(document.getElementById('amountInput').value);
    const note = document.getElementById('noteInput').value.trim();
    const key = getCurrentKey();

    if (!desc || isNaN(amount)) return;

    if (type === 'fixedExpense') {
        globalFixedExpenses.push({ id: Date.now(), desc, amount, note });
        localStorage.setItem('globalFixedExpenses_v6', JSON.stringify(globalFixedExpenses));
    } else {
        if (!db[key]) db[key] = { income: [], monthlyExpense: [], savings: [] };
        db[key][type].push({ id: Date.now(), desc, amount, note });
    }
    saveAndRefresh();
});

function refreshUI() {
    const key = getCurrentKey();
    const data = db[key] || { income: [], monthlyExpense: [], savings: [] };
    
    ['incomeTable', 'fixedExpenseTable', 'monthlyExpenseTable'].forEach(id => {
        document.querySelector(`#${id} tbody`).innerHTML = '';
    });

    let inc = 0, exp = 0, manualSav = 0;
    let chartStats = {};

    globalFixedExpenses.forEach(item => {
        exp += item.amount;
        chartStats[item.desc] = (chartStats[item.desc] || 0) + item.amount;
        renderRow('fixedExpenseTable', item, 'fixedExpense', true);
    });

    data.income?.forEach(i => { inc += i.amount; renderRow('incomeTable', i, 'income'); });
    data.monthlyExpense?.forEach(e => { 
        exp += e.amount; 
        chartStats[e.desc] = (chartStats[e.desc] || 0) + e.amount;
        renderRow('monthlyExpenseTable', e, 'monthlyExpense'); 
    });
    
    data.savings?.forEach(s => { manualSav += s.amount; });

    // חישובים אוטומטיים
    const potential = inc - exp; // הכנסה פחות הוצאה
    const balance = potential - manualSav; // יתרה בעו"ש אחרי הפרשה ידנית

    document.getElementById('totalInc').textContent = inc.toLocaleString() + ' ₪';
    document.getElementById('totalExp').textContent = exp.toLocaleString() + ' ₪';
    document.getElementById('potentialSav').textContent = potential.toLocaleString() + ' ₪';
    document.getElementById('manualSav').textContent = manualSav.toLocaleString() + ' ₪';
    document.getElementById('balance').textContent = balance.toLocaleString() + ' ₪';

    updateYearlyTable();
    updateChart(chartStats);
}

function renderRow(tableId, item, type, isGlobal = false) {
    const row = document.getElementById(tableId).tBodies[0].insertRow();
    row.innerHTML = `
        <td>${item.desc}</td>
        <td>${item.amount.toLocaleString()} ₪</td>
        <td><input type="text" class="note-cell" value="${item.note || ''}" onchange="updateNote('${type}', ${item.id}, this.value, ${isGlobal})"></td>
        <td><button class="delete-btn" onclick="deleteItem('${type}', ${item.id}, ${isGlobal})">✕</button></td>
    `;
}

document.getElementById('closeMonthBtn').addEventListener('click', function() {
    const monthIdx = monthSelect.value;
    const year = yearSelect.value;
    
    const inc = parseFloat(document.getElementById('totalInc').textContent.replace(/,/g, ''));
    const exp = parseFloat(document.getElementById('totalExp').textContent.replace(/,/g, ''));
    const savedThisMonth = inc - exp; // ההגדרה האוטומטית שביקשת

    // חישוב יתרה מצטברת
    const prevCumulative = closedMonths.length > 0 ? closedMonths[closedMonths.length - 1].cumulative : 0;
    const cumulative = prevCumulative + savedThisMonth;

    closedMonths.push({ 
        id: Date.now(),
        year, 
        monthName: monthNames[monthIdx], 
        inc, exp, savedThisMonth, cumulative 
    });
    
    localStorage.setItem('closedMonths_v6', JSON.stringify(closedMonths));
    updateYearlyTable();
});

function updateYearlyTable() {
    const tbody = document.querySelector('#yearlySummaryTable tbody');
    tbody.innerHTML = '';
    
    closedMonths.forEach((m, index) => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${m.monthName} ${m.year}</td>
            <td>${m.inc.toLocaleString()}</td>
            <td>${m.exp.toLocaleString()}</td>
            <td style="color:var(--success); font-weight:bold">${m.savedThisMonth.toLocaleString()}</td>
            <td style="font-weight:bold; color:var(--primary)">${m.cumulative.toLocaleString()} ₪</td>
            <td><button class="delete-btn" onclick="deleteClosedMonth(${m.id})">✕</button></td>
        `;
    });
}

window.deleteClosedMonth = function(id) {
    if(confirm('האם למחוק את סיכום החודש הזה? זה עשוי להשפיע על החישוב המצטבר.')) {
        closedMonths = closedMonths.filter(m => m.id !== id);
        localStorage.setItem('closedMonths_v6', JSON.stringify(closedMonths));
        updateYearlyTable();
    }
}

window.updateNote = function(type, id, newValue, isGlobal) {
    if (isGlobal) {
        const item = globalFixedExpenses.find(i => i.id === id);
        if (item) item.note = newValue;
        localStorage.setItem('globalFixedExpenses_v6', JSON.stringify(globalFixedExpenses));
    } else {
        const key = getCurrentKey();
        const item = db[key][type].find(i => i.id === id);
        if (item) item.note = newValue;
        localStorage.setItem('budgetDB_v6', JSON.stringify(db));
    }
}

window.deleteItem = function(type, id, isGlobal) {
    if (isGlobal) {
        globalFixedExpenses = globalFixedExpenses.filter(i => i.id !== id);
        localStorage.setItem('globalFixedExpenses_v6', JSON.stringify(globalFixedExpenses));
    } else {
        const key = getCurrentKey();
        db[key][type] = db[key][type].filter(i => i.id !== id);
    }
    saveAndRefresh();
}

function saveAndRefresh() {
    localStorage.setItem('budgetDB_v6', JSON.stringify(db));
    refreshUI();
}

let myChart;
function updateChart(stats) {
    const ctx = document.getElementById('expenseChart').getContext('2d');
    if (myChart) myChart.destroy();
    if (Object.keys(stats).length === 0) return;
    myChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(stats),
            datasets: [{ data: Object.values(stats), backgroundColor: ['#3182ce', '#38a169', '#e53e3e', '#ecc94b', '#9f7aea', '#ed64a6'] }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

yearSelect.addEventListener('change', () => { initMonthSelect(); refreshUI(); });
monthSelect.addEventListener('change', refreshUI);

initMonthSelect();
refreshUI();
// פונקציה לייצוא הנתונים לקובץ JSON
window.exportData = function() {
    const data = {
        db: JSON.parse(localStorage.getItem('budgetDB_v6')),
        fixed: JSON.parse(localStorage.getItem('globalFixedExpenses_v6')),
        closed: JSON.parse(localStorage.getItem('closedMonths_v6'))
    };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `budget_backup_${new Date().toLocaleDateString()}.json`;
    a.click();
};

// פונקציה לייבוא הנתונים מקובץ
window.importData = function(event) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const data = JSON.parse(e.target.result);
        if (confirm('טעינת קובץ תדרוס את הנתונים הקיימים. להמשיך?')) {
            localStorage.setItem('budgetDB_v6', JSON.stringify(data.db));
            localStorage.setItem('globalFixedExpenses_v6', JSON.stringify(data.fixed));
            localStorage.setItem('closedMonths_v6', JSON.stringify(data.closed));
            location.reload();
        }
    };
    reader.readAsText(event.target.files[0]);
};
