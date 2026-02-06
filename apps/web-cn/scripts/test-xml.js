const { XMLParser } = require('fast-xml-parser');
const parser = new XMLParser();

const xml = `
<xml>
  <ToUserName><![CDATA[gh_123456789abc]]></ToUserName>
  <FromUserName><![CDATA[ot7P_0t7P_0t7P_0t7P_0t7P_0t7P]]></FromUserName>
  <CreateTime>123456789</CreateTime>
  <MsgType><![CDATA[event]]></MsgType>
  <Event><![CDATA[SCAN]]></Event>
  <EventKey><![CDATA[SCENE_ID]]></EventKey>
  <Ticket><![CDATA[TICKET]]></Ticket>
</xml>
`;

const result = parser.parse(xml);
console.log('Result:', JSON.stringify(result, null, 2));
const msg = result.xml;
console.log('msg.ToUserName type:', typeof msg.ToUserName);
console.log('msg.ToUserName value:', msg.ToUserName);
