export function parseLegacyDocument(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const body = doc.body;

  return {
    bodyHtml: body.innerHTML,
    bodyClassName: body.getAttribute("class") || "",
    bodyDataset: Object.fromEntries(
      Array.from(body.attributes)
        .filter((attribute) => attribute.name.startsWith("data-"))
        .map((attribute) => [
          attribute.name
            .slice(5)
            .replace(/-([a-z])/g, (_, char) => char.toUpperCase()),
          attribute.value,
        ])
    ),
    title: doc.title || "Bitramed",
    htmlClassName: doc.documentElement.getAttribute("class") || "",
    inlineStyles: Array.from(doc.head.querySelectorAll("style"))
      .map((node) => node.textContent || "")
      .join("\n"),
  };
}

export function applyLegacyDocumentShell({
  bodyClassName = "",
  bodyDataset = {},
  htmlClassName = "",
  inlineStyles = "",
  title = "Bitramed",
}) {
  document.title = title;
  document.documentElement.lang = "en";

  const existingTheme =
    document.documentElement.classList.contains("dark-mode");
  document.documentElement.className = htmlClassName;
  document.documentElement.classList.toggle("dark-mode", existingTheme);

  document.body.className = bodyClassName;
  document.body.classList.toggle("dark-mode", existingTheme);

  Array.from(document.body.attributes)
    .filter((attribute) => attribute.name.startsWith("data-"))
    .forEach((attribute) => document.body.removeAttribute(attribute.name));

  Object.entries(bodyDataset).forEach(([key, value]) => {
    document.body.dataset[key] = value;
  });

  let styleNode = document.getElementById("legacy-inline-styles");
  if (!inlineStyles) {
    styleNode?.remove();
    return;
  }

  if (!styleNode) {
    styleNode = document.createElement("style");
    styleNode.id = "legacy-inline-styles";
    document.head.appendChild(styleNode);
  }
  styleNode.textContent = inlineStyles;
}
