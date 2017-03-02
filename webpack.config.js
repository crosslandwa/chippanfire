const HtmlWebpackPlugin = require('html-webpack-plugin')
const { pages } = require('./chippanfire.js')
const webpack = require('webpack')

module.exports = {
  entry: {
    common: './assets/common.js',
  },
  output: {
    filename: '[name].js',
    path: __dirname + '/dist'
  },
  plugins: [
    new webpack.optimize.UglifyJsPlugin({
      compress: {
        warnings: false
      }
    })
  ].concat(pages.map(page => new HtmlWebpackPlugin({
    chunks: ['common'],
    filename: page,
    template: `./build/${page}`
  }))),
  module: {
    rules: [{
        test: /\.css$/,
        loader: 'style-loader!css-loader'
      },
      {
        test: /\.eot(\?v=\d+\.\d+\.\d+)?$/,
        loader: "file-loader"
      },
      {
        test: /\.(woff|woff2)$/,
        loader: "url-loader?prefix=font/&limit=5000"
      },
      {
        test: /\.ttf(\?v=\d+\.\d+\.\d+)?$/,
        loader: "url-loader?limit=10000&mimetype=application/octet-stream"
      },
      {
        test: /\.svg(\?v=\d+\.\d+\.\d+)?$/,
        loader: "url-loader?limit=10000&mimetype=image/svg+xml"
      },
      {
        test: /\.(png|jpg)$/,
        loader: 'url-loader?limit=8192'
      }
    ]
  }
}
