// Quick test script to call Coze workflow and print streaming output.
// Run with: npm i @coze/api && node coze_stream_test.js
const { CozeAPI } = require('@coze/api');

async function main() {
  const client = new CozeAPI({
    token: 'pat_JmVtS89Ru052QdVwrAMYDy2SHd2bRx2YUyti2vfxKELoUbVLv48tleBCRe2D4m0D',
    baseURL: 'https://api.coze.cn',
  });

  // Kick off the workflow and get the async stream iterator.
  const stream = await client.workflows.runs.stream({
    workflow_id: '7574737601769340934',
    parameters: {
      pic_input:
        'https://p9-bot-workflow-sign.byteimg.com/tos-cn-i-mdko3gqilj/35995368bd5f4dc48afbe10d3ae24606.png~tplv-mdko3gqilj-image.image?rk3s=81d4c505&x-expires=1794738028&x-signature=D3Z7a2LCcrjCwrXSvp2HXgXp4aM%3D&x-wf-file_name=%E5%B1%8F%E5%B9%95%E6%88%AA%E5%9B%BE+2025-11-20+115901.png',
      process_input: 'vscode，chrome，feishu',
      text_input: '',
    },
  });

  console.log('--- Stream begin ---');
  try {
    for await (const packet of stream) {
      const { event, data = {}, code, msg, error_code, error_message, id } = packet;

      console.log(`event#${id ?? '?'}: ${event}`);
      if (event === 'Error') {
        console.error('error_code:', error_code ?? code, 'message:', error_message ?? msg);
        break;
      }

      if (data.content) console.log('content:', data.content);
      if (data.debug_url) console.log('debug_url:', data.debug_url);
      if (data.node_title) console.log('node:', data.node_title, 'node_id:', data.node_id);
      if (data.node_is_finish) console.log('node_is_finish:', data.node_is_finish);
    }
  } catch (err) {
    console.error('Stream failed:', err);
  } finally {
    console.log('--- Stream end ---');
  }
}

main();
