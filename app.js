(function () {
  "use strict";

  var data = readEmbeddedData();

  var ipInput = document.getElementById("ipInput");
  var clearButton = document.getElementById("clearButton");
  var subnetBody = document.getElementById("subnetBody");
  var resultBody = document.getElementById("resultBody");
  var statusText = document.getElementById("statusText");
  var resultMeta = document.getElementById("resultMeta");
  var networkFilters = document.getElementById("networkFilters");
  var networkCount = document.getElementById("networkCount");
  var hostCount = document.getElementById("hostCount");
  var staticCount = document.getElementById("staticCount");
  var addHostBtn = document.getElementById("addHostBtn");
  var addSubnetBtn = document.getElementById("addSubnetBtn");
  var subnetResultMeta = document.getElementById("subnetResultMeta");

  // Host modal elements
  var hostModal = document.getElementById("hostModal");
  var hostForm = document.getElementById("hostForm");
  var hostModalTitle = document.getElementById("hostModalTitle");
  var hostModalCancel = document.getElementById("hostModalCancel");
  var hostModalClose = document.getElementById("hostModalClose");
  var fIp = document.getElementById("fIp");
  var fName = document.getElementById("fName");
  var fRole = document.getElementById("fRole");
  var fNetworkId = document.getElementById("fNetworkId");
  var fAssign = document.getElementById("fAssign");
  var fNote = document.getElementById("fNote");
  var fIpError = document.getElementById("fIpError");
  var fNameError = document.getElementById("fNameError");

  // Subnet modal elements
  var subnetModal = document.getElementById("subnetModal");
  var subnetForm = document.getElementById("subnetForm");
  var subnetModalTitle = document.getElementById("subnetModalTitle");
  var subnetModalCancel = document.getElementById("subnetModalCancel");
  var subnetModalClose = document.getElementById("subnetModalClose");
  var fSid = document.getElementById("fSid");
  var fCidr = document.getElementById("fCidr");
  var fGateway = document.getElementById("fGateway");
  var fVlan = document.getElementById("fVlan");
  var fDhcpEnabled = document.getElementById("fDhcpEnabled");
  var fDhcpStart = document.getElementById("fDhcpStart");
  var fDhcpEnd = document.getElementById("fDhcpEnd");
  var fSidError = document.getElementById("fSidError");
  var fCidrError = document.getElementById("fCidrError");
  var fGatewayError = document.getElementById("fGatewayError");
  var fVlanError = document.getElementById("fVlanError");
  var fDhcpStartError = document.getElementById("fDhcpStartError");
  var fDhcpEndError = document.getElementById("fDhcpEndError");

  var confirmDialog = document.getElementById("confirmDialog");
  var confirmCancelBtn = document.getElementById("confirmCancelBtn");
  var confirmOkBtn = document.getElementById("confirmOkBtn");
  var confirmText = document.getElementById("confirmText");
  var confirmTitle = document.getElementById("confirmTitle");

  var dataModelAdapters = {
    hosts: {
      key: "hosts",
      columns: ["ip", "name", "role", "network_id", "assign", "note"]
    }
  };

  var state = {
    query: "",
    networkId: "all",
    sortKey: "",
    sortDir: "asc",
    editingIp: null,
    pendingDeleteIp: null,
    editingSubnetId: null,
    pendingDeleteSubnetId: null
  };

  var stored = loadFromStorage();
  var allHosts;
  var allSubnets;
  if (stored) {
    allHosts = stored.hosts;
    allSubnets = stored.subnets;
  } else {
    allHosts = normalizeItems(data, dataModelAdapters.hosts);
    allSubnets = normalizeSubnets(data);
  }

  renderSummary(allHosts, allSubnets);
  renderNetworkFilters(allSubnets);
  initNetworkFilterEvents();
  renderSubnetsTable();
  buildNetworkIdSelect();
  applyFilters();
  initViewSwitcher();

  if (!stored) saveToStorage();

  // ── イベント: 検索・フィルタ ──
  ipInput.addEventListener("input", function () {
    state.query = (ipInput.value || "").trim();
    applyFilters();
  });

  clearButton.addEventListener("click", function () {
    state.query = "";
    state.networkId = "all";
    state.sortKey = "";
    state.sortDir = "asc";
    ipInput.value = "";
    syncFilterSelection();
    syncSortHeaders();
    applyFilters();
    ipInput.focus();
  });

  ipInput.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      clearButton.click();
    }
  });

  // ── イベント: ソート ──
  var hostsThead = document.querySelector(".section-hosts thead");
  hostsThead.addEventListener("click", function (event) {
    var th = event.target.closest("th[data-sort]");
    if (!th) return;
    var key = th.getAttribute("data-sort");
    if (state.sortKey === key) {
      state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
    } else {
      state.sortKey = key;
      state.sortDir = "asc";
    }
    syncSortHeaders();
    applyFilters();
  });

  // ── イベント: Add Host ──
  addHostBtn.addEventListener("click", function () {
    openModal("add");
  });

  hostModalCancel.addEventListener("click", closeModal);
  hostModalClose.addEventListener("click", closeModal);

  hostModal.addEventListener("click", function (event) {
    if (event.target === hostModal) closeModal();
  });

  hostForm.addEventListener("submit", function (event) {
    event.preventDefault();
    saveHost();
  });

  // ── イベント: 削除確認 ──
  confirmCancelBtn.addEventListener("click", closeConfirm);

  confirmDialog.addEventListener("click", function (event) {
    if (event.target === confirmDialog) closeConfirm();
  });

  confirmOkBtn.addEventListener("click", function () {
    if (state.pendingDeleteIp !== null) {
      var hIdx = allHosts.findIndex(function (h) { return h.ip === state.pendingDeleteIp; });
      if (hIdx !== -1) {
        allHosts.splice(hIdx, 1);
        renderSummary(allHosts, allSubnets);
        applyFilters();
        saveToStorage();
      }
    } else if (state.pendingDeleteSubnetId !== null) {
      var sIdx = allSubnets.findIndex(function (s) { return s.id === state.pendingDeleteSubnetId; });
      if (sIdx !== -1) {
        allSubnets.splice(sIdx, 1);
        if (state.networkId === state.pendingDeleteSubnetId) {
          state.networkId = "all";
        }
        renderSummary(allHosts, allSubnets);
        renderSubnetsTable();
        renderNetworkFilters(allSubnets);
        buildNetworkIdSelect();
        applyFilters();
        saveToStorage();
      }
    }
    closeConfirm();
  });

  // ── イベント: テーブル操作列 (event delegation) ──
  resultBody.addEventListener("click", function (event) {
    var editBtn = event.target.closest(".btn-edit");
    var deleteBtn = event.target.closest(".btn-delete");
    if (editBtn) {
      openModal("edit", editBtn.getAttribute("data-ip"));
    } else if (deleteBtn) {
      openConfirm(deleteBtn.getAttribute("data-ip"));
    }
  });

  // ── イベント: Add Subnet ──
  addSubnetBtn.addEventListener("click", function () {
    openSubnetModal("add");
  });

  subnetModalCancel.addEventListener("click", closeSubnetModal);
  subnetModalClose.addEventListener("click", closeSubnetModal);

  subnetModal.addEventListener("click", function (event) {
    if (event.target === subnetModal) closeSubnetModal();
  });

  subnetForm.addEventListener("submit", function (event) {
    event.preventDefault();
    saveSubnet();
  });

  fDhcpEnabled.addEventListener("change", function () {
    syncDhcpFieldsDisabled();
  });

  // ── イベント: サブネット操作列 ──
  subnetBody.addEventListener("click", function (event) {
    var editBtn = event.target.closest(".btn-edit-subnet");
    var deleteBtn = event.target.closest(".btn-delete-subnet");
    if (editBtn) {
      openSubnetModal("edit", editBtn.getAttribute("data-sid"));
    } else if (deleteBtn) {
      requestDeleteSubnet(deleteBtn.getAttribute("data-sid"));
    }
  });

  // ── ESC でモーダルを閉じる ──
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      if (!hostModal.classList.contains("is-hidden")) closeModal();
      if (!subnetModal.classList.contains("is-hidden")) closeSubnetModal();
      if (!confirmDialog.classList.contains("is-hidden")) closeConfirm();
    }
  });

  // ────────────────────────────────────────
  // サイドバー: ビュー切替
  // ────────────────────────────────────────

  function initViewSwitcher() {
    var sidebar = document.querySelector(".sidebar");
    var toggle = document.getElementById("sidenavToggle");
    var navLinks = document.querySelectorAll(".sidenav-link");
    var sections = document.querySelectorAll("[data-view-section]");

    navLinks.forEach(function (btn) {
      btn.addEventListener("click", function () {
        switchView(btn.getAttribute("data-view"));
      });
    });

    if (toggle && sidebar) {
      toggle.addEventListener("click", function () {
        var expanded = sidebar.getAttribute("data-expanded") === "true";
        setSidebarExpanded(!expanded);
      });

      // クリック外で閉じる（モバイル時の誤操作防止）
      document.addEventListener("click", function (event) {
        if (sidebar.getAttribute("data-expanded") !== "true") return;
        if (sidebar.contains(event.target)) return;
        setSidebarExpanded(false);
      });

      // ESCで閉じる
      document.addEventListener("keydown", function (event) {
        if (event.key !== "Escape") return;
        if (sidebar.getAttribute("data-expanded") === "true") {
          setSidebarExpanded(false);
        }
      });
    }

    function setSidebarExpanded(value) {
      sidebar.setAttribute("data-expanded", value ? "true" : "false");
      if (toggle) toggle.setAttribute("aria-expanded", value ? "true" : "false");
    }

    function switchView(view) {
      navLinks.forEach(function (b) {
        b.classList.toggle("is-active", b.getAttribute("data-view") === view);
      });
      sections.forEach(function (s) {
        var match = s.getAttribute("data-view-section") === view;
        s.classList.toggle("is-hidden-view", !match);
      });
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }

  // ────────────────────────────────────────
  // フィルタ・ソート
  // ────────────────────────────────────────

  function applyFilters() {
    var rows = allHosts.slice();

    if (state.networkId !== "all") {
      rows = rows.filter(function (row) {
        return row.network_id === state.networkId;
      });
    }

    if (state.query) {
      rows = filterByKeyword(rows, state.query, dataModelAdapters.hosts.columns);
    }

    rows = sortRows(rows);

    renderRows(rows);
    updateStatus(rows);
    updateResultMeta(rows);
  }

  function sortRows(rows) {
    if (!state.sortKey) return rows;
    var key = state.sortKey;
    var dir = state.sortDir === "asc" ? 1 : -1;

    return rows.slice().sort(function (a, b) {
      if (key === "ip") {
        return dir * compareIp(a.ip, b.ip);
      }
      return dir * String(a[key]).localeCompare(String(b[key]), "ja", { numeric: true });
    });
  }

  function compareIp(a, b) {
    var partsA = a.split(".").map(Number);
    var partsB = b.split(".").map(Number);
    for (var i = 0; i < 4; i++) {
      var diff = (partsA[i] || 0) - (partsB[i] || 0);
      if (diff !== 0) return diff;
    }
    return 0;
  }

  function syncSortHeaders() {
    var ths = document.querySelectorAll("thead th[data-sort]");
    ths.forEach(function (th) {
      var key = th.getAttribute("data-sort");
      th.classList.remove("sort-asc", "sort-desc");
      if (key === state.sortKey) {
        th.classList.add(state.sortDir === "asc" ? "sort-asc" : "sort-desc");
      }
    });
  }

  // ────────────────────────────────────────
  // CRUD: モーダル開閉
  // ────────────────────────────────────────

  function buildNetworkIdSelect() {
    var options = allSubnets.map(function (s) {
      return '<option value="' + escapeHtml(s.id) + '">' + escapeHtml(s.id) + '</option>';
    });
    fNetworkId.innerHTML = options.join("");
  }

  function openModal(mode, ip) {
    clearModalErrors();
    if (mode === "add") {
      state.editingIp = null;
      hostModalTitle.textContent = "ホストを追加";
      hostForm.reset();
    } else {
      state.editingIp = ip;
      hostModalTitle.textContent = "ホストを編集";
      var host = allHosts.find(function (h) { return h.ip === ip; });
      if (!host) return;
      fIp.value = host.ip;
      fName.value = host.name;
      fRole.value = host.role;
      fNetworkId.value = host.network_id;
      fAssign.value = host.assign || "static";
      fNote.value = host.note;
    }
    hostModal.classList.remove("is-hidden");
    fIp.focus();
  }

  function closeModal() {
    hostModal.classList.add("is-hidden");
    state.editingIp = null;
  }

  function openConfirm(ip) {
    state.pendingDeleteIp = ip;
    state.pendingDeleteSubnetId = null;
    if (confirmTitle) confirmTitle.textContent = "ホストを削除";
    confirmText.textContent = ip + " を削除しますか？この操作は元に戻せません。";
    confirmDialog.classList.remove("is-hidden");
  }

  function closeConfirm() {
    confirmDialog.classList.add("is-hidden");
    state.pendingDeleteIp = null;
    state.pendingDeleteSubnetId = null;
  }

  // ────────────────────────────────────────
  // IP / CIDR 検証ヘルパー
  // ────────────────────────────────────────

  function isValidIpv4(value) {
    if (typeof value !== "string") return false;
    var m = value.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!m) return false;
    for (var i = 1; i <= 4; i++) {
      var n = Number(m[i]);
      if (!(n >= 0 && n <= 255)) return false;
    }
    return true;
  }

  function ipToInt(ip) {
    var parts = ip.split(".").map(Number);
    return (((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0);
  }

  function parseCidr(cidr) {
    if (typeof cidr !== "string") return null;
    var m = cidr.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\/(\d{1,2})$/);
    if (!m) return null;
    if (!isValidIpv4(m[1])) return null;
    var prefix = Number(m[2]);
    if (!(prefix >= 0 && prefix <= 32)) return null;
    var ipInt = ipToInt(m[1]);
    var mask = prefix === 0 ? 0 : ((0xFFFFFFFF << (32 - prefix)) >>> 0);
    return {
      prefix: prefix,
      mask: mask,
      network: (ipInt & mask) >>> 0
    };
  }

  function isValidCidr(value) {
    return parseCidr(value) !== null;
  }

  function ipInCidr(ip, parsed) {
    if (!parsed || !isValidIpv4(ip)) return false;
    return ((ipToInt(ip) & parsed.mask) >>> 0) === parsed.network;
  }

  // ────────────────────────────────────────
  // CRUD: 保存
  // ────────────────────────────────────────

  function saveHost() {
    clearModalErrors();
    var ipVal = fIp.value.trim();
    var nameVal = fName.value.trim();
    var networkIdVal = fNetworkId.value;
    var valid = true;

    if (!isValidIpv4(ipVal)) {
      showError(fIpError, "正しい IPv4 アドレスを入力してください (各オクテット 0〜255)");
      valid = false;
    } else {
      var selectedSubnet = allSubnets.find(function (s) { return s.id === networkIdVal; });
      if (selectedSubnet) {
        var parsed = parseCidr(selectedSubnet.subnet);
        if (parsed && !ipInCidr(ipVal, parsed)) {
          showError(fIpError, ipVal + " はサブネット " + selectedSubnet.id + " (" + selectedSubnet.subnet + ") の範囲外です");
          valid = false;
        }
      }
    }

    if (state.editingIp === null) {
      // 新規: IP重複チェック
      var duplicate = allHosts.some(function (h) { return h.ip === ipVal; });
      if (duplicate) {
        showError(fIpError, "この IP アドレスはすでに登録されています");
        valid = false;
      }
    }

    if (!nameVal) {
      showError(fNameError, "名称を入力してください");
      valid = false;
    }

    if (!valid) return;

    var newHost = {
      ip: ipVal,
      name: nameVal,
      role: fRole.value.trim(),
      network_id: fNetworkId.value,
      assign: fAssign.value,
      note: fNote.value.trim()
    };

    if (state.editingIp === null) {
      allHosts.push(newHost);
    } else {
      var idx = allHosts.findIndex(function (h) { return h.ip === state.editingIp; });
      if (idx !== -1) {
        allHosts[idx] = newHost;
      }
    }

    closeModal();
    renderSummary(allHosts, allSubnets);
    applyFilters();
    saveToStorage();
  }

  function clearModalErrors() {
    fIpError.textContent = "";
    fIpError.classList.remove("is-visible");
    fNameError.textContent = "";
    fNameError.classList.remove("is-visible");
  }

  function showError(el, message) {
    el.textContent = message;
    el.classList.add("is-visible");
  }

  // ────────────────────────────────────────
  // CRUD: サブネット
  // ────────────────────────────────────────

  function openSubnetModal(mode, id) {
    clearSubnetModalErrors();
    if (mode === "add") {
      state.editingSubnetId = null;
      subnetModalTitle.textContent = "サブネットを追加";
      subnetForm.reset();
      fSid.disabled = false;
      syncDhcpFieldsDisabled();
    } else {
      state.editingSubnetId = id;
      subnetModalTitle.textContent = "サブネットを編集";
      var subnet = allSubnets.find(function (s) { return s.id === id; });
      if (!subnet) return;
      fSid.value = subnet.id;
      fSid.disabled = true;
      fCidr.value = subnet.subnet;
      fGateway.value = subnet.gateway === "-" ? "" : subnet.gateway;
      fVlan.value = subnet.vlan;
      fDhcpEnabled.checked = subnet.dhcpEnabled;
      fDhcpStart.value = subnet.dhcpStart;
      fDhcpEnd.value = subnet.dhcpEnd;
      syncDhcpFieldsDisabled();
    }
    subnetModal.classList.remove("is-hidden");
    (state.editingSubnetId === null ? fSid : fCidr).focus();
  }

  function closeSubnetModal() {
    subnetModal.classList.add("is-hidden");
    state.editingSubnetId = null;
  }

  function syncDhcpFieldsDisabled() {
    var on = fDhcpEnabled.checked;
    fDhcpStart.disabled = !on;
    fDhcpEnd.disabled = !on;
    if (!on) {
      fDhcpStart.value = "";
      fDhcpEnd.value = "";
      clearFieldError(fDhcpStartError);
      clearFieldError(fDhcpEndError);
    }
  }

  function saveSubnet() {
    clearSubnetModalErrors();
    var idVal = fSid.value.trim();
    var cidrVal = fCidr.value.trim();
    var gatewayVal = fGateway.value.trim();
    var vlanVal = fVlan.value.trim();
    var dhcpOn = fDhcpEnabled.checked;
    var startVal = fDhcpStart.value.trim();
    var endVal = fDhcpEnd.value.trim();
    var valid = true;

    if (state.editingSubnetId === null) {
      if (!idVal) {
        showError(fSidError, "ID を入力してください");
        valid = false;
      } else if (allSubnets.some(function (s) { return s.id === idVal; })) {
        showError(fSidError, "この ID はすでに登録されています");
        valid = false;
      }
    }

    var parsedCidr = null;
    if (!isValidCidr(cidrVal)) {
      showError(fCidrError, "正しい CIDR 形式で入力してください (例: 192.168.1.0/24)");
      valid = false;
    } else {
      parsedCidr = parseCidr(cidrVal);
    }

    if (gatewayVal) {
      if (!isValidIpv4(gatewayVal)) {
        showError(fGatewayError, "正しい IPv4 アドレスを入力してください (各オクテット 0〜255)");
        valid = false;
      } else if (parsedCidr && !ipInCidr(gatewayVal, parsedCidr)) {
        showError(fGatewayError, "Gateway が CIDR 範囲外です");
        valid = false;
      }
    }

    if (vlanVal !== "") {
      var vn = Number(vlanVal);
      if (!/^\d+$/.test(vlanVal) || vn < 0 || vn > 4094) {
        showError(fVlanError, "0〜4094 の整数を入力してください");
        valid = false;
      }
    }

    if (dhcpOn) {
      var startOk = isValidIpv4(startVal);
      var endOk = isValidIpv4(endVal);
      if (!startOk) {
        showError(fDhcpStartError, "正しい IPv4 アドレスを入力してください (各オクテット 0〜255)");
        valid = false;
      } else if (parsedCidr && !ipInCidr(startVal, parsedCidr)) {
        showError(fDhcpStartError, "DHCP 開始が CIDR 範囲外です");
        valid = false;
      }
      if (!endOk) {
        showError(fDhcpEndError, "正しい IPv4 アドレスを入力してください (各オクテット 0〜255)");
        valid = false;
      } else if (parsedCidr && !ipInCidr(endVal, parsedCidr)) {
        showError(fDhcpEndError, "DHCP 終了が CIDR 範囲外です");
        valid = false;
      }
      if (startOk && endOk && ipToInt(startVal) > ipToInt(endVal)) {
        showError(fDhcpEndError, "終了アドレスは開始アドレス以上にしてください");
        valid = false;
      }
    }

    if (!valid) return;

    var normalizedVlan = vlanVal;
    var newSubnet = {
      id: state.editingSubnetId === null ? idVal : state.editingSubnetId,
      subnet: cidrVal,
      gateway: gatewayVal || "-",
      vlan: normalizedVlan,
      vlanLabel: normalizedVlan !== "" ? "VLAN " + normalizedVlan : "なし",
      hasVlan: normalizedVlan !== "",
      dhcpEnabled: dhcpOn,
      dhcpStart: dhcpOn ? startVal : "",
      dhcpEnd: dhcpOn ? endVal : ""
    };

    if (state.editingSubnetId === null) {
      allSubnets.push(newSubnet);
    } else {
      var idx = allSubnets.findIndex(function (s) { return s.id === state.editingSubnetId; });
      if (idx !== -1) allSubnets[idx] = newSubnet;
    }

    closeSubnetModal();
    renderSummary(allHosts, allSubnets);
    renderSubnetsTable();
    renderNetworkFilters(allSubnets);
    buildNetworkIdSelect();
    applyFilters();
    saveToStorage();
  }

  function requestDeleteSubnet(id) {
    var linkedCount = allHosts.filter(function (h) { return h.network_id === id; }).length;
    if (linkedCount > 0) {
      window.alert(id + " には " + linkedCount + " 件のホストが紐付いているため削除できません。\n先にホストを削除するか、別のサブネットへ移動してください。");
      return;
    }
    state.pendingDeleteSubnetId = id;
    state.pendingDeleteIp = null;
    if (confirmTitle) confirmTitle.textContent = "サブネットを削除";
    confirmText.textContent = id + " を削除しますか？この操作は元に戻せません。";
    confirmDialog.classList.remove("is-hidden");
  }

  function clearSubnetModalErrors() {
    [fSidError, fCidrError, fGatewayError, fVlanError, fDhcpStartError, fDhcpEndError].forEach(clearFieldError);
  }

  function clearFieldError(el) {
    if (!el) return;
    el.textContent = "";
    el.classList.remove("is-visible");
  }

  // ────────────────────────────────────────
  // データ読込・正規化
  // ────────────────────────────────────────

  function readEmbeddedData() {
    var el = document.getElementById("ipData");
    if (!el) {
      return { networks: [], hosts: [] };
    }

    try {
      return JSON.parse(el.textContent);
    } catch (_error) {
      setStatus("データ読込に失敗しました。JSON形式を確認してください。");
      return { networks: [], hosts: [] };
    }
  }

  // ────────────────────────────────────────
  // LocalStorage 永続化
  // ────────────────────────────────────────

  var STORAGE_KEY = "nar:v1";

  function loadFromStorage() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.hosts) || !Array.isArray(parsed.subnets)) return null;
      return parsed;
    } catch (_error) {
      return null;
    }
  }

  function saveToStorage() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
        hosts: allHosts,
        subnets: allSubnets
      }));
    } catch (_error) {
      // quota 超過 / プライベートモード 等 — 静かに無視
    }
  }

  function normalizeItems(model, adapter) {
    if (!model || !Array.isArray(model[adapter.key])) {
      return [];
    }

    return model[adapter.key].map(function (item) {
      var normalized = {};

      adapter.columns.forEach(function (column) {
        normalized[column] = item[column] == null ? "" : String(item[column]);
      });

      return normalized;
    });
  }

  function normalizeSubnets(model) {
    if (!model || !Array.isArray(model.networks)) {
      return [];
    }

    return model.networks.map(function (network) {
      var vlanNumber = readVlanNumber(network);
      var dhcp = (network && network.dhcp && typeof network.dhcp === "object") ? network.dhcp : null;
      var dhcpRange = (dhcp && dhcp.range && typeof dhcp.range === "object") ? dhcp.range : null;

      return {
        id: network && network.id ? String(network.id) : "",
        subnet: network && network.cidr ? String(network.cidr) : "",
        gateway: network && network.gateway ? String(network.gateway) : "-",
        vlan: vlanNumber,
        vlanLabel: vlanNumber !== "" ? "VLAN " + vlanNumber : "なし",
        hasVlan: vlanNumber !== "",
        dhcpEnabled: !!(dhcp && dhcp.enabled),
        dhcpStart: dhcpRange && dhcpRange.start ? String(dhcpRange.start) : "",
        dhcpEnd: dhcpRange && dhcpRange.end ? String(dhcpRange.end) : ""
      };
    });
  }

  function readVlanNumber(network) {
    if (!network || typeof network !== "object") {
      return "";
    }

    if (network.vlan && typeof network.vlan === "object") {
      if (network.vlan.number != null) {
        return String(network.vlan.number);
      }
      if (network.vlan.id != null) {
        return String(network.vlan.id);
      }
      if (network.vlan.vlan_id != null) {
        return String(network.vlan.vlan_id);
      }
    }

    if (network.vlan_id != null) {
      return String(network.vlan_id);
    }
    if (network.vlanId != null) {
      return String(network.vlanId);
    }
    if (network.vlan_number != null) {
      return String(network.vlan_number);
    }
    if (network.vlanNumber != null) {
      return String(network.vlanNumber);
    }

    return "";
  }

  // ────────────────────────────────────────
  // レンダリング
  // ────────────────────────────────────────

  function renderSummary(hosts, subnets) {
    var staticHosts = hosts.filter(function (host) {
      return host.assign.toLowerCase() === "static";
    });

    networkCount.textContent = String(subnets.length);
    hostCount.textContent = String(hosts.length);
    staticCount.textContent = String(staticHosts.length);
  }

  function renderNetworkFilters(subnets) {
    var buttons = ['<button type="button" class="filter-chip' + (state.networkId === "all" ? " is-active" : "") + '" data-network-id="all">すべて</button>'];

    subnets.forEach(function (subnet) {
      var activeCls = state.networkId === subnet.id ? " is-active" : "";
      buttons.push(
        '<button type="button" class="filter-chip' + activeCls + '" data-network-id="' + escapeHtml(subnet.id) + '">' +
        escapeHtml(subnet.id || subnet.subnet) +
        "</button>"
      );
    });

    networkFilters.innerHTML = buttons.join("");
  }

  function initNetworkFilterEvents() {
    networkFilters.addEventListener("click", function (event) {
      var button = event.target.closest("[data-network-id]");
      if (!button) {
        return;
      }

      state.networkId = button.getAttribute("data-network-id") || "all";
      syncFilterSelection();
      applyFilters();
    });
  }

  function syncFilterSelection() {
    var buttons = networkFilters.querySelectorAll("[data-network-id]");

    buttons.forEach(function (button) {
      var isActive = button.getAttribute("data-network-id") === state.networkId;
      button.classList.toggle("is-active", isActive);
    });
  }

  function renderSubnetsTable() {
    if (!Array.isArray(allSubnets) || allSubnets.length === 0) {
      subnetBody.innerHTML = '<tr><td colspan="6" class="empty">— サブネットが登録されていません —</td></tr>';
      updateSubnetMeta();
      return;
    }

    var html = allSubnets
      .map(function (row) {
        var dhcpCell;
        if (row.dhcpEnabled) {
          var range = (row.dhcpStart && row.dhcpEnd) ? (" " + row.dhcpStart + "–" + row.dhcpEnd) : "";
          dhcpCell = renderBadge("ON", "badge-assign-static") + '<span class="dhcp-range">' + escapeHtml(range) + "</span>";
        } else {
          dhcpCell = renderBadge("OFF", "badge-none");
        }
        return "<tr>" +
          "<td>" + escapeHtml(row.id) + "</td>" +
          "<td>" + escapeHtml(row.subnet) + "</td>" +
          "<td>" + escapeHtml(row.gateway) + "</td>" +
          "<td>" + renderBadge(row.vlanLabel, row.hasVlan ? "badge-vlan" : "badge-none") + "</td>" +
          "<td>" + dhcpCell + "</td>" +
          "<td>" +
            '<button class="btn-icon btn-edit btn-edit-subnet" data-sid="' + escapeHtml(row.id) + '" type="button">編集</button>' +
            '<button class="btn-icon btn-delete btn-delete-subnet" data-sid="' + escapeHtml(row.id) + '" type="button">削除</button>' +
          "</td>" +
          "</tr>";
      })
      .join("");

    subnetBody.innerHTML = html;

    var trs = subnetBody.querySelectorAll("tr");
    trs.forEach(function (tr, i) {
      tr.classList.add("row-enter");
      tr.style.animationDelay = (i * 38) + "ms";
    });

    updateSubnetMeta();
  }

  function updateSubnetMeta() {
    if (subnetResultMeta) {
      subnetResultMeta.textContent = allSubnets.length + " 件";
    }
  }

  function filterByKeyword(items, query, columns) {
    var q = String(query).toLowerCase();

    return items.filter(function (item) {
      return columns.some(function (column) {
        return String(item[column]).toLowerCase().indexOf(q) !== -1;
      });
    });
  }

  function renderRows(rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
      resultBody.innerHTML = '<tr><td colspan="7" class="empty">— 一致する hosts はありません —</td></tr>';
      return;
    }

    var html = rows
      .map(function (row) {
        return "<tr>" +
          "<td>" + escapeHtml(row.ip) + "</td>" +
          "<td>" + escapeHtml(row.name) + "</td>" +
          "<td>" + escapeHtml(row.role) + "</td>" +
          "<td>" + escapeHtml(row.network_id) + "</td>" +
          "<td>" + renderBadge(row.assign || "-", row.assign.toLowerCase() === "static" ? "badge-assign-static" : "badge-assign-dhcp") + "</td>" +
          "<td>" + escapeHtml(row.note) + "</td>" +
          "<td>" +
            '<button class="btn-icon btn-edit" data-ip="' + escapeHtml(row.ip) + '" type="button">編集</button>' +
            '<button class="btn-icon btn-delete" data-ip="' + escapeHtml(row.ip) + '" type="button">削除</button>' +
          "</td>" +
          "</tr>";
      })
      .join("");

    resultBody.innerHTML = html;

    // Stagger row entrance animation
    var trs = resultBody.querySelectorAll("tr");
    trs.forEach(function (tr, i) {
      tr.classList.add("row-enter");
      tr.style.animationDelay = (i * 38) + "ms";
    });
  }

  function updateStatus(rows) {
    var conditions = [];

    if (state.networkId !== "all") {
      conditions.push("ネットワーク: " + state.networkId);
    }

    if (state.query) {
      conditions.push("検索: " + state.query);
    }

    if (conditions.length === 0) {
      setStatus("全 " + allHosts.length + " 件を表示しています。");
      return;
    }

    setStatus(rows.length + " 件が一致しました (" + conditions.join(" / ") + ")");
  }

  function updateResultMeta(rows) {
    resultMeta.textContent = rows.length + " / " + allHosts.length + " 件を表示中";
  }

  function renderBadge(label, className) {
    return '<span class="badge ' + className + '">' + escapeHtml(label) + "</span>";
  }

  function setStatus(message) {
    statusText.textContent = message;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
})();
