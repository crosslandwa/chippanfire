#!/bin/bash

aws s3 sync . s3://chippanfire.com/ --delete --cache-control max-age=300

#aws s3 sync . s3://chippanfire.com/ --exclude "*" --include "*.json" --include "*.xml" --grants read=uri=http://acs.amazonaws.com/groups/global/AllUsers --cache-control max-age=30