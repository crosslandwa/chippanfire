import React from 'react'
import SectionHeader from './SectionHeader'
import ExternalLink from '../external-link'

const Panel = ({ href, label, strap }) => (
  <div className="cpf-grid__column-one-third">
    <div className="cpf-software__panel">
      <h2 className="cpf-header--small">
        {href ? <a className="cpf-link" href={href}>{label}</a> : label}
      </h2>
      <p>{strap}</p>
    </div>
  </div>
)

const PanelExternal = ({ href, label, strap }) => (
  <div className="cpf-grid__column-one-third">
    <div className="cpf-software__panel">
      <h2 className="cpf-header--small">
        <ExternalLink href={href}>{label}</ExternalLink>
      </h2>
      <p>{strap}</p>
    </div>
  </div>
)

const Software = props => (
  <React.Fragment>
    <SectionHeader id="software" label="Software" />
    <div className="cpf-grid__row">
      <PanelExternal
        label="Push Wrapper"
        strap="Interface with your Ableton Push (mk1) from a web browser"
        href="https://github.com/crosslandwa/push-wrapper"
      />
      <PanelExternal
        label="Metronome"
        strap="An online metronome built with React, Redux and the Web Audio API"
        href="https://crosslandwa.github.io/metronome/"
      />
      <Panel
        label="Max For Live Devices"
        strap="A collection of (free) Max For Live devices I have made"
        href="max-for-live-devices.html"
      />
    </div>
    <div className="cpf-grid__row">
      <Panel
        label="Wac Network MIDI"
        strap="Cross-platform (Win/OS X) tool for transmitting MIDI between computers"
        href="wac-network-midi.html"
      />
      <Panel
        label="Miniak Patch Editor"
        strap="Patch editor/management tool for the Akai Miniak synthesiser"
        href="miniak-patch-editor.html"
      />
      <PanelExternal
        label="KMK Control Script"
        strap="In-depth control of Ableton Live using the Korg Microkontrol"
        href="https://github.com/crosslandwa/kmkControl"
      />
    </div>
    <div className="cpf-grid__row">
      <PanelExternal
        label="Dude Up"
        strap={<>A web-app for settling up the cost of group activities. See the <ExternalLink href="https://github.com/crosslandwa/dudeup">source code here.</ExternalLink></>}
        href="https://crosslandwa.github.io/dudeup/"
      />
      <PanelExternal
        label="ChipPanFire"
        strap="Totally meta, see the source code for generating this site!"
        href="https://github.com/crosslandwa/chippanfire"
      />
    </div>
  </React.Fragment>
)

export default Software
