import { useState, useEffect } from 'react'
import { notificationService } from '../services/notificationService'
import { readPaginatedData } from '../../../services/pagination'

export function useNotifications(params = {}) {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [totalNotifications, setTotalNotifications] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  const load = async () => {
    try {
      const res = await notificationService.list(params)
      const pageData = readPaginatedData(res.data, { page: params.page, size: params.size })
      setNotifications(pageData.content)
      setUnreadCount(pageData.content.filter((n) => !n.isRead).length)
      setTotalNotifications(pageData.totalElements)
      setTotalPages(pageData.totalPages)
    } catch {}
  }

  useEffect(() => { load() }, [params.filter, params.page, params.size])

  const markRead = async (id) => {
    await notificationService.markRead(id)
    load()
  }

  const markAllRead = async () => {
    await notificationService.markAllRead()
    load()
  }

  const remove = async (id) => {
    await notificationService.delete(id)
    load()
  }

  return { notifications, unreadCount, totalNotifications, totalPages, markRead, markAllRead, remove, reload: load }
}

