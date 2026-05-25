import { JSONPath } from 'jsonpath-plus';

async function main() {
  const res = await fetch('http://192.168.1.35:97/credit-supsearch/chat/chat.do', {
    method: 'POST',
    headers: {
      'Accept-Language': 'en,zh-CN;q=0.9,zh;q=0.8',
      'Connection': 'keep-alive',
      'Content-Type': 'application/json',
      'Cookie': 'locale=en-US; CUID=simulate_session_id; _SID=908f52ff-f1d7-43fd-8077-9b8bb98ccc17',
      'Origin': 'http://192.168.1.35:97',
      'Referer': 'http://192.168.1.35:97/credit-portal/',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
      'accept': 'text/event-stream'
    },
    body: JSON.stringify({
      chatId: "",
      query: "什么是信用黑名单"
    })
  });

  const contentType = res.headers.get('Content-Type') || '';
  console.log('Content-Type:', contentType);

  // Read stream
  const reader = res.body?.getReader();
  const decoder = new TextDecoder();
  let fullResponse = '';
  let fullExtracted = '';
  let buffer = '';

  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      fullResponse += chunk;
      buffer += chunk;
      
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data:')) {
          const dataStr = line.substring(5).trim();
          if (dataStr === '[DONE]') continue;
          try {
            const jsonObj = JSON.parse(dataStr);
            const result = JSONPath({ path: '$.content', json: jsonObj });
            if (result && result.length > 0 && result[0] != null) {
              fullExtracted += result[0];
            }
          } catch (e) {
            console.error('Failed to parse:', dataStr);
          }
        }
      }
    }
  }

  console.log('-----------------');
  console.log('EXTRACTED:', fullExtracted);
}

main().catch(console.error);
