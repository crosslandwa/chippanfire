import React from 'react'
import SectionHeader from './SectionHeader'
import ExternalLink from '../external-link'

const Contact = props => (
  <React.Fragment>
    <SectionHeader id="contact" label="Contact" />
    <p>
      Find me on <ExternalLink href="https://github.com/crosslandwa">Github</ExternalLink>
    </p>
  </React.Fragment>
)

export default Contact
