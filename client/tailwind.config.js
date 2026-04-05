export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#7c3aed", // purple
        secondary: "#ec4899", // pink
        darkBg: "#020617", // deep dark
        card: "rgba(255,255,255,0.05)",
      },

      backdropBlur: {
        xs: "2px",
      },

      boxShadow: {
        glass: "0 8px 32px rgba(0,0,0,0.37)",
      },

      borderRadius: {
        xl2: "20px",
      },

      transitionProperty: {
        smooth: "all",
      },

      animation: {
        fadeIn: "fadeIn 0.4s ease-in-out",
        pop: "pop 0.2s ease-in-out",
      },

      keyframes: {
        fadeIn: {
          "0%": { opacity: 0, transform: "translateY(10px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
        pop: {
          "0%": { transform: "scale(0.95)" },
          "100%": { transform: "scale(1)" },
        },
      },
    },
  },
  plugins: [],
};