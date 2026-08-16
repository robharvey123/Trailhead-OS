// Inter + JetBrains Mono are loaded via next/font in app/layout.tsx and exposed
// on <body> as --font-inter / --font-jetbrains-mono, which .thmock reads through
// its --sans / --mono tokens. Nothing extra is needed at the page level.
// `mockupFontVars` is kept as an empty string so existing page wrappers
// (`thmock ${mockupFontVars}`) keep working; it is scheduled for removal.
export const mockupFontVars = ''
