import React from 'react'
import PageTemplate from '../PageTemplate'

const Error = props => (
  <PageTemplate>
    <h1 className="cpf-header">Not Found</h1>
    <p>Oh no! What you're looking for is not here. Maybe you followed an old link.</p>
    <p>Try using the navigation above to find what you were after...</p>
    <p id="redirect-suggestion"></p>
    <script dangerouslySetInnerHTML={{ __html: staticJs }}></script>
  </PageTemplate>
)

const staticJs = `
const contains = path => tests => !!tests.filter(function(t) { return path.indexOf(t) != -1 }).length

function lookingFor(href) {
  var urlContains = contains(href.toLowerCase());
  var suggestedName;
  var suggestHref;
  switch (true) {
    case urlContains(['carson', 'brent', 'kilc', 'socco', 'chico', 'music']):
      suggestHref = 'index.html#music'
      suggestedName = 'music'
      break;
    case urlContains(['device', 'kmk', 'metro', 'midi', 'miniak', 'modulo', 'push', 'snap', 'soft', 'where']):
      suggestHref = 'index.html#software'
      suggestedName = 'software'
      break;
    case urlContains(['cont']):
      suggestHref = 'index.html#contact'
      suggestedName = 'contact'
      break;
  }
  if (suggestHref) {
    document.getElementById('redirect-suggestion').innerHTML = '...or were looking for <a class="cpf-link" href="' + suggestHref + '">' + suggestedName + '</a>?';
  }
}

window.addEventListener('load', function () {
  lookingFor(window.location.href);
})`

export default Error
