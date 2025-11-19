import { session } from './'

const AccessToken = 'AUTH_TOKEN'

/**
 * 验证是否登录
 *
 * @returns boolean
 */
export function isLogin(): boolean {
  return getToken() != ''
}

/**
 * 获取登录授权 Token
 *
 * @returns token
 */
export function getToken(): string {
  // Use session storage for token so each tab maintains its own session
  // It prevents login in one tab from affecting another tab
  return session.get(AccessToken) || ''
}

/**
 * 设置登录授权 Token
 *
 * @returns token
 */
export function setToken(token: string, expire: number): void {
  // store token in session (tab-local) with the provided expire
  session.set(AccessToken, token, expire)
}

/**
 * 删除登录授权 Token
 */
export function deleteToken(): void {
  session.remove(AccessToken)
}
