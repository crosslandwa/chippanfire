const { writeFile } = require('fs')
const { renderTemplates } = require('./chippanfire.js')

function writeToBuildDirectory (renderedTemplates) {
  return Promise.all(renderedTemplates.map(writeToFile))
}

function writeToFile(template) {
  return new Promise((resolve, reject) => {
    writeFile(`./build/${template.file}`, template.content, function(err) {
      return err ? reject(err) : resolve()
    })
  })
}

renderTemplates()
  .then(writeToBuildDirectory)
  .then(() => { console.log('Template rendering complete') }, e => { console.log(e); process.exit(1) })
