import React from 'react'
import Music from './Music'
import Contact from './Contact'
import Software from './Software'
import PageTemplate from '../PageTemplate'

const Home = props => (
  <PageTemplate>
    <p>
      Hi, I'm Will Crossland, a musician, software developer and beer-user from northern England. I made this site as a home for the music/software I've made, and to provide a safe space to explore frontend development away from the day job.
    </p>
    <Music />
    <Software />
    <Contact />
  </PageTemplate>
)

export default Home
