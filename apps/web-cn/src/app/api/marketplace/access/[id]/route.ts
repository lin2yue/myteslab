import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { dbQuery } from '@/lib/db'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: wrapId } = await params
    const user = await getSessionUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { rows: wrapRows } = await dbQuery(
      `SELECT id, user_id, price_credits, is_public, is_active, deleted_at
       FROM wraps WHERE id = $1 LIMIT 1`,
      [wrapId]
    )
    const wrap = wrapRows[0]
    if (!wrap || wrap.deleted_at || !wrap.is_active || !wrap.is_public) {
      return NextResponse.json({ error: '贴图不存在或不可访问' }, { status: 404 })
    }

    const priceCredits = Number(wrap.price_credits || 0)
    if (user.id === wrap.user_id || priceCredits <= 0) {
      return NextResponse.json({ purchased: true, needCredits: 0, hasPaidBalance: 0, hasGiftBalance: 0 })
    }

    const { rows: purchaseRows } = await dbQuery(
      `SELECT id FROM wrap_purchases WHERE buyer_id = $1 AND wrap_id = $2 LIMIT 1`,
      [user.id, wrapId]
    )

    const { rows: creditRows } = await dbQuery(
      `SELECT paid_balance, gift_balance FROM user_credits WHERE user_id = $1 LIMIT 1`,
      [user.id]
    )

    return NextResponse.json({
      purchased: purchaseRows.length > 0,
      needCredits: priceCredits,
      hasPaidBalance: Number(creditRows[0]?.paid_balance || 0),
      hasGiftBalance: Number(creditRows[0]?.gift_balance || 0),
    })
  } catch (error) {
    console.error('[marketplace access] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
