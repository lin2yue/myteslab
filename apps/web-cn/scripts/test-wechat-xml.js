const { XMLParser } = require('fast-xml-parser');
const parser = new XMLParser();

const incomingXml = `
<xml>
  <ToUserName><![CDATA[gh_SA_ID]]></ToUserName>
  <FromUserName><![CDATA[user_openid]]></FromUserName>
  <CreateTime>123456789</CreateTime>
  <MsgType><![CDATA[event]]></MsgType>
  <Event><![CDATA[SCAN]]></Event>
  <EventKey><![CDATA[scene_123]]></EventKey>
  <Ticket><![CDATA[ticket_123]]></Ticket>
</xml>
`;

const result = parser.parse(incomingXml);
const msg = result.xml;

console.log('Parsed Msg:', JSON.stringify(msg, null, 2));

const openid = msg.FromUserName;
const sa_id = msg.ToUserName;

const replyXml = `<xml><ToUserName><![CDATA[${openid}]]></ToUserName><FromUserName><![CDATA[${sa_id}]]></FromUserName><CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime><MsgType><![CDATA[text]]></MsgType><Content><![CDATA[Test Reply]]></Content></xml>`;

console.log('Generated Reply XML:');
console.log(replyXml);

if (openid !== 'user_openid' || sa_id !== 'gh_SA_ID') {
    console.error('ERROR: To/From mismatch!');
} else {
    console.log('SUCCESS: Values parsed correctly.');
}
