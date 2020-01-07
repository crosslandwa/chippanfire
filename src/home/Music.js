import React from 'react'
import SectionHeader from './SectionHeader'
import ExternalLink from '../external-link'

const Music = props => (
  <React.Fragment>
    <SectionHeader id="music" label="Music" />
    <div className="cpf-grid__row">
      <div className="cpf-grid__column-one-third">
        <h2 className="cpf-header--small">Socco Chico</h2>
        <p>I make some music (sometimes with <ExternalLink href="https://soundcloud.com/adamparkinson">Adam Parkinson</ExternalLink>) for the dancefloor</p>
        <iframe width="100%" height="450" scrolling="no" frameBorder="no" src="https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/playlists/1644437&amp;auto_play=false&amp;hide_related=false&amp;show_comments=true&amp;show_user=true&amp;show_reposts=false&amp;visual=true"></iframe>
      </div>
      <div className="cpf-grid__column-one-third">
        <h2 className="cpf-header--small">Kilclinton</h2>
        <p>Disco synth jams and drum edits by Brett Lambe and I</p>
        <iframe width="100%" height="450" scrolling="no" frameBorder="no" src="https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/playlists/87360&amp;auto_play=false&amp;hide_related=false&amp;show_comments=true&amp;show_user=true&amp;show_reposts=false&amp;visual=true"></iframe>
      </div>
      <div className="cpf-grid__column-one-third">
        <h2 className="cpf-header--small">Carson Brent</h2>
        <p>My wife sings and I play guitar/sing</p>
        <p>We used to gig around Bristol many moons ago. We've played at friends' weddings (this is fun). One day I plan on making some new recordings...</p>
        <img className="cpf-image--full-width" src="carson-brent.jpg" alt="Carson Brent image" />
      </div>
    </div>
  </React.Fragment>
)

export default Music
