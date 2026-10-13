import { db, EVENT_ID, pathFor, PRODUCTS, yen, uuid } from "./common.js?v=2";
import { ref, onValue, set, serverTimestamp, onDisconnect } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";

const $ = id => document.getElementById(id);
const OUTBOX = `yatai-${EVENT_ID}-outbox`;
const SETTINGS = `yatai-${EVENT_ID}-register-settings`;
const DEVICE_KEY = `yatai-${EVENT_ID}-device-id`;
const emptyQuantities = () => Object.fromEntries(PRODUCTS.map(product => [product.key, 0]));
const deviceId = localStorage.getItem(DEVICE_KEY) || uuid();
localStorage.setItem(DEVICE_KEY, deviceId);

let current = { quantities: emptyQuantities(), received: 0, moneyStack: [] };
let activeSession = null;
let transactions = {};
let connected = false;
let cancelCandidate = null;

const settings = JSON.parse(localStorage.getItem(SETTINGS) || '{"registerId":"R1","cashierId":"C1"}');
$("registerId").value = settings.registerId;
$("cashierId").value = settings.cashierId;

function getOutbox() {
  try { return JSON.parse(localStorage.getItem(OUTBOX) || "[]"); } catch { return []; }
}

function saveOutbox(value) {
  localStorage.setItem(OUTBOX, JSON.stringify(value));
  render();
}

function saveSettings() {
  localStorage.setItem(SETTINGS, JSON.stringify({ registerId: $("registerId").value, cashierId: $("cashierId").value }));
  render();
}

function total() {
  return PRODUCTS.reduce((sum, product) => sum + current.quantities[product.key] * product.price, 0);
}

function productFields(source) {
  return Object.fromEntries(PRODUCTS.map(product => [product.field, Number(source[product.field] ?? source.quantities?.[product.key] ?? 0)]));
}

function mergedTransactions() {
  const merged = { ...transactions };
  getOutbox().forEach(item => merged[item.id] ??= item);
  return Object.values(merged).filter(item => item.sessionId === activeSession?.id);
}

function canceledIds(list) {
  return new Set(list.filter(item => item.type === "cancel").map(item => item.originalTransactionId));
}

function validSales() {
  const list = mergedTransactions();
  const canceled = canceledIds(list);
  return list.filter(item => item.type === "sale" && !canceled.has(item.id));
}

function render() {
  const amount = total();
  const short = Math.max(amount - current.received, 0);
  const change = Math.max(current.received - amount, 0);
  const outbox = getOutbox();
  PRODUCTS.forEach(product => { $(`${product.key}Qty`).textContent = current.quantities[product.key]; });
  $("received").textContent = yen(current.received);
  $("total").textContent = yen(amount);
  $("change").textContent = short ? `不足 ${yen(short)}` : yen(change);
  $("change").classList.toggle("short", short > 0);
  $("checkout").disabled = !activeSession || activeSession.status !== "open" || !amount || short > 0;
  $("clearMoney").disabled = !current.received;
  $("registerBadge").textContent = $("registerId").selectedOptions[0].text;
  $("cashierBadge").textContent = $("cashierId").selectedOptions[0].text;
  $("sessionBadge").textContent = activeSession ? `${activeSession.businessDay}日目 ${activeSession.status === "open" ? "営業中" : "終了"}` : "営業前";
  $("networkBadge").textContent = connected ? "オンライン" : "オフライン";
  $("networkBadge").className = `badge ${connected ? "online" : "offline"}`;
  $("outboxBadge").textContent = `未送信 ${outbox.length}件`;
  const sales = validSales().filter(item => item.registerId === $("registerId").value);
  const salesAmount = sales.reduce((sum, item) => sum + item.total, 0);
  const items = sales.reduce((sum, item) => sum + PRODUCTS.reduce((count, product) => count + Number(item[product.field] || 0), 0), 0);
  $("registerItems").textContent = `${items}点`;
  $("registerSales").textContent = yen(salesAmount);
  $("cancelLast").disabled = !sales.length;
}

function nextReceipt() {
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date()).replaceAll(":", "");
  const random = uuid().replaceAll("-", "").slice(0, 3).toUpperCase();
  return `A${activeSession.businessDay}-${$("registerId").value}-${time}-${random}`;
}

async function queue(record) {
  const list = getOutbox();
  if (!list.some(item => item.id === record.id)) list.push(record);
  saveOutbox(list);
  flushOutbox();
}

async function flushOutbox() {
  if (!connected) return;
  for (const item of getOutbox()) {
    try {
      await set(ref(db, pathFor(`transactions/${item.id}`)), { ...item, serverTime: serverTimestamp() });
      saveOutbox(getOutbox().filter(candidate => candidate.id !== item.id));
    } catch (error) {
      console.error(error);
      break;
    }
  }
}

