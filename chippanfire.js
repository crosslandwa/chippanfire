const { renderFile } = require('ejs')
const fs = require('fs')
const absoluteLinks = true
const href = path => (absoluteLinks ? '' : 'https://www.chippanfire.com/') + path
const renderPage = page => new Promise((resolve, reject) => {
  renderFile('templates/page.ejs', page, {}, (err, str) => err ? reject(err) : resolve({ content: str, file: page.file }))
})


const musicPage = {
  content: {
    title: 'Music'
  },
  href: href('music.html'),
  template: 'music'
}

const m4lPage = {
  content: {
    title: 'Max For Live Devices'
  },
  href: href('max-for-live-devices.html'),
  strapline: 'A collection of Max For Live devices I have made',
  template: 'm4l-devices'
}

const softwarePage = {
  content: {
    linked: [ m4lPage ],
    title: 'Software'
  },
  href: href('software.html'),
  template: 'software'
}

const homePage =  {
  content: {
    music: { href: musicPage.href },
    software: { href: softwarePage.href }
  },
  href: href('index.html'),
  template: 'index'
}

const errorPage = {
  content: {
    title: 'Not Found 40404040404'
  },
  href: href('error.html'),
  template: 'error'
}

const navItem = page => Object.assign({ href: page.href, title: page.content.title })

const baseData = {
  assetsBaseUrl: href('assets'),
  image: path => `${href('assets/images')}/${path}`,
  navigation: {
    homePageUrl: homePage.href,
    items: [
      navItem(musicPage),
      Object.assign(navItem(softwarePage), { dropdown: [navItem(m4lPage)] })
    ]
  }
}

const pages = [
  Object.assign({}, baseData, homePage, { file: 'index.html' }),
  Object.assign({}, baseData, errorPage, { file: 'error.html', scripts: ['assets/error-page.js']}),
  Object.assign({}, baseData, musicPage, { file: 'music.html' }),
  Object.assign({}, baseData, softwarePage, { file: 'software.html' }),
  Object.assign({}, baseData, m4lPage, { file: 'max-for-live-devices.html' }),
]

module.exports = {
  pages: pages.map(page => { return { file: page.file, scripts: page.scripts || [] } }),
  renderTemplates: () => Promise.all(pages.map(renderPage))
}
