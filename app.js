const STORAGE_KEY = 'sff_mezclas_compatibilizador_v1';
const DATA_URL = './data/ensayos.json';

let ensayos = [];
let filteredEnsayos = [];

// Referencias DOM
const searchInput = document.getElementById('searchInput');
const btnClearSearch = document.getElementById('btnClearSearch');
const filterCompat = document.getElementById('filterCompat');
const filterUso = document.getElementById('filterUso');
const filterCaldo = document.getElementById('filterCaldo');
const filterResultado = document.getElementById('filterResultado');
const btnResetFilters = document.getElementById('btnResetFilters');
const quickChips = document.getElementById('quickChips');
const ensayosBody = document.getElementById('ensayosBody');
const tableStatusText = document.getElementById('tableStatusText');

// KPIs
const kpiTotal = document.getElementById('kpiTotal');
const kpiOk = document.getElementById('kpiOk');
const kpiFail = document.getElementById('kpiFail');
const kpiFenix = document.getElementById('kpiFenix');

// Modal
const modalNuevaMezcla = document.getElementById('modalNuevaMezcla');
const btnOpenModal = document.getElementById('btnOpenModal');
const btnCloseModal = document.getElementById('btnCloseModal');
const btnCancelModal = document.getElementById('btnCancelModal');
const formNuevaMezcla = document.getElementById('formNuevaMezcla');
const activosInputsContainer = document.getElementById('activosInputsContainer');
const activosSuggestions = document.getElementById('activosSuggestions');
const duplicateAlertBox = document.getElementById('duplicateAlertBox');
const duplicateCountBadge = document.getElementById('duplicateCountBadge');
const duplicateMatchesBody = document.getElementById('duplicateMatchesBody');

// Exportación / Dropdown
const btnExportMenu = document.getElementById('btnExportMenu');
const exportDropdown = document.getElementById('exportDropdown');

function normalizeText(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .trim();
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => toast.classList.add('hidden'), 3200);
}

async function initApp() {
  buildActivosFormRows();
  setupEvents();

  // 1. Verificar si hay datos embebidos (modo portable) o guardados en localStorage
  const embeddedEl = document.getElementById('embedded-data');
  const localSaved = localStorage.getItem(STORAGE_KEY);

  if (localSaved) {
    try {
      ensayos = JSON.parse(localSaved);
    } catch (e) {
      ensayos = [];
    }
  }

  if (!ensayos.length && embeddedEl) {
    try {
      ensayos = JSON.parse(embeddedEl.textContent);
      saveToLocal();
    } catch (e) {
      ensayos = [];
    }
  }

  // 2. Si no hay datos locales, cargar desde data/ensayos.json (ideal para Vercel)
  if (!ensayos.length) {
    try {
      const resp = await fetch(DATA_URL);
      if (!resp.ok) throw new Error('No se pudo cargar data/ensayos.json');
      ensayos = await resp.json();
      saveToLocal();
    } catch (err) {
      tableStatusText.textContent =
        'Error cargando data/ensayos.json. Si abrís localmente sin servidor, usá un servidor local o Vercel.';
      console.error(err);
      return;
    }
  }

  populateDynamicFilters();
  populateActivosDatalist();
  renderQuickChips();
  applyFilters();
}

function saveToLocal() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ensayos));
}

function getActivosList(row) {
  return [row['Activo 1'], row['Activo 2'], row['Activo 3'], row['Activo 4'], row['Activo 5']]
    .map(v => String(v || '').trim())
    .filter(v => v && v !== '-');
}

function populateDynamicFilters() {
  const compats = [...new Set(ensayos.map(r => r['Compatibilizador']).filter(v => v && v !== '-'))].sort();
  const usos = [...new Set(ensayos.map(r => r['Forma de Uso']).filter(v => v && v !== '-'))].sort();
  const caldos = [...new Set(ensayos.map(r => r['Volumen de Caldo']).filter(v => v && v !== '-'))].sort(
    (a, b) => parseFloat(a) - parseFloat(b)
  );

  fillSelect(filterCompat, compats, 'Todos');
  fillSelect(filterUso, usos, 'Todas');
  fillSelect(filterCaldo, caldos, 'Todos');
}