function audit(action, detail = {}) {
  const id = uuid();
  set(ref(db, pathFor(`audit/${id}`)), { id, action, detail, deviceId, registerId: $("registerId").value, cashierId: $("cashierId").value, serverTime: serverTimestamp() }).catch(console.error);
}

function updatePresence() {
  if (!connected) return;
  const presenceRef = ref(db, pathFor(`presence/${deviceId}`));
  set(presenceRef, { online: true, registerId: $("registerId").value, cashierId: $("cashierId").value, lastSeen: serverTimestamp() });
  onDisconnect(presenceRef).set({ online: false, registerId: $("registerId").value, cashierId: $("cashierId").value, lastSeen: serverTimestamp() });
}

[$("registerId"), $("cashierId")].forEach(element => {
  element.onchange = () => {
    saveSettings();
    updatePresence();
    audit("operator_change", { registerId: $("registerId").value, cashierId: $("cashierId").value });
  };
});

document.querySelectorAll("[data-product]").forEach(button => {
  button.onclick = () => {
    const key = button.dataset.product;
    current.quantities[key] = Math.max(0, current.quantities[key] + Number(button.dataset.delta));
    render();
  };
});

document.querySelectorAll("[data-money]").forEach(button => {
  button.onclick = () => {
    const value = Number(button.dataset.money);
    current.received += value;
    current.moneyStack.push(value);
    render();
  };
});

$("undoMoney").onclick = () => { current.received = Math.max(0, current.received - (current.moneyStack.pop() || 0)); render(); };
$("clearMoney").onclick = () => { current.received = 0; current.moneyStack = []; render(); };
$("exactMoney").onclick = () => { current.received = total(); current.moneyStack = []; render(); };

$("checkout").onclick = () => {
  const amount = total();
  if (!activeSession || !amount || current.received < amount) return;
  const record = {
    id: uuid(), type: "sale", receiptNo: nextReceipt(), sessionId: activeSession.id,
    businessDay: activeSession.businessDay, businessDate: activeSession.businessDate,
    registerId: $("registerId").value, cashierId: $("cashierId").value,
    deviceId, clientTime: new Date().toISOString(), ...productFields(current),
    total: amount, received: current.received, change: current.received - amount
  };
  queue(record);
  current = { quantities: emptyQuantities(), received: 0, moneyStack: [] };
  $("notice").textContent = `${record.receiptNo} 会計完了`;
  setTimeout(() => $("notice").textContent = "", 2500);
  render();
};

$("cancelLast").onclick = () => {
  cancelCandidate = [...validSales()].filter(item => item.registerId === $("registerId").value).sort((a, b) => (b.clientTime || "").localeCompare(a.clientTime || ""))[0];
  if (!cancelCandidate) return;
  $("cancelTarget").textContent = `${cancelCandidate.receiptNo}／${yen(cancelCandidate.total)}`;
  $("cancelDialog").showModal();
};

$("confirmCancel").onclick = event => {
  event.preventDefault();
  if (!cancelCandidate) return;
  const record = {
    id: uuid(), type: "cancel", receiptNo: nextReceipt(), originalTransactionId: cancelCandidate.id,
    originalReceiptNo: cancelCandidate.receiptNo, reason: $("cancelReason").value, note: $("cancelNote").value.trim(),
    sessionId: activeSession.id, businessDay: activeSession.businessDay, businessDate: activeSession.businessDate,
    registerId: $("registerId").value, cashierId: $("cashierId").value,
    deviceId, clientTime: new Date().toISOString(), ...productFields(cancelCandidate),
    total: cancelCandidate.total, received: 0, change: 0
  };
  queue(record);
  audit("cancel_sale", { originalReceiptNo: cancelCandidate.receiptNo, reason: record.reason });
  $("cancelDialog").close();
  cancelCandidate = null;
};

onValue(ref(db, ".info/connected"), snapshot => {
  connected = Boolean(snapshot.val());
  render();
  if (connected) { updatePresence(); flushOutbox(); }
});
onValue(ref(db, pathFor("settings/currentSession")), snapshot => {
  const id = snapshot.val();
  if (!id) { activeSession = null; render(); return; }
  onValue(ref(db, pathFor(`sessions/${id}`)), sessionSnapshot => {
    activeSession = sessionSnapshot.val() ? { id, ...sessionSnapshot.val() } : null;
    render();
  });
});
onValue(ref(db, pathFor("transactions")), snapshot => { transactions = snapshot.val() || {}; render(); });
audit("register_open");
render();
