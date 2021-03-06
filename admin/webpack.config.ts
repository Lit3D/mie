import { resolve } from "path"
import * as zlib from "zlib"

import {
  Configuration,
  DefinePlugin,
  HotModuleReplacementPlugin,
  LoaderOptionsPlugin,
  ProgressPlugin,
  SourceMapDevToolPlugin,
} from "webpack"

import * as CompressionWebpackPlugin from "compression-webpack-plugin"
import * as HtmlWebpackPlugin from "html-webpack-plugin"
import * as MiniCssExtractPlugin from "mini-css-extract-plugin"
import * as ScriptExtHtmlWebpackPlugin from "script-ext-html-webpack-plugin"
import * as TerserWebpackPlugin from "terser-webpack-plugin"

const isProduction = process.env.NODE_ENV === "production"

const PATH = (...p: Array<string>) => resolve(__dirname, ...p)
const PKG = require("../package.json")
const ASSETS_URL = "/assets"
const STORAGE_KEY = "litPathList"

const postCSSPlugins = [
  require("postcss-import")(),
  require("postcss-gap-properties")(),
  require("postcss-color-rgb")(),
  require("autoprefixer")(),
  require("cssnano")({ preset: "default" }),
]

export default {
  name: PKG.name,

  mode: isProduction ? "production" : "development",
  target: "web",

  context: PATH("./src"),

  entry: {
    main: PATH("./src/main.ts"),
    polyfills: PATH("./src/polyfills.ts"),
    styles: PATH("./src/styles/index.css"),
  },

  resolve: {
    extensions: [".ts", ".mjs", ".js", ".json"],
    mainFields: [ "es2015", "browser", "module", "main"],
    symlinks: true,
  },

  output: {
    path: PATH("./artifacts"),
    publicPath: "/",
    filename: `js/[name].[hash:10].js`,
    crossOriginLoading: false,
    futureEmitAssets: true,
  },

  module: {
    rules: [{
      // === HTML ===
      test: /\.html$/i,
      use: [{
        loader: "raw-loader"
      }]
    },{
      // === Components styles ===
      test: /\.css$/i,
      exclude: [
        PATH("./src/styles"),
        PATH("./node_modules"),
      ],
      use: [{
        loader: "raw-loader",
      },{
        loader: "postcss-loader",
        options: {
          ident: "main",
          plugins: postCSSPlugins
        }
      }]
    },{
      // === Main page styles ===
      test: /\.css$/i,
      include: [
        PATH("./src/styles"),
        PATH("./node_modules"),
      ],
      use: [{
        loader: MiniCssExtractPlugin.loader,
      },{
        loader: "css-loader",
        options: {
          importLoaders: 1
        }
      },{
        loader: "postcss-loader",
        options: {
          ident: "main",
          plugins: postCSSPlugins
        }
      }]
    },{
      // === Typescript loader ===
      test: /\.tsx?$/,
      use: [{
        loader: "ts-loader",
      }]
    }],
  },

  plugins: [
    new ProgressPlugin(),

    new LoaderOptionsPlugin({
      debug: !isProduction,
      sourceMap: !isProduction,
      minimize: isProduction,
    }),

    new DefinePlugin({
      DEFINE_APP_NAME: JSON.stringify(PKG.name.trim()),
      DEFINE_APP_VERSION: JSON.stringify(PKG.version.trim()),
      DEFINE_DEBUG: JSON.stringify(!isProduction),
      DEFINE_ASSETS: JSON.stringify(ASSETS_URL.trim()),
      DEFINE_STORAGE_KEY: JSON.stringify(STORAGE_KEY.trim()),
    }),

    new MiniCssExtractPlugin({
      filename: "css/[name].css",
      chunkFilename: "css/[name].css",
    }),

    new HtmlWebpackPlugin({
      template: PATH("./src/index.html"),
      inject: "head",
      chunksSortMode: "manual",
      chunks: ["runtime", "polyfills", "vendor", "common", "styles", "main"],
    }),

    new ScriptExtHtmlWebpackPlugin({
      defaultAttribute: "defer"
    }),

  ].concat(isProduction ? [
    // === Production mode plugins ===
    new CompressionWebpackPlugin({
      test: /\.(css|js|json|html|svg)$/i,
      filename: "[path].gz",
      algorithm: "gzip",
      compressionOptions: { level: 9 }
    }),

    new CompressionWebpackPlugin({
      test: /\.(css|js|json|html|svg)$/i,
      filename: "[path].br",
      algorithm(input, _, callback) {
        return (<any>zlib).brotliCompress(input, {
          params: {
            [(<any>zlib).constants.BROTLI_PARAM_MODE]: (<any>zlib).constants.BROTLI_MODE_GENERIC,
            [(<any>zlib).constants.BROTLI_PARAM_QUALITY]: 11,
          }
        }, callback)
      }
    })
  ] : [
    // === Development mode plugins ===
    new SourceMapDevToolPlugin({
      filename: "[file].map",
      include: [/js$/, /css$/],
    }),

    new HotModuleReplacementPlugin(),
  ]),

  optimization: {
    noEmitOnErrors: true,
    runtimeChunk: "single",
    splitChunks: {
      maxAsyncRequests: Infinity,
      cacheGroups: {
        default: {
          chunks: "async",
          minChunks: 2,
          priority: 10,
        },
        common: {
          name: "common",
          chunks: "async",
          minChunks: 2,
          enforce: true,
          priority: 5,
        },
        vendors: false,
        vendor: {
          name: "vendor",
          chunks: "initial",
          enforce: true,
          test: (module: { nameForCondition?: Function }, chunks: Array<{ name: string }>) => {
            const moduleName = module.nameForCondition ? module.nameForCondition() : ""
            return /[\\/]node_modules[\\/]/.test(moduleName)
                && !chunks.some(({ name }) => name === "polyfills"
                                           || name === "styles"
                                )
            }
        },
      }
    },
    minimizer: [
      new TerserWebpackPlugin({
        parallel: true,
        sourceMap: false,
        cache: true,
        terserOptions: {
          ecma: 6,
          safari10: false,
          ie8: false,
          output: {
            ascii_only: true,
            comments: false,
            webkit: true,
          },
          compress: {
            pure_getters: true,
            passes: 3,
            global_defs: {
              ngDevMode: false,
              ngI18nClosureMode: false,
            },
          },
        },
      }),
    ],
  },

  performance: {
    hints: false,
  },

  node: false,
  profile: false,
  devtool: isProduction ? false : "cheap-eval-source-map",

  stats: "errors-warnings",

  devServer: {
    clientLogLevel: "warning",
    compress: isProduction,
    contentBase: PATH("./assets"),
    disableHostCheck: true,
    historyApiFallback: true,
    hot: !isProduction,
    progress: true,
    stats: "minimal",
  }

} as Configuration