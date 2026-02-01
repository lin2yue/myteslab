'use server';

import { revalidateTag } from 'next/cache';

export async function revalidateWraps() {
    revalidateTag('wraps', 'default' as any);
}
