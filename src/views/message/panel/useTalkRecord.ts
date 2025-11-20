import { fetchMessageRecords } from '@/apis/api'
import { useDialogueStore } from '@/store'
import { useFailedMessageStore } from '@/store/modules/failed-message'
import { ITalkRecord } from '@/types/chat'
import { safeParseJson } from '@/utils/common'

export function useTalkRecord() {
  const dialogueStore = useDialogueStore()

  const records = computed((): ITalkRecord[] => dialogueStore.records)

  let cursor = 0

  // 加载数据列表
  const loadChatRecord = async (): Promise<boolean> => {
    const { target: talk } = dialogueStore

    const request = {
      talk_mode: talk.talk_mode,
      to_from_id: talk.to_from_id,
      cursor: cursor,
      limit: 30
    }

    try {
      console.log('Loading talk records with request:', request)
      const data = await fetchMessageRecords(request)

      if (request.talk_mode !== talk.talk_mode || request.to_from_id !== talk.to_from_id) {
        console.error('Talk mode or to_from_id changed')
        throw new Error('Talk mode or to_from_id changed')
      }

      if (request.cursor === 0) {
        dialogueStore.clearDialogueRecord()
      }

        const failedStore = useFailedMessageStore()
        const sessionKey = `${request.talk_mode}_${request.to_from_id}`

          const list = data.items.map((item: any) => {
            item.extra = safeParseJson(item.extra || '{}')
            item.quote = safeParseJson(item.quote || '{}')
            // Respect server status if present, fall back to 1 (sent)
            if (!item.status || ![1, 2, 3].includes(Number(item.status))) {
              item.status = 1
            }

            // If frontend previously marked this message as failed, keep it failed
            if (failedStore.has(sessionKey, item.msg_id)) {
              item.status = 3
            }

            return item
          })

      dialogueStore.unshiftDialogueRecord(list.reverse())
      cursor = data.cursor

      return data.items.length < request.limit ? false : true
    } catch (error) {
      console.error('Error loading talk records:', error)
      throw error
    }
  }

  // 重置对话记录
  const resetTalkRecord = (): void => {
    cursor = 0
    dialogueStore.clearDialogueRecord()
  }

  return { records, loadChatRecord, dialogueStore, resetTalkRecord }
}
