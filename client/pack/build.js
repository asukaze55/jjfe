import { build } from './asukaze_builder.js';

const config = {
  source: {
    entryPoint: 'jjfe.js',
    path: '..'
  },
  noStrict: true,
  target: {
    file: 'jjfe_min.js',
    path: 'target'
  }
};

build(config).catch((error) => {
  console.error(error);
  process.exit(1);
});
