// Simple probe script to inspect Coze streaming payloads.
// Usage: node coze_probe.js
const { CozeAPI } = require('@coze/api');

async function main() {
  const client = new CozeAPI({
    token: 'pat_SjJwSXRU8hpJeHLq2Q71lhiBi53dy5wGJXTsLuRMhDwuCSFYxpCLYP6SF3TgkHs1',
    baseURL: 'https://api.coze.cn',
  });

  const stream = await client.workflows.runs.stream({
    workflow_id: '7574737601769340934',
    parameters: {
      pic_input:
        'https://p26-bot-workflow-sign.byteimg.com/tos-cn-i-mdko3gqilj/753475da83e542e8b07f430f8085692f.png~tplv-mdko3gqilj-image.image?rk3s=81d4c505&x-expires=1795962260&x-signature=%2BfaGLUG8KSPBAaltGV%2FugafKdl0%3D&x-wf-file_name=%E5%B1%8F%E5%B9%95%E6%88%AA%E5%9B%BE+2025-06-28+202506.png',
      process_input: 'chrome,iqyi,bilibili',
      text_input: '',
    },
  });

  console.log('--- stream start ---');
  let idx = 0;
  for await (const packet of stream) {
    const header = `#${idx++} event=${packet.event}`;
    console.log(header);
    try {
      console.log(JSON.stringify(packet, null, 2));
    } catch (err) {
      console.log(packet);
    }
    if (packet.event === 'Error' || packet.event === 'Done' || packet.event === 'Interrupt') {
      break;
    }
  }
  console.log('--- stream end ---');
}

main().catch((err) => {
  console.error('Probe failed:', err);
});
