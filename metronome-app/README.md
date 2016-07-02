# metronome-app

Generates the metronome.js app included in the CPF site at /site/assets/js/metronome.js

## Build

```javascript
npm install //install dependencies of this app
npm install -g browserify //install browserify for bundling
npm run-script build //uses browserify to bundle app.js into /site/assets/js/metronome.js
```

Note that the generated *metronome.js* file is checked into version control!