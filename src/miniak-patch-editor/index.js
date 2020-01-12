import React from 'react'
import ExternalLink from '../external-link'
import PageTemplate from '../PageTemplate'

const MiniakPatchEditor = () => (
  <PageTemplate>
    <h1 className="cpf-header">Miniak Patch Editor</h1>
    <p>
      <ExternalLink href="https://www.ableton.com/maxforlive">Max For Live</ExternalLink> devices I have made
      Patch editor/management tool for the <ExternalLink href="https://www.akaipro.com/miniak">Akai Miniak</ExternalLink>
      / <ExternalLink href="http://www.vintagesynth.com/misc/micron.php">Alesis Micron</ExternalLink> synthesiser
      <img src="miniak-patch-editor.jpg" alt="miniak patch editor screenshot" className="cpf-image cpf-image--fit-to-width" />
    </p>
    <h3 className="cpf-header cpf-header--small">
      <ExternalLink href="https://github.com/crosslandwa/miniak-patch-editor">Download from Github</ExternalLink>
    </h3>
    <p>Miniak Patch Editor is a <ExternalLink href="https://www.cycling74.com/">MaxMSP</ExternalLink> patch that can be downloaded and used <em>for free!</em></p>
    <p>The download includes:</p>
    <ul>
      <li>The Miniak Patch Editor MaxMSP patch</li>
      <li>A template for controlling Miniak Patch Editor from the popular iDevice software
        <ExternalLink href="https://hexler.net/software/touchosc">TouchOSC</ExternalLink>, created by <em>Adam
        Neddo</em> (see documentation for contact details). <em>Note the template controls the editor
        software (which updates the Miniak in realtime), but not the Miniak directly</em>
      </li>
      <li>Documentation for setup and use</li>
      <li>A folder of example patches</li>
    </ul>
  </PageTemplate>
)

export default MiniakPatchEditor
