module.exports = {
  fileMap: [/* sync. returns list of files with 'chunks' an template file name */],
  renderTemplates: () => Promise.resolve([{ file: 'a.txt', content: 'aaa' }, { file: 'b.txt', content: 'bbb' }])
}
