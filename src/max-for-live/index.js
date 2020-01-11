import React from 'react'
import PageTemplate from '../PageTemplate'
import ExternalLink from '../external-link'

const Device = ({ children, documentation, download, downloadInfo, id, strapline, title, versionHistory }) => {
  return (
    <>
      <h2 id={id} className="cpf-header">{title}</h2>
      {strapline}
      <div className="cpf-grid__row">
        <div className={versionHistory ? 'cpf-grid__column-one-half' : ''}>
          <h3 className="cpf-header cpf-header--small">Download</h3>
          {downloadInfo}
          <p>It is known to work with Ableton Live 8, but has not been updated for a very loooong time.</p>
          <a href={download} >
            <button type="submit" className="cpf-btn">Download</button>
          </a>
          <form action={documentation} method="GET">
            <button type="submit" className="cpf-btn cpf-btn--secondary">Download Documentation</button>
          </form>
        </div>
        {versionHistory && (
          <div className="cpf-grid__column-one-half">
            <h3 className="cpf-header cpf-header--small">Version History</h3>
            {versionHistory}
          </div>
        )}
      </div>
    </>
  )
}

const MaxForLiveDevices = props => (
  <PageTemplate>
    <h1 className="cpf-header">Max For Live Devices</h1>
    <p><ExternalLink href="https://www.ableton.com/maxforlive">Max For Live</ExternalLink> devices I have made</p>

    <Device
      id="device-snapshot-manager"
      title="Device Snapshot Manager"
      download="m4l-device-snapshot-manager-v1-1-1.zip"
      documentation="DeviceSnapshotManager.pdf"
      strapline={(
        <p>
          Adds the ability to store and recall ‘snapshots’ of Ableton Live devices in realtime.
          <img src="dsm-screenshot.jpg" alt="Device Snapshot Manager" className="cpf-image cpf-image--fit-to-width"/>
        </p>
      )}
      downloadInfo={(
        <p>Device Snapshot Manager is distributed as two fully editable Max For Live .amxd files – one MIDI effect and one Audio effect.</p>
      )}
      versionHistory={(
        <>
        <h4>1.1.1</h4>
          <ul>
            <li>Fixed bug where snapshots with more than 128 parameters were not fully recalled</li>
            <li>Improved speed of JS-based Live API interactions</li>
          </ul>
          <h4>1.1.0</h4>
          <ul>
            <li> Added ability to name snapshots</li>
          </ul>
        </>
      )}
    />

    <hr className="cpf-section-break"/>

    <Device
      id="where-am-i"
      title="Where Am I"
      download="m4l-where-am-i-v1-1-0.zip"
      documentation="WhereAmI.pdf"
      strapline={(
        <p>
          Displays Live API information for the currently selected element of the Ableton Live interface.
          <img src="wai-screenshot.jpg" alt="Where Am I" className="cpf-image cpf-image--fit-to-width"/>
        </p>
      )}
      downloadInfo={(
        <p>Where Am I is distributed as a free Max For Live Audio effect (the download also includes documentation). The downloaded .amxd file is fully editable and re-usable.</p>
      )}
      versionHistory={(
        <>
          <h4>1.1.0</h4>
          <ul>
            <li>Device no longer fills Lives undo buffer when observing changes in selected track/device/etc</li>
          </ul>
        </>
      )}
    />

    <hr className="cpf-section-break"/>

    <Device
      id="midi-clip-modulo"
      title="MIDI Clip Modulo"
      download="m4l-midi-clip-modulo-v1-0-0.zip"
      documentation="MidiClipModulo.pdf"
      strapline={(
        <p>
          Device that adds extra capabilities to note editing in Ableton Live's MIDI clips
          <img src="midi-clip-modulo.jpg" alt="MIDI Clip Modulo" className="cpf-image cpf-image--fit-to-width"/>
        </p>
      )}
      downloadInfo={(
        <p>Midi Clip Modulo's functionality can be mapped to keyboard/MIDI shortcuts to quickly integrate into your clip editing workflow. The device always makes edits to the currently selected MIDI clip, and all edits are fully undo-able via Lives undo function</p>
      )}
    />

  </PageTemplate>
)

export default MaxForLiveDevices