function fillSelect(selectEl, items, defaultLabel) {
  const current = selectEl.value;
  selectEl.innerHTML = `<option value="">${defaultLabel}</option>`;
  items.forEach(item => {
    const opt = document.createElement('option');
    opt.value = item;
    opt.textContent = item;
    selectEl.appendChild(opt);
  });
  if (items.includes(current)) selectEl.value = current;
}

function populateActivosDatalist() {
  const set = new Set();
  ensayos.forEach(r => getActivosList(r).forEach(a => set.add(a.toUpperCase())));
  activosSuggestions.innerHTML = '';
  [...set].sort().forEach(act => {
    const opt = document.createElement('option');
    opt.value = act;
    activosSuggestions.appendChild(opt);
  });
}

function renderQuickChips() {
  const comunes = ['GLIFOSATO', '2,4-D', 'FOMESAFEM', 'ATRAZINA', 'SULFENTRAZONE', 'CLETODIM', 'DICAMBA', 'PARAQUAT', 'METSULFURON'];
  quickChips.innerHTML = '<span style="font-size:12px;color:#64748b;font-weight:600;">Accesos rápidos:</span>';
  comunes.forEach(term => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip';
    btn.textContent = term;
    btn.addEventListener('click', () => {
      const current = searchInput.value.trim();
      const normCurrent = normalizeText(current);
      if (normCurrent.includes(normalizeText(term))) {
        searchInput.value = current
          .split(/\s+/)
          .filter(t => normalizeText(t) !== normalizeText(term))
          .join(' ');
      } else {
        searchInput.value = current ? `${current} ${term}` : term;
      }
      applyFilters();
    });
    quickChips.appendChild(btn);
  });
}

function applyFilters() {
  const rawQuery = normalizeText(searchInput.value);
  const tokens = rawQuery ? rawQuery.split(/\s+/).filter(Boolean) : [];
  const compatVal = filterCompat.value;
  const usoVal = filterUso.value;
  const caldoVal = filterCaldo.value;
  const resVal = filterResultado.value;

  filteredEnsayos = ensayos.filter(row => {
    if (compatVal && row['Compatibilizador'] !== compatVal) return false;
    if (usoVal && row['Forma de Uso'] !== usoVal) return false;
    if (caldoVal && row['Volumen de Caldo'] !== caldoVal) return false;
    if (resVal && row['Resultado Estabilidad'] !== resVal) return false;

    if (tokens.length > 0) {
      const haystack = normalizeText(
        [
          row['Ensayo N°'],
          row['Activo 1'],
          row['Activo 2'],
          row['Activo 3'],
          row['Activo 4'],
          row['Activo 5'],
          row['Compatibilizador'],
          row['Observaciones']
        ].join(' ')
      );
      const matchesAll = tokens.every(tok => haystack.includes(tok));
      if (!matchesAll) return false;
    }
    return true;
  });

  // Actualizar chips activos
  document.querySelectorAll('.chip').forEach(chip => {
    const active = tokens.includes(normalizeText(chip.textContent));
    chip.classList.toggle('active', active);
  });

  updateKPIs();
  renderTable();
}

function updateKPIs() {
  const total = ensayos.length;
  const vis = filteredEnsayos.length;
  const okCount = filteredEnsayos.filter(r => normalizeText(r['Resultado Estabilidad']).includes('OK ESTABLE')).length;
  const failCount = filteredEnsayos.filter(r => normalizeText(r['Resultado Estabilidad']).includes('NO OK')).length;
  const fenixCount = filteredEnsayos.filter(r => normalizeText(r['Compatibilizador']) === 'FENIX').length;

  kpiTotal.textContent = `${vis} / ${total}`;
  kpiOk.textContent = okCount;
  kpiFail.textContent = failCount;
  kpiFenix.textContent = fenixCount;
  tableStatusText.textContent = `Mostrando ${vis} de ${total} ensayos registrados`;
}

