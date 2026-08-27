import { db, ADMIN_PIN, EVENT_ID, pathFor, yen, localDate, downloadCsv, uuid } from "./common.js";
import { ref, onValue, get, set, update, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";

const $ = id => document.getElementById(id);
const ADMIN_SESSION = `yatai-${EVENT_ID}-admin-open`;
let currentSession = null;
let transactions = {};
let presence = {};
let adminOpen = sessionStorage.getItem(ADMIN_SESSION) === "1";

$("businessDate").value = localDate(new Date());

function sessionTransactions() {
  return Object.values(transactions).filter(item => item.sessionId === currentSession?.id);
}

function canceledIds(list) {
  return new Set(list.filter(item => item.type === "cancel").map(item => item.originalTransactionId));
}

function activeSales() {
  const list = sessionTransactions();
  const canceled = canceledIds(list);
  return list.filter(item => item.type === "sale" && !canceled.has(item.id));
}

function onlineRegisters() {
  return Object.values(presence).filter(item => item.online);
}

function resetBlockedReason() {
  if (currentSession?.status === "open") return "営業中は初期化できません。先に営業を締めてください。";
  if (onlineRegisters().length) return "接続中のレジがあります。レジ画面をすべて閉じてください。";
  return "";
}

function render() {
  const list = sessionTransactions();
  const sales = activeSales();
  const cancels = list.filter(item => item.type === "cancel");
  const sum = (items, key) => items.reduce((total, item) => total + Number(item[key] || 0), 0);
  const register1 = sales.filter(item => item.registerId === "R1");
  const register2 = sales.filter(item => item.registerId === "R2");

  $("sessionBadge").textContent = currentSession
    ? `${currentSession.businessDay}日目 ${currentSession.status === "open" ? "営業中" : "終了"}`
    : "営業前";
  $("startControls").classList.toggle("hidden", currentSession?.status === "open");
  $("openControls").classList.toggle("hidden", currentSession?.status !== "open");
  $("totalSales").textContent = yen(sum(sales, "total"));
  $("saleCount").textContent = `${sales.length}件`;
  $("cancelCount").textContent = `${cancels.length}件`;
  $("cancelAmount").textContent = yen(sum(cancels, "total"));
  $("yakisobaCount").textContent = `${sum(sales, "yakisobaQty")}個`;
  $("frankCount").textContent = `${sum(sales, "frankfurterQty")}本`;
  $("r1Sales").textContent = yen(sum(register1, "total"));
  $("r2Sales").textContent = yen(sum(register2, "total"));
  $("c1Count").textContent = `${sales.filter(item => item.cashierId === "C1").length}件`;
  $("c2Count").textContent = `${sales.filter(item => item.cashierId === "C2").length}件`;

  const online = onlineRegisters();
  $("r1Status").textContent = `レジ1 ${online.some(item => item.registerId === "R1") ? "接続中" : "未接続"}`;
  $("r2Status").textContent = `レジ2 ${online.some(item => item.registerId === "R2") ? "接続中" : "未接続"}`;

  $("transactionsBody").innerHTML = [...list]
    .sort((a, b) => (b.clientTime || "").localeCompare(a.clientTime || ""))
    .map(item => `<tr><td>${new Date(item.clientTime).toLocaleTimeString("ja-JP")}</td><td>${item.receiptNo || "-"}</td><td>${item.registerId}</td><td>${item.cashierId === "C1" ? "担当1" : "担当2"}</td><td>${item.type === "sale" ? "会計" : "取消"}</td><td>${item.yakisobaQty}</td><td>${item.frankfurterQty}</td><td>${yen(item.total)}</td><td>${item.reason || ""}</td></tr>`)
    .join("");

  const blocked = resetBlockedReason();
  $("openReset").disabled = Boolean(blocked);
  $("resetBlockReason").textContent = blocked;
}

function audit(action, detail = {}) {
  const id = uuid();
  set(ref(db, pathFor(`audit/${id}`)), {
    id,
    action,
    detail,
    actor: "admin",
    serverTime: serverTimestamp()
  }).catch(console.error);
}

function showAdmin() {
  adminOpen = true;
  sessionStorage.setItem(ADMIN_SESSION, "1");
  $("loginView").classList.add("hidden");
  $("adminView").classList.remove("hidden");
  startListeners();
  audit("admin_open");
}

function csvRows(list) {
  const ordered = [...list].sort((a, b) =>
    (Number(a.serverTime) || Date.parse(a.clientTime) || 0) -
    (Number(b.serverTime) || Date.parse(b.clientTime) || 0)
  );
  return [
    ["営業日", "会計番号", "サーバー時刻", "端末時刻", "レジ", "担当者", "種別", "元会計番号", "焼きそば", "フランク", "合計", "預かり", "お釣り", "取消理由", "補足"],
    ...ordered.map(item => [
      item.businessDate,
      item.receiptNo,
      item.serverTime ? new Date(item.serverTime).toLocaleString("ja-JP") : "未同期",
      new Date(item.clientTime).toLocaleString("ja-JP"),
      item.registerId,
      item.cashierId === "C1" ? "会計担当1" : "会計担当2",
      item.type === "sale" ? "会計" : "取消",
      item.originalReceiptNo || "",
      item.yakisobaQty,
      item.frankfurterQty,
      item.total,
      item.received,
      item.change,
      item.reason || "",
      item.note || ""
    ])
  ];
}

$("loginForm").onsubmit = event => {
  event.preventDefault();
  if ($("pin").value !== ADMIN_PIN) {
    $("loginError").textContent = "管理PINが違います。";
    audit("admin_pin_failure");
    return;
  }
  showAdmin();
};

$("logout").onclick = () => {
  adminOpen = false;
  sessionStorage.removeItem(ADMIN_SESSION);
  $("adminView").classList.add("hidden");
  $("loginView").classList.remove("hidden");
};

$("startSession").onclick = async () => {
  const day = Number($("businessDay").value);
  const date = $("businessDate").value;
  if (!date) return;
  const id = `${date}-D${day}`;
  if (!confirm(`${day}日目（${date}）の営業を開始しますか？`)) return;
  await set(ref(db, pathFor(`sessions/${id}`)), {
    businessDay: day,
    businessDate: date,
    status: "open",
    startedAt: serverTimestamp(),
    startedBy: "admin"
  });
  await set(ref(db, pathFor("settings/currentSession")), id);
  audit("session_start", { id });
};

$("exportCsv").onclick = () => {
  const rows = csvRows(sessionTransactions());
  downloadCsv(`屋台売上_全レジ_${currentSession.businessDate}_D${currentSession.businessDay}.csv`, rows);
  audit("csv_export", { sessionId: currentSession.id, count: rows.length - 1 });
};

$("openClose").onclick = () => $("closeDialog").showModal();
$("cancelClose").onclick = () => $("closeDialog").close();
$("confirmClose").onclick = async () => {
  const sales = activeSales();
  const register1 = sales.filter(item => item.registerId === "R1").reduce((total, item) => total + item.total, 0);
  const register2 = sales.filter(item => item.registerId === "R2").reduce((total, item) => total + item.total, 0);
  const number = id => Number($(id).value || 0);
  const summary = {
    r1: {
      openingFloat: number("r1Float"),
      sales: register1,
      expected: number("r1Float") + register1,
      actual: number("r1Actual"),
      difference: number("r1Actual") - (number("r1Float") + register1)
    },
    r2: {
      openingFloat: number("r2Float"),
      sales: register2,
      expected: number("r2Float") + register2,
      actual: number("r2Actual"),
      difference: number("r2Actual") - (number("r2Float") + register2)
    },
    inventory: {
      yakisobaPrepared: number("yPrepared"),
      yakisobaRemain: number("yRemain"),
      yakisobaExpectedSold: number("yPrepared") - number("yRemain"),
      yakisobaRecorded: sales.reduce((total, item) => total + item.yakisobaQty, 0),
      frankPrepared: number("fPrepared"),
      frankRemain: number("fRemain"),
      frankExpectedSold: number("fPrepared") - number("fRemain"),
      frankRecorded: sales.reduce((total, item) => total + item.frankfurterQty, 0)
    },
    closedAt: serverTimestamp(),
    closedBy: "admin"
  };
  if (!confirm(`営業を締めます。レジ1差額 ${yen(summary.r1.difference)}／レジ2差額 ${yen(summary.r2.difference)}。よろしいですか？`)) return;
  await update(ref(db, pathFor(`sessions/${currentSession.id}`)), { status: "closed", closeSummary: summary });
  audit("session_close", { sessionId: currentSession.id });
  $("closeDialog").close();
};

function updateResetConfirmation() {
  $("confirmReset").disabled = $("resetPin").value !== ADMIN_PIN || $("resetPhrase").value.trim() !== "全削除";
}

$("resetPin").addEventListener("input", updateResetConfirmation);
$("resetPhrase").addEventListener("input", updateResetConfirmation);

$("openReset").onclick = () => {
  const blocked = resetBlockedReason();
  if (blocked) {
    $("resetNotice").textContent = blocked;
    return;
  }
  $("resetPin").value = "";
  $("resetPhrase").value = "";
  $("resetError").textContent = "";
  $("resetSummary").textContent = `現在の取引履歴 ${Object.keys(transactions).length}件を含む、このイベントのテストデータを削除します。レジ端末の「未送信 0件」を確認してから実行してください。`;
  updateResetConfirmation();
  $("resetDialog").showModal();
};

$("cancelReset").onclick = () => $("resetDialog").close();

function addDeletes(target, basePath, snapshot) {
  snapshot.forEach(child => {
    target[`${basePath}/${child.key}`] = null;
  });
}

$("confirmReset").onclick = async () => {
  if ($("resetPin").value !== ADMIN_PIN || $("resetPhrase").value.trim() !== "全削除") return;
  const blocked = resetBlockedReason();
  if (blocked) {
    $("resetError").textContent = blocked;
    return;
  }

  $("confirmReset").disabled = true;
  $("resetError").textContent = "";
  $("confirmReset").textContent = "削除中…";

  try {
    const [transactionSnapshot, sessionSnapshot, auditSnapshot, presenceSnapshot, currentSessionSnapshot] = await Promise.all([
      get(ref(db, pathFor("transactions"))),
      get(ref(db, pathFor("sessions"))),
      get(ref(db, pathFor("audit"))),
      get(ref(db, pathFor("presence"))),
      get(ref(db, pathFor("settings/currentSession")))
    ]);

    const latestPresence = Object.values(presenceSnapshot.val() || {});
    if (latestPresence.some(item => item.online)) throw new Error("接続中のレジがあります。レジ画面をすべて閉じてください。");

    const currentSessionId = currentSessionSnapshot.val();
    if (currentSessionId) {
      const session = sessionSnapshot.child(currentSessionId).val();
      if (session?.status === "open") throw new Error("営業中は初期化できません。先に営業を締めてください。");
    }

    const backupTransactions = Object.values(transactionSnapshot.val() || {});
    if (backupTransactions.length) {
      downloadCsv(`屋台売上_初期化前バックアップ_${localDate(new Date())}.csv`, csvRows(backupTransactions));
    }

    const deletions = { "settings/currentSession": null };
    addDeletes(deletions, "transactions", transactionSnapshot);
    addDeletes(deletions, "sessions", sessionSnapshot);
    addDeletes(deletions, "audit", auditSnapshot);
    addDeletes(deletions, "presence", presenceSnapshot);

    const resetFlag = ref(db, pathFor("settings/resetRequested"));
    await set(resetFlag, true);
    try {
      await update(ref(db, pathFor("")), deletions);
    } finally {
      await set(resetFlag, null);
    }

    currentSession = null;
    transactions = {};
    presence = {};
    render();
    $("resetDialog").close();
    $("resetNotice").textContent = `テストデータを削除しました（取引 ${backupTransactions.length}件）。`;
  } catch (error) {
    console.error(error);
    $("resetError").textContent = error?.message || "削除できませんでした。通信状態とデータベースルールを確認してください。";
  } finally {
    $("confirmReset").textContent = "完全に削除する";
    updateResetConfirmation();
  }
};

let listenersStarted = false;
function startListeners() {
  if (listenersStarted) return;
  listenersStarted = true;
  onValue(ref(db, pathFor("settings/currentSession")), snapshot => {
    const id = snapshot.val();
    if (!id) {
      currentSession = null;
      render();
      return;
    }
    onValue(ref(db, pathFor(`sessions/${id}`)), sessionSnapshot => {
      currentSession = sessionSnapshot.val() ? { id, ...sessionSnapshot.val() } : null;
      render();
    });
  });
  onValue(ref(db, pathFor("transactions")), snapshot => {
    transactions = snapshot.val() || {};
    render();
  });
  onValue(ref(db, pathFor("presence")), snapshot => {
    presence = snapshot.val() || {};
    render();
  });
}

if (adminOpen) {
  showAdmin();
} else {
  $("loginView").classList.remove("hidden");
  $("adminView").classList.add("hidden");
}
render();
