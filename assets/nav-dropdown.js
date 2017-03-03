window.onclick = event => {
  if (!event.target.matches('.dropdown-toggle')) {
    [].forEach.call(document.getElementsByClassName('dropdown'), dropdown => {
      dropdown.classList.remove('open')
    })
  }
}
