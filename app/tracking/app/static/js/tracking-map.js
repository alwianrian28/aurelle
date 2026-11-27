/* Peta "Live Tracking" (Leaflet + OpenStreetMap).
 *
 * Data datang dari server lewat <script id="map-data" type="application/json">:
 *   origin, destination, route_passed, route_remaining, vehicle_position  -> [lat, lng]
 *   progress, show_vehicle, delivered, is_return
 * Posisi kendaraan adalah PERKIRAAN dari status pengiriman, bukan GPS.
 */
(function () {
  'use strict';

  var COLORS = { passed: '#2563eb', done: '#059669', returning: '#ea580c', remaining: '#475569' };
  var TRUCK_SVG =
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>' +
    '<circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>';
  var PIN_SVG =
    '<svg viewBox="0 0 24 32" width="24" height="32" aria-hidden="true">' +
    '<path d="M12 0C5.4 0 0 5.3 0 11.8 0 20.5 12 32 12 32s12-11.5 12-20.2C24 5.3 18.6 0 12 0z" fill="#ef4444" stroke="#fff" stroke-width="1.5"/>' +
    '<circle cx="12" cy="11.5" r="4" fill="#fff"/></svg>';

  function icon(html, size, anchor) {
    return L.divIcon({ html: html, className: 'tracking-marker', iconSize: size, iconAnchor: anchor });
  }

  function fullscreenControl(wrap, onChange) {
    var Control = L.Control.extend({
      options: { position: 'topleft' },
      onAdd: function () {
        var bar = L.DomUtil.create('div', 'leaflet-bar');
        var button = L.DomUtil.create('a', 'tracking-fullscreen', bar);
        button.href = '#';
        button.title = 'Layar penuh';
        button.setAttribute('role', 'button');
        button.setAttribute('aria-label', 'Layar penuh');
        button.innerHTML = '&#x26F6;';
        L.DomEvent.disableClickPropagation(bar);
        L.DomEvent.on(button, 'click', function (event) {
          L.DomEvent.preventDefault(event);
          if (document.fullscreenElement) {
            document.exitFullscreen();
          } else if (wrap.requestFullscreen) {
            wrap.requestFullscreen();
          }
        });
        return bar;
      },
    });
    document.addEventListener('fullscreenchange', onChange);
    return new Control();
  }

  function init() {
    var el = document.getElementById('tracking-map');
    var source = document.getElementById('map-data');
    if (!el || !source || typeof L === 'undefined') return;

    var data;
    try {
      data = JSON.parse(source.textContent);
    } catch (error) {
      return;
    }
    if (!data.available) return;

    var map = L.map(el, { zoomControl: true, scrollWheelZoom: false });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    var passedColor = data.delivered ? COLORS.done : data.is_return ? COLORS.returning : COLORS.passed;
    var passedLabel = data.delivered ? 'Sudah Dilewati' : 'Dalam Perjalanan';

    if (data.route_remaining.length > 1) {
      L.polyline(data.route_remaining, { color: COLORS.remaining, weight: 3.5, dashArray: '2 9', opacity: 0.95 })
        .bindTooltip('Sisa Perjalanan', { sticky: true })
        .addTo(map);
    }
    if (data.route_passed.length > 1) {
      L.polyline(data.route_passed, { color: passedColor, weight: 5, opacity: 0.95 })
        .bindTooltip(passedLabel, { sticky: true })
        .addTo(map);
    }

    L.marker(data.origin, { icon: icon('<span class="tracking-origin"></span>', [18, 18], [9, 9]), title: 'Titik Muat', keyboard: false })
      .bindTooltip('Titik Muat')
      .addTo(map);
    L.marker(data.destination, { icon: icon(PIN_SVG, [24, 32], [12, 32]), title: 'Titik Bongkar', keyboard: false })
      .bindTooltip('Titik Bongkar')
      .addTo(map);

    if (data.show_vehicle && data.vehicle_position) {
      L.marker(data.vehicle_position, {
        icon: icon('<span class="tracking-vehicle">' + TRUCK_SVG + '</span>', [32, 32], [16, 16]),
        title: 'Kendaraan (estimasi)',
        zIndexOffset: 1000,
        keyboard: false,
      })
        .bindTooltip(data.note || 'Perkiraan posisi berdasarkan status pengiriman')
        .addTo(map);
    }

    var bounds = L.latLngBounds([data.origin, data.destination].concat(data.route_passed, data.route_remaining));
    function fit() {
      map.invalidateSize();
      // Ruang kiri lebih lebar supaya rute tidak tertutup tombol zoom.
      map.fitBounds(bounds, { paddingTopLeft: [64, 28], paddingBottomRight: [28, 28] });
    }

    var wrap = document.getElementById('map-wrap') || el;
    fullscreenControl(wrap, function () {
      // Ukuran wadah berubah saat masuk / keluar layar penuh.
      setTimeout(fit, 60);
    }).addTo(map);

    fit();
    window.addEventListener('resize', function () {
      map.invalidateSize();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
