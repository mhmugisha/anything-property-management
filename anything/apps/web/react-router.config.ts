import type { Config } from '@react-router/dev/config';

export default {
  appDirectory: './src/app',
  ssr: true,
  serverBundles({ branch }) {
    // All routes use a single server bundle
    return 'server';
  },
} satisfies Config;
