import fs from 'fs'

export const readFile = filename => new Promise((resolve, reject) => fs.readFile(
  filename,
  (err, data) => err ? reject(err) : resolve(data.toString('utf-8'))
))

export const writeFile = filename => content => new Promise((resolve, reject) => fs.writeFile(
  filename,
  content,
  'utf8',
  (err, data) => err ? reject(err) : resolve(content)
))
