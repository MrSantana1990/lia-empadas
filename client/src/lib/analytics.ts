export function initAnalytics() {
  const endpoint = import.meta.env.VITE_ANALYTICS_ENDPOINT as string | undefined;
  const websiteId = import.meta.env.VITE_ANALYTICS_WEBSITE_ID as string | undefined;

  if (!endpoint || !websiteId) return;
  if (typeof document === "undefined") return;
  if (document.querySelector('script[data-website-id]')) return;

  const src = `${endpoint.replace(/\/+$/, "")}/umami`;

  const script = document.createElement("script");
  script.defer = true;
  script.src = src;
  script.dataset.websiteId = websiteId;
  document.head.appendChild(script);
}
