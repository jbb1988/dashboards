const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: {
    taskpane: './src/taskpane/index.tsx',
    commands: './src/commands/analyze.ts',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].bundle.js',
    clean: true,
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './public/taskpane.html',
      filename: 'taskpane.html',
      chunks: ['taskpane'],
    }),
    new HtmlWebpackPlugin({
      template: './public/commands.html',
      filename: 'commands.html',
      chunks: ['commands'],
    }),
  ],
  devServer: {
    static: {
      directory: path.join(__dirname, 'dist'),
    },
    port: 3001,
    https: true,
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  },
};
