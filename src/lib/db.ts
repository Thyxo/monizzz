import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query'],
  })

// The user fields the client gets back from login, register, me and settings.
export const userSelect = {
  id: true,
  username: true,
  themeAccentColor: true,
  themeBgColor: true,
  greetingStyle: true,
  defaultAccountId: true,
  hiddenWidgets: true,
  navTabs: true,
} as const

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db