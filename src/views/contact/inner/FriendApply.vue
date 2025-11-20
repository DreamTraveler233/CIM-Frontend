<script lang="ts" setup>
import {
  fetchContactApplyAccept,
  fetchContactApplyDecline,
  fetchContactApplyList
} from '@/apis/api'
import { fetchApi } from '@/apis/request'
import { ContactApplyListResponse_Item } from '@/apis/types'
import ButtonDropdown from '@/components/basic/ButtonDropdown.vue'
import { ContactConst } from '@/constant/event-bus'
import { useInject, useEventBus } from '@/hooks'
import { EditorConst } from '@/constant/event-bus'
import { useRouter } from 'vue-router'
import { useTalkStore } from '@/store/modules/talk'
import { useUserStore } from '@/store'
import { formatTime } from '@/utils/datetime'

const userStore = useUserStore()
const { toShowUserInfo, message } = useInject()
const { emit } = useEventBus([])
const items = ref<ContactApplyListResponse_Item[]>([])
// 正在处理的申请 ID 列表（用于禁用按钮）
const processingIds = ref<number[]>([])
const loading = ref(true)
const isContactApply = computed(() => userStore.isContactApply)

const onLoadData = async (isClearTip = false) => {
  const [err, data] = await fetchApi(fetchContactApplyList, {}, { loading })
  if (err) return

  items.value = data?.items || []

  if (isClearTip) {
    userStore.isContactApply = false
  }
}

const onInfo = (item: ContactApplyListResponse_Item) => {
  toShowUserInfo((item as any).friend_id || item.user_id)
}

const router = useRouter()
const talkStore = useTalkStore()

const onAccept = async (item: ContactApplyListResponse_Item) => {
  // 防止重复点击
  if (processingIds.value.includes(item.id)) return
  processingIds.value.push(item.id)
  const loading = message.loading('请稍等，正在处理')

  try {
    const [err, resp] = await fetchApi(
      fetchContactApplyAccept,
      {
        apply_id: item.id,
        remark: '同意'
      },
      { successText: '已同意' }
    )
    if (err) return

  onLoadData()
  emit(ContactConst.UpdateContactList, {})

  // 使用服务端返回的 session 打开会话窗口（私聊），若无 session 则提示用户稍后
  try {
    const session = (resp && (resp as any).session) || null
    if (session) {
      await talkStore.toTalk(session.talk_mode, session.to_from_id, router)
    }
    // 聚焦聊天输入框（延迟触发，确保 EditorMounted）
    setTimeout(() => emit(EditorConst.Focus, {}), 80)
    // 尝试把会话列表滚动到顶部（新会话位于最上层）
    setTimeout(() => emit('talk-session-scroll', { top: 0 }), 120)
  } catch (err) {
    console.error('Failed to open chat after accepting friend', err)
  }
  } finally {
    loading.destroy()
    // 移除 processing id
    const idx = processingIds.value.indexOf(item.id)
    if (idx !== -1) processingIds.value.splice(idx, 1)
  }
}

const onDecline = async (item: ContactApplyListResponse_Item) => {
  if (processingIds.value.includes(item.id)) return
  processingIds.value.push(item.id)
  const loading = message.loading('请稍等，正在处理')

  try {
    const [err] = await fetchApi(
    fetchContactApplyDecline,
    {
      apply_id: item.id,
      remark: '拒绝'
    },
    { successText: '已拒绝' }
  )
    if (err) return

    onLoadData()
  } finally {
    loading.destroy()
    const idx = processingIds.value.indexOf(item.id)
    if (idx !== -1) processingIds.value.splice(idx, 1)
  }
}

watch(isContactApply, () => {
  onLoadData(false)
})

onMounted(() => {
  onLoadData(true)
})
</script>

<template>
  <section
    style="min-height: 100%; overflow-y: auto"
    :class="{
      'flex-center': !items.length
    }"
  >
    <n-empty v-show="!items.length" description="暂无好友通知" />

    <div class="item border-bottom" v-for="item in items" :key="item.id">
      <div class="avatar" @click="onInfo(item)">
        <im-avatar :size="30" :src="item.avatar" :username="item.nickname" />
      </div>

      <div class="content pointer o-hidden" @click="onInfo(item)">
        <div class="username">
          <span>{{ item.nickname }}</span>
          <span class="time">{{ formatTime(item.created_at, 'MM/DD HH:mm') }}</span>
        </div>
        <div class="remark text-ellipsis">留言: {{ item.remark }}</div>
      </div>

      <div class="tools">
        <ButtonDropdown
          primary-text="同意"
          primary-type="default"
          :options="[{ label: '忽略', key: 'delete' }]"
          size="small"
          :loading="processingIds.includes(item.id)"
          :disabled="processingIds.includes(item.id)"
          @primary-click="onAccept(item)"
          @select="
            (key) => {
              if (key == 'delete') {
                onDecline(item)
              }

              return false
            }
          "
        />
      </div>
    </div>
  </section>
</template>

<style lang="less" scoped>
.item {
  min-height: 60px;
  display: flex;
  align-items: center;
  padding: 6px 0;

  > div {
    height: inherit;
  }

  .avatar {
    width: 40px;
    display: flex;
    align-items: center;
  }

  .content {
    width: 100%;
    margin-left: 10px;
    display: flex;
    flex-direction: column;
    justify-content: center;

    .username {
      height: 30px;
      line-height: 25px;
      display: flex;
      align-items: center;
      font-size: 15px;

      .time {
        font-size: 12px;
        color: #bfbbbb;
        margin-left: 5px;
      }
    }

    .remark {
      height: 30px;
      line-height: 25px;
      font-size: 12px;
      color: #9a9292;
      overflow: hidden;
      width: inherit;
    }
  }

  .tools {
    width: 100px;
    display: flex;
    align-items: center;
    justify-content: space-around;
  }
}
</style>