function formatCell(val, isActivo = false) {
  if (!val || val === '-') return '<span class="empty-dash">-</span>';
  return isActivo ? `<span class="activo-cell">${escapeHtml(val)}</span>` : `<span class="dosis-cell">${escapeHtml(val)}</span>`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderTable() {
  if (!filteredEnsayos.length) {
    ensayosBody.innerHTML = `<tr><td colspan="17" style="text-align:center;padding:28px;color:#64748b;">No se encontraron ensayos con los filtros seleccionados.</td></tr>`;
    return;
  }

  const rowsHtml = filteredEnsayos
    .map(r => {
      const isOk = normalizeText(r['Resultado Estabilidad']).includes('OK ESTABLE');
      const badgeClass = isOk ? 'badge-ok' : 'badge-fail';
      return `
        <tr>
          <td><strong>${escapeHtml(r['Ensayo N°'])}</strong></td>
          <td>${formatCell(r['Activo 1'], true)}</td>
          <td>${formatCell(r['Dosis Activo 1'])}</td>
          <td>${formatCell(r['Activo 2'], true)}</td>
          <td>${formatCell(r['Dosis Activo 2'])}</td>
          <td>${formatCell(r['Activo 3'], true)}</td>
          <td>${formatCell(r['Dosis Activo 3'])}</td>
          <td>${formatCell(r['Activo 4'], true)}</td>
          <td>${formatCell(r['Dosis Activo 4'])}</td>
          <td>${formatCell(r['Activo 5'], true)}</td>
          <td>${formatCell(r['Dosis Activo 5'])}</td>
          <td><strong>${escapeHtml(r['Volumen de Caldo'])}</strong></td>
          <td><span class="badge badge-compat">${escapeHtml(r['Compatibilizador'])}</span></td>
          <td>${escapeHtml(r['Dosis Compatibilizador'])}</td>
          <td><span class="badge badge-uso">${escapeHtml(r['Forma de Uso'])}</span></td>
          <td><span class="badge ${badgeClass}">${escapeHtml(r['Resultado Estabilidad'])}</span></td>
          <td class="obs-cell">${escapeHtml(r['Observaciones'] || '-')}</td>
        </tr>
      `;
    })
    .join('');

  ensayosBody.innerHTML = rowsHtml;
}

// Formulario Nueva Mezcla
function buildActivosFormRows() {
  activosInputsContainer.innerHTML = '';
  for (let i = 1; i <= 5; i++) {
    const row = document.createElement('div');
    row.className = 'activo-row';
    row.innerHTML = `
      <span>Activo ${i}${i === 1 ? ' *' : ''}</span>
      <input
        type="text"
        id="activoName_${i}"
        list="activosSuggestions"
        placeholder="Nombre del principio activo (ej: GLIFOSATO SAL K)"
        ${i === 1 ? 'required' : ''}
      />
      <input
        type="number"
        id="activoDose_${i}"
        step="any"
        min="0"
        placeholder="Dosis (ej: 2.5)"
        ${i === 1 ? 'required' : ''}
      />
      <select id="activoUnit_${i}">
        <option value="L/Ha">L/Ha</option>
        <option value="Kg/Ha">Kg/Ha</option>
      </select>
    `;
    activosInputsContainer.appendChild(row);
  }

  // Escuchar cambios en tiempo real para detectar mezclas repetidas
  for (let i = 1; i <= 5; i++) {
    document.getElementById(`activoName_${i}`).addEventListener('input', checkDuplicateMixture);
  }
}

function getBaseActiveKey(name) {
  // Extrae palabra base para detectar coincidencias aunque cambie concentración o sal (ej: GLIFOSATO, 2,4-D, ATRAZINA)
  const norm = normalizeText(name);
  if (!norm) return '';
  return norm.split(/[\s%()]+/)[0];
}

function checkDuplicateMixture() {
  const entered = [];
  for (let i = 1; i <= 5; i++) {
    const val = normalizeText(document.getElementById(`activoName_${i}`).value);
    if (val) entered.push(val);
  }

  if (entered.length === 0) {
    duplicateAlertBox.classList.add('hidden');
    return;
  }

  const enteredBases = [...new Set(entered.map(getBaseActiveKey).filter(Boolean))];

  const matches = ensayos.filter(row => {
    const rowActivos = getActivosList(row).map(normalizeText);
    if (!rowActivos.length) return false;
    const rowBases = [...new Set(rowActivos.map(getBaseActiveKey).filter(Boolean))];

    // Coincide si todos los activos ingresados están presentes en el ensayo (por nombre o raíz del principio activo)
    return enteredBases.every(eb =>
      rowBases.some(rb => rb === eb || rb.includes(eb) || eb.includes(rb))
    );
  });

  if (matches.length === 0) {
    duplicateAlertBox.classList.add('hidden');
    return;
  }

  duplicateAlertBox.classList.remove('hidden');
  duplicateCountBadge.textContent = `${matches.length} ensayo(s) previo(s)`;

  duplicateMatchesBody.innerHTML = matches
    .map(m => {
      const activosSummary = [];
      for (let i = 1; i <= 5; i++) {
        const a = m[`Activo ${i}`];
        const d = m[`Dosis Activo ${i}`];
        if (a && a !== '-') activosSummary.push(`${a} (${d})`);
      }
      const isOk = normalizeText(m['Resultado Estabilidad']).includes('OK ESTABLE');
      return `
        <tr>
          <td><strong>#${escapeHtml(m['Ensayo N°'])}</strong></td>
          <td>${escapeHtml(activosSummary.join(' + '))}</td>
          <td>${escapeHtml(m['Volumen de Caldo'])}</td>
          <td>${escapeHtml(m['Compatibilizador'])} (${escapeHtml(m['Dosis Compatibilizador'])})</td>
          <td>${escapeHtml(m['Forma de Uso'])}</td>
          <td><span class="badge ${isOk ? 'badge-ok' : 'badge-fail'}">${escapeHtml(m['Resultado Estabilidad'])}</span></td>
          <td>${escapeHtml(m['Observaciones'] || '-')}</td>
        </tr>
      `;
    })
    .join('');
}

function handleSaveNuevaMezcla(e) {
  e.preventDefault();

  const maxNum = ensayos.reduce((max, r) => Math.max(max, Number(r['Ensayo N°']) || 0), 0);
  const newRecord = {
    'Ensayo N°': maxNum + 1
  };

  for (let i = 1; i <= 5; i++) {
    const rawName = document.getElementById(`activoName_${i}`).value.trim().toUpperCase();
    const rawDose = document.getElementById(`activoDose_${i}`).value.trim();
    const unit = document.getElementById(`activoUnit_${i}`).value;

    if (rawName) {
      newRecord[`Activo ${i}`] = rawName;
      newRecord[`Dosis Activo ${i}`] = rawDose ? `${rawDose} ${unit}` : '-';
    } else {
      newRecord[`Activo ${i}`] = '-';
      newRecord[`Dosis Activo ${i}`] = '-';
    }
  }

  const caldoVal = document.getElementById('inputCaldo').value.trim();
  const compatVal = document.getElementById('inputCompat').value.trim().toUpperCase() || 'FENIX';
  const dosisCompatVal = document.getElementById('inputDosisCompat').value.trim();
  const formaUsoVal = document.getElementById('inputFormaUso').value;
  const correctorVal = document.getElementById('inputCorrector').value;
  const resultadoVal = document.getElementById('inputResultado').value;
  const obsVal = document.getElementById('inputObs').value.trim();

  newRecord['Volumen de Caldo'] = `${caldoVal} L/Ha`;
  newRecord['Corrector'] = correctorVal;
  newRecord['Compatibilizador'] = compatVal;
  newRecord['Dosis Compatibilizador'] = `${dosisCompatVal} mL`;
  newRecord['Forma de Uso'] = formaUsoVal;
  newRecord['Resultado Estabilidad'] = resultadoVal;
  newRecord['Observaciones'] = obsVal || 'Ensayo cargado desde app';

  ensayos.push(newRecord);
  saveToLocal();
  populateDynamicFilters();
  populateActivosDatalist();
  applyFilters();

  closeModal();
  showToast(`Ensayo N° ${newRecord['Ensayo N°']} guardado correctamente.`);
}

function openModal() {
  formNuevaMezcla.reset();
  document.getElementById('inputCompat').value = 'FENIX';
  duplicateAlertBox.classList.add('hidden');
  modalNuevaMezcla.classList.remove('hidden');
}

function closeModal() {
  modalNuevaMezcla.classList.add('hidden');
}

// Exportaciones
function exportExcel() {
  if (typeof XLSX === 'undefined') {
    showToast('Librería Excel no disponible sin conexión. Probá CSV o JSON.');
    return;
  }
  const ws = XLSX.utils.json_to_sheet(filteredEnsayos);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Ensayos Mezclas SFF');
  XLSX.writeFile(wb, `Mezclas_Compatibilizador_SFF_${new Date().toISOString().slice(0, 10)}.xlsx`);
  showToast('Excel descargado.');
}

function exportCSV() {
  if (!filteredEnsayos.length) return;
  const headers = Object.keys(filteredEnsayos[0]);
  const csvLines = [
    headers.join(';'),
    ...filteredEnsayos.map(row =>
      headers.map(h => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(';')
    )
  ];
  const blob = new Blob(['﻿' + csvLines.join('
')], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, `Mezclas_Compatibilizador_SFF_${new Date().toISOString().slice(0, 10)}.csv`);
  showToast('CSV descargado.');
}

function exportJSON() {
  const blob = new Blob([JSON.stringify(ensayos, null, 2)], { type: 'application/json;charset=utf-8;' });
  triggerDownload(blob, 'ensayos.json');
  showToast('Archivo ensayos.json descargado.');
}

async function exportPortableHTML() {
  try {
    const cssText = await fetch('./styles.css').then(r => r.text());
    const jsText = await fetch('./app.js').then(r => r.text());
    const cleanHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Mezclas Compatibilizador SFF (Portable)</title>
  <script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"><\/script>
  <style>${cssText}</style>
</head>
<body>
${document.body.innerHTML.replace(/<script[\s\S]*?<\/script>/gi, '')}
<script id="embedded-data" type="application/json">${JSON.stringify(ensayos)}<\/script>
<script>${jsText}<\/script>
</body>
</html>`;
    const blob = new Blob([cleanHtml], { type: 'text/html;charset=utf-8;' });
    triggerDownload(blob, `Mezclas_SFF_Portable_${new Date().toISOString().slice(0, 10)}.html`);
    showToast('App portable descargada con todos los datos incluidos.');
  } catch (err) {
    showToast('No se pudo empaquetar el HTML portable.');
    console.error(err);
  }
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function setupEvents() {
  searchInput.addEventListener('input', applyFilters);
  btnClearSearch.addEventListener('click', () => {
    searchInput.value = '';
    applyFilters();
  });

  [filterCompat, filterUso, filterCaldo, filterResultado].forEach(el =>
    el.addEventListener('change', applyFilters)
  );

  btnResetFilters.addEventListener('click', () => {
    searchInput.value = '';
    filterCompat.value = '';
    filterUso.value = '';
    filterCaldo.value = '';
    filterResultado.value = '';
    applyFilters();
  });

  btnOpenModal.addEventListener('click', openModal);
  btnCloseModal.addEventListener('click', closeModal);
  btnCancelModal.addEventListener('click', closeModal);
  formNuevaMezcla.addEventListener('submit', handleSaveNuevaMezcla);

  // Dropdown exportar
  btnExportMenu.addEventListener('click', e => {
    e.stopPropagation();
    exportDropdown.classList.toggle('hidden');
  });
  document.addEventListener('click', () => exportDropdown.classList.add('hidden'));

  document.getElementById('btnExportExcel').addEventListener('click', exportExcel);
  document.getElementById('btnExportCSV').addEventListener('click', exportCSV);
  document.getElementById('btnExportJSON').addEventListener('click', exportJSON);
  document.getElementById('btnExportPortable').addEventListener('click', exportPortableHTML);

  document.getElementById('inputImportJSON').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const imported = JSON.parse(ev.target.result);
        if (!Array.isArray(imported)) throw new Error('Formato inválido');
        ensayos = imported;
        saveToLocal();
        populateDynamicFilters();
        populateActivosDatalist();
        applyFilters();
        showToast(`Se importaron ${ensayos.length} ensayos desde JSON.`);
      } catch (err) {
        showToast('Error al leer el archivo JSON.');
      }
    };
    reader.readAsText(file);
  });

  document.getElementById('btnResetLocal').addEventListener('click', async () => {
    localStorage.removeItem(STORAGE_KEY);
    ensayos = [];
    await initApp();
    showToast('Base restaurada a los 153 ensayos originales.');
  });
}

initApp();
