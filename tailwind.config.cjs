/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./index.html",
        "./App.tsx",
        "./index.tsx",
        "./theme.ts",
        "./components/**/*.{js,ts,jsx,tsx}",
        "./services/**/*.{js,ts,jsx,tsx}",
        "./pages/**/*.{js,ts,jsx,tsx}",
    ],
    safelist: [
        "bg-blue-600",
        "bg-amber-500",
        "bg-red-600",
        "bg-indigo-600",
        "bg-green-600",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                civic: {
                    primary: "var(--civic-primary)",
                    primaryLight: "var(--civic-primary-light)",
                    primaryHover: "var(--civic-primary-hover)",
                    bg: "var(--civic-background)",
                    card: "var(--civic-card)",
                    border: "var(--civic-border)",
                    text: "var(--civic-text-primary)",
                    muted: "var(--civic-text-secondary)",
                    success: "var(--civic-success)",
                    warning: "var(--civic-warning)",
                    danger: "var(--civic-danger)",
                    info: "var(--civic-info)",
                },
            },
            borderRadius: {
                civic: "0.75rem",
            },
            boxShadow: {
                "civic-sm": "0 1px 2px rgb(15 23 42 / 0.08)",
                "civic-md": "0 8px 24px rgb(15 23 42 / 0.12)",
            },
        },
    },
    plugins: [],
}
