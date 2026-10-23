/* ===== Google tag (GA4) — chỉ chạy ở bản build có VITE_GA_ID, bỏ qua ?test ===== */
export function initAnalytics(): void {
  const id = import.meta.env.VITE_GA_ID as string | undefined;
  if (!id || new URLSearchParams(location.search).has('test')) return;
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.appendChild(s);
  const w = window as any;
  w.dataLayer = w.dataLayer || [];
  w.gtag = function () { w.dataLayer.push(arguments); };
  w.gtag('js', new Date());
  w.gtag('config', id);
}
