import React from 'react'
import Music from './Music'
import Contact from './Contact'
import Software from './Software'
import PageTemplate from '../PageTemplate'

const Home = props => (
  <PageTemplate>
    <Music />
    <Software />
    <Contact />
  </PageTemplate>
)

export default Home
