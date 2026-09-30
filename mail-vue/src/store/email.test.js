import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useEmailStore } from './email.js'
import { EmailUnreadEnum } from '@/enums/email-enum.js'

/**
 * email store 逻辑回归网（F005 US2）
 *
 * 覆盖 applyFullList（列表合并 + 已读状态保护）、toContentEmail（详情补齐）、
 * markListRead（滚动列表批量标已读）等纯逻辑路径。
 */
describe('store/email · 列表合并与状态流转', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
    })

    it('applyFullList 空列表不改变状态', () => {
        const store = useEmailStore()
        store.applyFullList([])
        expect(Object.keys(store.detailMap).length).toBe(0)
    })

    it('applyFullList 写入 detailMap 并补全 attList', () => {
        const store = useEmailStore()
        store.applyFullList([{ emailId: 1, subject: 'a' }])
        expect(store.detailMap[1]).toBeTruthy()
        expect(store.detailMap[1].attList).toEqual([])
    })

    it('applyFullList 跳过无 emailId 的脏数据', () => {
        const store = useEmailStore()
        store.applyFullList([{ subject: 'no-id' }, { emailId: 2 }])
        expect(store.detailMap[undefined]).toBeUndefined()
        expect(Object.keys(store.detailMap).length).toBe(1)
    })

    it('已读状态保护：完整列表晚到不把已读盖回未读', () => {
        const store = useEmailStore()
        // 先标记 email 5 已读
        store.applyFullList([{ emailId: 5, unread: EmailUnreadEnum.READ }])
        expect(store.detailMap[5].unread).toBe(EmailUnreadEnum.READ)
        // 完整列表带旧状态（未读）返回
        store.applyFullList([{ emailId: 5, unread: EmailUnreadEnum.UNREAD }])
        // 保护逻辑应保留 READ
        expect(store.detailMap[5].unread).toBe(EmailUnreadEnum.READ)
    })

    it('toContentEmail 对已有详情返回 detailMap 中的对象', () => {
        const store = useEmailStore()
        store.applyFullList([{ emailId: 9, subject: 'cached' }])
        const result = store.toContentEmail({ emailId: 9 })
        expect(result.subject).toBe('cached')
    })

    it('toContentEmail 对未知邮件补齐默认字段', () => {
        const store = useEmailStore()
        const result = store.toContentEmail({ emailId: 99, subject: 'new' })
        expect(result.emailId).toBe(99)
        expect(result.content).toBe('')
        expect(result.attList).toEqual([])
        expect(result.recipient).toBe('[]')
    })

    it('markListRead 将滚动列表中对应邮件标记为已读', () => {
        const store = useEmailStore()
        store.emailScroll = { emailList: [{ emailId: 1, unread: EmailUnreadEnum.UNREAD }] }
        store.starScroll = { emailList: [{ emailId: 1, unread: EmailUnreadEnum.UNREAD }] }
        store.markListRead(1)
        expect(store.emailScroll.emailList[0].unread).toBe(EmailUnreadEnum.READ)
        expect(store.starScroll.emailList[0].unread).toBe(EmailUnreadEnum.READ)
    })
})
