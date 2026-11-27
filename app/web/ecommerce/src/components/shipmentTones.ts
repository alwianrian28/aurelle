import type { ShipmentTone } from '../types/domain';

/** The colour of each shipment state: the travelled line, the parcel marker and the status panel. */
export const TONE_COLOR: Record<ShipmentTone, string> = { normal: '#151922', gray: '#8b929c', orange: '#c2410c', green: '#15803d', purple: '#7e22ce', red: '#b91c1c' };
