const HtmlWebpackPlugin = require('html-webpack-plugin')
const { pages } = require('./chippanfire.js')
const webpack = require('webpack')

const afterLastSlash = x => x.split('/')[x.split('/').length - 1] || x
const beforeLastDot = x => x.split('.')[x.split('.').length - 2]
const scriptName = x => beforeLastDot(afterLastSlash(x))

const scripts = pages.reduce((acc, page) => acc.concat(page.scripts) , []).concat('./assets/common.js')

module.exports = {
  entry: scripts.reduce((acc, script) => Object.assign(acc, { [scriptName(script)]: `./${script}` }), {}),
  output: {
    filename: '[name]-[hash].js',
    path: __dirname + '/dist/assets'
  },
  plugins: [
    new webpack.optimize.UglifyJsPlugin({
      compress: {
        warnings: false
      }
    })
  ].concat(pages.map(page => new HtmlWebpackPlugin({
    chunks: ['common'].concat(page.scripts.map(scriptName)),
    filename: `../${page.file}`,
    inject: 'head',
    template: `./build/${page.file}`
  }))),
  module: {
    rules: [{
        test: /\.css$/,
        loader: 'style-loader!css-loader'
      },
      {
        test: /\.eot(\?v=\d+\.\d+\.\d+)?$/,
        loader: "file-loader?outputPath=fonts/"
      },
      {
        test: /\.(woff|woff2)$/,
        loader: "url-loader?prefix=font/&limit=5000&outputPath=fonts/"
      },
      {
        test: /\.ttf(\?v=\d+\.\d+\.\d+)?$/,
        loader: "url-loader?limit=10000&mimetype=application/octet-stream&outputPath=fonts/"
      },
      {
        test: /\.svg(\?v=\d+\.\d+\.\d+)?$/,
        loader: "url-loader?limit=10000&mimetype=image/svg+xml&outputPath=images/"
      },
      {
        test: /\.(png|jpg)$/,
        loader: 'url-loader?limit=8192&outputPath=images/'
      },
      {
        test: /\.js$/,
        exclude: /(node_modules|bower_components)/,
        loader: 'babel-loader',
        query: {
          presets: ['es2015']
        }
      }
    ]
  }
}
