import EventBus from '@/plugins/event-bus'
import Storage from '@/plugins/storage'

export const storage = new Storage('im', localStorage)
// session storage wrapper - sessionStorage is not shared between tabs, so
// using this for auth token allows per-tab independent sessions
export const session = new Storage('im', sessionStorage)

export const bus = new EventBus()
