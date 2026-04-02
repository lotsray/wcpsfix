const GAS_URL = "https://script.google.com/macros/s/AKfycbxGsTCROvzkU_DPOMsAf3vbLoBaWkVprmV7ZdWPHXzLUuxYIHdNTSDoI6Z0Z_BKIi5-xQ/exec";

const STORAGE_KEY_ADMIN_CODE = "repair_admin_code";

function qs(selector) {
  return document.querySelector(selector);
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name) || "";
}

function setAlert(el, message, type = "info") {
  if (!el) return;
  el.hidden = false;
  el.className = `alert ${type}`;
  el.textContent = message;
}

function clearAlert(el) {
  if (!el) return;
  el.hidden = true;
  el.className = "alert";
  el.textContent = "";
}

async function getJson(url) {
  const res = await fetch(url, {
    method: "GET"
  });
  return await res.json();
}

async function postJson(payload) {
  const res = await fetch(GAS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify(payload)
  });
  return await res.json();
}

function fillSelect(selectEl, list, placeholder = "") {
  if (!selectEl) return;
  selectEl.innerHTML = "";

  if (placeholder) {
    const op = document.createElement("option");
    op.value = "";
    op.textContent = placeholder;
    selectEl.appendChild(op);
  }

  list.forEach(item => {
    const op = document.createElement("option");
    op.value = item;
    op.textContent = item;
    selectEl.appendChild(op);
  });
}

/* =========================
   repair.html
========================= */

async function initRepairPage() {
  const form = qs("#repairForm");
  if (!form) return;

  const alertBox = qs("#repairAlert");
  const titleEl = qs("#repairPageTitle");
  const categorySelect = qs("#category");
  const urgencySelect = qs("#urgency");
  const submitBtn = qs("#submitRepairBtn");

  clearAlert(alertBox);

  try {
    const data = await getJson(`${GAS_URL}?action=getSettings`);
    if (!data.success) {
      setAlert(alertBox, data.message || "讀取設定失敗", "error");
      return;
    }

    fillSelect(categorySelect, data.categories);
    fillSelect(urgencySelect, data.urgencyList);

    const categoryParam = getQueryParam("category");
    if (categoryParam && data.categories.includes(categoryParam)) {
      categorySelect.value = categoryParam;
      titleEl.textContent = categoryParam;
    } else {
      titleEl.textContent = "填寫報修單";
    }
  } catch (err) {
    setAlert(alertBox, "無法讀取系統設定，請稍後再試。", "error");
    return;
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    clearAlert(alertBox);

    submitBtn.disabled = true;
    submitBtn.textContent = "送出中...";

    const payload = {
      action: "submitRepair",
      category: qs("#category").value.trim(),
      urgency: qs("#urgency").value.trim(),
      reporter: qs("#reporter").value.trim(),
      unit: qs("#unit").value.trim(),
      contact: qs("#contact").value.trim(),
      location: qs("#location").value.trim(),
      itemName: qs("#itemName").value.trim(),
      description: qs("#description").value.trim()
    };

    try {
      const result = await postJson(payload);
      if (!result.success) {
        setAlert(alertBox, result.message || "送出失敗", "error");
        return;
      }

      form.reset();

      const categoryParam = getQueryParam("category");
      if (categoryParam) {
        qs("#category").value = categoryParam;
      }

      setAlert(alertBox, `送出成功，報修編號：${result.repairId}`, "success");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setAlert(alertBox, "送出失敗，請稍後再試。", "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "送出報修單";
    }
  });
}

/* =========================
   admin.html
========================= */

let adminSettingsCache = null;
let currentRepairs = [];

async function initAdminPage() {
  const loginForm = qs("#adminLoginForm");
  if (!loginForm) return;

  const savedCode = localStorage.getItem(STORAGE_KEY_ADMIN_CODE) || "";

  bindAdminStaticEvents();
  await loadAdminSettings();

  if (savedCode) {
    await adminLogin(savedCode, true);
  }

  loginForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    const code = qs("#adminCode").value.trim();
    await adminLogin(code, false);
  });
}

function bindAdminStaticEvents() {
  const refreshBtn = qs("#refreshBtn");
  const logoutBtn = qs("#logoutBtn");
  const searchBtn = qs("#searchBtn");
  const closeModalBtn = qs("#closeModalBtn");
  const modalBackdrop = qs("#modalBackdrop");
  const editForm = qs("#editForm");

  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => loadRepairs());
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", adminLogout);
  }

  if (searchBtn) {
    searchBtn.addEventListener("click", () => loadRepairs());
  }

  if (closeModalBtn) {
    closeModalBtn.addEventListener("click", closeEditModal);
  }

  if (modalBackdrop) {
    modalBackdrop.addEventListener("click", closeEditModal);
  }

  if (editForm) {
    editForm.addEventListener("submit", submitEditForm);
  }
}

