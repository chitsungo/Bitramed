const BITRAMED_FAVICON_URL =
  "https://frlujqujvpqwvtavofdq.supabase.co/storage/v1/object/public/Site%20Images/favicon.png";
const BITRAMED_FAVICON_TYPE = "image/png";
const BITRAMED_FAVICON_SELECTOR = [
  'link[rel="icon"]',
  'link[rel="shortcut icon"]',
  'link[rel="apple-touch-icon"]'
].join(", ");

function createFaviconLink(attributes) {
  const link = document.createElement("link");
  Object.entries(attributes).forEach(([key, value]) => {
    if (!value) return;
    link.setAttribute(key, value);
  });
  link.setAttribute("data-bitramed-favicon", "true");
  return link;
}

function bootstrapFavicon() {
  const head = document.head || document.getElementsByTagName("head")[0];
  if (!head) return;

  head.querySelectorAll(BITRAMED_FAVICON_SELECTOR).forEach((node) => node.remove());

  [
    { rel: "icon", type: BITRAMED_FAVICON_TYPE, href: BITRAMED_FAVICON_URL },
    { rel: "shortcut icon", type: BITRAMED_FAVICON_TYPE, href: BITRAMED_FAVICON_URL },
    { rel: "apple-touch-icon", href: BITRAMED_FAVICON_URL }
  ].forEach((attributes) => {
    head.appendChild(createFaviconLink(attributes));
  });
}

bootstrapFavicon();
