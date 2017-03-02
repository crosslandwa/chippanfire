module.exports = {
  fileMap: [/* sync. returns list of files with 'chunks' an template file name */],
  renderTemplates: () => { console.log('rendering'); return Promise.resolve([])/* async. returns map of renders ejs templates + file names */ }
}