async function loadAdminSettings() {
  try {
    const data = await getJson(`${GAS_URL}?action=getSettings`);
    if (!data.success) return;

    adminSettingsCache = data;
    fillSelect(qs("#statusFilter"), data.statusList, "全部狀態");
    fillSelect(qs("#editStatus"), data.statusList);
  } catch (err) {
    console.error(err);
  }
}

async function adminLogin(code, silent) {
  const loginAlert = qs("#loginAlert");
  if (!silent) clearAlert(loginAlert);

  if (!code) {
    setAlert(loginAlert, "請輸入管理碼", "error");
    return;
  }

  try {
    const result = await getJson(`${GAS_URL}?action=login&code=${encodeURIComponent(code)}`);
    if (!result.success) {
      localStorage.removeItem(STORAGE_KEY_ADMIN_CODE);
      if (!silent) {
        setAlert(loginAlert, result.message || "登入失敗", "error");
      }
      return;
    }

    localStorage.setItem(STORAGE_KEY_ADMIN_CODE, code);
    qs("#adminCode").value = "";

    qs("#adminLoginSection").hidden = true;
    qs("#adminPanelSection").hidden = false;

    qs("#adminPanelTitle").textContent = `${result.roleName}報修管理`;
    qs("#adminPanelSubtitle").textContent = `目前可管理類別：${result.category}`;

    clearAlert(loginAlert);
    await loadRepairs();
  } catch (err) {
    if (!silent) {
      setAlert(loginAlert, "登入失敗，請稍後再試。", "error");
    }
  }
}

function adminLogout() {
  localStorage.removeItem(STORAGE_KEY_ADMIN_CODE);
  qs("#adminLoginSection").hidden = false;
  qs("#adminPanelSection").hidden = true;
  qs("#adminCode").value = "";
  currentRepairs = [];
  renderRepairs([]);
}

async function loadRepairs() {
  const adminAlert = qs("#adminAlert");
  clearAlert(adminAlert);

  const code = localStorage.getItem(STORAGE_KEY_ADMIN_CODE) || "";
  if (!code) {
    adminLogout();
    return;
  }

  const status = qs("#statusFilter").value.trim();
  const keyword = qs("#keywordFilter").value.trim();

  setAlert(adminAlert, "資料讀取中...", "info");

  try {
    const url = `${GAS_URL}?action=getRepairs&code=${encodeURIComponent(code)}&status=${encodeURIComponent(status)}&keyword=${encodeURIComponent(keyword)}`;
    const result = await getJson(url);

    if (!result.success) {
      if ((result.message || "").includes("未授權")) {
        adminLogout();
      }
      setAlert(adminAlert, result.message || "讀取失敗", "error");
      return;
    }

    currentRepairs = result.repairs || [];
    renderRepairs(currentRepairs);

    if (currentRepairs.length === 0) {
      setAlert(adminAlert, "目前查無符合條件的報修資料。", "info");
    } else {
      setAlert(adminAlert, `共 ${currentRepairs.length} 筆資料。`, "success");
    }
  } catch (err) {
    setAlert(adminAlert, "讀取資料失敗，請稍後再試。", "error");
  }
}

