const { renderFile } = require('ejs')
const fs = require('fs')
const absoluteLinks = true;
const href = path => (absoluteLinks ? '' : 'https://www.chippanfire.com/') + path
const renderPage = page => new Promise((resolve, reject) => {
  renderFile('templates/page.ejs', page, {}, (err, str) => err ? reject(err) : resolve({ content: str, file: page.file }))
})


const musicPage = {
  href: href('music.html'),
  content: {
    title: 'Music'
  }
}

const softwarePage = {
  href: href('software.html'),
  content: {
    title: 'Software'
  }
}

const homePage =  {
  href: href('index.html'),
  template: 'index',
  content: {
    music: { href: musicPage.href },
    software: { href: softwarePage.href }
  }
}

const errorPage = {
  href: href('error.html'),
  template: 'error',
  content: {
    title: 'Not Found 40404040404'
  }
}

const baseData = {
  assetsBaseUrl: href('assets'),
  navigation: {
    homePageUrl: homePage.href,
    items: [
      { href: musicPage.href, title: musicPage.content.title }
    ]
  }
}

const pages = [
  Object.assign({}, baseData, homePage, { file: 'index.html' }),
  Object.assign({}, baseData, errorPage, { file: 'error.html' })
]

module.exports = {
  fileMap: [/* sync. returns list of files with 'chunks' an template file name */],
  renderTemplates: () => Promise.all(pages.map(renderPage))
}
