
function lookingFor(path) {
    var suggestedName;
    var suggestHref;
    switch (true) {
        case path.indexOf('carsonbrent') != -1:
        case path.indexOf('kilclinton') != -1:
        case path.indexOf('soccochico') != -1:
        case path.indexOf('music') != -1:
            suggestHref = 'music.html'
            suggestedName = 'music'
            break;
        case path.indexOf('software') != -1:
            suggestHref = 'software.html'
            suggestedName = 'software'
            break;
        case path.indexOf('contact') != -1:
            suggestHref = 'contact.html'
            suggestedName = 'contact'
            break;
    }
    if (suggestHref) {
        document.getElementById("redirect-suggestion").innerHTML = '...or perhaps you were looking for <a href="https://chippanfire.com/' + suggestHref + '">' + suggestedName + '</a>?';
    }
}

window.addEventListener('load', function () {
    lookingFor(window.location.pathname);
})
