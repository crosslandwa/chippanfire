# metronome-app

Generates the metronome.js app included in the CPF site at /site/assets/js/metronome.js

## Buil

```
npm install #install dependencies
npm run-script build #uses browesrify to bundle app.js into /site/assets/js/metronome.js
```

## Deploy
Upload the entire contents of the /site folder to your favourite host and point a DNS record at index.html

Note that cache-headers for the (static) content will need to be configured on the server...