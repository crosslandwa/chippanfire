# metronome-app

The metronome.js app included in the CPF site

## Build

```javascript
npm install //install dependencies of this app - MUST be run for the main site webpack build to work
```

Interesting things:
- the webpack build transpiles *app.js* (and the node_modules it requires) into ES5!
  - this replaces me needed to manually transpile (previoudly done with babel to build app.js -> metronome.js)
