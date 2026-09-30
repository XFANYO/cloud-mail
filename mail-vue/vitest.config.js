import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

/**
 * Vitest 配置（F005 测试基建）
 *
 * 说明：
 * - 独立于 vite.config.js（不复用，避免引入 VitePWA 的构建期副作用到测试环境）。
 * - 但必须补上与 vite.config.js 一致的「能编译 .vue + 解析 Element Plus 全局组件 +
 *   自动导入 API」三项能力，否则挂载 SFC 会报 invalid JS syntax。
 * - environment 必须 jsdom：实测 happy-dom 下 DOMPurify 会误剥 <a>/<img>（见 sanitizeEmail.js 勘误 3）。
 */
export default defineConfig({
    plugins: [
        vue(),
        AutoImport({
            resolvers: [ElementPlusResolver()],
            dts: false,
        }),
        Components({
            resolvers: [ElementPlusResolver()],
            dts: false,
        }),
    ],
    resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
    test: {
        environment: 'jsdom',
        include: ['src/**/*.test.js'],
        // 含 element-plus 的用例（axios/App 冒烟）在冷 node_modules 下首次解析可达 3-4s，
        // 默认 5s 阈值在 CI 冷启动会偶发超时。留足余量（见 F005 勘误：实测冷启动超时）。
        testTimeout: 20000,
        // Element Plus 组件解析会连带 import .css，交给 vite 内联处理，避免 node 报 "Unknown file extension .css"
        server: { deps: { inline: [/element-plus/] } },
        coverage: { reporter: ['text', 'html'], include: ['src/**'] },
    },
})
