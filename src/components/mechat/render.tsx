import { RoleEnum, MessageTypeEnum, IMessage, StatusEnum } from '@/components/chat'
import { useFailedMessageStore } from '@/store/modules/failed-message'
import { ITalkRecord } from '@/types/chat.ts'
import { components } from './components.tsx'

function render(extra: any, message: ITalkRecord, role: string) {
  const msgType = message.msg_type
  return components[msgType]?.(extra, message, role) || <unknown-message msgType={msgType} />
}

export const formatChatMessage = (
  loginUserId: number,
  chat: ITalkRecord,
  talk_mode?: number,
  to_from_id?: number
): IMessage => {
  const { msg_id, from_id, send_time, nickname, avatar, extra } = chat

  if (from_id == 0 || chat.msg_type >= 1000) {
    return {
      msg_id: msg_id,
      role: RoleEnum.SYSTEM,
      type: MessageTypeEnum.CUSTOM,
      time: send_time,
      render: () => render(extra, chat, RoleEnum.SYSTEM),
      status: StatusEnum.SENT
    }
  }

  if (chat.is_revoked == 1) {
    return {
      msg_id: msg_id,
      role: RoleEnum.SYSTEM,
      type: MessageTypeEnum.TEXT,
      time: send_time,
      content: '此消息已被撤回',
      status: StatusEnum.SENT
    }
  }

  const role = from_id != loginUserId ? RoleEnum.ASSISTANT : RoleEnum.USER

  const quote = chat?.quote
    ? {
        quote_id: chat.quote?.quote_id || '',
        content: chat.quote?.content || ''
      }
    : undefined

  let status = StatusEnum.SENT
  if ([2, 3].includes(chat.status)) {
    status = chat.status == 2 ? StatusEnum.SENDING : StatusEnum.ERROR
  }
  // 非好友导致的本地失效消息，extra.invalid=true
  try {
    if (extra && extra.invalid) {
      status = StatusEnum.ERROR
    }
  } catch (_) {}

  // 如果本地持久化标记了该消息为失败，则以失败状态优先显示
  try {
    const failedStore = useFailedMessageStore()
    const sessionKey = talk_mode !== undefined && to_from_id !== undefined ? `${talk_mode}_${to_from_id}` : ''
    if (sessionKey && failedStore.has(sessionKey, chat.msg_id)) {
      status = StatusEnum.ERROR
    }
  } catch (_) {}

  return {
    role,
    msg_id: msg_id,
    type: MessageTypeEnum.CUSTOM,
    time: send_time,
    name: nickname,
    avatar: avatar,
    quote: quote,
    render: () => render(extra, chat, role),
    status
  }
}
