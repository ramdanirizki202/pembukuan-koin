// ==========================================
// APP.JS: SINKRONISASI MURNI DARI GOOGLE SHEETS & FILTER TANGGAL
// ==========================================

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzpKlYvrPDw8x2Qjo9GsMxasiPu73ox3MSeH83fWkvojUsXUGzQVG-5OybU8F2jaFxl/exec"; 

let currentHargaPer1M = 15000;
let currentUser = null;
let allTransactions = []; // Data mentah dari Google Sheets
let transactions = [];    // Data aktif yang ditampilkan / difilter
let usersList = [];

document.addEventListener("DOMContentLoaded", () => {
    fetchInitialData();
});

// 1. Ambil Data Murni dari Google Sheets
function fetchInitialData() {
    if (APPS_SCRIPT_URL === "" || APPS_SCRIPT_URL.includes("ANDA_DISINI")) {
        usersList = [
            { username: "admin", password: "admin123", role: "admin", nama: "Administrator System" },
            { username: "obet", password: "123456", role: "karyawan", nama: "Obet" }
        ];
        allTransactions = [];
        transactions = [...allTransactions];
        updateStatsDisplay();
        renderTransactions();
        renderUsersTable();
        return;
    }

    fetch(APPS_SCRIPT_URL + "?action=getInitialData")
        .then(res => res.json())
        .then(data => {
            if (data.status === "success") {
                if (data.hargaAktif) currentHargaPer1M = data.hargaAktif;
                if (data.users && data.users.length > 0) usersList = data.users;
                if (data.transactions) {
                    allTransactions = data.transactions;
                    transactions = [...allTransactions];
                }
            }
            updateStatsDisplay();
            renderTransactions();
            renderUsersTable();
        })
        .catch(err => {
            console.error("Gagal memuat data dari Spreadsheet:", err);
            updateStatsDisplay();
            renderTransactions();
            renderUsersTable();
        });
}

// 2. Logika Login Multi-Role
function handleLogin(e) {
    e.preventDefault();
    const userIn = document.getElementById("loginUsername").value.trim().toLowerCase();
    const passIn = document.getElementById("loginPassword").value.trim();

    const found = usersList.find(u => String(u.username).trim().toLowerCase() === userIn && String(u.password).trim() === passIn);
    
    if (found) {
        currentUser = found;
        document.getElementById("loginView").classList.add("hidden");
        document.getElementById("appView").classList.remove("hidden");
        document.getElementById("userStatus").classList.remove("hidden");
        document.getElementById("userStatus").classList.add("flex");

        document.getElementById("userName").innerText = currentUser.nama || currentUser.username;
        document.getElementById("userRole").innerText = currentUser.role;

        if (currentUser.role === "admin") {
            document.getElementById("adminNavTabs").classList.remove("hidden");
            document.getElementById("adminNavTabs").classList.add("flex");
            document.getElementById("karyawanInputSection").classList.add("hidden");
            document.getElementById("hargaPer1MInput").value = currentHargaPer1M;
            switchAdminTab('dashboard');
        } else {
            document.getElementById("adminNavTabs").classList.add("hidden");
            document.getElementById("adminTabDashboard").classList.add("hidden");
            document.getElementById("adminTabKaryawan").classList.add("hidden");
            document.getElementById("adminTabRiwayat").classList.remove("hidden");
            document.getElementById("karyawanInputSection").classList.remove("hidden");
        }
    } else {
        alert("Username atau Password salah!");
    }
}

// 3. Navigasi Tab Admin
function switchAdminTab(tabName) {
    const tabDashboard = document.getElementById("adminTabDashboard");
    const tabKaryawan = document.getElementById("adminTabKaryawan");
    const tabRiwayat = document.getElementById("adminTabRiwayat");

    const btnDashboard = document.getElementById("tabBtnDashboard");
    const btnKaryawan = document.getElementById("tabBtnKaryawan");
    const btnRiwayat = document.getElementById("tabBtnRiwayat");

    tabDashboard.classList.add("hidden");
    tabKaryawan.classList.add("hidden");
    tabRiwayat.classList.add("hidden");

    btnDashboard.className = "px-4 py-2 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded-xl text-xs font-bold transition";
    btnKaryawan.className = "px-4 py-2 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded-xl text-xs font-bold transition";
    btnRiwayat.className = "px-4 py-2 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded-xl text-xs font-bold transition";

    if (tabName === 'dashboard') {
        tabDashboard.classList.remove("hidden");
        btnDashboard.className = "px-4 py-2 bg-amber-500 text-slate-950 rounded-xl text-xs font-bold transition";
    } else if (tabName === 'karyawan') {
        tabKaryawan.classList.remove("hidden");
        btnKaryawan.className = "px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold transition";
    } else if (tabName === 'riwayat') {
        tabRiwayat.classList.remove("hidden");
        btnRiwayat.className = "px-4 py-2 bg-amber-500 text-slate-950 rounded-xl text-xs font-bold transition";
    }
}

