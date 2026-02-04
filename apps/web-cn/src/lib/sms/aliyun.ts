import Dysmsapi20170525, * as $Dysmsapi20170525 from '@alicloud/dysmsapi20170525';
import * as OpenApi from '@alicloud/openapi-client';
import * as Util from '@alicloud/tea-util';

export async function sendSmsCode(phone: string, code: string) {
    const accessKeyId = process.env.ALIBABA_CLOUD_ACCESS_KEY_ID;
    const accessKeySecret = process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET;
    const signName = process.env.ALIYUN_SMS_SIGN_NAME;
    const templateCode = process.env.ALIYUN_SMS_TEMPLATE_CODE;
    const endpoint = process.env.ALIYUN_SMS_ENDPOINT || 'dysmsapi.aliyuncs.com';

    if (!accessKeyId || !accessKeySecret || !signName || !templateCode) {
        throw new Error('Missing Aliyun SMS env vars');
    }

    const config = new OpenApi.Config({
        accessKeyId,
        accessKeySecret,
        endpoint,
    });

    const client = new Dysmsapi20170525(config);
    const request = new $Dysmsapi20170525.SendSmsRequest({
        phoneNumbers: phone,
        signName,
        templateCode,
        templateParam: JSON.stringify({ code }),
    });

    const runtime = new Util.RuntimeOptions({});
    const response = await client.sendSmsWithOptions(request, runtime);

    const body = response?.body as any;
    if (body?.Code && body.Code !== 'OK') {
        throw new Error(`Aliyun SMS error: ${body.Code} ${body.Message || ''}`.trim());
    }
}
