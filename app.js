(() => {
  const STORAGE_KEY = "zeta-region-schedule-v1";
  const $ = (id) => document.getElementById(id);
  const form = $("regionForm");
  const fields = {
    id: $("editId"), name: $("regionName"), date: $("regionDate"),
    owner: $("regionOwner"), status: $("regionStatus"), note: $("regionNote")
  };
  let records = loadRecords();
  let toastTimer;

  function loadRecords() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(saved) ? saved : [];
    } catch { return []; }
  }
  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(records)); }
    catch { notify("Не удалось сохранить данные в браузере."); }
  }
  function escapeHtml(value = "") {
    return String(value).replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  }
  function formatDate(date) {
    if (!date) return "Не указана";
    const [y,m,d] = date.split("-").map(Number);
    return new Date(y,m-1,d).toLocaleDateString("ru-RU",{day:"2-digit",month:"short",year:"numeric"});
  }
  function statusClass(status) {
    return status === "Выполнен" ? "status-done" :
      status === "В работе" ? "status-progress" :
      status === "Перенос" ? "status-move" : "status-planned";
  }
  function getVisibleRecords() {
    const month = $("monthFilter").value;
    const query = $("searchInput").value.trim().toLocaleLowerCase("ru");
    const status = $("statusFilter").value;
    return [...records]
      .filter(r => !month || (r.date || "").startsWith(month))
      .filter(r => !status || r.status === status)
      .filter(r => !query || [r.region,r.owner,r.note].join(" ").toLocaleLowerCase("ru").includes(query))
      .sort((a,b) => (a.date || "9999").localeCompare(b.date || "9999") || a.region.localeCompare(b.region,"ru"));
  }
  function render() {
    const visible = getVisibleRecords();
    $("regionRows").innerHTML = visible.map(r => `<tr>
      <td class="date-cell">${escapeHtml(formatDate(r.date))}</td>
      <td>${escapeHtml(r.region)}</td>
      <td>${escapeHtml(r.owner || "—")}</td>
      <td><span class="status ${statusClass(r.status)}">${escapeHtml(r.status)}</span></td>
      <td title="${escapeHtml(r.note || "")}">${escapeHtml(r.note || "—")}</td>
      <td><div class="actions">
        <button class="icon-btn" type="button" data-action="edit" data-id="${r.id}" aria-label="Изменить" title="Изменить">✎</button>
        <button class="icon-btn" type="button" data-action="delete" data-id="${r.id}" aria-label="Удалить" title="Удалить">×</button>
      </div></td>
    </tr>`).join("");
    $("emptyState").classList.toggle("hidden", visible.length > 0);
    $("visibleCount").textContent = `${visible.length} ${plural(visible.length, "запись", "записи", "записей")}`;
    $("totalCount").textContent = visible.length;
    $("plannedCount").textContent = visible.filter(r => r.status === "Запланирован").length;
    $("progressCount").textContent = visible.filter(r => r.status === "В работе").length;
    const today = new Date(); today.setHours(0,0,0,0);
    $("attentionCount").textContent = visible.filter(r => !r.date || (r.date < isoDate(today) && r.status !== "Выполнен")).length;
  }
  function plural(n, one, few, many) {
    const n10=n%10,n100=n%100;
    if(n10===1&&n100!==11)return one;
    if(n10>=2&&n10<=4&&(n100<12||n100>14))return few;
    return many;
  }
  function isoDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
  }
  function resetForm() {
    form.reset(); fields.id.value = ""; $("formTitle").textContent = "Добавить регион";
    $("saveBtn").textContent = "＋ Добавить в график"; $("cancelEditBtn").classList.add("hidden");
  }
  function notify(message) {
    const el = $("toast"); el.textContent = message; el.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
  }
  form.addEventListener("submit", event => {
    event.preventDefault();
    const region = fields.name.value.trim();
    if (!region || !fields.date.value) return;
    const duplicate = records.find(r => r.region.toLocaleLowerCase("ru") === region.toLocaleLowerCase("ru") && r.date === fields.date.value && r.id !== fields.id.value);
    if (duplicate && !confirm(`Регион «${region}» уже назначен на ${formatDate(fields.date.value)}. Всё равно добавить?`)) return;
    const item = {
      id: fields.id.value || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
      region, date: fields.date.value, owner: fields.owner.value.trim(),
      status: fields.status.value, note: fields.note.value.trim()
    };
    if (fields.id.value) {
      records = records.map(r => r.id === item.id ? item : r);
      notify("Изменения сохранены.");
    } else {
      records.push(item); notify("Регион добавлен в график.");
    }
    persist(); resetForm(); render();
  });
  $("regionRows").addEventListener("click", event => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const record = records.find(r => r.id === button.dataset.id);
    if (!record) return;
    if (button.dataset.action === "edit") {
      fields.id.value = record.id; fields.name.value = record.region; fields.date.value = record.date;
      fields.owner.value = record.owner || ""; fields.status.value = record.status; fields.note.value = record.note || "";
      $("formTitle").textContent = "Изменить запись"; $("saveBtn").textContent = "Сохранить изменения";
      $("cancelEditBtn").classList.remove("hidden"); fields.name.focus();
      if (window.innerWidth < 1050) $("regionForm").scrollIntoView({behavior:"smooth",block:"start"});
    } else if (confirm(`Удалить регион «${record.region}» из графика?`)) {
      records = records.filter(r => r.id !== record.id); persist(); render(); notify("Запись удалена.");
      if (fields.id.value === record.id) resetForm();
    }
  });
  $("cancelEditBtn").addEventListener("click", resetForm);
  ["monthFilter","searchInput","statusFilter"].forEach(id => $(id).addEventListener("input", render));
  $("clearAllBtn").addEventListener("click", () => {
    if (!records.length) return notify("График уже пуст.");
    if (confirm("Удалить все записи графика? Это действие нельзя отменить.")) {
      records = []; persist(); render(); resetForm(); notify("График очищен.");
    }
  });
  $("exportPdfBtn").addEventListener("click", exportPdf);
  $("exportCsvBtn").addEventListener("click", exportCsv);

  function exportPdf() {
    const data = getVisibleRecords();
    if (!data.length) return notify("Нет записей для экспорта. Измените фильтры или добавьте регионы.");

    // Use the browser's native print-to-PDF engine. It works offline, avoids external
    // libraries, and preserves Unicode/Cyrillic using the device's installed fonts.
    const period = $("monthFilter").value || "Все периоды";
    const popup = window.open("", "_blank");
    if (!popup) {
      notify("Браузер заблокировал окно печати. Разрешите всплывающие окна для сайта и повторите.");
      return;
    }

    const rows = data.map((r, i) => `<tr>
      <td class="num">${i + 1}</td>
      <td>${escapeHtml(formatDate(r.date))}</td>
      <td><strong>${escapeHtml(r.region)}</strong></td>
      <td>${escapeHtml(r.owner || "—")}</td>
      <td><span class="status">${escapeHtml(r.status)}</span></td>
      <td class="note">${escapeHtml(r.note || "—")}</td>
    </tr>`).join("");
    const generatedAt = new Date().toLocaleString("ru-RU", { dateStyle: "long", timeStyle: "short" });
    const html = `<!doctype html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ZETA — График регионов</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; color: #17231e; background: #fff; }
  body { font-family: Arial, "DejaVu Sans", "Liberation Sans", sans-serif; font-size: 10pt; line-height: 1.4; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .toolbar { display:flex; gap:10px; justify-content:flex-end; padding:14px; background:#f1f5f2; }
  .toolbar button { border:0; border-radius:6px; padding:10px 16px; font-size:14px; cursor:pointer; background:#173d32; color:white; }
  .toolbar .close { background:#64736b; }
  .report { padding: 0; }
  .head { background:#173d32; color:white; padding:22px 24px; border-radius:7px 7px 0 0; }
  .brand { font-size:12pt; letter-spacing:3px; font-weight:800; }
  h1 { font-size:21pt; margin:9px 0 5px; line-height:1.2; }
  .meta { font-size:9pt; color:#e5eee8; }
  .summary { margin:14px 0 10px; font-size:9pt; color:#46584e; }
  table { width:100%; border-collapse:collapse; table-layout:fixed; }
  thead { display:table-header-group; }
  tr { break-inside:avoid; page-break-inside:avoid; }
  th { background:#eaf3ef; color:#173d32; font-weight:700; text-align:left; }
  th, td { border:1px solid #d7e1db; padding:8px 7px; vertical-align:top; overflow-wrap:anywhere; word-wrap:break-word; }
  tbody tr:nth-child(even) { background:#f7faf8; }
  .num { width:5%; text-align:center; color:#65766b; }
  th:nth-child(2) { width:15%; } th:nth-child(3) { width:20%; } th:nth-child(4) { width:17%; } th:nth-child(5) { width:13%; } th:nth-child(6) { width:30%; }
  .status { font-weight:600; }
  .foot { margin-top:16px; border-top:1px solid #dce5df; padding-top:8px; color:#718077; font-size:8pt; display:flex; justify-content:space-between; gap:12px; }
  @media screen { body { background:#eef1ef; } .report { max-width:1200px; margin:22px auto; padding:22px; background:white; box-shadow:0 2px 14px #0001; } }
  @media print { .toolbar { display:none !important; } .report { margin:0; padding:0; box-shadow:none; max-width:none; } }
</style>
</head>
<body>
<div class="toolbar"><button onclick="window.print()" type="button">Печать / Сохранить в PDF</button><button class="close" onclick="window.close()" type="button">Закрыть</button></div>
<main class="report">
  <header class="head"><div class="brand">ZETA</div><h1>График постановки регионов</h1><div class="meta">Период: ${escapeHtml(period)} · Сформировано: ${escapeHtml(generatedAt)}</div></header>
  <p class="summary">Всего записей в отчёте: <strong>${data.length}</strong></p>
  <table><thead><tr><th class="num">№</th><th>Дата постановки</th><th>Регион</th><th>Ответственный</th><th>Статус</th><th>Комментарий</th></tr></thead><tbody>${rows}</tbody></table>
  <footer class="foot"><span>ZETA · График регионов</span><span>Планирование и контроль</span></footer>
</main>
<script>window.addEventListener('load', function(){ setTimeout(function(){ try { window.focus(); window.print(); } catch(e) {} }, 350); });</script>
</body></html>`;

    popup.document.open();
    popup.document.write(html);
    popup.document.close();
    notify("Отчёт открыт для печати. Выберите «Сохранить как PDF» в окне печати.");
  }
  function exportCsv() {
    const data = getVisibleRecords();
    if (!data.length) return notify("Нет записей для экспорта.");
    const rows = [["Дата постановки","Регион","Ответственный","Статус","Комментарий"], ...data.map(r => [r.date,r.region,r.owner,r.status,r.note])];
    const csv = "\uFEFF" + rows.map(row => row.map(value => `"${String(value ?? "").replace(/"/g,'""')}"`).join(";")).join("\r\n");
    const blob = new Blob([csv], {type:"text/csv;charset=utf-8;"});
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = "ZETA-region-schedule.csv"; a.click(); URL.revokeObjectURL(url);
    notify("CSV-файл скачан.");
  }
  // Set current month initially; users can clear the filter to view every period.
  const now = new Date();
  $("monthFilter").value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  render();
})();