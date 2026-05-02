/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      screens: {
        // Mobile-first approach: mobile is default (no prefix needed)
        // Tablet breakpoint at 768px
        'tablet': '768px',
        // Desktop breakpoint at 1920px
        'desktop': '1920px',
      },
    },
  },
  plugins: [],
}
