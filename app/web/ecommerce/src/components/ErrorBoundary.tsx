import { Component, type ErrorInfo, type ReactNode } from 'react';
import SystemPage from '../pages/SystemPage';

/** Menangkap error render dan menampilkan halaman 500 alih-alih layar kosong. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Pengganti sementara layanan monitoring (NFR observability) — belum ada backend logging.
    console.error('[Aurelle] render error', error, info.componentStack);
  }

  render() {
    return this.state.failed ? <SystemPage kind="error" /> : this.props.children;
  }
}
