import React from 'react'
import ReactDOMServer from 'react-dom/server'
import Home from './home'
import MaxForLiveDevices from './max-for-live'
import MiniakPatchEditor from './miniak-patch-editor'
import WacNetworkMidi from './wac-network-midi'
import Error from './error'
import { readFile, writeFile } from './files/'

const html = css => component => `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="ie=edge">
    <title>chippanfire.com</title>
    <link rel="icon" href="favicon.ico" type="image/x-icon" />
    <style>
${css}
    </style>
  </head>
  <body>
    ${ReactDOMServer.renderToStaticMarkup(component)}
  </body>
</html>
`

readFile('./app.css')
  .then(html)
  .then(render => Promise.all([
    Promise.resolve(<Home />).then(render).then(writeFile('../dist/index.html')),
    Promise.resolve(<Error />).then(render).then(writeFile('../dist/error.html')),
    Promise.resolve(<MaxForLiveDevices />).then(render).then(writeFile('../dist/max-for-live-devices.html')),
    Promise.resolve(<MiniakPatchEditor />).then(render).then(writeFile('../dist/miniak-patch-editor.html')),
    Promise.resolve(<WacNetworkMidi />).then(render).then(writeFile('../dist/wac-network-midi.html')),
    Promise.resolve('User-agent: *\nDisallow:').then(writeFile('../dist/robots.txt'))
  ]))
