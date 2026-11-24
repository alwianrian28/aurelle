import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { TrackingPoint } from './api';

/**
 * Shipment route on OpenStreetMap tiles, drawn with Leaflet inside a WebView (the same map
 * library as the website). Checkpoint text is staff-entered, so it is passed as JSON data and
 * written with textContent, never as HTML.
 */
export default function TrackingMap({ points }: { points: TrackingPoint[] }) {
  // "<" is escaped so the JSON can never close the script tag.
  const data = JSON.stringify(points.map((p) => ({ lat: p.lat, lng: p.lng, label: p.label, note: p.note }))).replace(/</g, '\\u003c');
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>html,body,#map{height:100%;margin:0}.dot{border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(21,25,34,.4)}</style></head>
<body><div id="map"></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>
var points = ${data};
var map = L.map('map').setView([-2.5, 118], 4);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
var path = points.map(function (p) { return [p.lat, p.lng]; });
if (path.length > 1) L.polyline(path, { color: '#151922', weight: 2, dashArray: '6 6' }).addTo(map);
points.forEach(function (p, i) {
  var last = i === points.length - 1;
  var icon = L.divIcon({ className: 'dot', html: '', iconSize: [16, 16], iconAnchor: [8, 8] });
  var marker = L.marker([p.lat, p.lng], { icon: icon }).addTo(map);
  marker.getElement().style.background = last ? '#151922' : '#9aa1ab';
  var box = document.createElement('div');
  var title = document.createElement('strong'); title.textContent = p.label; box.appendChild(title);
  if (p.note) { box.appendChild(document.createElement('br')); box.appendChild(document.createTextNode(p.note)); }
  marker.bindPopup(box);
});
if (path.length === 1) map.setView(path[0], 10);
else if (path.length > 1) map.fitBounds(path, { padding: [30, 30], maxZoom: 12 });
</script></body></html>`;
  return (
    <View style={styles.frame} accessibilityLabel="Map of your parcel's journey">
      <WebView originWhitelist={['*']} source={{ html }} style={styles.map} scrollEnabled={false} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { height: 280, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#e7e7e3' },
  map: { flex: 1 },
});
