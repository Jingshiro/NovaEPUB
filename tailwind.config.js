/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // 设计系统：杜绝蓝紫，主色为朱砂红/陶土色
        bg: {
          DEFAULT: '#FBFBFB',
          card: '#FFFFFF',
          muted: '#F4F4F4',
        },
        ink: {
          DEFAULT: '#1E1E1E',
          secondary: '#6B6B6B',
          placeholder: '#9B9B9B',
        },
        accent: {
          DEFAULT: '#E16259',   // 主色调：朱砂红
          soft: '#D4A373',      // 辅助色：暖驼色
          hover: '#C94B42',     // 悬浮加深 10%
        },
        line: '#E8E8E8',
        danger: '#C84E4E',
      },
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          '"Segoe UI"',
          'Roboto',
          '"Noto Sans"',
          '"PingFang SC"',
          'sans-serif',
        ],
      },
      fontSize: {
        h1: '2.2rem',
        h2: '1.8rem',
        h3: '1.4rem',
        body: '1rem',
        ui: '0.9rem',
      },
      borderRadius: {
        card: '8px',
        btn: '6px',
      },
      boxShadow: {
        card: '0px 2px 4px rgba(0,0,0,0.04)',
      },
      spacing: {
        base: '8px',
      },
    },
  },
  plugins: [],
}
