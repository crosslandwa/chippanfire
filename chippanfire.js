const { renderFile } = require('ejs')
const renderPage = page => new Promise((resolve, reject) => {
  renderFile('templates/page.ejs', page, {}, (err, str) => err ? reject(err) : resolve({ content: str, file: page.file }))
})
const addHref = page => page.href ? page : Object.assign({}, page, { href: page.file })
const navItem = page => Object.assign({}, { href: addHref(page).href, title: page.content.title, external: !!page.external })

const musicPage = {
  content: { title: 'Music' },
  file: 'music.html',
  template: 'content-music'
}

const m4lPage = {
  content: { title: 'Max For Live Devices' },
  file: 'max-for-live-devices.html',
  strapline: 'A collection of Max For Live devices I have made',
  template: 'content-m4l-devices'
}

const kmkScriptPage = {
  content: { title: 'KMK Control Script' },
  external: true,
  href: 'https://github.com/crosslandwa/kmkControl',
  strapline: 'In-depth control of Ableton Live using the Korg Microkontrol'
}

const cpfPage = {
  content: { title: 'ChipPanFire Source' },
  external: true,
  href: 'https://github.com/crosslandwa/chippanfire-site',
  strapline: 'Totally meta, see the source code for generating this site!'
}

const wacNetworkMidiPage = {
  content: {
    title: 'Wac Network MIDI',
    github: 'https://github.com/crosslandwa/wac-network-midi'

  },
  file: 'wac-network-midi.html',
  strapline: 'Cross-platform (Win/OS X) tool for transmitting MIDI between computers',
  template: 'content-wac-network-midi'
}

const miniakPatchEditorPage = {
  content: {
    title: 'Miniak Patch Editor',
    github: 'https://github.com/crosslandwa/miniak-patch-editor',
  },
  file: 'miniak-patch-editor.html',
  strapline: 'Patch editor/management tool for the Akai Miniak synthesiser',
  template: 'content-miniak-patch-editor'
}

const metronomePage = {
  content: { title: 'Metronome' },
  file: 'metronome.html',
  strapline: "An online metronome fo' keepin' yo' shit tight!",
  scripts: ['metronome-app/metronome.js', 'metronome-app/metronome-styles.css'],
  template: 'content-metronome'
}

const pushWrapperPage = {
  content: { title: 'Push Wrapper' },
  file: 'push-wrapper.html',
  strapline: 'An online drum machine controlled by your Ableton Push (mk1)',
  scripts: ['push-wrapper-app/push-wrapper-example.js', 'push-wrapper-app/push-wrapper-example-styles.css'],
  template: 'content-push-wrapper'
}

const softwarePage = {
  content: {
    linked: [ pushWrapperPage, metronomePage, m4lPage, wacNetworkMidiPage, miniakPatchEditorPage, kmkScriptPage, cpfPage ].map(addHref),
    title: 'Software'
  },
  file: 'software.html',
  template: 'content-software'
}

const homePage =  {
  content: {
    music: { href: musicPage.file },
    software: { href: softwarePage.file }
  },
  file: 'index.html',
  template: 'content-index'
}

const contactPage = {
  content: { title: 'Contact' },
  file: 'contact.html',
  template: 'content-contact'
}

const errorPage = {
  content: {
    title: 'Not Found 40404040404'
  },
  file: 'nice-error.html',
  scripts: ['assets/error-page.js'],
  template: 'content-error'
}

const baseData = {
  image: path => `assets/images/${path}`,
  navigation: {
    homePageUrl: homePage.file,
    items: [
      navItem(musicPage),
      Object.assign(navItem(softwarePage), { dropdown: softwarePage.content.linked.map(navItem) }),
      navItem(contactPage)
    ]
  }
}

const pages = [ homePage, errorPage, musicPage,
  softwarePage, m4lPage, contactPage, wacNetworkMidiPage,
  miniakPatchEditorPage, metronomePage, pushWrapperPage ]
  .map(page => Object.assign({}, addHref(page), baseData))

module.exports = {
  pages: pages.map(page => { return { file: page.file, scripts: page.scripts || [] } }),
  renderTemplates: () => Promise.all(pages.map(renderPage))
}
