import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useUserStore } from './user.js'

// mock 依赖的接口模块，避免真实网络
vi.mock('@/request/my.js', () => ({
    loginUserInfo: vi.fn(() => Promise.resolve({ username: 'tester', permKeys: ['*'] })),
}))

/**
 * user store 逻辑测试（F005 US2）
 * 覆盖用户信息刷新语义。
 */
describe('store/user · 用户信息刷新', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
    })

    it('初始 user 为空对象', () => {
        const store = useUserStore()
        expect(store.user).toEqual({})
    })

    it('refreshUserInfo 拉取后写入 user', async () => {
        const store = useUserStore()
        await store.refreshUserInfo()
        expect(store.user.username).toBe('tester')
        expect(store.user.permKeys).toEqual(['*'])
    })

    it('refreshUserList 递增 refreshList 计数（触发列表刷新信号）', async () => {
        const store = useUserStore()
        const before = store.refreshList
        await store.refreshUserList()
        // 计数递增信号（异步 then 后）
        await Promise.resolve()
        expect(store.refreshList).toBeGreaterThan(before)
    })
})
