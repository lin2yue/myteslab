'use server'

import { getWraps } from './api'
import type { Wrap } from './types'

export async function fetchMoreWraps(model?: string, page: number = 1, sortBy: 'latest' | 'popular' = 'latest'): Promise<Wrap[]> {
    return await getWraps(model, page, 15, sortBy)
}
