const { renderTemplates } = require('./chippanfire.js')

function writeToBuildDirectory (renderedTemplates) {
  console.log('writing')
}

renderTemplates()
  .then(writeToBuildDirectory)
  .then(() => { console.log('Template rendering complete') }, console.log)
