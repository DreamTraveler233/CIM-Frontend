import { fetchMessageSend } from '@/apis/customize'
import { fetchMessageStatus } from '@/apis/api'
import { fetchApi } from '@/apis/request'
import * as chat from '@/constant/chat'
import { datetime } from '@/utils/datetime'
import { defineStore } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import { nextTick } from 'vue'
import { useDialogueStore } from './dialogue'
import { useFailedMessageStore } from './failed-message'
import { useUserStore } from './user'

type IAsyncMessage = {
  msg_id?: string // 消息ID
  type: string // 消息类型
  talk_mode: number // 聊天类型
  to_from_id: number // 聊天对象ID[群ID或者好友ID]
  quote_id: string // 引用消息ID
  body: any // 消息体
}

// 消息状态常量
const MESSAGE_STATUS_SENT = 1
const MESSAGE_STATUS_PENDING = 2
const MESSAGE_STATUS_FAILED = 3

const MAX_RETRIES = 6

// 编辑器草稿
export const useAsyncMessageStore = defineStore('async-message', () => {
  const { uid, nickname, avatar } = useUserStore()
  const dialogueStore = useDialogueStore()

  // 待推送消息ID
  let items: IAsyncMessage[] = []

  // 异步消息ID缓存
  const msgIdsSet = new Set<string>()
  // 添加待推送消息
  function addAsyncMessage(data: IAsyncMessage) {
    // 校验：禁止发送空白消息
    if (data.type === 'text') {
      const content = data.body?.text || data.body?.content || ''
      if (!content || !content.trim()) {
        window['$message']?.warning('发送内容不能为空')
        return
      }
    }

    if (data.type === 'mixed') {
      const items = data.body?.items || []
      if (!Array.isArray(items) || items.length === 0) {
        window['$message']?.warning('发送内容不能为空')
        return
      }
    }

    data.msg_id = uuid()
    items.push(data)

    msgIdsSet.add(data.msg_id)

    addRecordList(data)
    sendMessage(data)
  }

  async function sendMessage(message: IAsyncMessage, retryCount = 0) {
    try {
      // 调用后端发送：后端可能返回完整的 message record（msg_id/sequence 等）
      // 或者在转发场景返回 { items: [...] }
      const [err, res] = await fetchApi(fetchMessageSend, message)
      if (err) {
        if (retryCount < MAX_RETRIES) {
          await delay(delayStrategy(retryCount))
          await sendMessage(message, retryCount + 1)
        } else {
          console.error(`Failed to send message after ${MAX_RETRIES} retries`, message)
          updateMessageStatus(message.msg_id!, MESSAGE_STATUS_FAILED, `${message.talk_mode}_${message.to_from_id}`)
          msgIdsSet.delete(message.msg_id!)
        }
        return
      }

      // 更新对话记录状态
      updateMessageStatus(message.msg_id!, MESSAGE_STATUS_SENT, `${message.talk_mode}_${message.to_from_id}`)

      // 如果后端返回了 server msg_id（非转发场景），则把本地临时 msg_id 替换为后端 msg_id
      // 1. res 可能是 MessageSendResponse 或 ForwardSendResponse
      if (res && (res as any).msg_id) {
        const server_msg_id = (res as any).msg_id as string

        // 如果后端返回的 msg_id 和本地 msg_id 不同，需要把本地对话中的 msg_id 更新
        if (server_msg_id && server_msg_id !== message.msg_id) {
          dialogueStore.records.forEach((item) => {
            if (item.msg_id === message.msg_id) {
              item.msg_id = server_msg_id
            }
          })

          // 更新 msgIdsSet：替换本地临时 id 为服务器 id，以便 event 去重能正确匹配
          if (msgIdsSet.has(message.msg_id!)) {
            msgIdsSet.delete(message.msg_id!)
            msgIdsSet.add(server_msg_id)
          }
          // 如果本地该消息原先被标记为失败，迁移失败标记
          try {
            const key = `${message.talk_mode}_${message.to_from_id}`
            if (failedStore.has(key, message.msg_id!)) {
              failedStore.removeFailed(key, message.msg_id!)
              failedStore.addFailed(key, server_msg_id)
              // 同步服务器端状态（将临时消息对应的服务器消息也标记为失败）
              try {
                fetchApi(fetchMessageStatus, {
                  talk_mode: message.talk_mode,
                  to_from_id: message.to_from_id,
                  msg_id: server_msg_id,
                  status: MESSAGE_STATUS_FAILED
                }).catch(() => {})
              } catch (_) {}
            }
          } catch (_) {}
        }
      }

      // 非好友导致的失效消息（后端仍返回成功，但 extra.invalid 标记）
      try {
        const extraStr = (res as any).extra
        if (typeof extraStr === 'string') {
          const extraJson = JSON.parse(extraStr)
          if (extraJson?.invalid) {
            // 标记发送失败样式 & 弹提示（类似撤回提示临时出现）
            updateMessageStatus((res as any).msg_id || message.msg_id!, MESSAGE_STATUS_FAILED, `${message.talk_mode}_${message.to_from_id}`)
            window['$message']?.error('对方已不是你的好友，请重新添加')
          }
        }
      } catch (_) {}

      // 发送成功后将消息从待推送列表中移除
      items = items.filter((item) => item.msg_id !== message.msg_id)
    } catch (error) {
      console.error('Error sending message', error, message)
    }
  }

  const msgTypeMap = {
    text: chat.ChatMsgTypeText,
    code: chat.ChatMsgTypeCode,
    image: chat.ChatMsgTypeImage,
    audio: chat.ChatMsgTypeAudio,
    video: chat.ChatMsgTypeVideo,
    file: chat.ChatMsgTypeFile,
    location: chat.ChatMsgTypeLocation,
    card: chat.ChatMsgTypeCard,
    forward: chat.ChatMsgTypeForward,
    login: chat.ChatMsgTypeLogin,
    vote: chat.ChatMsgTypeVote,
    mixed: chat.ChatMsgTypeMixed
  }

  // 推送到会话记录中
  async function addRecordList(data: IAsyncMessage) {
    const record = {
      msg_id: data.msg_id as string,
      sequence: 0,
      msg_type: msgTypeMap[data.type],
      from_id: uid,
      nickname: nickname,
      avatar: avatar,
      is_revoked: 2,
      send_time: datetime(),
      extra: data.body,
      quote: {},
      status: MESSAGE_STATUS_PENDING
    }

    if (data.quote_id) {
      const quote = dialogueStore.records.find((item) => item.msg_id === data.quote_id)
      if (quote) {
        record.quote = {
          quote_id: quote.msg_id,
          msg_type: 1,
          nickname: quote.nickname,
          content: quote.extra.content ?? '查看消息'
        }
      }
    }

    dialogueStore.records.push(record)

    nextTick(() => {
      dialogueStore.scrollToBottom(false)
    })
  }

  const failedStore = useFailedMessageStore()

  // 更新消息状态
  function updateMessageStatus(msg_id: string, status: number, sessionKey?: string) {
    dialogueStore.records.forEach((item) => {
      if (item.msg_id === msg_id) {
        item.status = status
      }
    })

    // 持久化失败状态（3 = failed）
    if (status === MESSAGE_STATUS_FAILED) {
      // If session key absent, use current dialogue index
      const key = sessionKey || dialogueStore.index_name || ''
      failedStore.addFailed(key, msg_id)
      // 如果本条是当前用户发送，则同步至服务端
      try {
        const key = sessionKey || dialogueStore.index_name || ''
        const parts = key.split('_')
        const talk_mode = Number(parts[0] || 0)
        const to_from_id = Number(parts[1] || 0)
        // 只有发送者才可以更新消息状态至服务器
        const item = dialogueStore.records.find((it) => it.msg_id === msg_id)
        if (item && item.from_id === uid) {
          fetchApi(fetchMessageStatus, { talk_mode, to_from_id, msg_id, status }).catch(() => {})
        }
      } catch (_) {}
    }

    // 成功则移除失败标记
    if (status === MESSAGE_STATUS_SENT) {
      const key = sessionKey || dialogueStore.index_name || ''
      failedStore.removeFailed(key, msg_id)
      // 若本条是当前用户发送，则同步状态至服务端（把失败标记清除）
      try {
        const key = sessionKey || dialogueStore.index_name || ''
        const parts = key.split('_')
        const talk_mode = Number(parts[0] || 0)
        const to_from_id = Number(parts[1] || 0)
        const item = dialogueStore.records.find((it) => it.msg_id === msg_id)
        if (item && item.from_id === uid) {
          fetchApi(fetchMessageStatus, { talk_mode, to_from_id, msg_id, status }).catch(() => {})
        }
      } catch (_) {}
    }
  }

  const msgIdsCache = {
    has(msg_id: string): boolean {
      return msgIdsSet.has(msg_id)
    },
    clear(msg_id: string) {
      msgIdsSet.delete(msg_id)
    }
  }

  return {
    addAsyncMessage,
    msgIdsCache
  }
})

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function delayStrategy(retryCount: number): number {
  return retryCount * 1500
}

function uuid(): string {
  // @ts-expect-error
  return uuidv4().replaceAll('-', '')
}
