import React from 'react'

const SectionHeader = ({ id, label }) => (
  <h1 className="cpf-header" id={id || ''}>{label}</h1>
)

export default SectionHeader
