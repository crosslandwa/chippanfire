import React from 'react'
import ReactDOMServer from 'react-dom/server'
import Home from './home'
import { readFile, writeFile } from './files/'

const html = css => `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="ie=edge">
    <title>chippanfire.com</title>
    <link rel="icon" href="favicon.ico">
    <style>
${css}
    </style>
  </head>
  <body>
    ${ReactDOMServer.renderToStaticMarkup(<Home />)}
  </body>
</html>
`

readFile('./app.css')
  .then(html)
  .then(writeFile('../dist/index.html'))
