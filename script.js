/* ══════════════════════════════════════════
   WEATHER DASHBOARD — script.js
   12h Clock · Rich Cities · Improved Forecast
   ══════════════════════════════════════════ */

'use strict';

const API_KEY = 'a4a6a5e3ed3795fd3a5935d68ee8e396';
const BASE = 'https://api.openweathermap.org/data/2.5';

const S = {
  unit: localStorage.getItem('w_unit') || 'metric',
  windUnit: localStorage.getItem('w_wunit') || 'kmh',
  defaultCity: localStorage.getItem('w_city') || 'Lahore',
  autoLoc: localStorage.getItem('w_autoloc') === 'true',
  showHourly: localStorage.getItem('w_hourly') !== 'false',
  cities: JSON.parse(localStorage.getItem('w_cities') || '[]'),
  currentCity: null,
};

const get = id => document.getElementById(id);

/* ════════════
   INIT
════════════ */
document.addEventListener('DOMContentLoaded', () => {
  initSidebar();
  initSearch();
  initClock();
  initCitiesPanel();
  initSettings();
  bootWeather();

  // Register Service Worker for PWA
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(err => {
        console.log('ServiceWorker registration failed: ', err);
      });
    });
  }
});

/* ════════════
   SIDEBAR
════════════ */
function initSidebar() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      get(`panel-${btn.dataset.panel}`).classList.add('active');
    });
  });
}

/* ════════════
   SEARCH
════════════ */
function initSearch() {
  const inp = get('searchInput');
  inp.addEventListener('keypress', e => {
    if (e.key === 'Enter') {
      const c = inp.value.trim();
      if (c) { loadWeather(c); inp.value = ''; inp.blur(); }
    }
  });
}

/* ════════════
   12-HOUR CLOCK
════════════ */
function initClock() {
  const tick = () => {
    const now = new Date();
    let h = now.getHours();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    get('tbTime').textContent = `${h}:${m}:${s} ${ampm}`;
    get('tbDate').textContent = now.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric'
    });
  };
  tick();
  setInterval(tick, 1000);
}

/* ════════════
   BOOT
════════════ */
function bootWeather() {
  if (S.autoLoc && navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => loadWeatherByCoords(pos.coords.latitude, pos.coords.longitude),
      () => loadWeather(S.defaultCity)
    );
  } else {
    loadWeather(S.defaultCity);
  }
}

/* ════════════════════════
   WEATHER — Current
════════════════════════ */
async function loadWeather(city) {
  try {
    const [cur, fc] = await Promise.all([
      apiFetch(`${BASE}/weather?q=${enc(city)}&appid=${API_KEY}&units=${S.unit}`),
      apiFetch(`${BASE}/forecast?q=${enc(city)}&appid=${API_KEY}&units=${S.unit}`),
    ]);
    if (cur.cod !== 200) { toast(`"${city}" not found.`, 'error'); return; }
    S.currentCity = cur.name;
    renderCurrent(cur, fc.list);
    renderHourly(fc.list);
    renderForecast(fc.list);
  } catch { toast('Network error.', 'error'); }
}

async function loadWeatherByCoords(lat, lon) {
  try {
    const [cur, fc] = await Promise.all([
      apiFetch(`${BASE}/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=${S.unit}`),
      apiFetch(`${BASE}/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=${S.unit}`),
    ]);
    S.currentCity = cur.name;
    renderCurrent(cur, fc.list);
    renderHourly(fc.list);
    renderForecast(fc.list);
  } catch { toast('Location error.', 'error'); }
}

function apiFetch(url) { return fetch(url).then(r => r.json()); }