function renderRepairs(list) {
  const tbody = qs("#repairsTableBody");
  if (!tbody) return;

  if (!list || list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="15" class="empty-cell">尚無資料</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(item => {
    const urgencyBadgeClass = item.urgency === "急件" ? "urgent" : "normal";
    return `
      <tr>
        <td>${escapeHtml(item.repairId)}</td>
        <td>${escapeHtml(item.repairTime)}</td>
        <td>${escapeHtml(item.reporter)}</td>
        <td>${escapeHtml(item.unit)}</td>
        <td>${escapeHtml(item.contact)}</td>
        <td>${escapeHtml(item.location)}</td>
        <td>${escapeHtml(item.itemName)}</td>
        <td>${escapeHtml(item.description)}</td>
        <td><span class="badge ${urgencyBadgeClass}">${escapeHtml(item.urgency)}</span></td>
        <td>${escapeHtml(item.status)}</td>
        <td>${escapeHtml(item.handler)}</td>
        <td>${escapeHtml(item.handleNote)}</td>
        <td>${escapeHtml(item.completedTime)}</td>
        <td>${escapeHtml(item.remark)}</td>
        <td>
          <div class="row-actions">
            <button type="button" class="small-btn" onclick="openEditModal('${item.repairId.replace(/'/g, "\\'")}')">編輯</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function openEditModal(repairId) {
  const item = currentRepairs.find(x => x.repairId === repairId);
  if (!item) return;

  clearAlert(qs("#editAlert"));

  qs("#editRepairId").value = item.repairId || "";
  qs("#editStatus").value = item.status || "";
  qs("#editHandler").value = item.handler || "";
  qs("#editHandleNote").value = item.handleNote || "";
  qs("#editRemark").value = item.remark || "";

  qs("#editModal").hidden = false;
}

function closeEditModal() {
  qs("#editModal").hidden = true;
  clearAlert(qs("#editAlert"));
}

async function submitEditForm(e) {
  e.preventDefault();

  const editAlert = qs("#editAlert");
  clearAlert(editAlert);

  const code = localStorage.getItem(STORAGE_KEY_ADMIN_CODE) || "";
  if (!code) {
    adminLogout();
    return;
  }

  const payload = {
    action: "updateRepair",
    code: code,
    repairId: qs("#editRepairId").value.trim(),
    status: qs("#editStatus").value.trim(),
    handler: qs("#editHandler").value.trim(),
    handleNote: qs("#editHandleNote").value.trim(),
    remark: qs("#editRemark").value.trim()
  };

  try {
    const result = await postJson(payload);
    if (!result.success) {
      setAlert(editAlert, result.message || "更新失敗", "error");
      return;
    }

    setAlert(editAlert, "更新成功", "success");
    await loadRepairs();
    setTimeout(() => {
      closeEditModal();
    }, 500);
  } catch (err) {
    setAlert(editAlert, "更新失敗，請稍後再試。", "error");
  }
}

/* =========================
   status.html
========================= */

async function initStatusPage() {
  const tableBody = qs("#publicRepairsTableBody");
  if (!tableBody) return;

  const alertBox = qs("#publicAlert");
  clearAlert(alertBox);

  try {
    const data = await getJson(`${GAS_URL}?action=getSettings`);
    if (data.success) {
      fillSelect(qs("#publicCategoryFilter"), data.categories, "全部類別");
      fillSelect(qs("#publicStatusFilter"), data.statusList, "全部狀態");
    }
  } catch (err) {
    console.error(err);
  }

  const searchBtn = qs("#publicSearchBtn");
  if (searchBtn) {
    searchBtn.addEventListener("click", () => loadPublicRepairs());
  }

  await loadPublicRepairs();
}

async function loadPublicRepairs() {
  const alertBox = qs("#publicAlert");
  clearAlert(alertBox);

  const category = qs("#publicCategoryFilter") ? qs("#publicCategoryFilter").value.trim() : "";
  const status = qs("#publicStatusFilter") ? qs("#publicStatusFilter").value.trim() : "";
  const keyword = qs("#publicKeywordFilter") ? qs("#publicKeywordFilter").value.trim() : "";

  setAlert(alertBox, "資料讀取中...", "info");

  try {
    const url = `${GAS_URL}?action=getPublicRepairs&category=${encodeURIComponent(category)}&status=${encodeURIComponent(status)}&keyword=${encodeURIComponent(keyword)}`;
    const result = await getJson(url);

    if (!result.success) {
      setAlert(alertBox, result.message || "讀取失敗", "error");
      renderPublicRepairs([]);
      return;
    }

    const list = result.repairs || [];
    renderPublicRepairs(list);

    if (list.length === 0) {
      setAlert(alertBox, "目前查無符合條件的報修資料。", "info");
    } else {
      setAlert(alertBox, `共 ${list.length} 筆資料。`, "success");
    }
  } catch (err) {
    setAlert(alertBox, "讀取資料失敗，請稍後再試。", "error");
    renderPublicRepairs([]);
  }
}

function renderPublicRepairs(list) {
  const tbody = qs("#publicRepairsTableBody");
  if (!tbody) return;

  if (!list || list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" class="empty-cell">尚無資料</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(item => {
    const urgencyBadgeClass = item.urgency === "急件" ? "urgent" : "normal";
    return `
      <tr>
        <td>${escapeHtml(item.repairId)}</td>
        <td>${escapeHtml(item.repairTime)}</td>
        <td>${escapeHtml(item.category)}</td>
        <td>${escapeHtml(item.reporter)}</td>
        <td>${escapeHtml(item.unit)}</td>
        <td>${escapeHtml(item.location)}</td>
        <td>${escapeHtml(item.itemName)}</td>
        <td>${escapeHtml(item.description)}</td>
        <td><span class="badge ${urgencyBadgeClass}">${escapeHtml(item.urgency)}</span></td>
        <td>${escapeHtml(item.status)}</td>
        <td>${escapeHtml(item.completedTime)}</td>
      </tr>
    `;
  }).join("");
}
