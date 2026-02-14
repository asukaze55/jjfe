const AsukazePlugin = require('./asukaze_plugin.js');
const path = require('path');

const now = new Date();
const date = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0');
const finalFileName = `jjfe_min_${date}.js`;

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
    path: path.resolve(__dirname, '../../server/resources/'),
    filename: finalFileName
  }
};
