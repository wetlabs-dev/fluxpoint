export function ThemeScript() {
  const code = `
(() => {
  const storageKey = "fluxpoint-theme";
  const stored = window.localStorage.getItem(storageKey);
  const theme = stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
  const resolved = theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : theme === "dark" ? "dark" : "light";
  document.documentElement.classList.toggle("dark", resolved === "dark");
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = resolved;
})();
`;

  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
