const contains = path => test => path.indexOf(test) != -1

function redirectIfNotErrorPage(path) {
  if (!path.endsWith('error.html')) {
    window.location.replace(`http://localhost:8000/error.html?search=${encodeURIComponent(path)}`);
    return true
  }
  return false
}

function lookingFor(href) {
  var urlContains = contains(href.toLowerCase());
  var suggestedName;
  var suggestHref;
  switch (true) {
    case urlContains('carson'):
    case urlContains('brent'):
    case urlContains('kilclinton'):
    case urlContains('socco'):
    case urlContains('chico'):
    case urlContains('music'):
    case urlContains('thing'):
      suggestHref = 'music.html'
      suggestedName = 'music'
      break;
    case urlContains('midi'):
    case urlContains('miniak'):
    case urlContains('where'):
    case urlContains('snapshot'):
    case urlContains('modulo'):
    case urlContains('software'):
    case urlContains('kmk'):
      suggestHref = 'software.html'
      suggestedName = 'software'
      break;
    case urlContains('contact'):
      suggestHref = 'contact.html'
      suggestedName = 'contact'
      break;
  }
    if (suggestHref) {
      document.getElementById('redirect-suggestion').innerHTML = `...or were looking for <a href="https://chippanfire.com/${suggestHref}">${suggestedName}</a>?`;
    }
}

window.addEventListener('load', function () {
  redirectIfNotErrorPage(window.location.pathname) || lookingFor(window.location.href);
})
