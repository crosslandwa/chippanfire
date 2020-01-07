import React from 'react'

const ExternalLink = ({ href, children }) => (
  <a className="cpf-link" target="_blank" href={href}>{children}<i className="cpf-link__external-link-icon"></i></a>
)

export default ExternalLink
