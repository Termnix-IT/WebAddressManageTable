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

  // Modal elements
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

  var confirmDialog = document.getElementById("confirmDialog");
  var confirmCancelBtn = document.getElementById("confirmCancelBtn");
  var confirmOkBtn = document.getElementById("confirmOkBtn");
  var confirmText = document.getElementById("confirmText");

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
    pendingDeleteIp: null
  };

  var allHosts = normalizeItems(data, dataModelAdapters.hosts);
  var allSubnets = normalizeSubnets(data);

  renderSummary(allHosts, allSubnets);
  renderNetworkFilters(allSubnets);
  renderSubnets(allSubnets);
  buildNetworkIdSelect();
  applyFilters();

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
  var thead = document.querySelector("thead");
  thead.addEventListener("click", function (event) {
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
    if (state.pendingDeleteIp === null) return;
    var idx = allHosts.findIndex(function (h) { return h.ip === state.pendingDeleteIp; });
    if (idx !== -1) {
      allHosts.splice(idx, 1);
      renderSummary(allHosts, allSubnets);
      applyFilters();
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

  // ── ESC でモーダルを閉じる ──
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      if (!hostModal.classList.contains("is-hidden")) closeModal();
      if (!confirmDialog.classList.contains("is-hidden")) closeConfirm();
    }
  });

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
    confirmText.textContent = ip + " を削除しますか？この操作は元に戻せません。";
    confirmDialog.classList.remove("is-hidden");
  }

  function closeConfirm() {
    confirmDialog.classList.add("is-hidden");
    state.pendingDeleteIp = null;
  }

  // ────────────────────────────────────────
  // CRUD: 保存
  // ────────────────────────────────────────

  var IP_RE = /^(\d{1,3}\.){3}\d{1,3}$/;

  function saveHost() {
    clearModalErrors();
    var ipVal = fIp.value.trim();
    var nameVal = fName.value.trim();
    var valid = true;

    if (!IP_RE.test(ipVal)) {
      showError(fIpError, "正しいIPv4アドレスを入力してください");
      valid = false;
    }

    if (state.editingIp === null) {
      // 新規: IP重複チェック
      var duplicate = allHosts.some(function (h) { return h.ip === ipVal; });
      if (duplicate) {
        showError(fIpError, "このIPアドレスはすでに登録されています");
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

      return {
        id: network && network.id ? String(network.id) : "",
        subnet: network && network.cidr ? String(network.cidr) : "",
        gateway: network && network.gateway ? String(network.gateway) : "-",
        vlanLabel: vlanNumber !== "" ? "VLAN " + vlanNumber : "なし",
        hasVlan: vlanNumber !== ""
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
    var buttons = ['<button type="button" class="filter-chip is-active" data-network-id="all">すべて</button>'];

    subnets.forEach(function (subnet) {
      buttons.push(
        '<button type="button" class="filter-chip" data-network-id="' + escapeHtml(subnet.id) + '">' +
        escapeHtml(subnet.id || subnet.subnet) +
        "</button>"
      );
    });

    networkFilters.innerHTML = buttons.join("");

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

  function renderSubnets(rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
      subnetBody.innerHTML = '<p class="empty">データがありません</p>';
      return;
    }

    var html = rows
      .map(function (row) {
        return '<article class="subnet-card">' +
          '<p class="subnet-card-id">' + escapeHtml(row.id) + "</p>" +
          '<p class="subnet-card-cidr">' + escapeHtml(row.subnet) + "</p>" +
          '<dl class="subnet-card-meta">' +
          '<div><dt>Gateway</dt><dd>' + escapeHtml(row.gateway) + "</dd></div>" +
          '<div><dt>VLAN</dt><dd>' + renderBadge(row.vlanLabel, row.hasVlan ? "badge-vlan" : "badge-none") + "</dd></div>" +
          "</dl>" +
          "</article>";
      })
      .join("");

    subnetBody.innerHTML = html;
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
