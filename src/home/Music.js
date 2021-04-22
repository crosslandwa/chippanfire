import React from 'react'
import SectionHeader from './SectionHeader'
import ExternalLink from '../external-link'

const Music = props => (
  <>
    <SectionHeader id="music" label="Music" />

    <h2 className="cpf-header--small">Dry Stone Will</h2>
    <p>Dark pop, an English folk lilt and lush guitar-led backing</p>
    <iframe className="cpf-music-player__iframe--bandcamp" src="https://bandcamp.com/EmbeddedPlayer/album=3956288530/size=large/bgcol=ffffff/linkcol=63b2cc/transparent=true/" seamless>
      <a href="https://drystonewill.bandcamp.com/album/at-once-easily">at once easily by Dry Stone Will</a>
    </iframe>

    <h2 className="cpf-header--small">Socco Chico</h2>
    <p>I make some music (sometimes with <ExternalLink href="https://soundcloud.com/adamparkinson">Adam Parkinson</ExternalLink>) for the dancefloor</p>
    <iframe className="cpf-music-player__iframe--soundcloud" scrolling="no" frameBorder="no" src="https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/playlists/1644437&amp;auto_play=false&amp;hide_related=false&amp;show_comments=true&amp;show_user=true&amp;show_reposts=false&amp;visual=true"></iframe>

    <h2 className="cpf-header--small">Kilclinton</h2>
    <p>Disco synth jams and drum edits with Brett Lambe</p>
    <iframe className="cpf-music-player__iframe--soundcloud" scrolling="no" frameBorder="no" src="https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/playlists/87360&amp;auto_play=false&amp;hide_related=false&amp;show_comments=true&amp;show_user=true&amp;show_reposts=false&amp;visual=true"></iframe>
  </>
)

export default Music
