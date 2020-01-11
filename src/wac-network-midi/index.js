import React from 'react'
import ExternalLink from '../external-link'
import PageTemplate from '../PageTemplate'

const WacNetworkMidi = () => (
  <PageTemplate>
    <h1 className="cpf-header">Wac Network MIDI</h1>
    <p>
      Cross-platform (Win/OS X) tool for transmitting MIDI from one computer to another via a network, without hardware MIDI interfaces
      <img src="wac-network-midi.png" alt="wac network midi screenshot" className="cpf-image cpf-image--fit-to-width" />
    </p>
    <h3 className="cpf-header cpf-header--small">
      <ExternalLink href="https://github.com/crosslandwa/wac-network-midi">Download from Github</ExternalLink>
    </h3>
    <p>Wac Network MIDI is a <ExternalLink href="https://www.cycling74.com/">MaxMSP</ExternalLink> patch that can be downloaded and used <em>for free!</em></p>
    <p>The download includes:</p>
    <ul>
      <li>The Wac Network MIDI MaxMSP patch</li>
      <li>Documentation for setup and use</li>
    </ul>
  </PageTemplate>
)

export default WacNetworkMidi
