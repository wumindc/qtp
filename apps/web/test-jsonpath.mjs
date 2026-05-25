import { JSONPath } from 'jsonpath-plus';

const dataStr = `{"messageId":"206185ad-c8b7-406f-aa98-eda3ef9f5e64","chatId":"f3d41723-a066-4e91-a115-056e421b1845","role":"assistant","type":"answer","contentType":"text","content":"信用黑名单","think":"","thinkStatus":"DONE","data":null,"done":false,"extra":false,"feedback":null,"createTime":"2026-05-25 17:57:39"}`;

const jsonObj = JSON.parse(dataStr);
const result = JSONPath({ path: '$.content', json: jsonObj });

console.log(result);
