import React from 'react'
import Music from './Music'
import Contact from './Contact'

const NavItem = ({ a, label }) => <a className="cpf-header-nav__item" href={a}>{label}</a>
const LeadNavItem = ({ a, label }) => <a className="cpf-header-nav__item cpf-header-nav__item--lead" href="index.html">{label}</a>

const SectionHeader = ({ id, label }) => <h1 id={id || ''}>{label}</h1>

const Home = props => (
  <React.Fragment>
    <nav className="cpf-header-nav">
      <div className="cpf-container">
        <LeadNavItem label="ChipPanFire" />
        <NavItem a="index.html#music" label="Music" />
        <NavItem a="index.html#contact" label="Contact" />
      </div>
    </nav>
    <div className="cpf-container">
      <p>
        Hi, I
        'm Will Crossland, a musician, software developer and beer-user from northern England. I made this site as a home for the music/software I've made, and to provide a safe space to explore frontend development away from the day job.
      </p>
      <Music />
      <Contact />
    </div>
  </React.Fragment>
)

export default Home
