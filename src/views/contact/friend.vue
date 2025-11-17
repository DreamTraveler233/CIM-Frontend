<script lang="ts" setup>
import { fetchContactGroupList, fetchContactList } from '@/apis/api'
import { fetchApi } from '@/apis/request'
import { ContactListResponse_Item } from '@/apis/types'
import Dropdown from '@/components/basic/Dropdown.vue'
import UserSearchModal from '@/components/user/UserSearchModal.vue'
import { ContactConst } from '@/constant/event-bus'
import { useContact, useEventBus } from '@/hooks'
import { useTalkStore } from '@/store'
import { Female, Male, Plus, Search } from '@icon-park/vue-next'
import { useRouter } from 'vue-router'
import GroupManage from './inner/GroupManage.vue'

const router = useRouter()
const talkStore = useTalkStore()
const { onDeleteContact, onChangeContactRemark, toShowUserInfo } = useContact()

const isShowUserSearch = ref(false)
const loading = ref(false)
const isShowGroupModal = ref(false)
const keywords = ref('')
// -1: 全部好友, 0: 未分组, >0: 各分组 id
const index = ref(-1)
const items = ref<ContactListResponse_Item[]>([])
const groups: any = ref([])

const filter: any = computed(() => {
  return items.value.filter((item: ContactListResponse_Item) => {
    const value = item.remark || item.nickname
    const findIndex = value.toLowerCase().indexOf(keywords.value.toLowerCase())

    // -1 表示全部好友
    if (index.value === -1) {
      return findIndex !== -1
    }

    // 0 表示未分组（group_id === 0）
    if (index.value === 0) {
      return findIndex !== -1 && Number(item.group_id) === 0
    }

    // 其他为具体分组 id
    return findIndex !== -1 && Number(index.value) === Number(item.group_id)
  })
})

const loadContactList = async () => {
  const [err, data] = await fetchApi(fetchContactList, {}, { loading })
  if (err) return

  items.value = data?.items || []
}

const loadContactGroupList = async () => {
  const [err, data] = await fetchApi(fetchContactGroupList, {})
  if (err) return

  groups.value = data?.items || []
}

const onToTalk = (item: ContactListResponse_Item) => {
  talkStore.toTalk(1, item.user_id, router)
}

const onInfo = (item: ContactListResponse_Item) => {
  toShowUserInfo(item.user_id)
}

const onToolsMenu = (value: string) => {
  switch (value) {
    case 'add':
      isShowUserSearch.value = true
      break
    case 'group':
      isShowGroupModal.value = true
      break
  }
}

const onChangeRemark = (data: { user_id: number; remark: string }) => {
  let item: any = items.value.find((item: ContactListResponse_Item) => item.user_id == data.user_id)
  item && (item.remark = data.remark)
}

const onClickDropdown = (key: string, item: ContactListResponse_Item) => {
  const { user_id, nickname, remark } = item

  switch (key) {
    case 'change-remark':
      onChangeContactRemark({ user_id, nickname, remark }, (): void => {
        loadContactList()
      })

      break
    case 'delete-contact':
      onDeleteContact({ user_id, nickname, remark }, () => {
        loadContactList()
      })
      break
  }
}

onMounted(() => {
  loadContactList()
  loadContactGroupList()
})

useEventBus([
  { name: ContactConst.UpdateRemark, event: onChangeRemark },
  {
    name: ContactConst.UpdateGroupList,
    event: (data: any) => {
      // 重新加载分组列表
      loadContactGroupList()
      // 如果发布者要求重置选中的 tab（例如删除了当前分组），则回到全部
      if (data && data.resetIndex) {
        index.value = -1
      }
    }
  },
  { name: ContactConst.UpdateContactList, event: loadContactList }
])
</script>

