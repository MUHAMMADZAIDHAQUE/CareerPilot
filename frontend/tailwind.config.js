/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#ffffff",
        surface: {
          50: "#fafafa",
          100: "#f4f4f5",
          200: "#e4e4e7",
          300: "#d4d4d8",
          400: "#a1a1aa",
        },
        border: "#e5e7eb",
        subtle: "#f8fafc",
        charcoal: {
          950: "#09090b",
          900: "#0f172a",
          800: "#1e293b",
          700: "#334155",
          600: "#475569",
          500: "#64748b",
          400: "#94a3b8",
        },
        brand: {
          50: "#f8fafc",
          100: "#f1f5f9",
          500: "#0f172a",
          600: "#020617",
          primary: "#0f172a",
          accent: "#2563eb",
        },
        accent: {
          blue: "#2563eb",
          emerald: "#059669",
          amber: "#d97706",
          rose: "#dc2626",
          violet: "#7c3aed",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "monospace"],
      },
      boxShadow: {
        subtle: "0 1px 2px 0 rgba(0, 0, 0, 0.03)",
        card: "0 1px 3px 0 rgba(0, 0, 0, 0.03), 0 1px 2px -1px rgba(0, 0, 0, 0.02)",
        dropdown: "0 4px 12px rgba(0, 0, 0, 0.06)",
        elevated: "0 12px 24px -4px rgba(0, 0, 0, 0.06)",
      },
    },
  },
  plugins: [],
};
