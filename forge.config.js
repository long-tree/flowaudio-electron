const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

const isProd = process.env.NODE_ENV === 'production';

module.exports = {
  packagerConfig: {
    // 生产打包解包 @coze/api，避免 preload require 失败；开发模式不启用 asar 便于调试
    asar: isProd ? { unpackDir: 'node_modules/@coze/api' } : {},
  },
  rebuildConfig: {},
  makers: [
    { name: '@electron-forge/maker-squirrel', config: {} },
    { name: '@electron-forge/maker-zip', platforms: ['darwin'] },
    { name: '@electron-forge/maker-deb', config: {} },
    { name: '@electron-forge/maker-rpm', config: {} },
  ],

  plugins: [
    // Electron Fuses
    new FusesPlugin({
      version: FuseVersion.V1,
      // 允许 preload 使用 Node 环境
      [FuseV1Options.RunAsNode]: true,
      // 安全项
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: isProd,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: !isProd,
      [FuseV1Options.OnlyLoadAppFromAsar]: isProd,
    }),
  ],
};
