import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n/index.js'

/**
 * App 冒烟 + 路由守卫测试（F005 D-10：仅做 App 冒烟与未登录跳转两条）
 *
 * 不测 SFC 交互（推迟到 F000 后）。这里验证：
 * 1. App.vue 能被解析并真实挂载而不抛异常（模板/脚本/依赖注入健全性）；
 * 2. 路由守卫：未登录访问受保护路由 → 重定向 login（复刻 router/index.js L101-116 决策）。
 */

vi.mock('nprogress', () => ({
    default: { configure: vi.fn(), start: vi.fn(), done: vi.fn() },
}))
// App.vue 会副作用导入图标集，测试环境跳过（避免依赖 SVG sprite 加载）
vi.mock('@/icons/index.js', () => ({}))

describe('App 冒烟（F005 US2）', () => {
    beforeEach(() => setActivePinia(createPinia()))

    it('App.vue 可被解析为组件定义（import 不抛异常）', async () => {
        const App = await import('./App.vue')
        expect(App.default).toBeTruthy()
    })

    it('App.vue 可真实挂载且不抛异常（含 pinia + i18n 注入）', async () => {
        const App = await import('./App.vue')
        const wrapper = mount(App.default, {
            global: {
                plugins: [createPinia(), i18n],
                // router-view / el-config-provider 依赖外部上下文，桩掉以隔离冒烟范围
                stubs: {
                    'router-view': true,
                    'el-config-provider': {
                        inheritAttrs: false,
                        template: '<slot />',
                    },
                },
            },
        })
        expect(wrapper.exists()).toBe(true)
        wrapper.unmount()
    })
})

describe('路由守卫 · 未登录跳转（F005 US2）', () => {
    let originalToken

    beforeEach(() => {
        originalToken = localStorage.getItem('token')
        localStorage.removeItem('token')
    })

    afterEach(() => {
        if (originalToken) localStorage.setItem('token', originalToken)
        else localStorage.removeItem('token')
    })

    /**
     * 直接引用 router/index.js 导出的真实决策函数（resolveGuardAction），
     * 而非复刻逻辑——复刻会与实现脱节（评审建议项，2026-09-30 已修正）。
     */
    async function guard(token, to, from) {
        const { resolveGuardAction } = await import('@/router/index.js')
        return resolveGuardAction(token, to, from)
    }

    it('无 token 访问 /sent → 重定向 login', async () => {
        const action = await guard(null, { path: '/sent' }, { path: '/' })
        expect(action.type).toBe('redirect-login')
    })

    it('有 token 访问 /login → 重定向来源页', async () => {
        const action = await guard('fake-token', { path: '/login' }, { path: '/inbox' })
        expect(action.type).toBe('redirect-back')
        expect(action.to).toBe('/inbox')
    })

    it('无 token 访问 /login → 走加载背景分支（不重定向）', async () => {
        const action = await guard(null, { path: '/login' }, { path: '/' })
        expect(action.type).toBe('load-background')
    })

    it('有 token 访问普通页 → 正常放行', async () => {
        const action = await guard('fake-token', { path: '/inbox' }, { path: '/' })
        expect(action.type).toBe('proceed')
    })
})
