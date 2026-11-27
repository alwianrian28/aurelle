/* Komponen Alpine untuk halaman tracking: cari resi, salin tautan, refresh, toast, lightbox. */
function trackingPage(config) {
  'use strict';
  return {
    query: config.noResi || '',
    loading: false,
    toast: '',
    toastKind: 'ok',
    toastTimer: null,
    lightbox: null,

    search() {
      var resi = this.query.trim().toUpperCase();
      if (resi) window.location.href = '/tracking/' + encodeURIComponent(resi);
    },

    show(message, kind) {
      this.toast = message;
      this.toastKind = kind || 'ok';
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => (this.toast = ''), 2600);
    },

    async copy(text, message) {
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text);
        } else {
          // HTTP biasa (mis. alamat IP lokal): clipboard API tidak tersedia.
          var area = document.createElement('textarea');
          area.value = text;
          area.setAttribute('readonly', '');
          area.style.position = 'fixed';
          area.style.opacity = '0';
          document.body.appendChild(area);
          area.select();
          document.execCommand('copy');
          area.remove();
        }
        this.show(message);
      } catch (error) {
        this.show('Gagal menyalin. Salin secara manual.', 'warn');
      }
    },

    copyLink() {
      this.copy(window.location.origin + '/tracking/' + encodeURIComponent(config.noResi), 'Link disalin');
    },

    copyResi() {
      this.copy(config.noResi, 'No. resi disalin');
    },

    // Minta server sinkron ulang dari Biteship, lalu muat ulang halaman bila ada data baru.
    async refresh() {
      if (this.loading || !config.apiUrl) return;
      this.loading = true;
      try {
        var response = await fetch(config.apiUrl, { headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        var data = await response.json();
        if (data.sync && data.sync.synced_now) {
          window.location.reload();
          return;
        }
        if (data.sync && data.sync.warning) {
          this.show(data.sync.warning, 'warn');
        } else {
          this.show('Data sudah yang terbaru.');
        }
      } catch (error) {
        this.show('Gagal memuat data terbaru. Coba lagi.', 'warn');
      } finally {
        this.loading = false;
      }
    },
  };
}
