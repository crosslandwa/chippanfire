<?php

// Super strict, fail on warning
error_reporting(E_ALL);
ini_set('display_errors', 1);
function exception_error_handler($errno, $errstr, $errfile, $errline ) {
    throw new ErrorException($errstr, $errno, 0, $errfile, $errline);
}
set_error_handler("exception_error_handler");

// interfaces
include 'src/Linkable.php';
include 'src/Page.php';

// classes
include 'src/ExternalPage.php';
include 'src/Header.php';
include 'src/InternalPage.php';
include 'src/Link.php';
include 'src/Navigation.php';
include 'src/PageFactory.php';
include 'src/SimpleContent.php';
include 'src/Site.php';
include 'src/SoftwareContent.php';
include 'src/SoftwareHomeContent.php';


$site = Site::create();
$site->clearLastBuild();
$site->render();
