/** Only explicitly public build identifiers are exported, never environment values. */
export function createReleaseMetadata(env = process.env, now = new Date()) {
  const candidate = env.VERCEL_GIT_COMMIT_SHA || '';
  const revision = /^[a-f0-9]{7,40}$/i.test(candidate) ? candidate.toLowerCase() : 'local';
  const builtAt = now.toISOString();
  return { id: `${revision}-${builtAt.replace(/\D/g, '')}`, revision, builtAt };
}

export function releaseMetadataPlugin(options = {}) {
  const metadata = createReleaseMetadata(options.env, options.now);
  return {
    name: 'pazartarla-release-metadata',
    config() {
      return { define: { __PAZARTARLA_BUILD_ID__: JSON.stringify(metadata.id) } };
    },
    transformIndexHtml() {
      return [
        { tag: 'meta', attrs: { name: 'pazartarla-build-id', content: metadata.id }, injectTo: 'head' },
        { tag: 'meta', attrs: { name: 'pazartarla-built-at', content: metadata.builtAt }, injectTo: 'head' },
      ];
    },
    generateBundle(_options, bundle) {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ ...metadata, assets: Object.keys(bundle).sort() }, null, 2) + '\n',
      });
    },
  };
}