function logout() {
    currentUser = null;
    location.reload();
}

// 4. Update Harga Jual
function updateHargaJual() {
    const val = parseFloat(document.getElementById("hargaPer1MInput").value);
    if (val && val > 0) {
        currentHargaPer1M = val;
        updateStatsDisplay();
        calculateLiveTotal();
        alert("Harga jual per 1M koin berhasil diperbarui menjadi Rp " + currentHargaPer1M.toLocaleString('id-ID'));

        const payload = {
            action: "updateHarga",
            harga1M: currentHargaPer1M,
            updatedBy: currentUser ? currentUser.nama : "Admin"
        };

        if (APPS_SCRIPT_URL !== "") {
            fetch(APPS_SCRIPT_URL, {
                method: "POST",
                mode: "no-cors",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            }).catch(err => console.error("Error update harga:", err));
        }
    }
}

function calculateLiveTotal() {
    const koin = parseFloat(document.getElementById("inputKoin").value) || 0;
    const total = (koin / 1000000) * currentHargaPer1M;
    const elCalc = document.getElementById("liveTotalCalculated");
    if (elCalc) {
        elCalc.innerText = "Rp " + total.toLocaleString('id-ID', { maximumFractionDigits: 2 });
    }
}

// 5. Kirim Transaksi & Sinkronisasi Ulang
function handleTransactionSubmit(e) {
    e.preventDefault();
    const koin = parseFloat(document.getElementById("inputKoin").value);

    if (!koin || koin <= 0) return;

    const totalRupiah = (koin / 1000000) * currentHargaPer1M;

    const newTx = {
        action: "addTransaction",
        tanggal: new Date().toLocaleString('id-ID'),
        karyawan: currentUser ? (currentUser.nama || currentUser.username) : "Karyawan",
        koin: koin,
        harga1M: currentHargaPer1M,
        total: totalRupiah
    };

    allTransactions.unshift(newTx);
    transactions = [...allTransactions];
    document.getElementById("inputKoin").value = "";
    calculateLiveTotal();
    renderTransactions();
    updateStatsDisplay();
    alert("Transaksi pendapatan koin berhasil disimpan!");

    if (APPS_SCRIPT_URL !== "") {
        fetch(APPS_SCRIPT_URL, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newTx)
        }).then(() => {
            setTimeout(fetchInitialData, 1500);
        }).catch(err => console.error("API Error:", err));
    }
}

// 6. Filter Riwayat Berdasarkan Tanggal
function filterTransactions() {
    const startDate = document.getElementById("filterStartDate").value;
    const endDate = document.getElementById("filterEndDate").value;

    transactions = allTransactions.filter(tx => {
        let parts = tx.tanggal.split(',')[0].trim().split('/');
        if (parts.length === 3) {
            let txDateFormatted = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            if (startDate && txDateFormatted < startDate) return false;
            if (endDate && txDateFormatted > endDate) return false;
        }
        return true;
    });

    renderTransactions();
    updateStatsDisplay();
}

function resetFilter() {
    document.getElementById("filterStartDate").value = "";
    document.getElementById("filterEndDate").value = "";
    transactions = [...allTransactions];
    renderTransactions();
    updateStatsDisplay();
}

function renderTransactions() {
    const tbody = document.getElementById("transactionLogTable");
    if (!tbody) return;
    tbody.innerHTML = "";

    if (transactions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-slate-500 italic">Belum ada riwayat transaksi</td></tr>`;
        return;
    }

    transactions.forEach(tx => {
        const row = document.createElement("tr");
        row.className = "hover:bg-slate-800/40 border-b border-slate-800/50";
        row.innerHTML = `
            <td class="p-3 font-mono text-xs text-slate-400">${tx.tanggal}</td>
            <td class="p-3 font-semibold text-slate-200">${tx.karyawan}</td>
            <td class="p-3 font-mono text-blue-400">${Number(tx.koin).toLocaleString('id-ID')}</td>
            <td class="p-3 font-mono text-amber-400">Rp ${Number(tx.harga1M).toLocaleString('id-ID')}</td>
            <td class="p-3 font-mono font-bold text-emerald-400 text-right">Rp ${Number(tx.total).toLocaleString('id-ID')}</td>
        `;
        tbody.appendChild(row);
    });
}

