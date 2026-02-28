import type { Platform } from '../types/editor';

export function detectPlatform(): Platform {
  if (typeof window === 'undefined') {
    return 'desktop';
  }

  const userAgent = navigator.userAgent.toLowerCase();
  const isMobile = /android|iphone|ipad|ipod|mobile/i.test(userAgent);

  return isMobile ? 'mobile' : 'web';
}

export function isTouchDevice(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}
