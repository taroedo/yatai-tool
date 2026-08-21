import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";
import { firebaseConfig, eventId, adminPin } from "./firebase-config.js";

if (firebaseConfig.apiKey.startsWith("YOUR_")) {
  console.warn("firebase-config.js の設定値を変更してください。");
}

export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const EVENT_ID = eventId;
export const ADMIN_PIN = adminPin;
export const pathFor = path => `events/${EVENT_ID}/${path}`;
export const PRICES = { yakisoba: 300, frankfurter: 200 };
export const yen = value => `${Number(value || 0).toLocaleString("ja-JP")}円`;
export const uuid = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
export const localDate = date => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(date);
export const csvCell = value => `"${String(value ?? "").replaceAll('"', '""')}"`;
export function downloadCsv(filename, rows) {
  const csv = "\ufeff" + rows.map(row => row.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = Object.assign(document.createElement("a"), { href: url, download: filename });
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
