import React from 'react'
import SectionHeader from './SectionHeader'
import ExternalLink from '../external-link'

const Contact = props => (
  <React.Fragment>
    <SectionHeader id="contact" label="Contact" />
    <p>
      You can find me in these places:
    </p>
    <ul>
      <li>
        <ExternalLink href="https://github.com/crosslandwa">Github</ExternalLink>
      </li>
    </ul>
  </React.Fragment>
)

export default Contact
