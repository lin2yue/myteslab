import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { getSignedUrl } from '@/lib/oss'

export async function POST() {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const filename = `project-${user.id.slice(0, 8)}-${Date.now()}.json`
    const { url, key } = await getSignedUrl(filename, `editor/projects/${user.id}`)

    const cdnBase = (process.env.OSS_CDN_BASE || process.env.OSS_BASE_URL || '').replace(/\/+$/, '')
    const publicUrl = cdnBase ? `${cdnBase}/${key}` : null

    return NextResponse.json({ success: true, uploadUrl: url, ossKey: key, publicUrl })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
