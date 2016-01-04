<?php

// Super strict, fail on warning
error_reporting(E_ALL);
ini_set('display_errors', 1);
function exception_error_handler($errno, $errstr, $errfile, $errline ) {
    throw new ErrorException($errstr, $errno, 0, $errfile, $errline);
}
set_error_handler("exception_error_handler");

include 'src/Header.php';
include 'src/Navigation.php';
include 'src/Page.php';
include 'src/Site.php';

$software = new Page('Software', 'software.html', 'content-software.phtml');
$dsm = new Page('Device Snapshot Manager', 'software-m4l-device-snapshot-manager.html', 'content-devicesnapshotmanager.phtml');
$home = new Page('ChipPanFire', 'index.html', 'content-homepage.phtml');
$music = new Page('Music', 'music.html', 'content-music.phtml');
$contact = new Page('Contact', 'contact.html', 'content-contact.phtml');

$allPages = array($home, $music, $software, $dsm, $contact);
$navPages = array($home, $music, $software, $contact);

$site = new Site($allPages, new Navigation($navPages));
$site->clearLastBuild();
$site->render();
