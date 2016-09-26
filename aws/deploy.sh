#!/bin/bash

# HTML pages (24 hours cache) - changes published within 24 hours (can manually invalidate)
aws s3 sync ../site s3://chippanfire.com/ --delete --exclude "*" --include "*.html" --cache-control max-age=86400

# everything else (1 year cache)
aws s3 sync ../site s3://chippanfire.com/ --delete --cache-control max-age=31536000