(function () {
  "use strict";

  var data = readEmbeddedData();

  var ipInput = document.getElementById("ipInput");
  var searchButton = document.getElementById("searchButton");
  var clearButton = document.getElementById("clearButton");
  var subnetBody = document.getElementById("subnetBody");
  var resultBody = document.getElementById("resultBody");
  var statusText = document.getElementById("statusText");

  // dataModelAdapters にセクションを追加すれば、将来の機器/VLANにも対応できる。
  var dataModelAdapters = {
    hosts: {
      key: "hosts",
      ipField: "ip",
      columns: ["ip", "name", "role", "network_id", "assign", "note"]
    }
  };

  var allHosts = normalizeItems(data, dataModelAdapters.hosts);
  var allSubnets = normalizeSubnets(data);

  renderSubnets(allSubnets);
  renderRows(allHosts);
  setStatus("全 " + allHosts.length + " 件を表示しています。");

  function runSearch() {
    var query = (ipInput.value || "").trim();
    if (!query) {
      renderRows(allHosts);
      setStatus("未入力のため全件表示に戻しました。");
      return false;
    }

    var matched = filterByKeyword(allHosts, query, dataModelAdapters.hosts.columns);
    renderRows(matched);

    if (matched.length === 0) {
      setStatus("一致するデータは見つかりませんでした: " + query);
      return false;
    }

    setStatus("検索結果: " + matched.length + " 件 (" + query + ")");
    return true;
  }

  searchButton.addEventListener("click", function () {
    runSearch();
  });

  ipInput.addEventListener("input", function () {
    runSearch();
  });

  clearButton.addEventListener("click", function () {
    ipInput.value = "";
    renderRows(allHosts);
    setStatus("入力をクリアし、全件表示に戻しました。");
    ipInput.focus();
  });

  ipInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      runSearch();
    }
  });

  function readEmbeddedData() {
    var el = document.getElementById("ipData");
    if (!el) {
      return { hosts: [] };
    }

    try {
      return JSON.parse(el.textContent);
    } catch (_error) {
      setStatus("データ読込に失敗しました。JSON形式を確認してください。");
      return { hosts: [] };
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
      var hasVlan = vlanNumber !== "";

      return {
        subnet: network && network.cidr ? String(network.cidr) : "",
        vlanEnabled: hasVlan ? "あり" : "なし",
        vlanNumber: hasVlan ? vlanNumber : "-"
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

  function renderSubnets(rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
      subnetBody.innerHTML = '<tr><td colspan="3">データがありません</td></tr>';
      return;
    }

    var html = rows
      .map(function (row) {
        return "<tr>" +
          "<td>" + escapeHtml(row.subnet) + "</td>" +
          "<td>" + escapeHtml(row.vlanEnabled) + "</td>" +
          "<td>" + escapeHtml(row.vlanNumber) + "</td>" +
          "</tr>";
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
      resultBody.innerHTML = '<tr><td colspan="6">データがありません</td></tr>';
      return;
    }

    var html = rows
      .map(function (row) {
        return "<tr>" +
          "<td>" + escapeHtml(row.ip) + "</td>" +
          "<td>" + escapeHtml(row.name) + "</td>" +
          "<td>" + escapeHtml(row.role) + "</td>" +
          "<td>" + escapeHtml(row.network_id) + "</td>" +
          "<td>" + escapeHtml(row.assign) + "</td>" +
          "<td>" + escapeHtml(row.note) + "</td>" +
          "</tr>";
      })
      .join("");

    resultBody.innerHTML = html;
  }

  function setStatus(message) {
    statusText.textContent = message;
  }

  function escapeHtml(value) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
})();