/* ─── Render: Current ─── */
function renderCurrent(d, list) {
  const isMet = S.unit === 'metric';
  const unit = isMet ? '°C' : '°F';
  const cond = d.weather[0].main.toLowerCase();
  const icon = d.weather[0].icon;

  // Gradient hero background
  const bg = get('heroBg');
  bg.className = 'hero-bg ' + mapCond(cond);

  // City + condition
  get('heroCity').textContent = `${d.name}, ${d.sys.country}`;
  get('heroCondition').textContent = capEach(d.weather[0].description);

  // Temperature + unit symbol (dynamically updated!)
  animNum(get('heroTemp'), Math.round(d.main.temp));
  get('heroDeg').textContent = unit;

  // Hi/Lo from today's forecast entries
  const today = new Date().toISOString().split('T')[0];
  const todayList = list.filter(s => s.dt_txt.startsWith(today));
  if (todayList.length) {
    get('heroH').textContent = Math.round(Math.max(...todayList.map(s => s.main.temp_max)));
    get('heroL').textContent = Math.round(Math.min(...todayList.map(s => s.main.temp_min)));
  }

  // Icon — dayIcon() forces daytime variant (01n → 01d) so Clear Sky shows ☀ not ● black ball
  const ico = get('heroIcon');
  ico.alt = d.weather[0].description;
  // Remove any previous emoji fallback so icon re-renders clean on city switch
  const prevEmoji = ico.closest('.hero-right')?.querySelector('.hero-emoji');
  if (prevEmoji) prevEmoji.remove();
  ico.style.display = 'block';
  ico.onerror = () => {
    ico.style.display = 'none';
    const hRight = ico.closest('.hero-right');
    if (hRight && !hRight.querySelector('.hero-emoji')) {
      const span = document.createElement('span');
      span.className = 'hero-emoji';
      span.style.cssText = 'font-size:6rem;line-height:1;display:block;animation:floatIcon 4s ease-in-out infinite;';
      span.textContent = condEmoji(cond);
      hRight.insertBefore(span, hRight.firstChild);
    }
  };
  ico.src = iconUrl(icon);

  // Rain badge
  get('heroRain').innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
    <span>${d.clouds.all}% rain chance</span>
  `;

  // Metric chips — all with correct unit labels
  const windStr = formatWind(d.wind.speed);
  const feelsStr = `${Math.round(d.main.feels_like)}${unit}`;
  const visStr = d.visibility ? `${(d.visibility / 1000).toFixed(1)} km` : 'N/A';
  get('mHumidity').textContent = `${d.main.humidity}%`;
  get('mWind').textContent = windStr;
  get('mFeels').textContent = feelsStr;
  get('mVis').textContent = visStr;
  get('mPressure').textContent = `${d.main.pressure} hPa`;
  get('mUV').textContent = Math.max(0, Math.round((100 - d.clouds.all) / 11));

  // City label in right panel
  get('rpCityLabel').textContent = `${d.name}, ${d.sys.country}`;

  // Hourly visibility toggle
  const hs = get('hourlySection');
  if (hs) hs.style.display = S.showHourly ? '' : 'none';

  // Animate chips in
  stagger('.metric-chip');
}


/* ─── Render: Hourly (8 slots) ─── */
function renderHourly(list) {
  const row = get('hourlyRow');
  row.innerHTML = '';
  list.slice(0, 8).forEach((slot, i) => {
    const dt = new Date(slot.dt * 1000);
    let h = dt.getHours();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    const time = `${h}:00 ${ampm}`;
    const temp = Math.round(slot.main.temp);
    const icon = slot.weather[0].icon;
    const cond = slot.weather[0].main.toLowerCase();
    const div = document.createElement('div');
    div.className = 'h-item';
    div.style.cssText = 'opacity:0;transform:translateY(8px)';
    div.innerHTML = `
      <span class="h-time">${time}</span>
      <img class="h-img"
           src="${iconUrl(icon)}"
           alt="${cond}"
           onerror="this.style.display='none';this.nextElementSibling && this.nextElementSibling.classList.contains('h-emo') || this.insertAdjacentHTML('afterend','<span class=h-emo style=font-size:1.5rem>${condEmoji(cond)}</span>')">
      <span class="h-temp">${temp}°</span>
    `;
    row.appendChild(div);
    setTimeout(() => {
      div.style.transition = 'all 0.35s cubic-bezier(0.34,1.56,0.64,1)';
      div.style.opacity = '1';
      div.style.transform = 'translateY(0)';
    }, i * 55);
  });
}

/* ─── Render: 7-Day Forecast ─── */
function renderForecast(list) {
  const container = get('forecastList');
  container.innerHTML = '';

  const todayStr = new Date().toISOString().split('T')[0];
  const daysShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const map = groupByDay(list);

  // Get overall temp range for normalization
  let globalHi = -Infinity, globalLo = Infinity;
  Object.values(map).forEach(slots => {
    slots.forEach(s => {
      if (s.main.temp_max > globalHi) globalHi = s.main.temp_max;
      if (s.main.temp_min < globalLo) globalLo = s.main.temp_min;
    });
  });

  Object.entries(map).slice(0, 7).forEach(([date, slots], i) => {
    const dt = new Date(date + 'T12:00:00');
    const isToday = date === todayStr;
    const label = isToday ? 'Today' : daysShort[dt.getDay()];
    const dateNum = `${monthShort[dt.getMonth()]} ${dt.getDate()}`;
    const rep = slots.find(s => s.dt_txt.includes('12:00')) || slots[0];
    const icon = rep.weather[0].icon;
    const cond = capEach(rep.weather[0].description);
    const hi = Math.round(Math.max(...slots.map(s => s.main.temp_max)));
    const lo = Math.round(Math.min(...slots.map(s => s.main.temp_min)));

    // Temp bar fill: position relative to global range
    const range = globalHi - globalLo || 1;
    const loFrac = ((lo - globalLo) / range) * 100;
    const hiFrac = ((hi - globalLo) / range) * 100;
    const fillW = Math.max(hiFrac - loFrac, 8);

    // ── Build row matching 4-col CSS grid: day-block | icon-wrap | info | temps ──
    const row = document.createElement('div');
    row.className = `fc-row${isToday ? ' today-row' : ''}`;
    row.style.cssText = 'opacity:0;transform:translateX(10px)';

    // Day block
    const dayBlock = document.createElement('div');
    dayBlock.className = 'fc-day-block';
    dayBlock.innerHTML = `
      <div class="fc-day ${isToday ? 'is-today' : ''}">${label}</div>
      <div class="fc-date-num">${isToday ? 'Now' : dateNum}</div>
    `;

    // Icon wrap with emoji fallback
    const iconWrap = document.createElement('div');
    iconWrap.className = 'fc-icon-wrap';
    const imgEl = document.createElement('img');
    imgEl.className = 'fc-img';
    imgEl.src = iconUrl(icon);
    imgEl.alt = cond;
    imgEl.onerror = () => {
      imgEl.style.display = 'none';
      const fb = document.createElement('span');
      fb.className = 'fc-img-fallback';
      fb.textContent = condEmoji(rep.weather[0].main.toLowerCase());
      iconWrap.appendChild(fb);
    };
    iconWrap.appendChild(imgEl);

    // Info (condition + temp bar)
    const info = document.createElement('div');
    info.className = 'fc-info';
    info.innerHTML = `
      <div class="fc-cond">${cond}</div>
      <div class="fc-bar-track">
        <div class="fc-bar-fill" style="margin-left:${loFrac.toFixed(1)}%;width:${fillW.toFixed(1)}%"></div>
      </div>
    `;

    // Temps (stacked hi/lo)
    const temps = document.createElement('div');
    temps.className = 'fc-temps';
    temps.innerHTML = `
      <span class="fc-hi-val">${hi}°</span>
      <span class="fc-lo-val">${lo}°</span>
    `;

    row.appendChild(dayBlock);
    row.appendChild(iconWrap);
    row.appendChild(info);
    row.appendChild(temps);
    container.appendChild(row);
    setTimeout(() => {
      row.style.transition = 'all 0.35s cubic-bezier(0.34,1.56,0.64,1)';
      row.style.opacity = '1';
      row.style.transform = 'translateX(0)';
    }, i * 60);
  });
}

/* ════════════════════════
   CITIES
════════════════════════ */
function initCitiesPanel() {
  const inp = get('cityAddInput');
  const btn = get('cityAddBtn');
  renderCityCards();
  btn.addEventListener('click', doAdd);
  inp.addEventListener('keypress', e => { if (e.key === 'Enter') doAdd(); });

  async function doAdd() {
    const name = inp.value.trim();
    if (!name) return;
    inp.value = '';
    try {
      const d = await apiFetch(`${BASE}/weather?q=${enc(name)}&appid=${API_KEY}&units=${S.unit}`);
      if (d.cod !== 200) { toast(`"${name}" not found.`, 'error'); return; }
      if (S.cities.find(c => c.name.toLowerCase() === d.name.toLowerCase())) {
        toast(`${d.name} already saved.`, 'error'); return;
      }
      const entry = {
        name: d.name,
        country: d.sys.country,
        temp: Math.round(d.main.temp),
        icon: d.weather[0].icon,
        desc: d.weather[0].description,
        cond: mapCond(d.weather[0].main.toLowerCase()),
        humidity: d.main.humidity,
        wind: formatWind(d.wind.speed),
        feels: Math.round(d.main.feels_like),
        savedAt: Date.now(),
      };
      S.cities.push(entry);
      saveCities();
      renderCityCards();
      toast(`${entry.name} added!`, 'success');
    } catch { toast('Network error.', 'error'); }
  }
}

function renderCityCards() {
  const grid = get('citiesGrid');
  const empty = get('citiesEmpty');
  grid.innerHTML = '';

  if (!S.cities.length) { empty.classList.add('visible'); return; }
  empty.classList.remove('visible');

  S.cities.forEach((city, idx) => {
    const savedTime = new Date(city.savedAt).toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', hour12: true
    });

    const unit = S.unit === 'metric' ? '°C' : '°F';
    const card = document.createElement('div');
    card.className = 'city-card';
    card.style.cssText = 'opacity:0;transform:translateY(12px)';
    card.innerHTML = `
      <!-- full-gradient background layer -->
      <div class="cc-bg ${city.cond}"></div>

      <!-- Delete button -->
      <button class="cc-delete" data-idx="${idx}" title="Remove">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>

      <!-- Main content -->
      <div class="cc-content">
        <div class="cc-top">
          <div class="cc-name-block">
            <div class="cc-name">${city.name}</div>
            <div class="cc-country">${city.country}</div>
          </div>
          <img class="cc-icon" src="${iconUrl(city.icon)}" alt="${city.desc}"
               onerror="this.style.display='none';this.insertAdjacentHTML('afterend','<span style=\\'font-size:2.8rem;line-height:1;\\'>${condEmoji(city.cond)}</span>')">
        </div>
        <div class="cc-mid">
          <div class="cc-temp-row">
            <span class="cc-temp">${city.temp}</span>
            <span class="cc-temp-unit">${unit}</span>
          </div>
          <div class="cc-desc">${capEach(city.desc)}</div>
        </div>
      </div>

      <!-- Glass stats row -->
      <div class="cc-stats">
        <div class="cc-stat">
          <svg class="cc-stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
          <span class="cc-stat-val">${city.humidity}%</span>
          <span class="cc-stat-lbl">Humidity</span>
        </div>
        <div class="cc-stat">
          <svg class="cc-stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/></svg>
          <span class="cc-stat-val">${city.wind}</span>
          <span class="cc-stat-lbl">Wind</span>
        </div>
        <div class="cc-stat">
          <svg class="cc-stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg>
          <span class="cc-stat-val">${city.feels}${unit}</span>
          <span class="cc-stat-lbl">Feels Like</span>
        </div>
      </div>
    `;

    card.addEventListener('click', e => {
      if (e.target.closest('.cc-delete')) return;
      loadWeather(city.name);
      document.querySelector('[data-panel="weather"]').click();
    });

    card.querySelector('.cc-delete').addEventListener('click', e => {
      e.stopPropagation();
      S.cities.splice(idx, 1);
      saveCities();
      renderCityCards();
    });

    grid.appendChild(card);
    setTimeout(() => {
      card.style.transition = 'opacity 0.3s ease, transform 0.4s cubic-bezier(0.34,1.56,0.64,1), border-color 0.25s ease, box-shadow 0.25s ease, transform 0.25s ease';
      card.style.opacity = '1';
      card.style.transform = 'translateY(0)';
    }, idx * 80);
  });
}

function saveCities() { localStorage.setItem('w_cities', JSON.stringify(S.cities)); }

/* ════════════════════════
   SETTINGS
════════════════════════ */
function initSettings() {
  initSeg('tempUnitCtrl', S.unit, val => {
    S.unit = val;
    localStorage.setItem('w_unit', val);
    if (S.currentCity) loadWeather(S.currentCity);
    toast('Unit updated.', 'success');
  });

  initSeg('windUnitCtrl', S.windUnit, val => {
    S.windUnit = val;
    localStorage.setItem('w_wunit', val);
    if (S.currentCity) loadWeather(S.currentCity);
  });

  const dcInp = get('defaultCityInput');
  if (dcInp) dcInp.value = S.defaultCity;
  get('saveDefaultCity')?.addEventListener('click', () => {
    const v = dcInp?.value.trim();
    if (!v) return;
    S.defaultCity = v;
    localStorage.setItem('w_city', v);
    toast(`Default city set to ${v}`, 'success');
  });

  const autoT = get('autoLocToggle');
  if (autoT) {
    autoT.checked = S.autoLoc;
    autoT.addEventListener('change', () => {
      S.autoLoc = autoT.checked;
      localStorage.setItem('w_autoloc', S.autoLoc);
      if (S.autoLoc) bootWeather();
    });
  }

  const hourlyT = get('showHourlyToggle');
  if (hourlyT) {
    hourlyT.checked = S.showHourly;
    hourlyT.addEventListener('change', () => {
      S.showHourly = hourlyT.checked;
      localStorage.setItem('w_hourly', S.showHourly);
      const s = get('hourlySection');
      if (s) s.style.display = S.showHourly ? '' : 'none';
    });
  }
}

function initSeg(id, current, onChange) {
  const ctrl = get(id);
  if (!ctrl) return;
  ctrl.querySelectorAll('.seg-btn').forEach(b => {
    if (b.dataset.val === current) b.classList.add('active');
    b.addEventListener('click', () => {
      ctrl.querySelectorAll('.seg-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      onChange(b.dataset.val);
    });
  });
}

/* ════════════════════════
   UTILITIES
════════════════════════ */
function animNum(el, target) {
  const from = parseInt(el.textContent) || 0;
  const t0 = performance.now();
  const dur = 600;
  const run = now => {
    const p = Math.min((now - t0) / dur, 1);
    el.textContent = Math.round(from + (target - from) * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(run);
  };
  requestAnimationFrame(run);
}

function stagger(sel) {
  document.querySelectorAll(sel).forEach((el, i) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(6px)';
    setTimeout(() => {
      el.style.transition = 'all 0.3s cubic-bezier(0.34,1.56,0.64,1)';
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    }, i * 50);
  });
}

function mapCond(c) {
  if (c.includes('clear')) return 'clear';
  if (c.includes('cloud')) return 'clouds';
  if (c.includes('rain')) return 'rain';
  if (c.includes('drizzle')) return 'drizzle';
  if (c.includes('snow')) return 'snow';
  if (c.includes('thunder')) return 'thunderstorm';
  if (c.includes('mist') || c.includes('fog') || c.includes('haze')) return 'mist';
  return '';
}

// Always force daytime icon variant — 01n (night moon on dark bg) looks like a black ball
function dayIcon(code) {
  return code ? code.replace(/n$/, 'd') : code;
}

// Icon URL helper
function iconUrl(code) {
  return `https://openweathermap.org/img/wn/${dayIcon(code)}@2x.png`;
}

// Emoji fallback for when OWM icon images fail to load
function condEmoji(c) {
  if (c.includes('clear')) return '☀️';
  if (c.includes('cloud')) return '☁️';
  if (c.includes('rain')) return '🌧️';
  if (c.includes('drizzle')) return '🌦️';
  if (c.includes('snow')) return '❄️';
  if (c.includes('thunder')) return '⛈️';
  if (c.includes('mist') || c.includes('fog') || c.includes('haze')) return '🌫️';
  return '🌡️';
}

function formatWind(ms) {
  if (S.windUnit === 'kmh') return `${(ms * 3.6).toFixed(1)} km/h`;
  if (S.windUnit === 'mph') return `${(ms * 2.237).toFixed(1)} mph`;
  return `${ms.toFixed(1)} m/s`;
}

function groupByDay(list) {
  const m = {};
  list.forEach(s => {
    const d = s.dt_txt.split(' ')[0];
    if (!m[d]) m[d] = [];
    m[d].push(s);
  });
  return m;
}

function capEach(str) {
  return str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function enc(s) { return encodeURIComponent(s); }

function toast(msg, type = 'info') {
  const wrap = get('toastWrap');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    el.addEventListener('animationend', () => el.remove());
  }, 3200);
}
