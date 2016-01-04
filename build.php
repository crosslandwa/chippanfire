<?php

// Super strict, fail on warning
error_reporting(E_ALL);
ini_set('display_errors', 1);
function exception_error_handler($errno, $errstr, $errfile, $errline ) {
    throw new ErrorException($errstr, $errno, 0, $errfile, $errline);
}
set_error_handler("exception_error_handler");

// Remove HTML pages from previous build
$oldFiles = glob('site/*.html');
foreach ($oldFiles as $oldFile) {
    if (is_file($oldFile)) {
        unlink($oldFile);
    }
}

include 'src/Header.php';
include 'src/Navigation.php';
include 'src/Page.php';
include 'src/Site.php';

$softwarePage = new Page('Software', 'software.html', 'template/content-software.phtml');

$dsmPage = new Page('Device Snapshot Manager', 'software-m4l-device-snapshot-manager.html', 'template/content-devicesnapshotmanager.phtml');

$pages = array(
	new Page('ChipPanFire', 'index.html', 'template/content-homepage.phtml'),
	new Page('Music', 'music.html', 'template/content-music.phtml'),
	$softwarePage,
	$dsmPage,
	new Page('Contact', 'contact.html', 'template/content-contact.phtml')
);

$site = new Site($pages);
$site->render();
