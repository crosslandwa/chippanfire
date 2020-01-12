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
    <p>
      I've made some (free!) software to help me make music, mostly for <ExternalLink href="https://www.cycling74.com/">MaxMSP</ExternalLink> and <ExternalLink href="https://www.ableton.com">Ableton Live</ExternalLink>, mostly. Some of it is available here, some of it is available from the below Github links
    </p>
    <div className="cpf-grid__row">
      <PanelExternal
        label="Push Wrapper"
        strap="Interface with your Ableton Push (mk1) from a web browser"
        href="https://github.com/crosslandwa/push-wrapper"
      />
      <Panel
        label="Max For Live Devices"
        strap="A collection of Max For Live devices I have made"
        href="max-for-live-devices.html"
      />
      <Panel
        label="Wac Network MIDI"
        strap="Cross-platform (Win/OS X) tool for transmitting MIDI between computers"
        href="wac-network-midi.html"
      />
    </div>
    <div className="cpf-grid__row">
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
      <PanelExternal
        label="ChipPanFire"
        strap="Totally meta, see the source code for generating this site!"
        href="https://github.com/crosslandwa/chippanfire-site"
      />
    </div>
  </React.Fragment>
)

export default Software
