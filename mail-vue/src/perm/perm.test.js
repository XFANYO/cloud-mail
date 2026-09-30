import { describe, it, expect } from 'vitest'
import { permsToRouter } from './perm.js'

/**
 * perm 权限路由表测试（F005 US2）
 *
 * permsToRouter(permKeys) 是纯函数：角色权限 key 数组 → 可见路由条目数组。
 * 覆盖文档要求的三类样本：管理员（*）/ 普通用户（部分 key）/ 无权限。
 */
describe('perm · permsToRouter 角色路由表', () => {
    it('管理员（*）可见全部 7 组路由', () => {
        const routes = permsToRouter(['*'])
        // 7 组：email:send(2) / user:query / role:query / setting:query / reg-key:query / all-email:query / analysis:query
        expect(routes.length).toBe(8)
        const paths = routes.map((r) => r.path)
        expect(paths).toContain('/sent')
        expect(paths).toContain('/all-users')
        expect(paths).toContain('/system-settings')
    })

    it('普通用户（部分权限）只可见对应路由', () => {
        const routes = permsToRouter(['email:send'])
        expect(routes.length).toBe(2)
        expect(routes.map((r) => r.path)).toEqual(['/sent', '/drafts'])
    })

    it('无权限用户（空数组）可见路由为空', () => {
        expect(permsToRouter([])).toEqual([])
    })

    it('未知权限 key 不产生路由', () => {
        expect(permsToRouter(['unknown:perm'])).toEqual([])
    })
})
