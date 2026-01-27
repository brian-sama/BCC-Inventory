/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./index.html",
        "./App.tsx",
        "./index.tsx",
        "./components/**/*.{js,ts,jsx,tsx}",
        "./services/**/*.{js,ts,jsx,tsx}",
        "./pages/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {},
    },
    plugins: [],
}
