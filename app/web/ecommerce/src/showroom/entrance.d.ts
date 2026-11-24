export function mountEntrance(root: HTMLElement,options?: {onFallback?: (reason: string)=>void; onOpen?: ()=>void}): {ready(task: string): void; fallback(reason?: string): void; dispose(): void};
