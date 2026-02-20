const AsukazePlugin = require('./asukaze_plugin.js');
const path = require('path');

module.exports = {
  mode: 'production',
  entry: path.resolve(__dirname, '../jjfe.js'),
  module: {
    rules: [{
      test: /.js$/,
      loader: path.resolve(__dirname, 'asukaze_loader.js'),
    }],
  },
  plugins: [new AsukazePlugin()],
  output: {
    path: path.resolve(__dirname, 'target'),
    filename: 'jjfe_min.js'
  }
};
