# chippanfire

Generation of the (static) chippanfire site

## Why
I wanted to make my own static site to learn a bunch of things

**Generation 4**
- HTML generation as per Generation 3
- Deployed to Github pages (using Github Action)

**Generation 3**
- Uses [React](https://reactjs.org/) as a templating langauge for the HTML generation
  - Transpiling JSX code to vanilla javascript via [Babel](https://babeljs.io/)
- All styling done via custom CSS following [BEM](http://getbem.com/) conventions
- Hosting continues to be via AWS S3/Cloudfront

**Generation 2**
- uses [EJS](https://ejs.co/) to templates to render static HTML
- uses Bootstrap for styling
- bundling/transpiling assets as part of build to target a variety browsers via Webpack
- hosting static sites on AWS S3, using AWS Cloudfront and Letsencrypt to serve the site over HTTPS

**Generation 1**
- PHP used to generate HTML from template files
- uses Bootstrap for styling

## Build

The site's static HTML is generated in two phases:
1. Babel is used to transpile the code in the `/src` directory
    - React is used as a templating language to generate HTML, which is pushed into the `/dist` directory
1. Static assets are included in the build
    - A bash command is used to find/copy assets into the `/dist` directory

```bash
npm run build
# or
npm run watch #automatically re-build whenever changes are made to /src
```

## Run
To see the (locally) built site, start the dev webserver:
```bash
npm run dev-webserver # requires python to be installed on your system
```

Then navigate in your browser to http://localhost:8000/

## Linting

```bash
npm run lint
```

Linting is done with [ESLint](https://eslint.org/) and is configured to conform code to https://standardjs.com/

### Deployment

This site is hosted on [Github Pages](https://crosslandwa.github.io/chippanfire). Deployment happens on commit to the `main` branch via a Github Action