<template>
  <section class="el-container is-vertical h-full">
    <header class="el-header from-header border-bottom">
      <div class="groups">
        <n-tabs v-model:value="index">
          <!-- 固定的全部好友标签，name 为 -1，对应 filter 中的全部逻辑 -->
          <n-tab :name="-1">全部好友({{ items.length }})</n-tab>

          <!-- 固定的未分组（group_id === 0）标签 -->
          <n-tab :name="0">未分组({{ items.filter(i => Number(i.group_id) === 0).length }})</n-tab>

          <!-- 动态分组标签（确保 name 为数字类型） -->
          <n-tab v-for="tab in groups" :key="tab.id" :name="Number(tab.id)">
            {{ tab.name }}({{ tab.count }})
          </n-tab>
        </n-tabs>
      </div>
      <div class="tools">
        <n-space>
          <n-input
            v-model:value.trim="keywords"
            placeholder="搜索"
            clearable
            style="width: 200px"
            round
          >
            <template #prefix>
              <n-icon :component="Search" />
            </template>
          </n-input>

          <n-dropdown
            :animated="true"
            trigger="hover"
            :show-arrow="true"
            @select="onToolsMenu"
            :options="[
              {
                label: '添加好友',
                key: 'add'
              },
              {
                label: '分组管理',
                key: 'group'
              }
            ]"
          >
            <n-button circle>
              <template #icon>
                <n-icon :component="Plus" />
              </template>
            </n-button>
          </n-dropdown>
        </n-space>
      </div>
    </header>

    <main class="el-main" style="padding-bottom: 10px" v-if="filter.length">
      <n-virtual-list style="max-height: inherit" :item-size="80" :items="filter">
        <template #default="{ item }">
          <div :key="item.user_id" class="item-box pointer">
            <div class="avatar" @click="onInfo(item)">
              <im-avatar :src="item.avatar" :size="40" :username="item.nickname" />
            </div>
            <div class="content" @click="onInfo(item)">
              <div class="content-title">
                <span>{{ item.remark || item.nickname }}</span>
                <span>
                  <n-icon v-if="item.gender == 1" :component="Male" color="#508afe" />
                  <n-icon v-if="item.gender == 2" :component="Female" color="#ff5722" />
                </span>
              </div>
              <div class="content-text text-ellipsis">
                个性签名: {{ item.motto ? item.motto : '暂无' }}
              </div>
            </div>
            <div class="tool">
              <n-button text size="small" type="primary" @click="onToTalk(item)"> 发消息 </n-button>
              <Dropdown
                :value="item"
                :options="[
                  {
                    label: '编辑备注',
                    key: 'change-remark'
                  },
                  {
                    label: '删除好友',
                    key: 'delete-contact'
                  }
                ]"
                @select="onClickDropdown"
              />
            </div>
          </div>
        </template>
      </n-virtual-list>
    </main>

    <main class="el-main flex-center" v-else v-loading="loading">
      <n-empty description="暂无相关数据" />
    </main>
  </section>

  <!-- 用户查询模态框 -->
  <UserSearchModal v-model:show="isShowUserSearch" />

  <!-- 分组管理 -->
  <GroupManage
    v-if="isShowGroupModal"
    @close="isShowGroupModal = false"
    @relaod="loadContactGroupList"
  />
</template>

<style lang="less" scoped>
.from-header {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;

  .groups {
    display: flex;
    align-items: center;
    flex: 1 auto;
    height: 100%;
    margin-right: 30px;
    overflow: hidden;
    padding-left: 15px;
  }

  .tools {
    display: flex;
    align-items: center;
    height: 100%;
    width: 250px;
    flex-shrink: 0;
    padding-right: 10px;
  }
}

.item-box {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: all 0.5s;
  border-radius: 5px;
  padding: 5px 0;
  border: 1px solid var(--border-color);
  margin: 10px;
  position: relative;

  &:hover {
    border: 1px solid var(--im-primary-color);
  }

  > div {
    height: inherit;
  }

  .avatar {
    width: 70px;
    flex-shrink: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .content {
    flex: 1;
    overflow: hidden;
    user-select: none;

    &-title {
      display: flex;
      align-items: center;
      height: 30px;
      line-height: 30px;
      span {
        margin-right: 5px;
      }
    }

    &-text {
      height: 30px;
      line-height: 30px;
      color: rgba(0, 0, 0, 45%);
    }
  }

  .tool {
    width: 100px;
    flex-shrink: 1;
    display: flex;
    align-items: center;
    justify-content: space-around;
    margin-right: 10px;
  }
}

html[theme-mode='dark'] {
  .item-box {
    .content {
      &-text {
        color: rgba(255, 255, 255, 50%);
      }
    }
  }
}
</style>