function updateStatsDisplay() {
    const elHarga = document.getElementById("statHargaAct");
    if (elHarga) elHarga.innerText = "Rp " + currentHargaPer1M.toLocaleString('id-ID');

    const totalKoin = transactions.reduce((acc, curr) => acc + (parseFloat(curr.koin) || 0), 0);
    const totalIDR = transactions.reduce((acc, curr) => acc + (parseFloat(curr.total) || 0), 0);

    const elKoin = document.getElementById("statTotalKoin");
    const elIDR = document.getElementById("statTotalIDR");
    if (elKoin) elKoin.innerText = totalKoin.toLocaleString('id-ID');
    if (elIDR) elIDR.innerText = "Rp " + totalIDR.toLocaleString('id-ID', { maximumFractionDigits: 2 });
}

// 7. CRUD Data Karyawan
function renderUsersTable() {
    const tbody = document.getElementById("userTableBody");
    if (!tbody) return;
    tbody.innerHTML = "";

    usersList.forEach(u => {
        const row = document.createElement("tr");
        row.className = "hover:bg-slate-800/40 border-b border-slate-800/50";
        row.innerHTML = `
            <td class="p-3 font-semibold text-slate-200">${u.nama || '-'}</td>
            <td class="p-3 font-mono text-slate-300">${u.username}</td>
            <td class="p-3 font-mono text-slate-400">${u.password}</td>
            <td class="p-3"><span class="px-2 py-0.5 text-xs rounded-full bg-slate-800 ${u.role === 'admin' ? 'text-amber-400 border border-amber-500/30' : 'text-blue-400 border border-blue-500/30'}">${u.role}</span></td>
            <td class="p-3 text-right space-x-2">
                <button onclick="editUser('${u.username}')" class="text-blue-400 hover:text-blue-300 p-1"><i class="fa-solid fa-pen-to-square"></i></button>
                <button onclick="deleteUser('${u.username}')" class="text-rose-400 hover:text-rose-300 p-1"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function openUserModal(isEdit = false) {
    document.getElementById("userModal").classList.remove("hidden");
    document.getElementById("modalEditMode").value = isEdit ? "true" : "false";
    document.getElementById("modalTitle").innerText = isEdit ? "Edit Data Karyawan" : "Tambah Karyawan Baru";
    if (!isEdit) {
        document.getElementById("modalNama").value = "";
        document.getElementById("modalUsername").value = "";
        document.getElementById("modalUsername").readOnly = false;
        document.getElementById("modalPassword").value = "";
        document.getElementById("modalRole").value = "karyawan";
    }
}

function closeUserModal() {
    document.getElementById("userModal").classList.add("hidden");
}

function editUser(username) {
    const user = usersList.find(u => u.username === username);
    if (user) {
        openUserModal(true);
        document.getElementById("modalNama").value = user.nama || "";
        document.getElementById("modalUsername").value = user.username;
        document.getElementById("modalUsername").readOnly = true;
        document.getElementById("modalPassword").value = user.password;
        document.getElementById("modalRole").value = user.role;
    }
}

function handleSaveUser(e) {
    e.preventDefault();
    const isEdit = document.getElementById("modalEditMode").value === "true";
    const nama = document.getElementById("modalNama").value.trim();
    const username = document.getElementById("modalUsername").value.trim();
    const password = document.getElementById("modalPassword").value.trim();
    const role = document.getElementById("modalRole").value;

    const payload = {
        action: isEdit ? "updateUser" : "createUser",
        nama, username, password, role
    };

    if (isEdit) {
        const idx = usersList.findIndex(u => u.username === username);
        if (idx !== -1) usersList[idx] = payload;
    } else {
        if (usersList.some(u => u.username.toLowerCase() === username.toLowerCase())) {
            alert("Username sudah terdaftar!");
            return;
        }
        usersList.push(payload);
    }

    renderUsersTable();
    closeUserModal();

    if (APPS_SCRIPT_URL !== "") {
        fetch(APPS_SCRIPT_URL, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        }).catch(err => console.error("API Error:", err));
    }
}

function deleteUser(username) {
    if (currentUser && username === currentUser.username) {
        alert("Tidak bisa menghapus akun yang sedang dipakai!");
        return;
    }

    if (confirm(`Yakin ingin menghapus karyawan '${username}'?`)) {
        usersList = usersList.filter(u => u.username !== username);
        renderUsersTable();

        if (APPS_SCRIPT_URL !== "") {
            fetch(APPS_SCRIPT_URL, {
                method: "POST",
                mode: "no-cors",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "deleteUser", username: username })
            }).catch(err => console.error("API Error:", err));
        }
    }
}
