/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // 设计系统：参考 Notion 的素净中性配色（杜绝蓝紫/刺眼红）
        bg: {
          DEFAULT: '#FFFFFF',
          card: '#FFFFFF',
          muted: '#F7F6F3',
        },
        ink: {
          DEFAULT: '#37352F',
          secondary: '#787774',
          placeholder: '#9F9F9B',
        },
        accent: {
          DEFAULT: '#37352F',   // 主色：炭黑/近黑，用于按钮与重要图标
          soft: '#E9E8E4',      // 辅助：浅暖灰，用于高亮/选中
          hover: '#2B2A26',     // 悬浮加深
        },
        line: '#E9E8E4',
        danger: '#D44C47',
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
