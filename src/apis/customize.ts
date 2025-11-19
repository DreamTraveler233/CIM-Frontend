import { createApi } from './request'
import type { MessageSendResponse, ForwardSendResponse } from './types.d.ts'

/**
 * 表情包上传接口
 */
export const fetchEmoticonCustomizeUpload = createApi<FormData, any>(
  '/api/v1/emoticon/customize/upload'
)

/**
 * 文章附件上传接口
 */
export const fetchArticleAnnexUpload = createApi<FormData, any>('/api/v1/article-annex/upload')

// 上传头像裁剪图片服务接口
export const fetchUploadImage = createApi<FormData, any>('/api/v1/upload/media-file')

// 查询大文件拆分信息服务接口
export const fetchUploadInitMultipart = createApi('/api/v1/upload/init-multipart')

// 文件拆分上传服务接口
export const fetchUploadMultipart = createApi<FormData, any>('/api/v1/upload/multipart')

// 发送代码块消息服务接口
export const fetchMessageSend = createApi<ServTalkMessageSendRequest, MessageSendResponse | ForwardSendResponse>(
  '/api/v1/message/send'
)

interface ServTalkMessageSendRequest {
  type: string// 消息类型
  quote_id?: string// 引用消息ID（可选）
  body: any// 消息内容
  talk_mode: number// 对话模式
  to_from_id: number// 对话对象ID
  msg_id?: string// 消息ID（可选）
}
