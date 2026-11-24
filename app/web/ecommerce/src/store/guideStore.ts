import { create } from 'zustand';
import type { SizeKind } from '../content/service';

/** Which customer-guide dialog is open; the dialogs render once in Layout. */
interface GuideState {
  open: 'size' | 'care' | null;
  sizeTab: SizeKind;
  openSize: (tab?: SizeKind) => void;
  openCare: () => void;
  close: () => void;
}

export const useGuideStore = create<GuideState>()((set) => ({
  open: null,
  sizeTab: 'ring',
  openSize: (tab = 'ring') => set({ open: 'size', sizeTab: tab }),
  openCare: () => set({ open: 'care' }),
  close: () => set({ open: null }),
}));
