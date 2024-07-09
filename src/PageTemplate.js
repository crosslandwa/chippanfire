import React from 'react'

const NavItem = ({ a, label }) => <a className="cpf-link cpf-header-nav__item" href={a}>{label}</a>

const PageTemplate = ({ children }) => (
  <React.Fragment>
    <nav className="cpf-header-nav">
      <div className="cpf-container">
        <a className="cpf-link cpf-header-nav__item cpf-header-nav__item--lead" href="index.html">
          <img className="cpf-header-nav__item-image" src="cpf_logo.png" alt="ChipPanFire" />
        </a>
        <NavItem a="index.html#music" label="Music" />
        <NavItem a="index.html#software" label="Software" />
        <NavItem a="index.html#contact" label="Contact" />
      </div>
    </nav>
    <div className="cpf-container">
      {children}
    </div>
    <footer className="cpf-footer">
      <div className="cpf-container">
        <p>ChipPanFire</p>
      </div>
    </footer>
  </React.Fragment>
)

export default PageTemplate
