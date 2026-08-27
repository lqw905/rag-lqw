/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        serif: ['Newsreader', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        paper: '#FAF9F6', // 温暖杂志米灰纸张底色
        surface: '#FFFFFF', // 纯白高光卡片
        border: '#E8E6DF', // 优雅浅暖灰边框
        subtle: '#F2F0E8', // 次级背景底色
        ink: {
          900: '#191918', // 主标题/高对比正文
          700: '#3D3D3A', // 次级正文
          500: '#73726C', // 辅助描述与注脚
          400: '#A1A09A', // 占位符/禁用态
          200: '#E3E2DC', // 分割线
        },
        accent: {
          DEFAULT: '#0F172A', // 曜岩黑主色
          hover: '#334155',
          blue: '#2563EB',
          emerald: '#059669',
          amber: '#D97706',
          rose: '#E11D48',
        }
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.02), 0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        'float': '0 12px 32px -4px rgba(25, 25, 24, 0.06), 0 4px 12px -2px rgba(25, 25, 24, 0.03)',
        'popover': '0 20px 40px -8px rgba(25, 25, 24, 0.12), 0 1px 3px 0 rgba(25, 25, 24, 0.04)',
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.25s ease-out forwards',
        'slide-left': 'slideLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideLeft: {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        }
      }
    },
  },
  plugins: [],
}
