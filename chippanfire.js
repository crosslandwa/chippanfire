const ejs = require('ejs')
const fs = require('fs')

function renderPage(page) {
  return new Promise((resolve, reject) => {
    ejs.renderFile('templates/page.ejs', page || {}, {}, function(err, str) {
      return err ? reject(err) : resolve({ content: str, file: page.file })
    })
  })
}

absoluteLinks = false;

const musicPage = {
  href: 'https://www.chippanfire.com/music.html',
  content: {
    title: 'Music'
  }
}

const softwarePage = {
  href: 'https://www.chippanfire.com/software.html',
  content: {
    title: 'Software'
  }
}

const homePage =  {
  href: 'https://www.chippanfire.com/index.html',
  template: 'index',
  content: {
    music: { href: musicPage.href },
    software: { href: softwarePage.href }
  }
}

const errorPage = {
  template: 'error',
  content: {
    title: 'Not Found 40404040404'
  }
}

const baseData = {
  assetsBaseUrl: absoluteLinks ? 'https://chippanfire.com/assets' : 'assets',
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
