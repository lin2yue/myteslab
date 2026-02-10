import { AlipaySdk } from 'alipay-sdk';

let cachedAlipaySdk: AlipaySdk | null = null;

export function getAlipaySdk() {
    if (cachedAlipaySdk) {
        return cachedAlipaySdk;
    }

    const appId = process.env.ALIPAY_APP_ID;
    const privateKey = process.env.ALIPAY_PRIVATE_KEY;
    const alipayPublicKey = process.env.ALIPAY_PUBLIC_KEY;
    const gateway = process.env.ALIPAY_GATEWAY || 'https://openapi.alipay.com/gateway.do';

    if (!appId || !privateKey || !alipayPublicKey) {
        throw new Error('Missing Alipay configuration env vars.');
    }

    cachedAlipaySdk = new AlipaySdk({
        appId,
        privateKey,
        alipayPublicKey,
        gateway,
        signType: 'RSA2',
    });

    return cachedAlipaySdk;
}
