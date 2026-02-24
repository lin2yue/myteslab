'use server'

import { getWraps, type WrapSortBy } from './api'
import type { Wrap } from './types'

export async function fetchMoreWraps(
    model?: string,
    page: number = 1,
    sortBy: WrapSortBy = 'recommended',
    searchQuery?: string
): Promise<Wrap[]> {
    return await getWraps(model, page, 12, sortBy, searchQuery)
}
