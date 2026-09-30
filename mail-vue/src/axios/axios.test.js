import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * axios 封装 · noMsg 静默吞错语义（F005 US2 必演示样例）
 *
 * 拦截器行为：noMsg=true 时按 code 静默 resolve/reject，不弹 ElMessage；
 * 非 noMsg 的失败会走 ElMessage 全局提示。
 * 这里通过 mock 依赖 + 直接触发已注册的响应拦截器来验证语义。
 */

const elMessageSpy = vi.fn()
const routerReplace = vi.fn()

// ElMessage 由 unplugin-auto-import 注入（源码中为裸标识符），
// 因此必须 mock 其真实来源模块 element-plus，stubGlobal 不会生效。
vi.mock('element-plus', async (importOriginal) => {
    const actual = await importOriginal()
    const message = (...args) => elMessageSpy(...args)
    message.error = (...args) => elMessageSpy(...args)
    message.success = (...args) => elMessageSpy(...args)
    message.warning = (...args) => elMessageSpy(...args)
    return { ...actual, ElMessage: message }
})

vi.mock('@/router', () => ({ default: { replace: routerReplace } }))
vi.mock('@/i18n/index.js', () => ({ default: { global: { t: (k) => k } } }))
vi.mock('@/store/setting.js', () => ({
    useSettingStore: () => ({ lang: 'zh' }),
}))

async function getResponseInterceptor() {
    vi.resetModules()
    const mod = await import('./index.js')
    // axios 实例的响应拦截器 handler 挂在实例内部；这里用 mock adapter 走完整流程
    return mod.default
}

describe('axios · noMsg 静默吞错语义', () => {
    beforeEach(() => {
        elMessageSpy.mockClear()
        routerReplace.mockClear()
    })

    it('noMsg=true 且 code=200 时 resolve data（不弹提示）', async () => {
        const http = await getResponseInterceptor()
        // 挂 mock adapter 直接返回构造响应
        http.defaults.adapter = async (config) => ({
            data: { code: 200, message: 'ok', data: { v: 1 } },
            status: 200,
            config,
        })
        const res = await http.get('/x', { noMsg: true })
        expect(res).toEqual({ v: 1 })
        expect(elMessageSpy).not.toHaveBeenCalled()
    })

    it('noMsg=true 且 code!=200 时 reject 且不弹提示（静默吞错）', async () => {
        const http = await getResponseInterceptor()
        http.defaults.adapter = async (config) => ({
            data: { code: 500, message: 'boom', data: null },
            status: 200,
            config,
        })
        await expect(http.get('/x', { noMsg: true })).rejects.toMatchObject({ code: 500 })
        expect(elMessageSpy).not.toHaveBeenCalled()
    })

    it('noMsg=false 且 code!=200 时弹全局错误提示', async () => {
        const http = await getResponseInterceptor()
        http.defaults.adapter = async (config) => ({
            data: { code: 500, message: 'boom', data: null },
            status: 200,
            config,
        })
        await expect(http.get('/x', { noMsg: false })).rejects.toMatchObject({ code: 500 })
        expect(elMessageSpy).toHaveBeenCalled()
    })
})
